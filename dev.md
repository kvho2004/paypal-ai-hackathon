# Krumms: Development Plan

https://github.com/lagmanju
https://github.com/alannaq
https://github.com/kvho2004

Food-rewards assistant for the PayPal AI Hackathon. One app, one AI agent, all your restaurant rewards.

**Deadline:** Nov 12, 2026 @ 3:00 PM EST (about 3.5 build days from Nov 8 night)
**Hard requirements:** meaningful PayPal integration (sandbox), meaningful AI, working demo judges can run (hosted URL or full setup instructions), public repo with license, demo video under 3 minutes on YouTube, tools disclosure.

---

## 1. Product scope for the hackathon

### The one demo story (build everything around this)

1. User signs in and links PayPal (sandbox). Krumms reads recent food purchases and says: "You've spent $86 at Demo Diner and Starbucks this month. You're in Starbucks Rewards, but not Demo Diner's program."
2. User connects a rewards account through a secure hosted login. The agent opens a cloud browser, reads the points balance and available rewards, and shows them in the unified view.
3. User asks: "Lunch under $8, nothing fried." The agent ranks options using rewards value, offers, and preferences.
4. Agent recommends one option and asks for approval. User approves, pays with PayPal, and the purchase immediately updates their purchase context and "close to reward" progress.
5. Agent notices an unenrolled restaurant and offers to join its rewards program (user-approved action).

### In scope (MVP)
- PayPal purchase context (Transaction Search)
- PayPal checkout for an agent-recommended order (Orders v2), approved by the user
- One working rewards account flow end to end via browser agent
- Unified rewards view with value-per-point ranking
- Chat assistant with tools, preferences memory ("stop suggesting McDonald's")
- One user-approved action (rewards sign-up on the demo program)

