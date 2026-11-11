import "dotenv/config";
import { db } from "../lib/db";
import { DEMO_USER_ID, ingestFromPayPal } from "../lib/purchases";

/**
 * Restore the demo user to the exact "before the demo" state, so every filming take
 * and every judge run starts identical:
 *   - demo user exists with empty preferences
 *   - rewards connections, balances and actions are cleared (so "connect rewards" can be shown live)
 *   - purchases are re-ingested from PayPal Transaction Search (the 12 seeded sandbox payments)
 *
 * Only rows belonging to the demo user are touched. Requires DEMO_MODE=true.
 *
 * Usage: npx tsx scripts/reset-demo.ts
 */
async function counts() {
  const connections = await db.connection.findMany({
    where: { userId: DEMO_USER_ID },
    select: { id: true },
  });
  return {
    purchases: await db.purchase.count({ where: { userId: DEMO_USER_ID } }),
    connections: connections.length,
    balances: await db.balance.count({
      where: { connectionId: { in: connections.map((c) => c.id) } },
    }),
    actions: await db.action.count({ where: { userId: DEMO_USER_ID } }),
  };
}

async function main() {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error("Refusing to reset: set DEMO_MODE=true to confirm this is the demo database.");
  }

  console.log("Before:", await counts());

  const connections = await db.connection.findMany({
    where: { userId: DEMO_USER_ID },
    select: { id: true },
  });

  // Delete children first, then the rows that reference them.
  await db.$transaction([
    db.balance.deleteMany({ where: { connectionId: { in: connections.map((c) => c.id) } } }),
    db.connection.deleteMany({ where: { userId: DEMO_USER_ID } }),
    db.action.deleteMany({ where: { userId: DEMO_USER_ID } }),
    db.purchase.deleteMany({ where: { userId: DEMO_USER_ID } }),
    db.user.upsert({
      where: { id: DEMO_USER_ID },
      create: {
        id: DEMO_USER_ID,
        name: "Demo Student",
        paypalSandboxEmail: process.env.SEED_RECIPIENT_EMAIL ?? null,
        prefs: {},
      },
      update: { prefs: {} },
    }),
  ]);

  const ingest = await ingestFromPayPal(DEMO_USER_ID, 30);
  console.log("Re-ingested from PayPal:", ingest);
  console.log("After: ", await counts());
}

main()
  .catch((e) => {
    console.error("reset-demo failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
