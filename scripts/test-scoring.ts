import { OFFERS, REWARDS } from "../app/demo-diner/_lib/data";
import { applyPrefsUpdate, MAX_BLOCKLIST, parsePrefs, type Prefs } from "../lib/agent/prefs";
import { loadCatalog, type Catalog } from "../lib/scoring/catalog";
import {
  activeOffers,
  matchesTerm,
  suggestMeals,
  type CheckoutRules,
  type ProgramState,
  type SuggestOptions,
} from "../lib/scoring/suggest";
import { sameTerm } from "../lib/scoring/terms";
import { rankRedemptions, typicalPointsPerVisit } from "../lib/scoring/value";
import type { RewardRow } from "../lib/views/rewards";

/**
 * Checks the scoring and preference rules. No database, no LLM.
 * Usage: npx tsx scripts/test-scoring.ts
 *
 * The state matches the demo: Alex has 620 points (app/demo-diner/_lib/data.ts), and the seeded PayPal history
 * (scripts/seed-sandbox.ts) has three Demo Diner visits: $9.50, $8.25 and $11.00. If either changes, update the
 * numbers here; the checks will fail loudly until you do.
 */

let failures = 0;
function check(ok: boolean, label: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
}

const catalog = loadCatalog("demo-diner");
if (!catalog) throw new Error("No demo-diner catalog");
const itemNamed = (name: string) => catalog.items.find((i) => i.name === name)!;
const tagsOf = (name: string) => itemNamed(name)?.tags ?? [];

const CHECKOUT: CheckoutRules = { programId: "demo-diner", maxCents: 5000 }; // as in lib/paypal/orders.ts
const TODAY = "2026-11-11";
const BALANCE = 620;
const pointsPerVisit = typicalPointsPerVisit(950 + 825 + 1100, 3, catalog.earnRate);
// What extraction reads from the live site: the bowl offer shows "Redeem by Nov 20, 2026", the others no date.
const OFFERS_READ = OFFERS.map((o) => ({ name: o.title, expiresAt: /bowl/i.test(o.title) ? "2026-11-20" : null }));

const stateAt = (points: number, today = TODAY): Map<string, ProgramState> =>
  new Map([
    [
      "demo-diner",
      {
        programId: "demo-diner",
        points,
        rewards: REWARDS.map((r) => ({ name: r.name, pointCost: r.pointCost })),
        offers: activeOffers(OFFERS_READ, today),
        pointsPerVisit,
      },
    ],
  ]);
const LUNCH: SuggestOptions = { budgetCents: 800, meal: "lunch", diet: [], exclude: [], prefer: [], programId: null };
const suggest = (states: Map<string, ProgramState>, opts: Partial<SuggestOptions> = {}, catalogs = [catalog]) =>
  suggestMeals(catalogs, states, { ...LUNCH, ...opts }, CHECKOUT);

console.log(`Typical visit: ${pointsPerVisit.toFixed(2)} pts\n`);

// ---- Demo prompt: "Lunch under $8, nothing fried, and stop suggesting burgers" ----
const prefs = applyPrefsUpdate(parsePrefs({}), { addBlock: ["burgers"] });
const picks = suggest(stateAt(BALANCE), { exclude: [...prefs.blocklist, "fried"] });
console.log("Picks:");
for (const p of picks) console.log(`  ${p.score}  ${p.item}: ${p.reasons.join("; ")}`);
console.log();

check(picks.length >= 3, `at least 3 picks (got ${picks.length})`);
check(picks.every((p) => p.priceCents <= 800), "nothing over $8");
check(picks.every((p) => !tagsOf(p.item).includes("fried")), "nothing tagged fried");
check(picks.every((p) => !tagsOf(p.item).includes("burger")), "no burgers");
check(picks.every((p) => tagsOf(p.item).includes("lunch")), "every pick is a lunch item");
check(picks.every((p) => p.canCheckout), "every Demo Diner pick can be paid");
check(picks.every((p, i) => i === 0 || p.score < picks[i - 1].score), "scores fall with rank");

const top = picks[0];
check(top?.item === "Garden Grain Bowl", `Garden Grain Bowl on top (got ${top?.item})`);
check(top?.pointsEarned === 72, `Garden Grain Bowl earns 72 pts (got ${top?.pointsEarned})`);
check(top?.unlocks === "Garden Grain Bowl", `620 + 72 unlocks Garden Grain Bowl (got ${top?.unlocks})`);
check(top?.reasons.includes("+72 pts → Garden Grain Bowl ready") ?? false, 'reason "+72 pts → Garden Grain Bowl ready"');
check(top?.offer === "$2 off any bowl", `matching offer "$2 off any bowl" (got ${top?.offer})`);
check(picks.slice(1).every((p) => p.offer === null), "the bowl offer attaches to the bowl only");

