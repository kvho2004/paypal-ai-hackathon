import { getTransactionSearch } from "./client";
import { normalizeMerchant } from "./merchants";

export interface NormalizedPurchase {
  paypalTxnId: string;
  merchantRaw: string;
  programId: string | null;
  amountCents: number;
  at: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_DAYS = 31; // Transaction Search hard limit per call
const PAGE_SIZE = 100;

/** "-8.50" -> 850. Purchases are outflows, so we store the absolute value. */
function toCents(value: string | undefined): number {
  return Math.abs(Math.round(parseFloat(value ?? "0") * 100));
}

/**
 * Fetch transactions between two dates, splitting into <=31-day windows and
 * paging through each. Note: Transaction Search only sees the account that owns
 * the REST app credentials, and new transactions can take up to ~3 hours to appear.
 */
export async function fetchTransactions(
  start: Date,
  end: Date,
): Promise<NormalizedPurchase[]> {
  const api = getTransactionSearch();
  const out: NormalizedPurchase[] = [];

  for (let from = start.getTime(); from < end.getTime(); ) {
    const to = Math.min(from + MAX_WINDOW_DAYS * DAY_MS, end.getTime());

    let page = 1;
    let totalPages = 1;
    do {
      const { result } = await api.searchTransactions({
        startDate: new Date(from).toISOString(),
        endDate: new Date(to).toISOString(),
        fields: "all",
        pageSize: PAGE_SIZE,
        page,
      });
      totalPages = result.totalPages ?? 1;

      for (const d of result.transactionDetails ?? []) {
        const info = d.transactionInfo;
        if (!info?.transactionId || !info.transactionInitiationDate) continue;
        // Skip positive amounts (money received); keep outflows as purchases.
        const value = info.transactionAmount?.value;
        if (value === undefined || parseFloat(value) >= 0) continue;

        // Seeded payouts carry the merchant name in the note; fall back to other fields.
        // Which field PayPal populates depends on the transaction type, so verify with real data.
        const merchantRaw =
          info.transactionNote ??
          info.transactionSubject ??
          d.payerInfo?.payerName?.alternateFullName ??
          d.payerInfo?.emailAddress;
        // No merchant info means a non-purchase line, e.g. a payout batch total (T1503).
        if (!merchantRaw) continue;

        out.push({
          paypalTxnId: info.transactionId,
          merchantRaw,
          programId: normalizeMerchant(merchantRaw),
          amountCents: toCents(value),
          at: new Date(info.transactionInitiationDate),
        });
      }
      page += 1;
    } while (page <= totalPages);

    from = to;
  }
  return out;
}

export async function fetchRecentTransactions(days: number) {
  const end = new Date();
  return fetchTransactions(new Date(end.getTime() - days * DAY_MS), end);
}

export interface PurchaseSummaryRow {
  programId: string | null;
  merchant: string;
  visits: number;
  totalCents: number;
}

/** Spend and visits grouped by restaurant. This is the shape for the `getPurchaseSummary` agent tool. */
export function summarize(purchases: NormalizedPurchase[]): PurchaseSummaryRow[] {
  const byMerchant = new Map<string, PurchaseSummaryRow>();
  for (const p of purchases) {
    const key = p.programId ?? p.merchantRaw;
    const row = byMerchant.get(key) ?? {
      programId: p.programId,
      merchant: p.programId ?? p.merchantRaw,
      visits: 0,
      totalCents: 0,
    };
    row.visits += 1;
    row.totalCents += p.amountCents;
    byMerchant.set(key, row);
  }
  return [...byMerchant.values()].sort((a, b) => b.totalCents - a.totalCents);
}
