// suggestMeals: filter the catalog by budget, meal, diet and blocklist, then rank by reward impact.
// Pure: no database and no LLM, so scripts/test-scoring.ts can check it directly.
import type { RankedPick } from "@/lib/agent/types";
import type { Catalog, CatalogItem, CatalogTag } from "./catalog";
import { SCORING } from "./config";
import { normalizeTerm, sameTerm, words } from "./terms";
import { closeToEarning, pointsFor } from "./value";

/** What scoring needs to know about one program that has a balance. */
export interface ProgramState {
  programId: string;
  points: number; // balance + pending points: what counts toward rewards right now
  rewards: { name: string; pointCost: number }[]; // from the latest read of the program's site
  offers: { name: string; expiresAt: string | null }[]; // pass through activeOffers first
  pointsPerVisit: number; // typical visit; 0 with no purchase history
}

export interface SuggestOptions {
  budgetCents: number | null;
  meal: CatalogTag | null; // the item must have this tag, e.g. "lunch"
  diet: CatalogTag[]; // the item must have every one of these tags
  exclude: string[]; // saved blocklist + this request's exclusions; see matchesTerm
  prefer: CatalogTag[]; // soft: items with more of these tags rank higher (never saved in prefs)
  programId?: string | null;
}

/** Which picks can be paid: the rules in lib/paypal/orders.ts, passed in so this file stays database-free. */
export interface CheckoutRules {
  programId: string;
  maxCents: number; // inclusive
}

// ---- Blocklist ----------------------------------------------------------------------------------------------

/**
 * True if a blocklist term rules out an item. For "Seasoned Fries" (tags side, fried, vegetarian) in Demo Diner:
 * - "fried" matches a tag, "fries" matches a word in the name
 * - "demo diner" or "demo-diner" matches the program, so it rules out every Demo Diner item
 * - "fried chicken" (a phrase) only matches a name containing that phrase, so not this item
 */
export function matchesTerm(term: string, item: CatalogItem, catalog: Catalog): boolean {
  const t = normalizeTerm(term);
  if (!t) return false;
  if (t === catalog.programId || t === normalizeTerm(catalog.name)) return true;
  if (t.includes(" ")) return normalizeTerm(item.name).includes(t);
  return [...item.tags, ...words(item.name)].some((w) => sameTerm(w, t));
}

// ---- Offers ----------------------------------------------------------------------------------------------------

/** Offers still valid on `today` (YYYY-MM-DD). An offer with no date shown counts as valid. */
export function activeOffers<T extends { expiresAt: string | null }>(offers: T[], today: string): T[] {
  return offers.filter((o) => o.expiresAt === null || o.expiresAt >= today);
}

/**
 * The first offer that names this item: an offer word equals a word in the item's name, e.g. "$2 off any bowl"
 * for "Garden Grain Bowl". The program's own name ("Demo Diner") doesn't count, or every item would match.
 */
function matchingOffer(item: CatalogItem, catalog: Catalog, offers: { name: string }[]): string | null {
  const programWords = new Set(words(catalog.name));
  const itemWords = words(item.name).filter((w) => !programWords.has(w));
  return offers.find((o) => words(o.name).some((w) => itemWords.some((iw) => sameTerm(iw, w))))?.name ?? null;
}

// ---- Ranking -------------------------------------------------------------------------------------------------

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

interface RewardImpact {
  unlocks: string | null; // the biggest reward this purchase newly makes redeemable
  close: { reward: string; pointsAway: number } | null; // otherwise, the next reward if it's close after it
}

function rewardImpact(state: ProgramState, earned: number): RewardImpact {
  const after = state.points + earned;
  const unlocked = state.rewards
    .filter((r) => r.pointCost > state.points && r.pointCost <= after)
    .sort((a, b) => b.pointCost - a.pointCost)[0];
  if (unlocked) return { unlocks: unlocked.name, close: null };

  const next = state.rewards.filter((r) => r.pointCost > after).sort((a, b) => a.pointCost - b.pointCost)[0];
  if (next && closeToEarning(next.pointCost - after, state.pointsPerVisit)) {
    return { unlocks: null, close: { reward: next.name, pointsAway: next.pointCost - after } };
  }
  return { unlocks: null, close: null };
}