// ---- Blocklist ----
check(suggest(stateAt(BALANCE), { exclude: ["fried"] }).some((p) => p.item === "Diner Slider Duo"), "without the block, the slider is suggested");
check(matchesTerm("pancakes", itemNamed("Buttermilk Pancake Stack"), catalog), '"pancakes" blocks Buttermilk Pancake Stack');
check(matchesTerm("sides", itemNamed("Seasoned Fries"), catalog), '"sides" blocks Seasoned Fries (tag "side")');
check(!matchesTerm("fried chicken", itemNamed("Seasoned Fries"), catalog), '"fried chicken" is a phrase: doesn\'t block fries');
check(suggest(stateAt(BALANCE), { exclude: ["demo diner"] }).length === 0, '"demo diner" blocks every Demo Diner item');
check(
  sameTerm("Fries", "fries") && sameTerm("burgers", "burger") && sameTerm("cookies", "cookie") && !sameTerm("fried", "fries"),
  "plural matching",
);

// ---- Preferences ----
const DEFAULTS = JSON.stringify({ blocklist: [], diet: [], budgetCents: null });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
check(same(parsePrefs({}), JSON.parse(DEFAULTS)), "{} parses to defaults");
check(
  [null, [], "burger", 5].every((garbage) => JSON.stringify(parsePrefs(garbage)) === DEFAULTS),
  "null, an array, a string or a number parse to defaults",
);
const oneBadField = parsePrefs({ blocklist: ["burger"], budgetCents: "8" });
check(same(oneBadField.blocklist, ["burger"]) && oneBadField.budgetCents === null, "a bad budget falls back to null, the blocklist survives");
const badEntries = parsePrefs({ blocklist: ["burger", 5, "  ", null, "fries"], diet: ["vegetarian", "keto", 3] });
check(same(badEntries.blocklist, ["burger", "fries"]), `bad blocklist entries are dropped, not the list (got ${JSON.stringify(badEntries.blocklist)})`);
check(same(badEntries.diet, ["vegetarian"]), `diet keeps only catalog tags (got ${JSON.stringify(badEntries.diet)})`);

check(applyPrefsUpdate(prefs, { removeBlock: ["Burger"] }).blocklist.length === 0, 'removeBlock "Burger" lifts "burgers"');
check(applyPrefsUpdate(prefs, { addBlock: ["Burger"] }).blocklist.length === 1, "adding Burger next to burgers doesn't duplicate");
const pancake = applyPrefsUpdate(parsePrefs({}), { addBlock: ["pancake"] });
check(same(applyPrefsUpdate(pancake, { addBlock: ["pancakes"] }).blocklist, ["pancake"]), 'adding "pancakes" next to "pancake" doesn\'t duplicate');
check(applyPrefsUpdate(pancake, { removeBlock: ["pancakes"] }).blocklist.length === 0, 'removeBlock "pancakes" lifts "pancake"');
check(applyPrefsUpdate(prefs, { addBlock: ["   ", "x".repeat(41)] }).blocklist.length === 1, "empty and over-long terms are skipped, not cut");
const full: Prefs = { blocklist: Array.from({ length: MAX_BLOCKLIST }, (_, i) => `item${i}`), diet: [], budgetCents: null };
check(applyPrefsUpdate(full, { addBlock: ["one more"] }).blocklist.length === MAX_BLOCKLIST, `the blocklist stops at ${MAX_BLOCKLIST}`);

const veg = applyPrefsUpdate(parsePrefs({}), { diet: ["healthy"] });
check(same(applyPrefsUpdate(veg, { diet: ["vegetarian"] }).diet, ["vegetarian"]), "diet replaces the saved list");
check(applyPrefsUpdate(veg, { diet: [] }).diet.length === 0, "diet [] clears it");
check(same(applyPrefsUpdate(veg, {}).diet, ["healthy"]), "no diet in the update keeps it");
const budget = applyPrefsUpdate(parsePrefs({}), { budgetCents: 800 });
check(budget.budgetCents === 800 && applyPrefsUpdate(budget, { budgetCents: null }).budgetCents === null, "budget set, then cleared with null");
check(applyPrefsUpdate(budget, {}).budgetCents === 800, "no budget in the update keeps it");

const before = JSON.stringify(prefs);
applyPrefsUpdate(prefs, { addBlock: ["pie"], removeBlock: ["burger"], diet: ["vegetarian"], budgetCents: 500 });
check(JSON.stringify(prefs) === before, "applyPrefsUpdate leaves its input unchanged");

// ---- Reward impact ----
const after = suggest(stateAt(BALANCE + 72)).find((p) => p.item === "Garden Grain Bowl");
check(after !== undefined && after.unlocks !== "Garden Grain Bowl", `at 692 (paid, pending) the bowl doesn't "unlock" itself (got ${after?.unlocks})`);
const fromZero = suggest(stateAt(0)).find((p) => p.item === "Garden Grain Bowl");
check(
  fromZero?.unlocks === null && (fromZero?.reasons.includes("+72 pts → Bottomless Drip Coffee 78 pts away") ?? false),
  `at 0 pts: close, not unlock (got ${fromZero?.reasons.join("; ")})`,
);
const offline = suggest(new Map());
check(offline.every((p) => p.unlocks === null && p.offer === null), "no balance yet: no unlocks or offers");
check(offline[0]?.reasons.some((r) => r.endsWith("(no rewards balance yet)")) ?? false, 'no balance yet: says "no rewards balance yet"');
check(suggest(stateAt(BALANCE), { budgetCents: null }).some((p) => p.priceCents > 800), "no budget: picks of any price");

