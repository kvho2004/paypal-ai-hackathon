# Krumms: Team Plan (3 people)

Companion to `development.md`. Deadline: **Thu Nov 12, 3:00 PM EST**. Target submit: **1:00 PM** (2-hour buffer).

## Roles

| Role | Person | Owns |
|---|---|---|
| **Dev 1: Payments & Platform** | Teammate with the PayPal developer account | PayPal sandbox, Transaction Search, checkout, webhooks, Render (app, DB, worker, cron), AG Grid rewards view, Zapier, APIMatic evidence |
| **Dev 2: Agent & Rewards** | Second developer | Kernel spike + Managed Auth, Demo Diner site, rewards adapters + extraction, chat agent + tools, scoring, in-chat grids + approval cards |
| **Producer & Research** | Third teammate | Demo video, background research, reward catalog data, Postman collection, README/Devpost writing, QA, submission |

Rule of thumb: Dev 1 owns everything that touches money or infrastructure; Dev 2 owns everything the agent thinks or reads; the Producer owns everything a judge reads or watches.

---

## Shared contracts (agree tonight, before splitting up)

Spend 30 minutes together tonight so both devs can work in parallel without waiting on each other.

1. **Prisma schema** from `development.md` section 9: commit as-is, change only by PR.
2. **Agent tool signatures** (section 7): Dev 2 writes the zod schemas; Dev 1 implements the PayPal-backed ones (`getPurchaseSummary`, `createPayPalOrder`, `capturePayPalOrder`).
3. **Mock data:** `data/mock/purchases.json` and `data/mock/balances.json` so Dev 2 can build the agent before real PayPal/Kernel data lands. Producer drafts these from research.
4. **Git:** `main` stays deployable. Feature branches, PR reviewed by the other dev, auto-deploy `main` to Render.
5. **Comms:** 10-minute check-ins at **10 AM** and **9 PM** daily. Post blockers immediately, don't sit on them more than 1 hour.

---

## Tonight (Sun Nov 8)

| Dev 1 | Dev 2 | Producer |
|---|---|---|
| Create REST app in PayPal Developer Dashboard, enable **Transaction Search** (scope can take hours, so do it first) | Scaffold Next.js + Tailwind + Prisma, push repo, add MIT LICENSE | Read Official Rules: can one project win multiple prizes? Sponsor prize opt-in steps? Report in chat |
| Create sandbox accounts: Personal (student) + Business (Demo Diner) | Install APIMatic Context Plugin (`npx context-plugins install paypal`) | Draft `data/mock/*.json` with realistic student food purchases and balances |
| Seed 10 to 15 sandbox purchases (Transaction Search lags up to ~3 hours) | Sign up for Kernel, get API key | Start research doc (see Producer section) |
| Share sandbox credentials in a private channel / password manager, never in the repo | Create Render project, connect repo | Create YouTube channel/account access and pick royalty-free music |
| Install APIMatic Context Plugin | | |

**Done tonight =** repo live on Render with a blank page, sandbox app with Transaction Search enabled, seeded purchases, mock data committed.

---

## Dev 1: Payments & Platform

| Day | Tasks | Done when |
|---|---|---|
| **Mon** | `lib/paypal/transactions.ts` (Transaction Search via Server SDK), merchant-name normalization, `scripts/seed-sandbox.ts`, purchases ingestion into Postgres. `render.yaml` Blueprint (web, Postgres, worker, cron) | Real sandbox purchases appear in DB; `getPurchaseSummary` returns them |
| **Tue** | AG Grid rewards view (value-per-point sort, progress bar renderer, row grouping, freshness badge) and purchases grid with "not enrolled" flag. Render worker wired to Dev 2's refresh job | Rewards page shows mock + live balances in AG Grid |
| **Wed** | PayPal checkout: `create_order` (Agent Toolkit), JS SDK approval, capture, webhook `PAYMENT.CAPTURE.COMPLETED` updating purchases + progress. Render cron. Zapier Catch Hook alerts | Approve in chat, pay in sandbox, progress bar updates, text/Discord alert fires |
| **Thu AM** | Bug fixes only, seed hosted demo user, confirm judges can log in with demo credentials | Hosted URL works in a clean incognito window |

Also: write `docs/apimatic.md` (prompt used, code it produced, what it saved) as you go. Five minutes per day is enough.

## Dev 2: Agent & Rewards

