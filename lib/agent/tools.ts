// The chat agent's tools. makeTools(userId) closes over the signed-in user, so the model never passes a user id.
// Every number the agent may state comes from these outputs (dev.md §7).
// Server only: this imports the database and Kernel. Client code may only `import type` from it (AgentUIMessage).
import { tool, type FinishReason, type InferUITools, type UIMessage } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { CHECKOUT_PROGRAM_ID, MAX_AMOUNT_CENTS } from "@/lib/paypal/orders";
import { getPurchaseSummary } from "@/lib/purchases";
import { getAdapter } from "@/lib/rewards/adapters";
import { refreshRewards } from "@/lib/rewards/refresh";
import { CATALOG_TAGS, listCatalogs, loadCatalog } from "@/lib/scoring/catalog";
import { suggestMeals } from "@/lib/scoring/suggest";
import { rankRedemptions } from "@/lib/scoring/value";
import { getPrefs, loadPointsPerVisit, loadRewards, toProgramStates, updatePrefs } from "./data";
import { PrefsUpdateSchema } from "./prefs";
import type { ApprovalRequest, ApprovalResult } from "./types";

const CONNECT_PATH = "/connect";
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const Tag = z.enum(CATALOG_TAGS);

/** "12 minutes ago": saves the model from doing date math when it states how fresh data is. */
function ago(date: Date, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - date.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Checkout menu prices by item name: an approval must match one exactly, so a confused model can't ask for a wrong price. */
const checkoutPrices = new Map(loadCatalog(CHECKOUT_PROGRAM_ID)?.items.map((i) => [i.name, i.menuPriceCents]) ?? []);

const ApprovalRequestSchema = z
  .object({
    programId: z.literal(CHECKOUT_PROGRAM_ID).describe("Only Demo Diner can be paid (sandbox)"),
    item: z.string().min(1).max(127).describe("The pick's item name, exactly as suggestMeals returned it"),
    amountCents: z.number().int().min(1).max(MAX_AMOUNT_CENTS).describe("The pick's priceCents"),
    rewardImpact: z.string().min(1).describe('From the pick\'s reasons, e.g. "+72 pts → Garden Grain Bowl ready"'),
  })
  .refine((r) => checkoutPrices.get(r.item) === r.amountCents, {
    message: "item must be a Demo Diner menu item from suggestMeals, and amountCents its exact priceCents",
  }) satisfies z.ZodType<ApprovalRequest>;

const ApprovalResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("paid"),
    purchase: z.object({
      purchaseId: z.string(),
      paypalTxnId: z.string(),
      programId: z.string(),
      amountCents: z.number(),
    }),
  }),
  z.object({ status: z.literal("denied") }),
  z.object({ status: z.literal("failed"), error: z.string() }),
]) satisfies z.ZodType<ApprovalResult>;