function passesFilters(item: CatalogItem, catalog: Catalog, opts: SuggestOptions): boolean {
  return (
    (opts.budgetCents === null || item.menuPriceCents <= opts.budgetCents) &&
    (opts.meal === null || item.tags.includes(opts.meal)) &&
    opts.diet.every((d) => item.tags.includes(d)) &&
    !opts.exclude.some((term) => matchesTerm(term, item, catalog))
  );
}

/** The pick's reasons, built from numbers so the agent can quote them without inventing any. */
function buildReasons(
  item: CatalogItem,
  opts: SuggestOptions,
  pointsEarned: number,
  impact: RewardImpact | null, // null: no balance read for this program yet
  offer: string | null,
): string[] {
  const reasons = [
    opts.budgetCents === null
      ? usd(item.menuPriceCents)
      : `${usd(item.menuPriceCents)}, within your ${usd(opts.budgetCents)} budget`,
  ];
  if (opts.diet.length > 0) reasons.push(opts.diet.join(", "));
  if (impact === null) reasons.push(`+${pointsEarned} pts (no rewards balance yet)`);
  else if (impact.unlocks) reasons.push(`+${pointsEarned} pts → ${impact.unlocks} ready`);
  else if (impact.close) reasons.push(`+${pointsEarned} pts → ${impact.close.reward} ${impact.close.pointsAway} pts away`);
  else reasons.push(`+${pointsEarned} pts`);
  if (offer) reasons.push(`offer: ${offer}`);
  return reasons;
}

interface Candidate {
  pick: RankedPick;
  unlocks: boolean;
  close: boolean;
  preferShare: number; // share of the requested prefer tags the item has, 0..1
}

/**
 * The ranking, in order: unlocks a reward > close to earning > more prefer tags > more points earned.
 * A matching offer only breaks ties; then cheaper first, then by name, so the order is stable.
 */
const byRank = (a: Candidate, b: Candidate) =>
  Number(b.unlocks) - Number(a.unlocks) ||
  Number(b.close) - Number(a.close) ||
  b.preferShare - a.preferShare ||
  b.pick.pointsEarned - a.pick.pointsEarned ||
  Number(b.pick.offer !== null) - Number(a.pick.offer !== null) ||
  a.pick.priceCents - b.pick.priceCents ||
  a.pick.item.localeCompare(b.pick.item);

/** Ranked meal picks, best first, at most SCORING.topN. */
export function suggestMeals(
  catalogs: Catalog[],
  states: ReadonlyMap<string, ProgramState>,
  opts: SuggestOptions,
  checkout: CheckoutRules,
): RankedPick[] {
  const candidates: Candidate[] = [];

  for (const catalog of catalogs) {
    if (opts.programId && catalog.programId !== opts.programId) continue;
    const state = states.get(catalog.programId);

    for (const item of catalog.items) {
      if (!passesFilters(item, catalog, opts)) continue;

      const pointsEarned = pointsFor(item.menuPriceCents, catalog.earnRate);
      const impact = state ? rewardImpact(state, pointsEarned) : null;
      const offer = state ? matchingOffer(item, catalog, state.offers) : null;

      candidates.push({
        unlocks: impact?.unlocks != null,
        close: impact?.close != null,
        preferShare: opts.prefer.length > 0 ? opts.prefer.filter((p) => item.tags.includes(p)).length / opts.prefer.length : 0,
        pick: {
          programId: catalog.programId,
          item: item.name,
          priceCents: item.menuPriceCents,
          score: 0, // set from the rank below
          reasons: buildReasons(item, opts, pointsEarned, impact, offer),
          pointsEarned,
          unlocks: impact?.unlocks ?? null,
          offer,
          canCheckout: catalog.programId === checkout.programId && item.menuPriceCents <= checkout.maxCents,
        },
      });
    }
  }

  // The score is the rank turned around (the best of n candidates scores n), so higher is better
  // within one result list, as RankedPick says.
  const ranked = candidates.sort(byRank);
  ranked.forEach((c, i) => (c.pick.score = ranked.length - i));
  return ranked.slice(0, SCORING.topN).map((c) => c.pick);
}
