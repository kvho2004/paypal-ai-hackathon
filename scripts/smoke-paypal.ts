import "dotenv/config";
import { fetchRecentTransactions, summarize } from "../lib/paypal/transactions";

/**
 * Verifies sandbox credentials and the Transaction Search scope.
 * Usage: npx tsx scripts/smoke-paypal.ts [days=30]
 */
async function main() {
  const days = Number(process.argv[2] ?? 30);
  console.log(`Fetching the last ${days} days of transactions (${process.env.PAYPAL_ENVIRONMENT ?? "SANDBOX"})...`);

  const purchases = await fetchRecentTransactions(days);
  console.log(`Found ${purchases.length} outgoing transactions.\n`);

  for (const p of purchases.slice(0, 10)) {
    console.log(
      `${p.at.toISOString().slice(0, 10)}  $${(p.amountCents / 100).toFixed(2).padStart(7)}  ${p.merchantRaw}  -> ${p.programId ?? "(no program)"}`,
    );
  }

  console.log("\nSummary by restaurant:");
  console.table(summarize(purchases));
}

main().catch((err) => {
  console.error("Smoke test failed:", err?.message ?? err);
  if (err?.statusCode === 403 || err?.statusCode === 401) {
    console.error(
      "Hint: enable Transaction Search on the REST app in the PayPal Developer Dashboard (the scope can take hours to apply).",
    );
  }
  process.exit(1);
});
