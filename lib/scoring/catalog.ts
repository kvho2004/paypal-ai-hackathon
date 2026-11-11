// Catalog: hand-curated menu prices and tags per program (data/catalog/<programId>.json).
// - Rewards: gives each extracted reward a dollar value, for cents per point. getRewardRows matches
//   them by name, so reward names must match the site exactly (app/demo-diner/_lib/data.ts).
// - Menu: prices and tags for suggestMeals. `pointCost: null` marks a menu-only item.
// Imported statically (not read with fs), so it's bundled into the Next.js server build and works in tsx scripts.
import { z } from "zod";
import demoDiner from "@/data/catalog/demo-diner.json";

/** Tags that suggestMeals filters on. An enum, so a typo in the JSON fails loudly instead of skipping a filter. */
export const CATALOG_TAGS = [
  "lunch", "breakfast", "dessert", "drink", "side", "vegetarian", "healthy", "fried", "burger",
] as const;
export type CatalogTag = (typeof CATALOG_TAGS)[number];

const CatalogItemSchema = z.strictObject({
  name: z.string().min(1),
  menuPriceCents: z.number().int().positive(),
  pointCost: z.number().int().positive().nullable(),
  tags: z.array(z.enum(CATALOG_TAGS)),
});

const CatalogSchema = z
  .strictObject({
    programId: z.string().min(1),
    name: z.string().min(1),
    earnRate: z.number().positive(), // points per $1
    items: z.array(CatalogItemSchema).min(1),
  })
  .refine(
    (c) => new Set(c.items.map((i) => i.name.trim().toLowerCase())).size === c.items.length,
    "duplicate item names (names are matched case-insensitively)",
  );

export type CatalogItem = z.infer<typeof CatalogItemSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;

/** Parse at import time: a bad catalog fails the build or script that loads it, not a chat turn. */
function parse(json: unknown, file: string): Catalog {
  const result = CatalogSchema.safeParse(json);
  if (!result.success) throw new Error(`Invalid catalog ${file}: ${z.prettifyError(result.error)}`);
  return result.data;
}

const CATALOGS: Catalog[] = [parse(demoDiner, "data/catalog/demo-diner.json")];

/** Every catalog, e.g. for seed-catalog to upsert `Program` and `CatalogItem` rows. */
export function listCatalogs(): Catalog[] {
  return CATALOGS;
}

/** The catalog for one program, or null if it isn't catalogued. */
export function loadCatalog(programId: string): Catalog | null {
  return CATALOGS.find((c) => c.programId === programId) ?? null;
}