| Day | Tasks | Done when |
|---|---|---|
| **Mon AM** | **Kernel spike (4-hour timebox):** Managed Auth login on Starbucks, render balance page, extract 3 times. Log results in `docs/spike-log.md`. Try Chipotle/Panera if blocked | Clear yes/no on a real program by Mon 2 PM |
| **Mon PM** | Demo Diner site (`/demo-diner`: login, points page, join page). `RewardsAdapter` interface, Demo Diner adapter, Claude extraction with zod validation | Agent reads Demo Diner balance through a Kernel browser end to end |
| **Tue** | Chat agent (Vercel AI SDK + Claude): all read tools, preferences memory (blocklist, diet, budget), `lib/scoring/value.ts` using Producer's catalog | "Lunch under $8, no fried food" returns ranked, explained picks from real data |
| **Wed** | In-chat AG Grid for ranked results, approval cards (`requestApproval`), `joinProgram` on Demo Diner, screenshot-upload fallback. Hand checkout hook to Dev 1 | Full demo story runs start to finish |
| **Thu AM** | Bug fixes, prompt tuning, guard against hallucinated values | Producer completes 3 clean demo runs in a row |

## Producer & Research

### Research (Mon to Tue), output: `docs/research.md` + pitch numbers
- **Problem evidence:** student food spending and food insecurity stats; how much loyalty points go unredeemed; how many restaurant apps a typical person has. Cite every number.
- **Competitive landscape:** existing rewards aggregators / card-linked offers and what Krumms does differently (agent reads real balances, ranks value, acts with approval, pays with PayPal).
- **Reward catalog:** for Demo Diner (invent) and 1 to 2 real programs, build `data/catalog/*.json`: reward name, point cost, typical menu price, earn rate. This powers value-per-point scoring, so accuracy matters.
- **Risk framing:** one paragraph on ToS/automation limits and the partnership path for production (for README "Limitations").
- **Prize intel:** Official Rules answers and which sponsor judges to speak to in the video/README.

### Supporting deliverables
- **Postman (Tue to Wed):** public collection with PayPal sandbox calls, Krumms API routes, sample webhook payload. Dev 1 gives you endpoints; you build and document it.
- **README + Devpost text (Wed):** problem, features, architecture, setup, sponsor section (how each tool is used), limitations, tools disclosure.
- **QA (Wed night, Thu AM):** run the demo story repeatedly on the hosted URL; file bugs with exact steps.

### Demo video (under 3 minutes)
| When | Task |
|---|---|
| Mon | Script + storyboard from `development.md` section 12; send to devs so they know exactly which screens must look polished |
| Tue | Record voiceover draft; design title card + architecture slide (no third-party logos without permission) |
| Wed evening | Record screen takes on the near-final build (Dev 2 seeds a clean demo state) |
| Thu 10 AM to 12 PM | Final recording after freeze, edit, captions, upload to YouTube (public), check length under 3:00 |
| Thu 12 to 1 PM | Submit on Devpost: video link, repo link, hosted URL, text, tools, sponsor prize opt-ins |

---

## Handoffs and dependencies

| From | To | What | By |
|---|---|---|---|
| Dev 1 | Dev 2 | Sandbox credentials in a private channel, Transaction Search working | Sun night / Mon noon |
| Producer | Dev 2 | Mock data + catalog JSON | Sun night (mock), Tue noon (catalog) |
| Dev 2 | All | Kernel spike verdict (real program or Demo Diner only) | Mon 2 PM |
| Producer | Devs | Video storyboard: screens that must be polished | Mon night |
| Dev 1 | Producer | API endpoints for Postman | Tue night |
| Devs | Producer | Near-final build + clean demo state for recording | Wed 8 PM |
| All | All | **Feature freeze** | Thu 10 AM |

## Cut list (if behind on Wed night)
Drop in this order: Postman, Zapier alerts, Render cron, webhooks (poll instead), `joinProgram`, real-program adapter. **Never cut:** Demo Diner flow, PayPal checkout, AG Grid rewards view, chat agent.

## Risks specific to this split
- **Dev 2 has the heaviest load.** If the Kernel spike fails early, Dev 2 moves straight to Demo Diner and gains time. If Dev 2 is behind Tue night, Dev 1 takes the in-chat grids.
- **Single point of failure on PayPal credentials.** Dev 1 adds the other dev as a collaborator on the PayPal app if possible, or shares sandbox credentials in a password manager tonight.
- **Video recorded on a moving target.** Lock demo data with a `DEMO_MODE` reset script so retakes look identical.
