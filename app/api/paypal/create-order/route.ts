import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth/server";
import { CheckoutInputError, createPayPalOrder, validateOrderInput } from "../../../../lib/paypal/orders";

export const dynamic = "force-dynamic";

/** POST { programId, item, amountCents } -> { orderId, approvalUrl } */
export async function POST(req: Request) {
  // Middleware already requires a session; checked again here because this route moves money.
  if (!(await getSessionUserId())) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const input = validateOrderInput(await req.json().catch(() => null));
    return NextResponse.json(await createPayPalOrder(input));
  } catch (err) {
    if (err instanceof CheckoutInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("create-order failed:", err);
    return NextResponse.json({ error: "Could not create the PayPal order" }, { status: 502 });
  }
}
