import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth/server";
import { capturePayPalOrder } from "../../../../lib/paypal/orders";

export const dynamic = "force-dynamic";

/** POST { orderId } -> { purchaseId, paypalTxnId, programId, amountCents }, saved to the signed-in student */
export async function POST(req: Request) {
  // Middleware already requires a session; checked again here because this route moves money.
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { orderId?: unknown } | null;
  if (!body || typeof body.orderId !== "string" || !body.orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await capturePayPalOrder(body.orderId, userId));
  } catch (err) {
    console.error("capture-order failed:", err);
    return NextResponse.json({ error: "Could not capture the PayPal order" }, { status: 502 });
  }
}
