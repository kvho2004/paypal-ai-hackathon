import "dotenv/config";
import { db } from "../lib/db";
import { getAdapter } from "../lib/rewards/adapters";
import { listCatalogs } from "../lib/scoring/catalog";

/**
 * Writes data/catalog/*.json to the database: one Program row per catalog and one CatalogItem row per item.
 * getRewardRows joins CatalogItem to the extracted rewards by name (cents per point, best/poor flags), and
 * Program.earnRate drives pending points. Without these rows both are empty.
 *
 * Safe to rerun: rows are keyed by program and item name, and items removed from the JSON are deleted.
 * Run it after scripts/reset-demo.ts (which leaves Program and CatalogItem alone) and after every catalog edit.
 *
 * Usage: npx tsx scripts/seed-catalog.ts
 */
async function main() {
  for (const catalog of listCatalogs()) {
    // The catalog has no domain; it comes from the rewards adapter (what Kernel logs in to).
    const adapter = getAdapter(catalog.programId);
    if (!adapter) throw new Error(`No rewards adapter for catalog "${catalog.programId}"`);

    const items = catalog.items.map((item) => ({
      id: `${catalog.programId}:${item.name}`,
      programId: catalog.programId,
      rewardName: item.name,
      menuPriceCents: item.menuPriceCents,
      pointCost: item.pointCost,
    }));

    await db.$transaction([
      db.program.upsert({
        where: { id: catalog.programId },
        create: { id: catalog.programId, name: catalog.name, domain: adapter.domain, earnRate: catalog.earnRate },
        update: { name: catalog.name, domain: adapter.domain, earnRate: catalog.earnRate },
      }),
      db.catalogItem.deleteMany({ where: { programId: catalog.programId, id: { notIn: items.map((i) => i.id) } } }),
      ...items.map(({ id, ...data }) => db.catalogItem.upsert({ where: { id }, create: { id, ...data }, update: data })),
    ]);
    const rewards = items.filter((i) => i.pointCost !== null).length;
    console.log(
      `${catalog.programId}: ${items.length} items (${rewards} rewards, ${items.length - rewards} menu-only), earn rate ${catalog.earnRate}/$1`,
    );
  }
}

main()
  .catch((e) => {
    console.error("seed-catalog failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
