import "dotenv/config";
import { parseArgs } from "node:util";
import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateText, isStepCount, type ModelMessage } from "ai";
import { db } from "../lib/db";
import { SYSTEM_PROMPT } from "../lib/agent/prompt";
import { getPrefs } from "../lib/agent/data";
import { makeTools } from "../lib/agent/tools";
import { DEMO_USER_ID } from "../lib/purchases";
import { appearsInText } from "../lib/rewards/extract";
import { loadCatalog } from "../lib/scoring/catalog";

/**
 * Runs the demo prompts through the real agent (the same model, system prompt and tools as /api/chat) and checks
 * each reply. Calls the live model, so it needs ANTHROPIC_API_KEY, and it reads and resets the demo student's
 * saved preferences in the database in DATABASE_URL, so run it where that is a demo database.
 * Usage: npx tsx scripts/test-agent.ts [--runs=3] [--verbose]
 *
 * Each run is one conversation, with saved preferences reset first:
 *   1. "Where have I been eating?"                                          -> getPurchaseSummary
 *   2. "Lunch under $8, nothing fried, and stop suggesting burgers"        -> updatePreferences, then suggestMeals
 *   3. "Order the Garden Grain Bowl"                                        -> requestApproval (mocked: always "denied")
 *   4. "What are my rewards worth?"                                         -> getRewards or rankRedemptions
 * requestApproval has no server side (the browser answers it), so here it returns "denied": no payment is made, and
 * the agent has nothing to claim was paid.
 *
 * Checks: the expected tools ran; every $ amount and point count in a reply appears in that turn's tool inputs and
 * outputs (or the user's message); no burger in any suggestMeals pick from the demo prompt onward; and at the end the
 * saved blocklist holds only the burger term (one-off limits like "$8" and "fried" aren't saved).
 * The state matches the demo (Alex's 620 points, the seeded PayPal history); `npm run reset-demo` restores it.
 */

// Same as app/api/chat/route.ts.
const MODEL = "claude-opus-5-5";
const EFFORT = "medium";
const MAX_STEPS = 8;

const DEMO_PROMPT = "Lunch under $8, nothing fried, and stop suggesting burgers";
const ORDER_ITEM = "Garden Grain Bowl";

type Turn = {
  prompt: string;
  /** Tool names that must each be called at least once. */
  expect: string[];
  /** At least one of these must be called (when non-empty). */
  expectAny?: string[];
};

const TURNS: Turn[] = [
  { prompt: "Where have I been eating?", expect: ["getPurchaseSummary"] },
  { prompt: DEMO_PROMPT, expect: ["updatePreferences", "suggestMeals"] },
  { prompt: `Order the ${ORDER_ITEM}`, expect: ["requestApproval"] },
  { prompt: "What are my rewards worth?", expect: [], expectAny: ["getRewards", "rankRedemptions"] },
];
const DEMO_TURN = 1; // index of the turn that sets the burger block

const burgerItems = new Set(
  (loadCatalog("demo-diner")?.items ?? []).filter((i) => i.tags.includes("burger")).map((i) => i.name),
);
const friedItems = new Set(
  (loadCatalog("demo-diner")?.items ?? []).filter((i) => i.tags.includes("fried")).map((i) => i.name),
);

type Call = { toolName: string; input: unknown; output?: unknown };

/** Dollar amounts ("$7.25", "$8") in text, as cents. */
function dollarCents(text: string): number[] {
  return [...text.matchAll(/\$(\d[\d,]*(?:\.\d{1,2})?)/g)].map((m) => Math.round(Number(m[1].replace(/,/g, "")) * 100));
}

/** Point counts ("72 pts", "+1,330 points") in text. */
function pointCounts(text: string): number[] {
  return [...text.matchAll(/(\d[\d,]*)\s*(?:pts?|points?)\b/gi)].map((m) => Number(m[1].replace(/,/g, "")));
}

/**
 * Numbers in the reply that no tool result (or the user) gave. A cents value in a tool output counts as its dollar
 * amount too, so "$7.25" is fine when only `priceCents: 725` appears.
 */
function unbackedNumbers(reply: string, sourceText: string): string[] {
  const sourceDollarCents = new Set(dollarCents(sourceText));
  const bad: string[] = [];
  for (const cents of new Set(dollarCents(reply))) {
    if (!sourceDollarCents.has(cents) && !appearsInText(cents, sourceText)) bad.push(`$${(cents / 100).toFixed(2)}`);
  }
  for (const n of new Set(pointCounts(reply))) {
    if (!appearsInText(n, sourceText)) bad.push(`${n} pts`);
  }
  return bad;
}

/** Earlier turns' thinking blocks are rejected once a new user message follows (see dropOldReasoning in the chat route). */
function withoutReasoning(ms: ModelMessage[]): ModelMessage[] {
  return ms.map((m) =>
    m.role === "assistant" && typeof m.content !== "string" ? { ...m, content: m.content.filter((p) => p.type !== "reasoning") } : m,
  );
}

