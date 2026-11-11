# Krumms: Dev 1 + Dev 2 split for the remaining Tuesday work (revised Tue Nov 10, night)

Companion to `team-plan.md`. The detailed spec for each task is in `docs/plans/dev2-tuesday.md`; task numbers (T0–T11) below refer to that file. This doc covers **who** does what and **when**.

**What changed:** Dev 2's Tuesday work starts about a day late. Dev 1 takes the UI and payment pieces of it, on top of Dev 1's own Wednesday list. To make room, Dev 1's Wednesday items are ranked, and the low-value ones fall to the existing cut list.

## Ownership

Rule of thumb, as in `team-plan.md`:
- **Dev 2** owns what the agent thinks or reads: tools, scoring, prompt, Kernel.
- **Dev 1** owns money, demo state, and the components that render agent output.

| Task (dev2-tuesday.md) | Owner | Notes |
|---|---|---|
| T0 Leftovers | Dev 2 | Dev 1 reviews + merges PR #16 |
| T1 Catalog JSON + `lib/scoring/catalog.ts` | Dev 2 | With the Producer's numbers if they've landed |
| T1 `scripts/seed-catalog.ts` + add it to the demo reset routine | **Dev 1** | Demo state is Dev 1's |
| T2 Scoring (`suggestMeals`, `rankRedemptions`, `closeToEarning`) | Dev 2 | |
| T2 `pendingPoints` | **Dev 1** | Lives in `lib/views/rewards.ts` (see Contracts) |
| T3 Prefs | Dev 2 | |
| T4 Agent route | Dev 2 | Includes the `react` bump + `@ai-sdk/react` |
| T5 Chat UI | Dev 2 | Owns `Chat.tsx` and the code that renders each tool result |
| T6 Approval card + PayPal | **Dev 1** | `ApprovalCard.tsx`; Dev 2 connects it to the `requestApproval` tool |
| T7 `/connect` API routes + `onLiveView` in `refreshRewards` | Dev 2 | |
| T7 `/connect` page (`ConnectFlow.tsx`) | **Dev 1** | Built against the route contract below |
| T8 In-chat AG Grid | **Dev 1** | `RankedGrid.tsx`; Dev 2 connects it |
| T9 Prompt tuning + `test-agent.ts` | Dev 2 | |
| T10 `joinProgram` | Dev 2 | First to cut |
| T11 Hosted run | Both | Dev 1: deploy, reset, warm the URL. Dev 2: demo prompts → Producer |
| Home redirect `/purchases` → `/chat` | Dev 1 | After T5 works on the hosted URL |

**File ownership (to avoid merge conflicts):**
- **Dev 1:** `app/(krumms)/chat/{ApprovalCard,RankedGrid}.tsx`, `app/(krumms)/connect/ConnectFlow.tsx`, `lib/views/rewards.ts`, `scripts/seed-catalog.ts`.
- **Dev 2:** everything else under `app/(krumms)/chat/` and `app/(krumms)/connect/`, plus `app/api/chat`, `app/api/connect`, `app/api/rewards`, `lib/agent/`, `lib/scoring/`, `lib/rewards/`.

## Contracts (Dev 2 pushes `lib/agent/types.ts` first, within the first hour)

This lets Dev 1 build the components before the chat exists. Test them on a scratch page, or on `/checkout-demo` for the approval card.

```ts
// lib/agent/types.ts (Dev 2)
export interface RankedPick {
  programId: string; item: string; priceCents: number; score: number;
  reasons: string[]; pointsEarned: number; unlocks: string | null;
  offer: string | null; canCheckout: boolean;
}
export interface ApprovalRequest { programId: string; item: string; amountCents: number; rewardImpact: string }
export type ApprovalResult =
  | { status: "paid"; purchase: CapturedPurchase }   // from lib/paypal/orders.ts
  | { status: "denied" }
  | { status: "failed"; error: string };
```