export function makeTools(userId: string) {
  return {
    getPurchaseSummary: tool({
      description:
        "The user's restaurant spending from PayPal: visits and total per restaurant over the last `days` days. " +
        "`enrolled` says whether a rewards account is connected for that restaurant; `canConnect` says whether Krumms " +
        "can connect one (at /connect).",
      inputSchema: z.object({ days: z.number().int().min(1).max(90).default(30) }),
      execute: async ({ days }) => {
        const [rows, connections] = await Promise.all([
          getPurchaseSummary(userId, days),
          db.connection.findMany({ where: { userId }, select: { programId: true } }),
        ]);
        const connected = new Set(connections.map((c) => c.programId));
        const totalCents = rows.reduce((sum, r) => sum + r.totalCents, 0);
        return {
          days,
          total: usd(totalCents),
          restaurants: rows.map((r) => ({
            programId: r.programId,
            merchant: r.merchant,
            visits: r.visits,
            total: usd(r.totalCents),
            enrolled: r.programId !== null && connected.has(r.programId),
            canConnect: r.programId !== null && !connected.has(r.programId) && getAdapter(r.programId) !== undefined,
          })),
        };
      },
    }),

    getRewards: tool({
      description:
        "Saved rewards balances for every connected program, from the last time Krumms read the program's site: " +
        "points, pending points (from PayPal purchases since that read, not yet confirmed by the program), " +
        "each reward's point cost and value flag, and member offers. Fast; use it before refreshRewards.",
      inputSchema: z.object({}),
      execute: async () => {
        const programs = await loadRewards(userId);
        if (programs.length === 0) {
          return { programs: [], note: `No rewards accounts connected yet. The user can connect one at ${CONNECT_PATH}.` };
        }
        return {
          programs: programs.map((p) => ({
            programId: p.programId,
            programName: p.programName,
            status: p.status,
            points: p.points,
            pendingPoints: p.pendingPoints,
            pointsWithPending: p.points === null ? null : p.points + p.pendingPoints,
            fetched: p.fetchedAt ? ago(p.fetchedAt) : "never",
            source: p.source,
            rewards: p.rows.map((r) => ({
              name: r.reward,
              pointCost: r.pointCost,
              pointsNeeded: r.pointsNeeded,
              menuValue: r.menuValueCents === null ? null : usd(r.menuValueCents),
              centsPerPoint: r.centsPerPoint === null ? null : Math.round(r.centsPerPoint * 100) / 100,
              valueFlag: r.valueFlag,
            })),
            offers: p.offers,
          })),
        };
      },
    }),

    refreshRewards: tool({
      description:
        "Re-reads a program's rewards site in a cloud browser and saves the new balance. Slow: 30-60 seconds. " +
        "Only when the user asks for fresh numbers or getRewards has none.",
      inputSchema: z.object({ programId: z.string().min(1) }),
      execute: async ({ programId }) => {
        const conn = await db.connection.findFirst({ where: { userId, programId } });
        if (!conn) return { ok: false, status: "NOT_CONNECTED", connectAt: CONNECT_PATH };
        try {
          const result = await refreshRewards(conn.id);
          if (!result.ok) {
            // The raw error (extraction details) goes to the log; the model gets text it can repeat.
            console.warn(`refreshRewards tool: ${result.status}: ${result.error}`);
            return result.status === "NEEDS_AUTH"
              ? { ok: false, status: result.status, error: "The rewards account needs a fresh login.", connectAt: CONNECT_PATH }
              : { ok: false, status: result.status, error: "The rewards page couldn't be read. The saved balance still stands." };
          }
          return { ok: true, points: result.rewards.points, rewards: result.rewards.rewards.length, fetched: ago(result.fetchedAt) };
        } catch (err) {
          console.error("refreshRewards tool failed:", err);
          return { ok: false, status: "ERROR", error: "The rewards site couldn't be read right now. Try again later." };
        }
      },
    }),

    rankRedemptions: tool({
      description:
        "The user's rewards ranked by value (cents per point, best first), with value flags " +
        '("best", or "poor" for a weak use of points), points still needed, and whether each is close to earning.',
      inputSchema: z.object({ programId: z.string().min(1).optional() }),
      execute: async ({ programId }) => {
        const [programs, perVisit] = await Promise.all([loadRewards(userId), loadPointsPerVisit(userId)]);
        const rows = programs.flatMap((p) => p.rows).filter((r) => !programId || r.programId === programId);
        const fetched = programs.filter((p) => p.fetchedAt).map((p) => ({ programId: p.programId, fetched: ago(p.fetchedAt!) }));
        return { rows: rankRedemptions(rows, perVisit), fetched };
      },
    }),

    suggestMeals: tool({
      description:
        "Ranked meal picks from the restaurant catalog, filtered by budget, meal, diet and exclusions, and scored by " +
        "what each does for the user's rewards. Saved preferences (blocklist, diet, budget) are always applied on top " +
        "of these arguments. Each pick's `reasons` are ready to quote.",
      inputSchema: z.object({
        budgetCents: z.number().int().positive().optional().describe("Max price for this request, in cents"),
        meal: Tag.optional().describe('e.g. "lunch". Leave it out if the meal isn\'t one of these tags.'),
        diet: z.array(Tag).optional().describe("Tags every pick must have, e.g. vegetarian"),
        exclude: z
          .array(z.string())
          .optional()
          .describe(
            'For this request only, e.g. ["fried"]. To exclude something from now on, use updatePreferences, and ' +
              "also list it here when you save it in the same turn.",
          ),
        prefer: z.array(Tag).optional().describe('Soft preferences, e.g. ["healthy"]'),
        programId: z.string().optional(),
      }),
      execute: async (input) => {
        const [prefs, programs, perVisit] = await Promise.all([
          getPrefs(userId),
          loadRewards(userId),
          loadPointsPerVisit(userId),
        ]);
        const applied = {
          budgetCents: input.budgetCents ?? prefs.budgetCents,
          meal: input.meal ?? null,
          diet: [...new Set([...prefs.diet, ...(input.diet ?? [])])],
          blocklist: prefs.blocklist,
          exclude: input.exclude ?? [],
        };
        const picks = suggestMeals(listCatalogs(), toProgramStates(programs, perVisit), {
          budgetCents: applied.budgetCents,
          meal: applied.meal,
          diet: applied.diet,
          exclude: [...applied.blocklist, ...applied.exclude],
          prefer: input.prefer ?? [],
          programId: input.programId ?? null,
        }, { programId: CHECKOUT_PROGRAM_ID, maxCents: MAX_AMOUNT_CENTS });
        const fetched = programs.filter((p) => p.fetchedAt).map((p) => ({ programId: p.programId, fetched: ago(p.fetchedAt!) }));
        return {
          picks,
          applied,
          fetched,
          ...(picks.length === 0 && { note: "Nothing matched. Ask which filter to relax." }),
        };
      },
    }),

    updatePreferences: tool({
      description:
        "Saves the user's preferences: things to stop suggesting (blocklist, kept until the user lifts it), " +
        'diet tags, and a default budget. "Stop suggesting burgers" → addBlock ["burger"]. ' +
        "Send every change in one call. Not for one-off limits: those go in suggestMeals' arguments.",
      inputSchema: PrefsUpdateSchema,
      execute: async (update) => ({ prefs: await updatePrefs(userId, update) }),
    }),

    // Client tool: no execute. The chat UI renders ApprovalCard and returns its result with addToolOutput,
    // so money only moves through the PayPal popup the user approves.
    requestApproval: tool({
      description:
        "Asks the user to approve paying for a meal with PayPal (sandbox). Shows an approval card; nothing is charged " +
        "unless they approve in the PayPal popup. Only for a pick with canCheckout true, using its exact item and " +
        "priceCents. Returns paid, denied or failed.",
      inputSchema: ApprovalRequestSchema,
      outputSchema: ApprovalResultSchema,
    }),
  };
}

export type AgentTools = ReturnType<typeof makeTools>;
/** Sent with the "finish" part, so the UI can show a friendly line when Claude declines a request. */
export type ChatMetadata = { finishReason?: FinishReason };
export type AgentUIMessage = UIMessage<ChatMetadata, never, InferUITools<AgentTools>>;
