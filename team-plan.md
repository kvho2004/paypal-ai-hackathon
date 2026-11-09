# Krumms: Team Plan (3 people), revised Mon Nov 9 evening

Companion to `dev.md`. Deadline: **Thu Nov 12, 3:00 PM EST**. Target submit: **Thu 1:00 PM**.

**What changed:** filming moves from Wednesday evening to **Tuesday evening**. Filming is done **scene by scene**, so one broken feature never blocks the rest. Wednesday becomes the reshoot, polish and hardening day, and Thursday is edit and submit only.

## Roles

| Role | Person | Owns |
|---|---|---|
| **Dev 1: Payments & Platform** | Teammate with the PayPal developer account | PayPal sandbox, Transaction Search, checkout, webhooks, Render (app, DB, worker, cron), app shell + AG Grid rewards/purchases views, demo reset script, Zapier, APIMatic evidence |
| **Dev 2: Agent & Rewards** | Second developer | Kernel + Managed Auth, Demo Diner site, rewards adapters + extraction, chat agent + tools, scoring, in-chat grids + approval cards |
| **Producer & Research** | Third teammate | Demo video, research, reward catalog data, Postman collection, README/Devpost writing, QA, submission |

Rule of thumb: Dev 1 owns everything that touches money or infrastructure; Dev 2 owns everything the agent thinks or reads; the Producer owns everything a judge reads or watches.

---

## Key dates

| When | Milestone |
|---|---|
| Mon night | Storyboard + per-scene shot list; Demo Diner + extraction done; app shell + reset script |
| Tue 10 AM | Check-in. Catalog JSON due. Go/no-go per scene |
| **Tue 3 PM** | **Demo freeze:** UI and demo data locked for filming. Only blocker fixes after this |
| **Tue 5 to 9 PM** | **Filming, scene by scene** (see below) |
| Tue 9 PM | Rough cut + list of scenes to reshoot |
| Wed | Reshoots, webhook, cron, Zapier, Postman, README, hardening. **Full freeze Wed 8 PM** |
| Thu AM | Final edit, captions, upload, QA on hosted URL, submit by 1 PM (no feature work) |

---

## Shared contracts (agree tonight)

1. **Prisma schema** from `dev.md` section 9. Merged on `main`; change only by PR.
2. **Agent tools** (section 7): Dev 2 writes the zod schemas. Dev 1 provides:
   - `getPurchaseSummary(userId, days)` in `lib/purchases.ts` (**done**, returns real data)
   - `createPayPalOrder({ programId, item, amountCents })` returning `{ orderId, approvalUrl }`
   - `capturePayPalOrder(orderId)` which captures **and writes the `Purchase` row directly** (the webhook comes later and is only a backup)
3. **Routes** (so the shell and the agent do not collide): Dev 1 owns `app/layout.tsx`, nav, `/purchases`, `/rewards`. Dev 2 owns `/chat`, `/demo-diner`, `/connect`.
4. **Demo state:** `scripts/reset-demo.ts` (Dev 1) restores the exact same demo data for every take. Run it before each filming session.
5. **Git:** `main` stays deployable. Feature branches, PR reviewed by the other dev.
6. **Comms:** check-ins at **10 AM** and **9 PM**, plus a quick **Tue 3 PM** go/no-go. Post blockers immediately; do not sit on one for more than 1 hour.

---

## Done so far (Dev 1)

Repo scaffold on `main`; PayPal sandbox with Transaction Search working; 12 seeded purchases ($102.55) ingested into Render Postgres; Render Blueprint synced; `getPurchaseSummary` returns real data.

---

## Dev 1: Payments & Platform

| When | Tasks | Done when |
|---|---|---|
| **Mon night** | Push `dev1/database` and merge the PR. `scripts/reset-demo.ts`. App shell: layout, nav, `/purchases` page reading `getPurchaseSummary`. Set PayPal env vars + `APP_URL` on Render. Pick **one** canonical PayPal app | Hosted URL shows real purchases in a table |
| **Tue AM** | AG Grid rewards view (value-per-point sort, progress bar, row grouping, freshness badge) on mock/Demo Diner balances. Purchases grid with "not enrolled" flag | `/rewards` and `/purchases` look film-ready |
| **Tue by noon** | `createPayPalOrder` / `capturePayPalOrder` + PayPal JS SDK approval button. Capture writes the `Purchase` row and returns updated progress. **Hand the tool to Dev 2 by noon** | Approve in sandbox, row appears, progress bar moves |
| **Tue 3 PM** | Demo freeze. Seed clean demo state, run reset script, confirm hosted URL | Producer can run the full story on the hosted URL |
| **Tue evening** | On call while filming; fix blockers only | Scenes captured |
| **Wed** | Webhook `PAYMENT.CAPTURE.COMPLETED` (backup path), Zapier Catch Hook (insert shot for the alert), Render worker + cron, `docs/apimatic.md`, Postman endpoints to Producer by noon, consider Render `starter` plan for judging | Webhook + alert fire; worker/cron deployed |
| **Thu AM** | Bug fixes only, confirm hosted URL in a clean incognito window | Judges can run the demo |

