import "dotenv/config";

/**
 * Seeds the sandbox "student" account with food purchases so Transaction Search has data.
 *
 * Why Payouts: Transaction Search only reads the account that owns the REST app, so that
 * account plays the student. Orders v2 needs a buyer to approve each payment in a browser,
 * whereas Payouts sends money out in one server-side call. The merchant name goes in the
 * payout note. Limitation: all seeded transactions are dated "now" (sandbox can't backdate).
 *
 * Requirements:
 *   - "Payouts" enabled under the app's Features in the PayPal Developer Dashboard
 *   - SEED_RECIPIENT_EMAIL in .env: the email of another sandbox account (e.g. Demo Diner)
 *
 * Usage: npx tsx scripts/seed-sandbox.ts
 */
const BASE =
  process.env.PAYPAL_ENVIRONMENT === "PRODUCTION"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

if (BASE.includes("sandbox") === false) {
  throw new Error("Refusing to seed outside the sandbox.");
}

// [merchant name used in the note, amount in USD]
const PURCHASES: Array<[string, string]> = [
  ["Starbucks #4821", "6.45"],
  ["Starbucks #4821", "5.75"],
  ["Starbucks #1093", "7.20"],
  ["Starbucks #4821", "4.95"],
  ["Demo Diner", "9.50"],
  ["Demo Diner", "8.25"],
  ["Demo Diner", "11.00"],
  ["Chipotle Online", "10.85"],
  ["Chipotle Online", "9.95"],
  ["Panera Bread #512", "8.40"],
  ["Local Pizza Co", "12.50"],
  ["Campus Taqueria", "7.75"],
];

async function getToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  return (await res.json()).access_token;
}

async function main() {
  const receiver = process.env.SEED_RECIPIENT_EMAIL;
  if (!receiver) throw new Error("Set SEED_RECIPIENT_EMAIL in .env (another sandbox account's email).");

  const total = PURCHASES.reduce((s, [, a]) => s + parseFloat(a), 0);
  console.log(`Sending ${PURCHASES.length} sandbox payouts totalling $${total.toFixed(2)} to ${receiver}...`);

  const token = await getToken();
  const batchId = `krumms-seed-${Date.now()}`;
  const res = await fetch(`${BASE}/v1/payments/payouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: batchId,
        email_subject: "Krumms sandbox seed",
      },
      items: PURCHASES.map(([merchant, amount], i) => ({
        recipient_type: "EMAIL",
        receiver,
        amount: { value: amount, currency: "USD" },
        note: merchant,
        sender_item_id: `${batchId}-${i}`,
      })),
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Payout failed (${res.status}):`, body?.message ?? body?.name ?? body);
    if (res.status === 403 || res.status === 401) {
      console.error("Hint: enable 'Payouts' under the app's Features in the Developer Dashboard.");
    }
    process.exit(1);
  }
  console.log(`Created batch ${body.batch_header?.payout_batch_id} (${body.batch_header?.batch_status}).`);
  console.log("Transaction Search can take up to ~3 hours to show these. Then run: npx tsx scripts/smoke-paypal.ts");
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
