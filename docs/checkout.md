# Checkout design: accounts, apps and tool shapes

Decision (Mon Nov 9): the student pays a **separate Demo Diner Business account**. Orders v2 pays whichever account owns the app that creates the order, so checkout uses a **second PayPal REST app under the Demo Diner account**. Two apps is intentional: one per role.

## Why there are several accounts

Everything here is PayPal's sandbox, so these are fake people and businesses. A payment has two sides, and the demo needs both to be real.

| Account | Plays | Why it's needed |
|---|---|---|
| **Student** (`LE8E8NPMYHUPE`) | The Krumms user | Krumms reads this account's PayPal history to learn where they eat (Transaction Search). It is also the buyer who approves checkout. |
| **Demo Diner** (new Business account) | The restaurant | Someone has to receive the money. It makes the demo visible: money moves from the student to Demo Diner, and the purchase shows up in the student's history. |
| **Personal** (`sb-gq0fa...@personal.example.com`) | Nothing in the story | Only received the 12 seed payouts so the student account had past purchases. It never appears on screen. |

### Why two apps

A PayPal "app" is API credentials tied to **one** account, and it can only act as that account:

- The app under the student account reads the student's history. This is the existing app.
- Only an app under Demo Diner can charge as Demo Diner, which is what creating and capturing an order means. This is the new app.

### Why not one account for everything

The student would be paying themselves. Money would not really move, and the payment would not appear as a purchase in their history, which breaks the "pay, then the progress bar jumps" moment in the video.

### Real world vs. sandbox

In production Krumms would own neither account. Reading a student's history needs PayPal partner access, and each restaurant would have its own PayPal. In the sandbox we play both roles ourselves. The README should say this honestly.

## Accounts and apps

| Role | Sandbox account | REST app | Env vars | Used for |
|---|---|---|---|---|
| **Student (payer)** | `LE8E8NPMYHUPE` | existing app | `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | Transaction Search, seeding payouts, and the buyer login at approval |
| **Demo Diner (payee)** | new Business account | new Merchant app | `PAYPAL_MERCHANT_CLIENT_ID` / `PAYPAL_MERCHANT_CLIENT_SECRET` | Creating and capturing orders. The webhook `PAYMENT.CAPTURE.COMPLETED` is registered on **this** app |

## Flow

1. Agent proposes a meal; the approval card shows item, price and reward impact (Dev 2).
2. On approve, the server calls `createPayPalOrder` using the **Demo Diner app**. The order's payee is Demo Diner.
3. The browser opens the PayPal approval popup (PayPal JS SDK). The buyer logs in as the **student sandbox account** and approves.
4. The server calls `capturePayPalOrder(orderId)` (Demo Diner app). It captures the payment and **writes the `Purchase` row directly**, with `paypalTxnId` = the capture id.
5. The webhook `PAYMENT.CAPTURE.COMPLETED` (Wednesday, backup path) upserts the same row, so a missed capture response still lands.

## Tool shapes (contract with Dev 2)

```ts
createPayPalOrder(input: {
  programId: string;     // "demo-diner"
  item: string;          // "Veggie wrap"
  amountCents: number;   // 825
}): Promise<{ orderId: string; approvalUrl: string }>;

capturePayPalOrder(orderId: string): Promise<{
  purchaseId: string;
  paypalTxnId: string;
  programId: string;
  amountCents: number;
}>;
```

Amounts are integer cents in our code; convert to a `"8.25"` string only when talking to PayPal. Sandbox only: never default to production.

## Setup checklist (one-time, PayPal Developer Dashboard, about 10 minutes)

1. Testing tools > Sandbox accounts: create a **Business** account named "Demo Diner".
2. Apps & Credentials: create a **Merchant** app attached to the Demo Diner account, with checkout/payments features enabled.
3. Copy its client ID and secret into the password manager, then into `.env` and the Render dashboard (`krumms-web`) as `PAYPAL_MERCHANT_CLIENT_ID` / `PAYPAL_MERCHANT_CLIENT_SECRET`.
4. Note the **student account's sandbox login** (email + password) so the approval popup can be completed on camera.

## To verify on the first real checkout (unconfirmed)

- The student account appears as payer, and the payment shows in Transaction Search as an outgoing entry.
- The capture id on the Demo Diner side matches the transaction id on the student side. If it does, `ingestFromPayPal` upserts the same `Purchase` row. If not, ingestion would double count, and we filter checkout payments out of ingestion instead.
- The student account has enough balance (it started at $5,000; the seed payouts used about $105).
