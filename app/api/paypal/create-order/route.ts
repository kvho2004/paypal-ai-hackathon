import { NextResponse } from "next/server";
import { CheckoutInputError, createPayPalOrder, validateOrderInput } from "../../../../lib/paypal/orders";

export const dynamic = "force-dynamic";

/** POST { programId, item, amountCents } -> { orderId, approvalUrl } */
export async function POST(req: Request) {
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