### Out of scope (mention as roadmap only)
- iMessage/SMS interface
- More than 2 real restaurant programs
- Push notifications at scale
- Production PayPal partner onboarding (reading other users' PayPal accounts)

---

## 2. Integration map

| Integration | Purpose | Status / risk | Decision |
|---|---|---|---|
| **PayPal Transaction Search API** | Purchase context: which restaurants, how often, how much | Low risk in sandbox. Reads the API caller's own account; reading third-party users' history requires PayPal partner access | Use for demo user's sandbox account. Be explicit in README |
| **PayPal Orders v2 (via Agent Toolkit)** | Agent creates an order, user approves, app captures | Low risk | Core "agentic commerce" moment |
| **PayPal Webhooks** | `PAYMENT.CAPTURE.COMPLETED` updates context and reward progress in real time | Low risk | Nice to have, Day 3 |
| **Kernel (sponsor) Managed Auth + cloud browser** | User logs into a rewards site via hosted login; agent reads balance in the authenticated session | Medium risk: bot detection, MFA, layout changes. Managed Auth is public beta | Primary rewards-access mechanism |
| **Real restaurant program (Starbucks first)** | Proves real-world access | High risk: no public API; login may block automation; ToS considerations | Spike on Day 1, timebox to 4 hours. Alternates: Chipotle, Panera, Taco Bell |
| **"Demo Diner" rewards site (our own, clearly fictional)** | Guaranteed working rewards flow for judges and video | No risk | Build Day 1. Same adapter path as real sites |
| **Claude (Anthropic API) via Vercel AI SDK** | Chat agent, tool calling, extraction of balances from page content | Low risk | Core AI |
| **Render (sponsor)** | Web app, Postgres, background worker, cron | Low risk | Hosted demo URL; Render prize (see section 8) |
| **AG Grid (sponsor)** | Rewards view grid + in-chat ranked grids | Low risk | Core UI; AG Grid prize (see section 8) |
| **APIMatic Context Plugin (sponsor)** | Grounds our AI coding agent in the current PayPal Server SDK | Low risk | Use for all PayPal code; APIMatic prize (see section 8) |
| **Zapier (sponsor)** | Outbound alerts (SMS/Discord, Sheets spend log) | Not viable for reading consumer rewards balances | Notifications only |
| **Postman (sponsor)** | Public collection for our API + PayPal sandbox + webhook simulation | Low risk | Judge-facing testing aid |

### Why this makes PayPal central (not just context)
PayPal does three jobs: (1) tells the agent where you actually eat, (2) is the rail the agent uses to complete the recommended purchase, and (3) its capture events drive the reward-progress loop. This hits "Best Use of PayPal + AI" and "Best Use of Agentic Commerce."

---

## 3. Architecture

```
┌───────────────────────────── Next.js app (Render) ─────────────────────────────┐
│  UI: Chat panel | Rewards view (AG Grid) | Connect accounts | Approvals        │
│                                                                                │
│  /api/chat  ── Vercel AI SDK + Claude ── tools:                                │
│     ├─ paypal.searchTransactions   (Transaction Search API)                    │
│     ├─ paypal.createOrder / captureOrder (PayPal Agent Toolkit, sandbox)       │
│     ├─ rewards.listPrograms / getBalances (DB cache)                           │
│     ├─ rewards.refresh(programId)  ──► Kernel browser + extractor              │
│     ├─ rewards.rankRedemptions     (value scoring, deterministic code)         │
│     ├─ prefs.update / prefs.get    (blocklist, diet, budget)                   │
│     └─ actions.requestApproval     (join program, pay, redeem)                 │
│                                                                                │
│  /api/paypal/webhook  ── updates purchases + progress                          │
│  /api/connect/:program ── Kernel Managed Auth hosted login                     │
└────────────────────────────────────┬───────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
   Postgres (Prisma)          Kernel cloud browsers       PayPal Sandbox
   users, purchases,          profiles per user+site      Orders, Transaction
   programs, balances,        live view for login         Search, Webhooks
   catalog, prefs, actions
                                     │
                                     ▼
                       Demo Diner rewards site (/demo-diner, same repo)
                       + one real program (Starbucks if spike succeeds)
```

### Tech stack
- **Frontend/backend:** Next.js (App Router, TypeScript), Tailwind, shadcn/ui
- **AI:** Vercel AI SDK + `@ai-sdk/anthropic` (Claude), tool calling with zod schemas
- **PayPal:** `@paypal/agent-toolkit/ai-sdk` (orders), `@paypal/paypal-server-sdk` for Transaction Search and capture (written with the APIMatic Context Plugin), PayPal JS SDK buttons for buyer approval
- **Browser agent:** `@onkernel/sdk` + Playwright over CDP; Kernel Managed Auth for login
- **DB:** Postgres on Render, Prisma ORM
- **Grid:** AG Grid Community (`ag-grid-react`)
- **Hosting/jobs:** Render web service, background worker, cron job, Postgres
- **Alerts:** Zapier webhook trigger (Catch Hook) to SMS/Discord/Sheets
- **API docs/testing:** Postman public collection

---

## 4. Rewards access design (the make-or-break piece)

### Adapter interface
Every program implements the same interface, so the demo site and real sites share one code path.

```ts
interface RewardsAdapter {
  programId: string;              // "starbucks", "demo-diner"
  domain: string;                 // used for Kernel auth connection
  balanceUrl: string;             // page that shows points + rewards
  extract(page: Page): Promise<RawRewardsPage>; // Playwright: DOM text/screenshot
  signUp?(page: Page, user: SignUpInfo): Promise<SignUpResult>; // optional action
}
```

### Flow
1. **Connect:** `kernel.auth.connections.create({ domain, profile_name: "<userId>-<programId>" })`, then `connections.login(id)` returns a `hosted_url`. User logs in themselves (Krumms never sees the password). Poll or stream status until `SUCCESS`.
2. **Read:** launch a Kernel browser with that profile, navigate to `balanceUrl`, grab visible text (and a screenshot as fallback).
3. **Extract:** send page text to Claude with a strict zod schema: `{ points, rewards: [{ name, pointCost, expiresAt? }], tierProgress? }`. Validate; reject if fields are missing rather than guessing.
4. **Store:** write to `balances` with `fetchedAt` and `source: "live"`. UI shows freshness ("updated 2 min ago").
5. **Fail gracefully:** if login or extraction fails, mark `status: NEEDS_AUTH` or `EXTRACT_FAILED` and offer the manual fallback (enter balance or upload a screenshot, parsed by Claude vision).

### Day 1 spike: real program (timebox 4 hours)
Test in this order and record results in `docs/spike-log.md`:
1. Can Kernel Managed Auth complete a Starbucks login (MFA/CAPTCHA)?
2. Does the balance page render in a Kernel browser (stealth mode on)?
3. Can extraction return points + rewards reliably 3 times in a row?

If any step fails, try Chipotle or Panera. If all fail, the demo uses Demo Diner live plus the screenshot fallback for a real program, and the README states this honestly.

### Guardrails
- Read-only by default. Any write (sign-up, redeem) requires an explicit approval card.
- Only the user's own accounts, user-initiated.
- Note in README: automating third-party sites may conflict with their terms; production would pursue official partnerships.

---

## 5. Reward value scoring

Deterministic code, not the LLM, computes value. The LLM explains it.

```
cents_per_point = (menu_price_cents - copay_cents) / point_cost
```

- **Catalog:** `data/catalog/<program>.json` maps reward names to typical menu price (hand-curated for supported programs and Demo Diner). Extraction gives point costs; catalog gives dollar value.
- **Rank** redemptions by `cents_per_point`; flag "poor use" when below the program's median by 30%+.
- **Close to earning:** `points_needed = point_cost - balance`; surface rewards where `points_needed <= typical_points_per_visit * 2`. `typical_points_per_visit` comes from PayPal purchase averages times the program's earn rate.
- **Recommendation score** for chat suggestions combines: price within budget, preference match (diet, blocklist), redemption value, and offers. Keep weights in one config file.

---

## 6. PayPal integration details

### Sandbox setup (do on Day 1, it has lag)
1. Developer Dashboard: create REST app, enable **Transaction Search** in app settings. Scope can take hours to appear on new tokens.
2. Create sandbox accounts: one Personal (the student), one Business (Demo Diner merchant).
3. Seed 10 to 15 food purchases across a few merchant names. Transaction Search can take up to ~3 hours to reflect new transactions, so seed early.
4. Keep a `scripts/seed-sandbox.ts` so judges can reproduce.

### Purchase context
- `GET /v1/reporting/transactions?start_date&end_date&fields=all` (31-day max window per call; loop for longer).
- Normalize merchant names to `programId` via a small alias map + LLM fallback ("SBUX #1234" to `starbucks`).
- Store in `purchases`. Never treat a purchase as proof of points earned.

### Agent checkout (agentic commerce)
1. Agent proposes an order, shows an approval card (item, price, reward impact).
2. On approve: `create_order` (Agent Toolkit, sandbox) returns an approval link / PayPal button flow.
3. User approves in PayPal; server captures.
4. Webhook `PAYMENT.CAPTURE.COMPLETED` writes the purchase and recalculates "close to reward."

In sandbox, the payee is the Demo Diner business account. For real restaurants, frame checkout as roadmap (or a Krumms prepaid meal credit) rather than implying we place real restaurant orders.

---

## 7. Chat agent

### System prompt essentials
- Role: food-rewards assistant for budget-conscious students.
- Always call tools for balances and prices; never invent point values.
- State data freshness when citing balances.
- Every action that spends money or changes an account requires `actions.requestApproval`.
- Respect the preference blocklist permanently until the user lifts it.

### Tools (zod-typed)
| Tool | Description |
|---|---|
| `getPurchaseSummary(days)` | Spend and visits by restaurant from PayPal |
| `getRewards()` | Cached balances and rewards across programs |
| `refreshRewards(programId)` | Runs Kernel read + extraction |
| `rankRedemptions(programId?)` | Value scoring output |
| `suggestMeals({budget, diet, exclude})` | Combines catalog, rewards, prefs |
| `updatePreferences(patch)` | Blocklist, diet, budget |
| `requestApproval(action)` | Renders approval card; returns approved/denied |
| `createPayPalOrder(item)` / `capturePayPalOrder(id)` | Agent Toolkit |
| `joinProgram(programId)` | Runs adapter `signUp` after approval (Demo Diner) |

---

## 8. Sponsor tools and prize strategy

Main prize targets: **Best Use of Agentic Commerce** and **Best Use of PayPal + AI** (agent recommends, user approves in chat, PayPal checkout, capture updates rewards progress). Sponsor work below is ordered by payoff. Confirm in the Official Rules whether one project can win multiple prizes.

| Tool | Prize | Effort | Priority |
|---|---|---|---|
| AG Grid | $5k / $2k / $1k (x3) | Medium | High |
| Render | $1,000 / $750 / $500 credits | Low | High |
| APIMatic | $1k (x3) + 6-month business subscription | Low | Medium |
| Zapier | No dedicated prize | Low | Low (demo polish) |
| Postman | No dedicated prize; Postman judge on panel | Low | Low (judge experience) |

### AG Grid
- **Rewards view:** one grid of all programs and rewards. Columns: program, reward, point cost, menu value, cents per point (sortable, default sort), "close to earning" progress bar (custom cell renderer), expiration, balance freshness badge.
- Row grouping by program; conditional styling flags "poor use of points" in red and "best value" in green.
- Quick filter wired to preferences (hide blocklisted restaurants, diet filters).
- **In-chat grids:** when the agent calls `rankRedemptions` or `suggestMeals`, the chat renders a compact AG Grid instead of plain text, with an "Approve" button per row that triggers `requestApproval`. This ties AG Grid directly into the AI flow.
- Purchases tab: grid of PayPal transactions with mapped program and "not enrolled" flag plus a "Join" action.

### Render
- **Web service:** Next.js app (hosted demo URL for judges).
- **Postgres:** primary DB.
- **Background worker:** queue consumer that runs Kernel balance refreshes so chat requests never block on a browser session.
- **Cron job (hourly):** refresh stale balances, recompute "close to reward," fire alerts via Zapier.
- Commit `render.yaml` (Blueprint) so the full stack deploys in one click; mention it in the README and video.

### APIMatic Context Plugin
- Each developer runs `npx context-plugins install paypal` on Day 1 so Claude Code/Cursor uses the current `@paypal/paypal-server-sdk` surface.
- Write Transaction Search, order capture, and webhook verification with it.
- Capture evidence: short before/after note in `docs/apimatic.md` (prompt used, code generated, fewer fixes needed) and a 5-second mention in the video.

### Zapier
- App posts events to a Zapier Catch Hook: `close_to_reward`, `reward_expiring`, `purchase_captured`, `program_joined`.
- Zaps: SMS or Discord message for alerts; append row to a Google Sheet "meal spend log."
- Shows the "one agent manages notifications" idea without building a messaging backend. Gate behind `ZAPIER_HOOK_URL` so the app works without it.

### Postman
- Public collection in a public workspace: Krumms API (`/api/chat`, `/api/rewards`, `/api/paypal/webhook`), PayPal sandbox calls (OAuth token, Transaction Search, Orders), and a sample `PAYMENT.CAPTURE.COMPLETED` payload to simulate webhooks.
- Environment file with placeholders; link it in the README "Test without the UI" section.

---

## 9. Data model (Prisma, simplified)

```prisma
model User        { id String @id; name String; paypalSandboxEmail String?; prefs Json }
model Program     { id String @id; name String; domain String; earnRate Float }
model Connection  { id String @id; userId String; programId String; kernelAuthId String; status String }
model Balance     { id String @id; connectionId String; points Int; rewards Json; fetchedAt DateTime; source String }
model Purchase    { id String @id; userId String; paypalTxnId String @unique; merchantRaw String; programId String?; amountCents Int; at DateTime }
model CatalogItem { id String @id; programId String; rewardName String; menuPriceCents Int; pointCost Int? }
model Action      { id String @id; userId String; type String; payload Json; status String; createdAt DateTime }
```

---

## 10. Repo structure

```
krumms/
├─ app/
│  ├─ (app)/chat, rewards, connect, settings
│  ├─ api/chat/route.ts
│  ├─ api/paypal/webhook/route.ts
│  ├─ api/connect/[program]/route.ts
│  └─ demo-diner/            # fictional rewards site: login, points, join
├─ lib/
│  ├─ agent/tools.ts, prompt.ts
│  ├─ paypal/transactions.ts, orders.ts, webhooks.ts
│  ├─ rewards/adapters/{demo-diner,starbucks}.ts, kernel.ts, extract.ts
│  └─ scoring/value.ts
├─ data/catalog/*.json
├─ prisma/schema.prisma
├─ scripts/seed-sandbox.ts, seed-db.ts
├─ workers/refresh.ts       # Render background worker
├─ jobs/hourly.ts           # Render cron job
├─ postman/krumms.postman_collection.json
├─ docs/spike-log.md, apimatic.md, architecture.png
├─ render.yaml              # Render Blueprint
├─ .env.example
├─ LICENSE (MIT)
└─ README.md
```

### Environment variables
```
ANTHROPIC_API_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=SANDBOX
PAYPAL_WEBHOOK_ID=
KERNEL_API_KEY=
DATABASE_URL=
APP_URL=
DEMO_MODE=true   # seeds demo user, enables Demo Diner
ZAPIER_HOOK_URL= # optional; alerts disabled if empty
```

---

## 11. Build timeline

| When | Goals | Owner |
|---|---|---|
| **Sun Nov 8 (night)** | Repo, Next.js skeleton, Prisma, Render Blueprint deploy, PayPal sandbox app + Transaction Search enabled, seed sandbox purchases, everyone installs APIMatic Context Plugin | Dev 1: PayPal sandbox, Dev 2: scaffold + Render, Producer: rules + mock data |
| **Mon Nov 9** | Kernel spike on Starbucks (4h box). Demo Diner site with login/points/join. Adapter + extraction working on Demo Diner. Transaction Search ingestion | Dev 1: PayPal + Render Blueprint, Dev 2: Kernel spike + Demo Diner, Producer: research + storyboard |
| **Tue Nov 10** | Chat agent with all read tools. Scoring + catalog. AG Grid rewards view + in-chat grids. Preferences memory. Render worker for refreshes | Dev 1: AG Grid + worker, Dev 2: agent + scoring, Producer: catalog + Postman |
| **Wed Nov 11** | Approval cards, PayPal checkout + capture + webhook. Join-program action. Fallback screenshot upload. Render cron + Zapier alerts. Postman collection. Polish | Dev 1: checkout + cron + Zapier, Dev 2: approvals + in-chat grids, Producer: README + screen takes |
| **Thu Nov 12 AM** | Freeze by 10 AM. Record video, write README + Devpost text, verify hosted demo from a clean browser. Submit by 1 PM (2h buffer) | Devs: fixes only, Producer: video + submission |

**Cut order if behind:** Postman collection, Zapier alerts, Render cron (run refresh on demand), webhooks (poll instead), join-program action, real-program adapter (keep Demo Diner + screenshot fallback). Keep AG Grid and the PayPal checkout; they carry the most prize weight.

---

## 12. Demo video plan (under 3 min)

| Time | Shot |
|---|---|
| 0:00 to 0:20 | Problem: five food apps, wasted points, tight student budget |
| 0:20 to 0:50 | PayPal context: agent summarizes where you eat and spots an unenrolled program |
| 0:50 to 1:30 | Connect rewards: hosted login, live view of agent reading balance, AG Grid rewards view updates |
| 1:30 to 2:15 | Chat: "lunch under $8, no fried food, stop suggesting McDonald's"; agent replies with an in-chat AG Grid of ranked picks |
| 2:15 to 2:45 | Approve and pay with PayPal; progress bar jumps; Zapier text arrives ("2 visits from a free drink"); join-program offer |
| 2:45 to 3:00 | Architecture slide: PayPal, Claude, Kernel, AG Grid, Render, APIMatic, Zapier, Postman |

Use only Demo Diner branding on screen; avoid showing third-party logos without permission.

---

## 13. Submission checklist

- [ ] Public GitHub repo, MIT LICENSE visible in About
- [ ] README: problem, features, architecture diagram, setup (`npm i`, `.env`, `prisma migrate`, `seed`), sandbox test accounts, `DEMO_MODE`
- [ ] Hosted demo URL on Render with seeded demo user (judges should not need their own keys)
- [ ] Tools disclosure: Claude (chat, tool calling, extraction), PayPal Agent Toolkit + Server SDK + Orders v2 + Transaction Search + Webhooks, Kernel, Render, AG Grid, APIMatic Context Plugin, Zapier, Postman
- [ ] Sponsor section in README explaining how each tool is used (judges for sponsor prizes read this)
- [ ] `render.yaml` Blueprint committed; Postman collection link in README; `docs/apimatic.md` evidence
- [ ] Opt into each sponsor prize on the Devpost submission form
- [ ] Honest limitations section (which programs work live, partner access needed for production PayPal history)
- [ ] YouTube video, public, under 3 minutes, no copyrighted music
- [ ] Devpost text description

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Real restaurant login blocks automation | Demo Diner guarantees a working flow; screenshot fallback for real programs |
| Transaction Search scope/latency delays | Enable and seed on Day 1; cache results in DB |
| LLM hallucinates balances or values | Schema-validated extraction, deterministic scoring, freshness labels |
| Judges can't run it | Hosted URL + `DEMO_MODE` with pre-seeded data and sandbox credentials |
| Kernel Managed Auth beta changes | Fallback: plain Kernel profile with live view where user logs in manually |
| Scope creep | Follow cut order in section 11 |

---

## 15. Open decisions for the team

1. Which real program is the Day 1 spike target (Starbucks vs. Chipotle vs. Panera)?
2. Checkout framing for real restaurants: roadmap only, or a "Krumms meal credit" purchased via PayPal?
3. Team ownership split: see `team-plan.md` (Dev 1: Payments & Platform, Dev 2: Agent & Rewards, Producer & Research).

---

### References
- PayPal Agent Toolkit: https://developer.paypal.com/tools/agent-toolkit
- PayPal Transaction Search: https://developer.paypal.com/docs/transaction-search
- PayPal MCP server overview: https://www.scalekit.com/blog/paypal-mcp-vs-api
- Kernel Managed Auth: https://www.kernel.sh/docs/profiles/managed-auth/overview
- Kernel Profiles: https://kernel.sh/docs/auth/profiles
- Kernel + human-in-the-loop login guide: https://vercel.com/kb/guide/build-a-browser-agent
- APIMatic Context Plugin for PayPal SDKs: https://developer.paypal.com/community/blog/A%20New%20Context%20Plugin%20for%20AI-Assisted%20Coding%20with%20PayPal%20SDKs
- API Context Marketplace: https://www.everydev.ai/tools/api-context-marketplace
