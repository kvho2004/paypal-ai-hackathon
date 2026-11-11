import "dotenv/config";
import { db } from "../lib/db";
import { capturePayPalOrder, createPayPalOrder } from "../lib/paypal/orders";

/**
 * Terminal test of the sandbox checkout, no UI needed.
 *
 *   npx tsx scripts/test-checkout.ts                 create an $8.25 order and print the approval link
 *   npx tsx scripts/test-checkout.ts capture <id>    capture an approved order and save the Purchase
 *
 * Open the approval link in a browser and log in as the STUDENT sandbox account to approve.
 */
async function main() {
  const [cmd, orderId] = process.argv.slice(2);

  if (cmd === "capture") {
    if (!orderId) throw new Error("Usage: test-checkout.ts capture <orderId>");
    const purchase = await capturePayPalOrder(orderId);
    console.log("Captured and saved:", purchase);
    return;
  }

  const order = await createPayPalOrder({ programId: "demo-diner", item: "Test meal", amountCents: 825 });
  console.log("Order created:", order.orderId);
  console.log("\n1. Open this link and approve as the student sandbox account:\n  ", order.approvalUrl);
  console.log(`\n2. Then run: npx tsx scripts/test-checkout.ts capture ${order.orderId}`);
}

main()
  .catch((e) => {
    console.error("test-checkout failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