// ---- Offers ----
check(activeOffers(OFFERS_READ, "2026-11-21").every((o) => !/bowl/i.test(o.name)), "the bowl offer is dropped after Nov 20");
check(suggest(stateAt(BALANCE, "2026-11-21")).every((p) => p.offer === null), "an expired offer isn't attached");

// ---- Ranking order, on made-up programs ----
const tiny = (programId: string, items: Catalog["items"]): Catalog => ({ programId, name: programId, earnRate: 10, items });
const state = (programId: string, points: number, cost: number): [string, ProgramState] => [
  programId,
  { programId, points, rewards: [{ name: `${programId} reward`, pointCost: cost }], offers: [], pointsPerVisit: 100 },
];
// "unlocker": $2 earns 20, 90 → 110 unlocks. "closer": $9, healthy, earns 90, 0 → 90, 110 short: close only.
const ranked = suggestMeals(
  [tiny("unlocker", [{ name: "Toast", menuPriceCents: 200, pointCost: null, tags: ["lunch"] }]),
   tiny("closer", [{ name: "Salad", menuPriceCents: 900, pointCost: null, tags: ["lunch", "healthy"] }])],
  new Map([state("unlocker", 90, 110), state("closer", 0, 200)]),
  { ...LUNCH, budgetCents: null, prefer: ["healthy"] },
  CHECKOUT,
);
check(ranked[0]?.item === "Toast", `an unlock outranks close + prefer + more points (got ${ranked.map((p) => p.item).join(", ")})`);
// Two equal items: the one with a matching offer goes first, even though its name sorts later.
const tie = suggestMeals(
  [tiny("tie", [
    { name: "Apple Plate", menuPriceCents: 500, pointCost: null, tags: ["lunch"] },
    { name: "Zesty Bowl", menuPriceCents: 500, pointCost: null, tags: ["lunch"] },
  ])],
  new Map([["tie", { programId: "tie", points: 0, rewards: [], offers: [{ name: "$1 off any bowl", expiresAt: null }], pointsPerVisit: 0 }]]),
  LUNCH,
  CHECKOUT,
);
check(tie[0]?.item === "Zesty Bowl", `a matching offer breaks a tie (got ${tie.map((p) => p.item).join(", ")})`);

// ---- Close to earning (rankRedemptions) ----
const rows: RewardRow[] = REWARDS.map((r) => ({
  id: r.name,
  programId: "demo-diner",
  programName: "Demo Diner",
  reward: r.name,
  pointCost: r.pointCost,
  balance: BALANCE,
  pendingPoints: 0,
  menuValueCents: null,
  centsPerPoint: null,
  progress: Math.min(BALANCE / r.pointCost, 1),
  pointsNeeded: Math.max(r.pointCost - BALANCE, 0),
  expiresAt: null,
  fetchedAt: new Date().toISOString(),
  source: "live",
  valueFlag: null,
}));
const byName = new Map(rankRedemptions(rows, new Map([["demo-diner", pointsPerVisit]])).map((r) => [r.reward, r]));
check(byName.get("Garden Grain Bowl")?.closeToEarning === true && byName.get("Garden Grain Bowl")?.visitsNeeded === 1, "Garden Grain Bowl (30 pts short) is close: 1 visit");
check(byName.get("Blue Plate Special")?.closeToEarning === false, "Blue Plate Special (580 short) is not close");
check(byName.get("Bottomless Drip Coffee")?.closeToEarning === false, "an already redeemable reward isn't 'close'");
const noHistory = rankRedemptions(rows, new Map()).find((r) => r.reward === "Garden Grain Bowl");
check(noHistory?.visitsNeeded === null && noHistory.closeToEarning === false, "no purchase history: visitsNeeded is null");

// ---- Catalog data check ----
// Not a test of getRewardRows: this recomputes its flag rule (poor < 70% of the program's median cents per point,
// best = the top value) on the catalog prices, to check the prices give the flags the video needs.
const values = catalog.items
  .filter((i) => i.pointCost !== null)
  .map((i) => ({ name: i.name, cpp: i.menuPriceCents / i.pointCost! }));
const sorted = values.map((v) => v.cpp).sort((a, b) => a - b);
const mid = Math.floor(sorted.length / 2);
const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
const poor = values.filter((v) => v.cpp < median * 0.7).map((v) => v.name);
const best = values.reduce((a, b) => (b.cpp > a.cpp ? b : a)).name;
check(JSON.stringify(poor) === JSON.stringify(["Bottomless Drip Coffee"]), `catalog: only coffee would be poor (got ${poor.join(", ")})`);
check(best === "Buttermilk Pancake Stack", `catalog: pancakes would be best (got ${best})`);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
