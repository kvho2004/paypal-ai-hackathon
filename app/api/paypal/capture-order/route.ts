import { NextResponse } from "next/server";
import { capturePayPalOrder } from "../../../../lib/paypal/orders";

export const dynamic = "force-dynamic";

/** POST { orderId } -> { purchaseId, paypalTxnId, programId, amountCents } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { orderId?: unknown } | null;
  if (!body || typeof body.orderId !== "string" || !body.orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await capturePayPalOrder(body.orderId));
  } catch (err) {
    console.error("capture-order failed:", err);
    return NextResponse.json({ error: "Could not capture the PayPal order" }, { status: 502 });
  }
}
