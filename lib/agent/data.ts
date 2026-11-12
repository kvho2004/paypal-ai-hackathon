// Database access behind the agent tools: rewards and purchase reads, and saving preferences.
// Balances, pending points and value flags come from getRewardRows (one source of truth);
// this adds what it leaves out: offers, connection status, purchase history.
import { db } from "@/lib/db";
import { getPurchaseSummary } from "@/lib/purchases";
import { OfferSchema, type Offer } from "@/lib/rewards/types";
import { listCatalogs } from "@/lib/scoring/catalog";
import { SCORING } from "@/lib/scoring/config";
import { activeOffers, type ProgramState } from "@/lib/scoring/suggest";
import { typicalPointsPerVisit } from "@/lib/scoring/value";
import { getRewardRows, type RewardRow } from "@/lib/views/rewards";
import { applyPrefsUpdate, parsePrefs, type Prefs, type PrefsUpdate } from "./prefs";

export interface ProgramRewards {
  programId: string;
  programName: string;
  connectionId: string;
  status: string; // PENDING | ACTIVE | NEEDS_AUTH | EXTRACT_FAILED
  points: number | null; // balance at the last read; null if never read
  pendingPoints: number;
  fetchedAt: Date | null;
  source: string | null;
  rows: RewardRow[];
  offers: Offer[];
}

/** Offers saved in Balance.rewards ({ rewards, offers, tierProgress }); malformed ones are skipped. */
function parseOffers(json: unknown): Offer[] {
  const list = (json as { offers?: unknown } | null)?.offers;
  if (!Array.isArray(list)) return [];
  return list.flatMap((o) => {
    const parsed = OfferSchema.safeParse(o);
    return parsed.success ? [parsed.data] : [];
  });
}

/** One entry per connected program, newest balance read first wins. */
export async function loadRewards(userId: string): Promise<ProgramRewards[]> {
  const connections = await db.connection.findMany({ where: { userId } });
  if (connections.length === 0) return [];

  const [rows, programs, balances] = await Promise.all([
    getRewardRows(userId),
    db.program.findMany({ where: { id: { in: connections.map((c) => c.programId) } } }),
    db.balance.findMany({
      where: { connectionId: { in: connections.map((c) => c.id) } },
      orderBy: { fetchedAt: "desc" },
    }),
  ]);
  const programName = new Map(programs.map((p) => [p.id, p.name]));
  const catalogName = new Map(listCatalogs().map((c) => [c.programId, c.name]));

  return connections.map((conn) => {
    const latest = balances.find((b) => b.connectionId === conn.id) ?? null;
    const programRows = rows.filter((r) => r.programId === conn.programId);
    return {
      programId: conn.programId,
      programName: programName.get(conn.programId) ?? catalogName.get(conn.programId) ?? conn.programId,
      connectionId: conn.id,
      status: conn.status,
      points: latest?.points ?? null,
      pendingPoints: programRows[0]?.pendingPoints ?? 0,
      fetchedAt: latest?.fetchedAt ?? null,
      source: latest?.source ?? null,
      rows: programRows,
      offers: latest ? parseOffers(latest.rewards) : [],
    };
  });
}

/** Typical points per visit for each catalogued program, from the user's recent PayPal purchases. */
export async function loadPointsPerVisit(userId: string): Promise<Map<string, number>> {
  const summary = await getPurchaseSummary(userId, SCORING.historyDays);
  const perVisit = new Map<string, number>();
  for (const catalog of listCatalogs()) {
    const row = summary.find((s) => s.programId === catalog.programId);
    perVisit.set(catalog.programId, row ? typicalPointsPerVisit(row.totalCents, row.visits, catalog.earnRate) : 0);
  }
  return perVisit;
}

/** Scoring input for every connected program that has a balance. Expired offers are left out. */
export function toProgramStates(
  rewards: ProgramRewards[],
  pointsPerVisit: ReadonlyMap<string, number>,
): Map<string, ProgramState> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, like Offer.expiresAt
  const states = new Map<string, ProgramState>();
  for (const p of rewards) {
    if (p.points === null) continue;
    states.set(p.programId, {
      programId: p.programId,
      points: p.points + p.pendingPoints,
      rewards: p.rows.map((r) => ({ name: r.reward, pointCost: r.pointCost })),
      offers: activeOffers(p.offers, today),
      pointsPerVisit: pointsPerVisit.get(p.programId) ?? 0,
    });
  }
  return states;
}

export async function getPrefs(userId: string): Promise<Prefs> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { prefs: true } });
  return parsePrefs(user?.prefs ?? {});
}

export async function updatePrefs(userId: string, update: PrefsUpdate): Promise<Prefs> {
  const prefs = applyPrefsUpdate(await getPrefs(userId), update);
  await db.user.update({ where: { id: userId }, data: { prefs } });
  return prefs;
}
