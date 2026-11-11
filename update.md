# Dev 1 update for Justin (Producer) and Alanna (Dev 2)

Wed Nov 11, 4:45 PM. Deadline: Thu Nov 12, 3:00 PM EST. Full freeze tonight at 8 PM.

## Short version

- Everything Dev 1 owned in `dev2-dev1-team-split.md` is merged and live, except `seed-catalog.ts` and the home redirect, which are blocked on Dev 2's files.
- The chat agent, `lib/agent/types.ts`, the catalog, scoring and the `/connect` routes are **not on `main`**. Scenes 3 to 5 depend on them.
- Three lines in the video script do not match what the app can show. They need a decision today (see "Script").

Hosted site: https://krumms-web.onrender.com. Sign in with the demo login shown on the `/login` page.

## What is live now

| Page | What it does | Status |
|---|---|---|
| `/login` | Student sign-in. Every Krumms page and API route now needs it | Works |
| `/purchases` | PayPal purchase history by restaurant, with "Not enrolled" flags | Works, real sandbox data |
| `/rewards` | AG Grid of rewards ranked by value per point, punch-card progress, "+N pending" after a purchase | Works, but on **mock** balances until the connect flow is live |
| `/checkout-demo` | Pay Demo Diner through the real PayPal sandbox popup | Works, tested end to end |
| `/connect` | Connect flow UI (hosted login, live view, result) | UI done. Says "not available yet" until Dev 2's routes deploy |
| `/preview` | Scratch page: ranked grid, approval card, connect flow against a stub | Works. Sample data, not agent output |
| `/chat` | Placeholder | Waiting on Dev 2 |
| `/demo-diner/*` | The fictional restaurant site | Works, stays public |

The site also works on phones (bottom tab bar, card layouts).

## For Alanna (Dev 2)

**What I need from you, in order:**
1. `lib/agent/types.ts`. I built against the shapes in the split doc and copied them into `app/(krumms)/chat/agentTypes.ts`. When yours lands, I replace mine with a re-export. Tell me if any shape changed.
2. `data/catalog/demo-diner.json` and `lib/scoring/catalog.ts`. `seed-catalog.ts` is blocked on these.
3. The `/connect` routes (`POST` and `GET /api/connect/[program]`, `POST /api/rewards/refresh`). `ConnectFlow` already calls them with the contract from the split doc.
4. A time estimate for the chat agent, so Justin can plan filming.

**Ready for you to plug in** (all under `app/(krumms)/`):
- `chat/RankedGrid.tsx`: `<RankedGrid picks={RankedPick[]} onOrder={...} />` for meal picks, or `<RankedGrid rows={RewardRow[]} />` for reward rankings.
- `chat/ApprovalCard.tsx`: `<ApprovalCard request clientId onResult />`. It reports one final result: `paid`, `denied` or `failed`. `clientId` is `process.env.PAYPAL_MERCHANT_CLIENT_ID`, read on the server.
- `connect/ConnectFlow.tsx`: already rendered by `/connect`.
- Try all three on `/preview` before wiring them.

**Things that changed under you:**
- **Sign-in gates everything.** Your API routes must use the signed-in student, not `DEMO_USER_ID`: `getSessionUserId()` or `requireUser()` from `lib/auth/server`. Unauthenticated API calls get a 401. `/demo-diner/*` stays public so Kernel can read it.
- **`pendingPoints` is in `getRewardRows`** (`lib/views/rewards.ts`). `progress` and `pointsNeeded` now use balance plus pending. It needs `Program.earnRate`, which `seed-catalog` will set.
- **`User` has two new nullable columns**, `email` and `passwordHash` (migration `1_user_auth`, already applied to the shared database).
- **Checkout pays a separate Demo Diner sandbox account** through its own PayPal app. Details in `docs/checkout.md`.
- **Use the PayPal popup button for approval, not the raw approval link.** The link flow hangs after approval because the order has no return URL.
- `reset-demo` rebuilds purchases from the 12 seed payments only, so test checkouts never come back.

**Two questions:**
- Is `revert-12-dev2/demo-diner` intentional? It would delete the whole Demo Diner site. I have not touched it.
- Is the join scene (T10) in or out? The split doc says to cut it if undecided.

## For Justin (Producer)

**Ready for you:**
- `docs/api-endpoints.md`: the endpoint list for Postman, with request bodies and every status code. The routes marked "not built yet" should stay out of the collection for now.
- `docs/apimatic.md`: the APIMatic write-up. Please read it before it goes to judges (see "Script" below, last row).

**What you can film now:** `/purchases`, `/rewards` (mock balances, labelled "mock"), `/checkout-demo` (a real sandbox payment), and the phone layout.

**What you cannot film yet:** the chat (scene 4), the approval inside chat (scene 5), and the live connect (scene 3). These wait on Dev 2. If they do not land tonight, the fallback is to film those scenes from `/preview`, which uses sample data. The README would then have to say so.

**Before any take:**
- Ask me to run the demo reset. The database currently has test purchases and a test "+82 pending" on the rewards page.
- Load each page once first. The site is slow on its first request after sitting idle.
- Every merge to `main` restarts the site, so tell us when you are recording.

**Still needed from you:**
- The reward catalog numbers (the split doc says Alanna builds the JSON and you review the prices).
- Citations for the opening statistics (food insecurity, Pell Grants, unused loyalty points) for the README and Devpost text.
- The text of the official rules page: https://paypalaihackathon.devpost.com/rules. I could not open it. I need the demo/access requirement, sandbox vs. live, the video rules, and the deadline's time zone.

## Script: three mismatches to settle today

| Line in the script | What the app shows | Suggested fix |
|---|---|---|
| "I linked my PayPal" | There is no linking step. The app reads one sandbox account | Say "Krumms looked at my PayPal purchases" |
| A burrito place and a café, no real brand names on screen | The purchase data shows Starbucks, Chipotle and Panera, and the working restaurant is "Demo Diner" | Say "diner" in the demo lines. I can re-seed the purchases with fictional names only (about 1 hour) and add a café with weekly visits |
| "Built on PayPal's Agent Toolkit" | We do not use the Agent Toolkit. We use PayPal's Server SDK: Orders and Transaction Search | Say "PayPal's Orders API and transaction search" |
| "APIMatic" in the tools list | True: our PayPal SDK is APIMatic-generated. But the APIMatic Context Plugin describes a different SDK than ours, so it did not write our PayPal code | Keep the mention. For a stronger entry, someone runs one real plugin session and records it in `docs/apimatic.md` |

## Not done on my side

| Item | Why | Plan |
|---|---|---|
| `scripts/seed-catalog.ts` | Needs the catalog JSON and loader | 30 min once they land |
| Home redirect to `/chat` | Needs the chat | 5 min once it works |
| Fictional purchase data | Needs the script decision above | About 1 hour |
| Webhook, Zapier, worker and cron | On the cut list | Cut unless there is time after 6 PM; the README should call them roadmap |
| Remove or hide `/preview` | It makes real sandbox payments | Before judging |
| Render plan | Free tier is slow on a cold start | Decide before judging |

## How to reach a decision fast

Reply in the team chat with: Alanna's ETA for the agent, in or out for the join scene, and yes or no on each script fix.
