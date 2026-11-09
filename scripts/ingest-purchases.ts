import "dotenv/config";
import { db } from "../lib/db";
import {
  DEMO_USER_ID,
  SAMPLE_TXN_PREFIX,
  clearSamplePurchases,
  getPurchaseSummary,
  ingestFromPayPal,
  savePurchases,
} from "../lib/purchases";
import { normalizeMerchant } from "../lib/paypal/merchants";

/**
 * Usage:
 *   npx tsx scripts/ingest-purchases.ts [days=30]   pull from PayPal Transaction Search
 *   npx tsx scripts/ingest-purchases.ts --sample    insert fake rows to test without PayPal data
 *   npx tsx scripts/ingest-purchases.ts --clear-sample   remove the fake rows
 */
const SAMPLES: Array<[string, number]> = [
  ["Starbucks #4821", 645],
  ["Starbucks #4821", 575],
  ["Demo Diner", 950],
  ["Demo Diner", 825],
  ["Chipotle Online", 1085],
  ["Local Pizza Co", 1250],
];

async function main() {
  const arg = process.argv[2];

  if (arg === "--clear-sample") {
    console.log(`Removed ${await clearSamplePurchases()} sample rows.`);
    return;
  }

  if (arg === "--sample") {
    const now = Date.now();
    const result = await savePurchases(
      DEMO_USER_ID,
      SAMPLES.map(([merchantRaw, amountCents], i) => ({
        paypalTxnId: `${SAMPLE_TXN_PREFIX}${i}`,
        merchantRaw,
        programId: normalizeMerchant(merchantRaw),
        amountCents,
        at: new Date(now - i * 24 * 60 * 60 * 1000),
      })),
    );
    console.log("Sample ingest:", result);
  } else {
    const days = Number(arg ?? 30);
    console.log(`Ingesting the last ${days} days from PayPal...`);
    console.log("Ingest:", await ingestFromPayPal(DEMO_USER_ID, days));
  }

  console.log("\nSummary (last 30 days):");
  console.table(await getPurchaseSummary(DEMO_USER_ID, 30));
}

main()
  .catch((e) => {
    console.error("ingest failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
