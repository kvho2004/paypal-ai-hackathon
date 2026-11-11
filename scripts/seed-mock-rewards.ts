import "dotenv/config";
import { db } from "../lib/db";
import { DEMO_USER_ID } from "../lib/purchases";

/**
 * Inserts clearly-labelled MOCK rewards data for Demo Diner (a fictional program) so the
 * rewards grid can be built and filmed before the live Kernel pipeline lands.
 * Every row has a "mock-" id and the balance has source "mock". Real brands are not mocked:
 * we never invent point costs for programs that really exist.
 *
 *   npx tsx scripts/seed-mock-rewards.ts            insert (safe to rerun)
 *   npx tsx scripts/seed-mock-rewards.ts --clear    remove the mock rows
 */
const PROGRAM_ID = "demo-diner";
const CONN_ID = "mock-conn-demo-diner";
const BAL_ID = "mock-bal-demo-diner";

// name, point cost, typical menu price in cents
const REWARDS: Array<[string, number, number]> = [
  ["Free drink", 150, 350],
  ["Free fries", 200, 300],
  ["Free veggie wrap", 450, 825],
  ["Free chicken bowl", 600, 950],
  ["$5 off any order", 500, 500], // 1.0 cents per point: deliberately the weak redemption
];

async function clear() {
  const [b, c, i] = await db.$transaction([
    db.balance.deleteMany({ where: { id: { startsWith: "mock-" } } }),
    db.connection.deleteMany({ where: { id: { startsWith: "mock-" } } }),
    db.catalogItem.deleteMany({ where: { id: { startsWith: "mock-" } } }),
  ]);
  console.log(`Removed ${b.count} balance, ${c.count} connection, ${i.count} catalog rows.`);
}

async function main() {
  if (process.argv[2] === "--clear") return clear();

  await db.program.upsert({
    where: { id: PROGRAM_ID },
    create: { id: PROGRAM_ID, name: "Demo Diner", domain: "demo-diner.local", earnRate: 10 },
    update: {},
  });
  await db.connection.upsert({
    where: { id: CONN_ID },
    create: { id: CONN_ID, userId: DEMO_USER_ID, programId: PROGRAM_ID, kernelAuthId: "mock", status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });

  const rewards = REWARDS.map(([name, pointCost]) => ({ name, pointCost, expiresAt: null }));
  const data = {
    connectionId: CONN_ID,
    points: 380,
    rewards: { rewards, offers: [], tierProgress: null },
    fetchedAt: new Date(Date.now() - 2 * 60 * 1000), // "updated 2 min ago"
    source: "mock",
  };
  await db.balance.upsert({ where: { id: BAL_ID }, create: { id: BAL_ID, ...data }, update: data });

  for (const [name, pointCost, menuPriceCents] of REWARDS) {
    const id = `mock-cat-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const row = { programId: PROGRAM_ID, rewardName: name, menuPriceCents, pointCost };
    await db.catalogItem.upsert({ where: { id }, create: { id, ...row }, update: row });
  }
  console.log(`Seeded mock Demo Diner balance (${data.points} pts) with ${REWARDS.length} rewards.`);
}

main()
  .catch((e) => {
    console.error("seed-mock-rewards failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