**Components (Dev 1):**
- `<RankedGrid picks={RankedPick[]} onOrder={(pick) => void} />`
  - Compact grid; reuse the AG Grid setup and theme from `RewardsGrid.tsx`.
  - Show the "Order" button only when `canCheckout` is true.
- `<RankedGrid rows={RewardRow[]} />`, the `rankRedemptions` variant: the same component without the button.
- `<ApprovalCard request={ApprovalRequest} clientId={string} onResult={(r: ApprovalResult) => void} />`
  - Shows the item, the price, `rewardImpact`, and a visible **sandbox** label.
  - **Deny** → `onResult({ status: "denied" })`.
  - **Approve** → PayPal Buttons → `/api/paypal/create-order` → `/api/paypal/capture-order` → `onResult({ status: "paid", purchase })`.
  - The card handles every PayPal state on its own: popup closed, capture error.

**`pendingPoints` (Dev 1)**, in `lib/views/rewards.ts`:
- **Formula:** the sum of `floor(amountCents / 100 × Program.earnRate)` over the user's `Purchase` rows for that program dated after the latest `Balance.fetchedAt`.
- **New fields on `RewardRow`:**
  - `pendingPoints`
  - `progress` and `pointsNeeded`, both computed from `balance + pendingPoints`
- **Label:** "pending" in the UI, never "earned" (dev.md §6).
- **Why it matters:**
  - It's what makes the progress bar move after a payment.
  - Dev 2's `getRewards` / `rankRedemptions` / `suggestMeals` read it through `getRewardRows`, so there's one source of truth.
  - `earnRate` comes from the `Program` row that `seed-catalog` upserts.

**`/connect` routes (Dev 2) → `ConnectFlow.tsx` (Dev 1):**
- `POST /api/connect/[program]` → `{ connectionId, hostedUrl }`
- `GET /api/connect/[program]?connectionId=` → `{ status: "PENDING" | "ACTIVE" | "NEEDS_AUTH", error: string | null }`. Poll it every 2 s.
- `POST /api/rewards/refresh` with body `{ connectionId }` streams NDJSON, one object per line:
  - `{ step: "browser", liveViewUrl }`
  - `{ step: "extracting" }`
  - `{ step: "done", ok: true, points, rewards: number, fetchedAt }` or `{ step: "done", ok: false, status, error }`
- **UI:**
  - "Connect Demo Diner" opens `hostedUrl` in a new tab.
  - On `ACTIVE`, start the refresh and show the live view (an iframe, or a link if embedding is blocked) and the current step.
  - When done, show "620 pts, 9 rewards" and a link to `/rewards`.
- Until Dev 2's routes land, build against a stub that returns these shapes.

## Schedule

| When | Dev 1 | Dev 2 |
|---|---|---|
| **Tue night** | Review + merge PR #16. Then:<br>- `pendingPoints`<br>- `seed-catalog.ts` (once the catalog JSON is pushed)<br>- `RankedGrid`<br>- `ApprovalCard` | First hour: T0, `lib/agent/types.ts`, catalog JSON + loader (**unblocks Dev 1**). Then:<br>- T2 scoring<br>- T3 prefs<br>- T4 agent route |
| **Wed 10 AM check-in** | `RankedGrid`, `ApprovalCard`, `pendingPoints`, `seed-catalog` merged. Start `ConnectFlow` | T5 chat UI with the read tools on `main`. Connect Dev 1's components. Start T7 routes |
| **Wed noon** | **API endpoint list to the Producer for Postman** (team-plan.md). `ConnectFlow` done. Home redirect | T7 routes done. **Full story runs once end to end on the hosted URL** |
| **Wed noon to 3 PM** | Help fix integration bugs. `docs/apimatic.md` | T9 prompt tuning, `test-agent.ts` 3/3. Real replies + exact prompts → Producer |
| **Wed 3 PM** | **Demo freeze + go/no-go for scenes 3 to 5.** Run `reset-demo` + `seed-catalog`, warm the URL | Same go/no-go |
| **Wed 3 to 6 PM** | **Filming scenes 3 to 5. No merges to `main`** (a merge redeploys Render mid-take). On call for blockers | On call for blockers. T10 `joinProgram` on a branch |
| **Wed 6 to 8 PM** | Own Wednesday items, in this order:<br>1. webhook `PAYMENT.CAPTURE.COMPLETED` (backup path)<br>2. Zapier hook (insert shot)<br>3. Render worker + cron (likely cut) | Merge T10 if it works (join scene filmed after merge, or cut). Reshoot fixes. Screenshot fallback only if everything else is done |
| **Wed 8 PM** | **Full feature freeze** | **Full feature freeze** |
| **Thu AM** | Bug fixes only; hosted URL check in an incognito window | Bug fixes only |

