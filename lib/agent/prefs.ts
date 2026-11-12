// Saved preferences (User.prefs): a blocklist, diet tags and a budget.
// suggestMeals merges these in code, so a blocked item stays out whatever the prompt says.
// Pure (no database), so scripts/test-scoring.ts can check the rules; getPrefs/updatePrefs are in data.ts.
import { z } from "zod";
import { CATALOG_TAGS, type CatalogTag } from "@/lib/scoring/catalog";
import { normalizeTerm, sameTerm } from "@/lib/scoring/terms";

export const MAX_TERM_LENGTH = 40;
export const MAX_BLOCKLIST = 50;

const isTerm = (v: unknown): v is string => typeof v === "string" && normalizeTerm(v) !== "";
const isTag = (v: unknown): v is CatalogTag => (CATALOG_TAGS as readonly unknown[]).includes(v);

/**
 * A saved list: keeps the valid entries and drops the rest, so one bad entry can't wipe the blocklist.
 * A missing or non-array value becomes [] (`.catch`, because a bare z.unknown() still rejects a missing key).
 */
const savedList = <T>(keep: (v: unknown) => v is T) =>
  z.array(z.unknown()).catch([]).transform((v): T[] => v.filter(keep));

// A missing or bad field falls back on its own, so `{}` (what reset-demo writes) parses to the defaults.
const PrefsSchema = z.object({
  blocklist: savedList(isTerm),
  diet: savedList(isTag),
  budgetCents: z.number().int().positive().nullable().catch(null),
});

export type Prefs = z.infer<typeof PrefsSchema>;

const defaultPrefs = (): Prefs => ({ blocklist: [], diet: [], budgetCents: null });

/** Saved prefs JSON → Prefs. Anything that isn't an object gives the defaults. */
export function parsePrefs(json: unknown): Prefs {
  const result = PrefsSchema.safeParse(json);
  return result.success ? result.data : defaultPrefs();
}

const Term = z.string().trim().min(1).max(MAX_TERM_LENGTH);

/** What updatePreferences accepts. The tool uses this schema, so the tool and the merge rules can't disagree. */
export const PrefsUpdateSchema = z.object({
  addBlock: z.array(Term).optional().describe('Things to stop suggesting from now on, e.g. ["burger"]'),
  removeBlock: z.array(Term).optional().describe("Blocks the user lifts"),
  diet: z.array(z.enum(CATALOG_TAGS)).optional().describe("Replaces the saved diet list, so send the full list; [] clears it"),
  budgetCents: z.number().int().positive().nullable().optional().describe("Default max price in cents; null clears it"),
});

export type PrefsUpdate = z.infer<typeof PrefsUpdateSchema>;

/** The prefs after an update. Leaves `prefs` unchanged. Adds run before removes. */
export function applyPrefsUpdate(prefs: Prefs, update: PrefsUpdate): Prefs {
  const blocklist = [...prefs.blocklist];
  for (const raw of update.addBlock ?? []) {
    const term = normalizeTerm(raw);
    // Skip, don't cut: a shortened term would block something the user didn't name.
    if (!term || term.length > MAX_TERM_LENGTH || blocklist.length >= MAX_BLOCKLIST) continue;
    if (!blocklist.some((b) => sameTerm(b, term))) blocklist.push(term);
  }
  const removes = update.removeBlock ?? [];

  return {
    blocklist: blocklist.filter((b) => !removes.some((r) => sameTerm(b, r))),
    diet: update.diet !== undefined ? [...new Set(update.diet)] : [...prefs.diet],
    budgetCents: update.budgetCents !== undefined ? update.budgetCents : prefs.budgetCents,
  };
}