## Dev 2: Agent & Rewards

| When | Tasks | Done when |
|---|---|---|
| **Mon night** | Kernel spike verdict (real program or Demo Diner only), Demo Diner site, `RewardsAdapter`, Claude extraction with zod validation | Agent reads the Demo Diner balance through a Kernel browser |
| **Tue AM** | Chat agent (Vercel AI SDK + Claude): read tools, preferences memory, `lib/scoring/value.ts`. Use a **hard-coded Demo Diner catalog** until the Producer's catalog lands at 10 AM | "Lunch under $8, no fried food" returns ranked, explained picks |
| **Tue by 2 PM** | In-chat AG Grid for ranked picks, approval card (`requestApproval`), wire to Dev 1's `createPayPalOrder`, `joinProgram` on Demo Diner | Full story runs once end to end |
| **Tue 3 PM** | Demo freeze. Prompt tuning on the exact demo prompts; guard against hallucinated values | 3 clean runs in a row |
| **Wed** | Screenshot-upload fallback, reshoot fixes, edge cases, `docs/spike-log.md` | Reshoots look clean |
| **Thu AM** | Bug fixes only | Hosted demo stable |

## Producer & Research

### Demo video (under 3 minutes), filmed scene by scene
| Scene (from `dev.md` section 12) | Needs | Film |
|---|---|---|
| 1. Problem (0:00 to 0:20) | Title card, voiceover | Tue AM |
| 2. PayPal context (0:20 to 0:50) | `/purchases` + chat summary | Tue 5 PM |
| 3. Connect rewards (0:50 to 1:30) | Demo Diner + Kernel live view + `/rewards` | Tue 6 PM |
| 4. Chat + ranked grid (1:30 to 2:15) | Agent, scoring, in-chat grid | Tue 7 PM |
| 5. Approve and pay (2:15 to 2:45) | Approval card, sandbox checkout, progress bar. Zapier text is an **insert shot** filmed Wed | Tue 8 PM |
| 6. Architecture slide (2:45 to 3:00) | Slide, no third-party logos without permission | Tue AM |

Rules: film each scene only if it passes the **3 PM go/no-go**. Run `scripts/reset-demo.ts` before every take. Anything weak goes on the Wed reshoot list. Thu is final edit, captions, YouTube (public), length check under 3:00.

### Research and deliverables
- **Tonight:** storyboard + per-scene shot list sent to both devs (which screens must look polished). Report Official Rules answers (multiple prizes? sponsor opt-in steps?).
- **Tue 10 AM:** `data/catalog/*.json` (reward name, point cost, menu price, earn rate) for Demo Diner + 1 to 2 real programs. Moved earlier from Tue noon.
- **Tue:** `docs/research.md` with cited numbers; voiceover draft.
- **Wed:** Postman collection (public workspace), README + Devpost text, sponsor section, limitations section.
- **Wed night to Thu AM:** QA runs of the demo story on the hosted URL.
- **Thu 12 to 1 PM:** submit on Devpost with all sponsor-prize opt-ins.

---

## Handoffs and dependencies

| From | To | What | By |
|---|---|---|---|
| Dev 1 | Dev 2 | `getPurchaseSummary` with real data | **Done** (merge the PR) |
| Producer | Devs | Storyboard + per-scene shot list | Mon night |
| Dev 2 | All | Kernel spike verdict | Mon night |
| Producer | Dev 2 | Catalog JSON | Tue 10 AM |
| Dev 1 | Dev 2 | `createPayPalOrder` / `capturePayPalOrder` | Tue noon |
| All | All | **Demo freeze** + go/no-go per scene | Tue 3 PM |
| Dev 1 | Producer | Clean demo state (reset script) + hosted URL | Tue 3 PM |
| Dev 1 | Producer | API endpoints for Postman | Wed noon |
| All | All | **Full feature freeze** | Wed 8 PM |

## Cut list (apply Tue 3 PM, then again Wed 8 PM)
Drop in this order: Postman, Zapier alerts, Render cron, webhooks (capture endpoint already writes the row), `joinProgram`, real-program adapter. **Never cut:** Demo Diner flow, PayPal checkout, AG Grid rewards view, chat agent.

## Risks
- **Compressed Tuesday.** Checkout moves from Wed to Tue. Mitigation: capture writes the purchase directly (no webhook dependency), scene-by-scene filming, and a Wed reshoot window.
- **Dev 2 has the heaviest load.** If the Kernel spike failed, move straight to Demo Diner. If Dev 2 is behind at Tue noon, Dev 1 takes the in-chat grid.
- **Checkout payer/payee.** The PayPal app's account acts as the "student", so decide the payer (sandbox Personal) and payee for Orders v2 before Tue noon. Test one end-to-end capture Tue AM.
- **Filming on a moving target.** Demo freeze at Tue 3 PM, reset script before every take, and no feature merges to `main` between 3 PM and 9 PM except blocker fixes.
- **Single point of failure on PayPal credentials.** Share through a password manager, never the repo. Use one canonical app everywhere (webhook IDs are tied to an app).
- **Render free tier cold starts.** Warm the URL before filming and before judging; consider the `starter` plan with the hackathon credits.
