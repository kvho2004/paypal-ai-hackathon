/**
 * Map a raw PayPal merchant string ("SBUX #1234", "Demo Diner LLC") to a programId.
 * Alias map only for now; an LLM fallback can be added later for unmatched names.
 * Returns null when the merchant is not a known program (shown as "not enrolled").
 */
const ALIASES: Array<[RegExp, string]> = [
  [/\b(starbucks|sbux)\b/i, "starbucks"],
  [/\bchipotle\b/i, "chipotle"],
  [/\bpanera\b/i, "panera"],
  [/\bdemo\s*diner\b/i, "demo-diner"],
];

export function normalizeMerchant(raw: string): string | null {
  for (const [pattern, programId] of ALIASES) {
    if (pattern.test(raw)) return programId;
  }
  return null;
}
