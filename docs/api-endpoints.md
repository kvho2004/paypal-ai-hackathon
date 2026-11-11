# Krumms API endpoints (for the Postman collection)

Base URL: `https://krumms-web.onrender.com` (hosted) or `http://localhost:3000` (local).

Everything here was checked against the code on `main` on Wed Nov 11. Section 3 lists routes that are planned but **not built yet**; do not add those to the collection until they land.

## How sign-in works in Postman

Every route except `/api/auth/*` needs a signed-in student. Signing in sets a cookie named `krumms_session`, and Postman keeps cookies automatically, so:

1. Run **Sign in** first.
2. Run the other requests in the same Postman session.

Without the cookie, API routes answer `401 {"error":"Sign in required"}`.

Use Postman environment variables for `baseUrl`, `email` and `password`. The demo login is shown on the hosted `/login` page. Do not save real passwords in a public collection.

## 1. Auth

### Sign in
`POST {{baseUrl}}/api/auth/login`

Body (JSON):
```json
{ "email": "{{email}}", "password": "{{password}}" }
```

| Status | Body | Meaning |
|---|---|---|
| 200 | `{"ok":true,"name":"Demo Student"}` | Signed in; the session cookie is set (lasts 7 days) |
| 400 | `{"error":"Email and password are required"}` | Body is missing a field |
| 401 | `{"error":"Incorrect email or password"}` | Same message for a wrong password and an unknown email |
| 429 | `{"error":"Too many attempts. Try again in a few minutes."}` | 5 failed tries for that email within 10 minutes |
| 503 | `{"error":"Sign-in is not configured on this server"}` | The server has no `SESSION_SECRET` |

### Sign out
`POST {{baseUrl}}/api/auth/logout` (no body)

Returns `200 {"ok":true}` and clears the cookie.

## 2. PayPal checkout (sandbox)

Both routes need the session cookie. Payments go to the fictional **Demo Diner** sandbox account. No real money moves.

### Create an order
`POST {{baseUrl}}/api/paypal/create-order`

Body (JSON):
```json
{ "programId": "demo-diner", "item": "Veggie wrap", "amountCents": 825 }
```

Rules: `programId` must be `"demo-diner"`, `item` is 1 to 127 characters, and `amountCents` is a whole number from 1 to 5000 (a $50 sandbox cap).

| Status | Body | Meaning |
|---|---|---|
| 200 | `{"orderId":"8S6104326P519363W","approvalUrl":"https://www.sandbox.paypal.com/checkoutnow?token=..."}` | Order created; not paid yet |
| 400 | `{"error":"programId must be \"demo-diner\""}` (or a message about `item` / `amountCents`) | Invalid input |
| 401 | `{"error":"Sign in required"}` | No session cookie |
| 502 | `{"error":"Could not create the PayPal order"}` | PayPal rejected the request |

The buyer must approve the order before it can be captured. In the app this happens in the PayPal popup. In Postman, open `approvalUrl` in a browser and approve as the student sandbox account. Note: that page may keep loading after approval because the order has no return URL; the approval still registers.

### Capture an order
`POST {{baseUrl}}/api/paypal/capture-order`

Body (JSON):
```json
{ "orderId": "8S6104326P519363W" }
```

| Status | Body | Meaning |
|---|---|---|
| 200 | `{"purchaseId":"185365c1-...","paypalTxnId":"2XD027125L336991N","programId":"demo-diner","amountCents":825}` | Payment captured and saved to the signed-in student's purchases |
| 400 | `{"error":"orderId is required"}` | Missing `orderId` |
| 401 | `{"error":"Sign in required"}` | No session cookie |
| 502 | `{"error":"Could not capture the PayPal order"}` | Usually the order has not been approved yet |

Calling capture twice for the same order is safe: the second call returns the same purchase and does not charge again.

## 3. Planned, not on `main` yet (contract from `dev2-dev1-team-split.md`)

Do not add these until Dev 2 confirms they are merged. Shapes may still change.

| Route | Purpose |
|---|---|
| `POST /api/chat` | The chat agent |
| `POST /api/connect/[program]` | Start connecting a rewards account; returns `{ connectionId, hostedUrl }` |
| `GET /api/connect/[program]?connectionId=` | Connection status: `{ status: "PENDING" \| "ACTIVE" \| "NEEDS_AUTH", error }` |
| `POST /api/rewards/refresh` | Read the rewards balance; streams one JSON object per line |
| `POST /api/paypal/webhook` | PayPal `PAYMENT.CAPTURE.COMPLETED` webhook (backup path; may be cut) |

## 4. PayPal sandbox calls the server makes

For a "PayPal sandbox" folder in the collection. All use `https://api-m.sandbox.paypal.com` and need sandbox app credentials, which are **not** in the repo. Use placeholders such as `{{paypalClientId}}`.

| Call | Used for | App that makes it |
|---|---|---|
| `POST /v1/oauth2/token` (`grant_type=client_credentials`, Basic auth with client id and secret) | Access token for every call below | Both |
| `GET /v1/reporting/transactions?start_date=&end_date=&fields=all` | Transaction Search: the student's purchase history (31-day window per call; new transactions can take up to 3 hours to appear) | Student app |
| `POST /v1/payments/payouts` | Seeding the 12 demo purchases (`scripts/seed-sandbox.ts`) | Student app |
| `POST /v2/checkout/orders` | Create an order paid to Demo Diner | Demo Diner app |
| `POST /v2/checkout/orders/{id}/capture` | Capture an approved order | Demo Diner app |
| `GET /v2/checkout/orders/{id}` | Read an order that was already captured | Demo Diner app |

Why two apps: a PayPal app can only act as the account that owns it. The student app reads the student's history; the Demo Diner app takes payments. See `docs/checkout.md`.

## Pages (for reference, not API)

`/login`, `/purchases`, `/rewards`, `/checkout-demo`, `/chat` and `/connect` (both placeholders today), and `/demo-diner/*` (the fictional restaurant site, public).
