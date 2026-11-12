// Scoring knobs, kept in one place so tuning never touches the scoring logic.
// The ranking order itself (unlocks > close to earning > prefer tags > points earned) is in suggest.ts.
// Which items can be paid comes from lib/paypal/orders.ts, not from here.

export const SCORING = {
  /** How many picks suggestMeals returns. */
  topN: 5,
  /** "Close to earning": points still needed ≤ a typical visit's points × this (dev.md: × 2). */
  closeToEarningVisits: 2,
  /** Purchase history window used for the typical visit. */
  historyDays: 30,
} as const;
