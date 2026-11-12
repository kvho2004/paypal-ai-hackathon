// Reward value helpers: points per purchase, "close to earning", and the rankRedemptions view.
// Pure functions: the agent tools load the data (lib/agent/data.ts) and pass it in.
import type { RewardRow } from "@/lib/views/rewards";
import { SCORING } from "./config";

/** Points a purchase earns. Same rounding as computePendingPoints in lib/views/rewards.ts. */
export function pointsFor(priceCents: number, earnRate: number): number {
  if (!(earnRate > 0) || !(priceCents > 0)) return 0;
  return Math.floor((priceCents / 100) * earnRate);
}

/**
 * Points a typical visit earns: the average purchase × the earn rate. 0 with no history.
 * Not rounded, so "close to earning" is exactly the plan's average purchase × earn rate × 2.
 */
export function typicalPointsPerVisit(totalCents: number, visits: number, earnRate: number): number {
  return visits > 0 && earnRate > 0 ? (totalCents / visits / 100) * earnRate : 0;
}

/** True when a reward isn't redeemable yet but is within `closeToEarningVisits` typical visits. */
export function closeToEarning(pointsNeeded: number, pointsPerVisit: number): boolean {
  return pointsNeeded > 0 && pointsPerVisit > 0 && pointsNeeded <= pointsPerVisit * SCORING.closeToEarningVisits;
}

export interface RankedRedemption extends RewardRow {
  closeToEarning: boolean;
  /** Typical visits until redeemable: 0 if redeemable now, null with no purchase history. */
  visitsNeeded: number | null;
}

/**
 * getRewardRows plus "close to earning", in getRewardRows' order (best cents per point first).
 * Balances, pending points, progress and the best/poor flags come from getRewardRows unchanged.
 */
export function rankRedemptions(
  rows: RewardRow[],
  pointsPerVisit: ReadonlyMap<string, number>,
): RankedRedemption[] {
  return rows.map((row) => {
    const perVisit = pointsPerVisit.get(row.programId) ?? 0;
    return {
      ...row,
      closeToEarning: closeToEarning(row.pointsNeeded, perVisit),
      visitsNeeded: row.pointsNeeded === 0 ? 0 : perVisit > 0 ? Math.ceil(row.pointsNeeded / perVisit) : null,
    };
  });
}
