// Blocklist terms: how they're stored and compared. Shared by scoring (suggest.ts) and saved prefs (prefs.ts).

/** Lowercase, trimmed, single-spaced. How blocklist terms are stored and compared. */
export function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The words in a name or offer: "Tomato Soup & Grilled Roll" → tomato, soup, grilled, roll. */
export function words(text: string): string[] {
  return normalizeTerm(text).split(/[^a-z0-9]+/).filter(Boolean);
}

/** A word and its possible singulars: "pancakes" → pancakes, pancake, pancak. */
const forms = (word: string) => [word, word.replace(/s$/, ""), word.replace(/es$/, "")].filter(Boolean);

/**
 * True if two blocklist terms mean the same thing: "Burgers" / "burger", "pancakes" / "pancake".
 * Only single words get the plural rule; a phrase ("fried chicken") must match exactly.
 */
export function sameTerm(a: string, b: string): boolean {
  const [x, y] = [normalizeTerm(a), normalizeTerm(b)];
  if (x === y) return true;
  if (x.includes(" ") || y.includes(" ")) return false;
  const yForms = forms(y);
  return forms(x).some((f) => yForms.includes(f));
}
