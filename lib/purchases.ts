import { randomUUID } from "node:crypto";
import { db } from "./db";
import {
  fetchRecentTransactions,
  summarize,
  type NormalizedPurchase,
  type PurchaseSummaryRow,
} from "./paypal/transactions";

/** The single demo user the hosted demo runs as (see scripts/seed-db.ts). */
export const DEMO_USER_ID = "demo-user";

/** Prefix for fake rows made by `scripts/ingest-purchases.ts --sample`, so they can be cleared. */
export const SAMPLE_TXN_PREFIX = "SAMPLE-";

/**
 * Upsert purchases by PayPal transaction id, so running ingestion repeatedly is safe.
 * Returns how many rows were new vs. already present.
 */
export async function savePurchases(
  userId: string,
  purchases: NormalizedPurchase[],
): Promise<{ created: number; updated: number }> {
  const existing = await db.purchase.findMany({
    where: { paypalTxnId: { in: purchases.map((p) => p.paypalTxnId) } },
    select: { paypalTxnId: true },
  });
  const seen = new Set(existing.map((e) => e.paypalTxnId));

  for (const p of purchases) {
    const fields = {
      merchantRaw: p.merchantRaw,
      programId: p.programId,
      amountCents: p.amountCents,
      at: p.at,
    };
    await db.purchase.upsert({
      where: { paypalTxnId: p.paypalTxnId },
      create: { id: randomUUID(), userId, paypalTxnId: p.paypalTxnId, ...fields },
      update: fields,
    });
  }
  return {
    created: purchases.filter((p) => !seen.has(p.paypalTxnId)).length,
    updated: purchases.filter((p) => seen.has(p.paypalTxnId)).length,
  };
}

/** Pull the last `days` of PayPal transactions and store them for `userId`. */
export async function ingestFromPayPal(userId: string, days: number) {
  const purchases = await fetchRecentTransactions(days);
  return { fetched: purchases.length, ...(await savePurchases(userId, purchases)) };
}

/**
 * Spend and visits by restaurant over the last `days`, from the database.
 * This is what Dev 2's `getPurchaseSummary` agent tool should call.
 */
export async function getPurchaseSummary(
  userId: string,
  days: number,
): Promise<PurchaseSummaryRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.purchase.findMany({
    where: { userId, at: { gte: since } },
    orderBy: { at: "desc" },
  });
  return summarize(rows);
}

export async function clearSamplePurchases(): Promise<number> {
  const { count } = await db.purchase.deleteMany({
    where: { paypalTxnId: { startsWith: SAMPLE_TXN_PREFIX } },
  });
  return count;
}