async function runOnce(run: number, verbose: boolean): Promise<string[]> {
  const failures: string[] = [];
  const fail = (turn: number, msg: string) => failures.push(`turn ${turn + 1}: ${msg}`);

  await db.user.update({ where: { id: DEMO_USER_ID }, data: { prefs: {} } });

  const base = makeTools(DEMO_USER_ID);
  // requestApproval is answered by the browser in the app; here it always returns "denied".
  const tools = { ...base, requestApproval: { ...base.requestApproval, execute: async () => ({ status: "denied" as const }) } };

  const messages: ModelMessage[] = [];
  for (const [t, turn] of TURNS.entries()) {
    messages.push({ role: "user", content: turn.prompt });
    const result = await generateText({
      model: anthropic(MODEL),
      instructions: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: isStepCount(MAX_STEPS),
      toolCallConcurrency: 1,
      providerOptions: { anthropic: { effort: EFFORT } satisfies AnthropicLanguageModelOptions },
    });
    messages.push(...withoutReasoning(result.response.messages)); // as app/api/chat/route.ts does for earlier turns

    const calls: Call[] = result.steps.flatMap((s) =>
      s.toolCalls.map((c) => ({
        toolName: c.toolName,
        input: c.input,
        output: s.toolResults.find((r) => r.toolCallId === c.toolCallId)?.output,
      })),
    );
    const reply = result.steps.map((s) => s.text).join("\n").trim();
    const names = calls.map((c) => c.toolName);
    if (verbose) console.log(`  [run ${run} turn ${t + 1}] ${turn.prompt}\n    tools: ${names.join(", ") || "(none)"}\n    reply: ${reply}`);

    if (!reply) fail(t, "no reply text");
    for (const name of turn.expect) if (!names.includes(name)) fail(t, `expected a ${name} call, got [${names.join(", ")}]`);
    if (turn.expectAny && !turn.expectAny.some((n) => names.includes(n))) {
      fail(t, `expected one of ${turn.expectAny.join(" / ")}, got [${names.join(", ")}]`);
    }

    // The block is saved before suggestMeals reads it, as the prompt asks.
    if (t === DEMO_TURN && names.includes("updatePreferences") && names.includes("suggestMeals")) {
      if (names.indexOf("updatePreferences") > names.indexOf("suggestMeals")) fail(t, "suggestMeals ran before updatePreferences");
    }

    // Numbers: everything the reply states must be in this turn's tool inputs and outputs, or in the user's message.
    const source = `${turn.prompt}\n${JSON.stringify(calls.map((c) => [c.input, c.output]))}`;
    const bad = unbackedNumbers(reply, source);
    if (bad.length) fail(t, `numbers not in this turn's tool results: ${bad.join(", ")}`);

    // Burgers: none in any pick from the demo prompt onward. "Fried" items too in the demo turn ("nothing fried").
    if (t >= DEMO_TURN) {
      for (const c of calls.filter((c) => c.toolName === "suggestMeals")) {
        const picks = ((c.output as { picks?: { item: string }[] } | undefined)?.picks ?? []).map((p) => p.item);
        const burgers = picks.filter((i) => burgerItems.has(i));
        if (burgers.length) fail(t, `burger in picks: ${burgers.join(", ")}`);
        if (t === DEMO_TURN) {
          const fried = picks.filter((i) => friedItems.has(i));
          if (fried.length) fail(t, `fried item in picks: ${fried.join(", ")}`);
        }
      }
      if (t === DEMO_TURN && [...burgerItems].some((name) => reply.includes(name))) fail(t, "the reply names a burger item");
    }

    // The order: the approval must be for the item the user asked for, on Demo Diner.
    if (turn.expect.includes("requestApproval")) {
      const req = calls.find((c) => c.toolName === "requestApproval")?.input as { item?: string; programId?: string } | undefined;
      if (req && req.item !== ORDER_ITEM) fail(t, `approval was for "${req.item}", not "${ORDER_ITEM}"`);
    }
  }

  // Saved preferences after the demo prompt: only the burger term. One-off limits ("$8", "fried") aren't saved.
  const prefs = await getPrefs(DEMO_USER_ID);
  if (prefs.blocklist.length !== 1 || !/burger/i.test(prefs.blocklist[0])) {
    failures.push(`saved blocklist should hold only the burger term, got ${JSON.stringify(prefs.blocklist)}`);
  }
  if (prefs.budgetCents !== null) failures.push(`the one-off $8 budget was saved: ${prefs.budgetCents}`);
  if (prefs.diet.length) failures.push(`diet was saved: ${JSON.stringify(prefs.diet)}`);
  return failures;
}

async function main() {
  const { values } = parseArgs({
    options: { runs: { type: "string", default: "3" }, verbose: { type: "boolean", default: false } },
  });
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");

  let clean = 0;
  for (let run = 1; run <= runs; run++) {
    console.log(`Run ${run}/${runs}`);
    let failures: string[];
    try {
      failures = await runOnce(run, values.verbose);
    } catch (err) {
      failures = [`threw: ${err instanceof Error ? err.message : String(err)}`];
    }
    if (failures.length === 0) {
      clean++;
      console.log("  PASS");
    } else {
      for (const f of failures) console.log(`  FAIL  ${f}`);
    }
  }
  console.log(`\n${clean}/${runs} clean`);
  await db.$disconnect();
  if (clean < runs) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
