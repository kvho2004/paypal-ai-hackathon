import { ApiError, CheckoutPaymentIntent, type Order } from "@paypal/paypal-server-sdk";
import { getMerchantOrders } from "./client";
import { DEMO_USER_ID, savePurchases } from "../purchases";
import { db } from "../db";

/** Only Demo Diner can be paid in the sandbox: its app is the payee (docs/checkout.md). */
export const CHECKOUT_PROGRAM_ID = "demo-diner";
const MAX_AMOUNT_CENTS = 5000; // sandbox safety cap: $50

export interface CreateOrderInput {
  programId: string;
  item: string;
  amountCents: number;
}

export interface CreatedOrder {
  orderId: string;
  approvalUrl: string;
}

export interface CapturedPurchase {
  purchaseId: string;
  paypalTxnId: string;
  programId: string;
  amountCents: number;
}

/** Thrown for bad caller input, so API routes can answer 400 instead of 500. */
export class CheckoutInputError extends Error {}

/** PayPal API errors have an empty `message`; surface the HTTP status and PayPal's issue code instead. */
function explain(err: unknown): Error {
  if (err instanceof ApiError) {
    const r = err.result as { name?: string; details?: Array<{ issue?: string }> } | undefined;
    const issue = r?.details?.[0]?.issue ?? r?.name ?? "unknown";
    return new Error(`PayPal API ${err.statusCode}: ${issue}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export function validateOrderInput(input: unknown): CreateOrderInput {
  const i = input as Partial<CreateOrderInput> | null;
  if (!i || typeof i !== "object") throw new CheckoutInputError("Body must be a JSON object");
  if (i.programId !== CHECKOUT_PROGRAM_ID) {
    throw new CheckoutInputError(`programId must be "${CHECKOUT_PROGRAM_ID}"`);
  }
  if (typeof i.item !== "string" || !i.item.trim() || i.item.length > 127) {
    throw new CheckoutInputError("item must be a non-empty string up to 127 characters");
  }
  if (!Number.isInteger(i.amountCents) || i.amountCents! < 1 || i.amountCents! > MAX_AMOUNT_CENTS) {
    throw new CheckoutInputError(`amountCents must be an integer from 1 to ${MAX_AMOUNT_CENTS}`);
  }
  return { programId: i.programId, item: i.item.trim(), amountCents: i.amountCents! };
}

/** Create a sandbox order paid to Demo Diner. The buyer then approves it at `approvalUrl` (or via the JS SDK). */
export async function createPayPalOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { programId, item, amountCents } = validateOrderInput(input);
  const { result } = await getMerchantOrders()
    .createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            referenceId: programId,
            description: item,
            amount: { currencyCode: "USD", value: (amountCents / 100).toFixed(2) },
          },
        ],
      },
      prefer: "return=representation",
    })
    .catch((err) => {
      throw explain(err);
    });

  const approvalUrl = result.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!result.id || !approvalUrl) throw new Error("PayPal did not return an order id and approval link");
  return { orderId: result.id, approvalUrl };
}

function completedCapture(order: Order) {
  const unit = order.purchaseUnits?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture?.id || !capture.amount?.value) throw new Error("Order has no capture yet");
  if (capture.status !== "COMPLETED") {
    throw new Error(`Capture is ${capture.status ?? "in an unknown state"}, not COMPLETED`);
  }
  return {
    paypalTxnId: capture.id,
    programId: unit?.referenceId ?? CHECKOUT_PROGRAM_ID,
    amountCents: Math.round(parseFloat(capture.amount.value) * 100),
    at: capture.createTime ? new Date(capture.createTime) : new Date(),
  };
}

/**
 * Capture an approved order and record it as a Purchase for the demo user.
 * Safe to call twice: an already-captured order is read back and upserted by capture id.
 */
export async function capturePayPalOrder(orderId: string): Promise<CapturedPurchase> {
  const orders = getMerchantOrders();
  let order: Order;
  try {
    ({ result: order } = await orders.captureOrder({ id: orderId, prefer: "return=representation" }));
  } catch (err) {
    if (err instanceof ApiError && JSON.stringify(err.result ?? "").includes("ORDER_ALREADY_CAPTURED")) {
      ({ result: order } = await orders.getOrder({ id: orderId }));
    } else {
      throw explain(err);
    }
  }

  const c = completedCapture(order);
  await savePurchases(DEMO_USER_ID, [
    {
      paypalTxnId: c.paypalTxnId,
      merchantRaw: "Demo Diner",
      programId: c.programId,
      amountCents: c.amountCents,
      at: c.at,
    },
  ]);
  const row = await db.purchase.findUniqueOrThrow({ where: { paypalTxnId: c.paypalTxnId } });
  return {
    purchaseId: row.id,
    paypalTxnId: c.paypalTxnId,
    programId: c.programId,
    amountCents: c.amountCents,
  };
}