**Dev 1's own Wednesday list, ranked:**

| Rank | Item | Time | Status |
|---|---|---|---|
| 1 | API endpoint list for Postman | 15 min | Keep: the Producer is blocked on it |
| 2 | `docs/apimatic.md` | 30 min | Keep: cheap, and needed for the APIMatic prize |
| 3 | Webhook | ~1h | Keep if there's time |
| 4 | Zapier hook | ~1h | Keep if there's time |
| 5 | Worker + cron | ~2h | Likely cut |

- **Worker + cron:** cut list items 3–4. The chat calls `refreshRewards` inline anyway. If cut, describe them as roadmap in the README.
- **Render `starter` plan:** decide before judging (5 min).

**Rough load:**
- **Dev 1:** ~5h of the Tuesday work plus ~3h of their own Wednesday list.
- **Dev 2:** ~9h.
- If Dev 2 is still behind at the Wed 10 AM check-in, Dev 1 also takes the `/connect` API routes (T7). Dev 2 keeps the chat and scoring.

## Handoffs

| From | To | What | By |
|---|---|---|---|
| Dev 2 | Dev 1 | `lib/agent/types.ts` + `data/catalog/demo-diner.json` + `lib/scoring/catalog.ts` | Tue night, first hour |
| Dev 1 | Dev 2 | PR #16 reviewed + merged | Tue night |
| Dev 1 | Dev 2 | `pendingPoints` in `getRewardRows`; `seed-catalog` run on the shared DB | Wed 10 AM |
| Dev 1 | Dev 2 | `RankedGrid` + `ApprovalCard` merged | Wed 10 AM |
| Dev 2 | Dev 1 | `/connect` routes live (stub until then) | Wed noon |
| Dev 1 | Producer | API endpoints for Postman | Wed noon |
| Dev 2 | Producer | Exact demo prompts + the agent's real replies | Wed 3 PM |
| Both | Producer | Clean demo state (`reset-demo` → `seed-catalog`) + warm hosted URL | Wed 3 PM |

## Cut list (apply at Wed 10 AM, Wed 3 PM, Wed 8 PM)

Drop in this order:
1. Postman (the Producer can describe the endpoints in the README)
2. Render cron + worker
3. Zapier
4. Webhook (capture already writes the row)
5. `joinProgram`
6. `/connect` live-view embed (show step text only)
7. Screenshot fallback
8. Real-program adapter in the demo

**Never cut:**
- the chat agent with read tools + scoring
- the approval card → PayPal checkout
- the AG Grid rewards view and the in-chat grid
- the Demo Diner flow

## Risks
- **Integration seam:** Dev 1's components and Dev 2's chat meet at `lib/agent/types.ts`. Freeze it once pushed; any change goes in a PR that names the other dev.
- **Merges during filming:** every merge to `main` redeploys Render. Nothing merges between 3 and 6 PM except blocker fixes agreed by both.
- **Shared DB during development:** `scripts/test-refresh.ts` creates and deletes its own rows. Don't run `reset-demo` while the other dev is mid-test; announce it in chat first.
- **Join scene undecided** (dev2-tuesday.md §7, D1). If it's not decided at the Wed 10 AM check-in, cut T10 and the join scene.
- **Dev 1 overload:** if the chat components slip past Wed 10 AM, Dev 1's Wednesday items 3–5 are cut automatically (see the ranked list).
