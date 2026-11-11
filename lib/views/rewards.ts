import { db } from "../db";

/** One row in the rewards grid: a single redeemable reward in one program. */
export interface RewardRow {
  id: string;
  programId: string;
  programName: string;
  reward: string;
  pointCost: number;
  balance: number; // the user's current points in this program
  menuValueCents: number | null; // from the catalog; null if the reward isn't catalogued
  centsPerPoint: number | null;
  progress: number; // 0..1 = balance / pointCost
  pointsNeeded: number; // 0 when the reward is already redeemable
  expiresAt: string | null; // YYYY-MM-DD
  fetchedAt: string; // ISO timestamp of the balance read
  source: string; // "live" | "screenshot" | "manual" | "mock"
  valueFlag: "best" | "poor" | null;
}

interface RawReward {
  name: string;
  pointCost: number;
  expiresAt: string | null;
}

/**
 * Balance.rewards holds { rewards, offers, tierProgress } (shape defined by Dev 2 in
 * lib/rewards/types.ts). Parse defensively: skip anything that is not well formed
 * instead of guessing, and accept a bare array too.
 */
export function parseRewards(json: unknown): RawReward[] {
  const list = Array.isArray(json) ? json : (json as { rewards?: unknown } | null)?.rewards;
  if (!Array.isArray(list)) return [];
  const out: RawReward[] = [];
  for (const r of list) {
    const item = r as Partial<RawReward> | null;
    if (item && typeof item.name === "string" && Number.isFinite(item.pointCost) && item.pointCost! > 0) {
      out.push({
        name: item.name,
        pointCost: item.pointCost!,
        expiresAt: typeof item.expiresAt === "string" ? item.expiresAt : null,
      });
    }
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Everything the rewards grid shows for a user, sorted by cents per point (best value first). */
export async function getRewardRows(userId: string): Promise<RewardRow[]> {
  const connections = await db.connection.findMany({ where: { userId } });
  if (connections.length === 0) return [];

  const programIds = [...new Set(connections.map((c) => c.programId))];
  const [programs, catalog, balances] = await Promise.all([
    db.program.findMany({ where: { id: { in: programIds } } }),
    db.catalogItem.findMany({ where: { programId: { in: programIds } } }),
    db.balance.findMany({
      where: { connectionId: { in: connections.map((c) => c.id) } },
      orderBy: { fetchedAt: "desc" },
    }),
  ]);

  const programName = new Map(programs.map((p) => [p.id, p.name]));
  const menuValue = new Map(catalog.map((c) => [`${c.programId}|${norm(c.rewardName)}`, c.menuPriceCents]));

  const rows: RewardRow[] = [];
  for (const conn of connections) {
    const latest = balances.find((b) => b.connectionId === conn.id); // newest first
    if (!latest) continue;

    for (const r of parseRewards(latest.rewards)) {
      const menuValueCents = menuValue.get(`${conn.programId}|${norm(r.name)}`) ?? null;
      rows.push({
        id: `${conn.id}:${norm(r.name)}`,
        programId: conn.programId,
        programName: programName.get(conn.programId) ?? conn.programId,
        reward: r.name,
        pointCost: r.pointCost,
        balance: latest.points,
        menuValueCents,
        centsPerPoint: menuValueCents === null ? null : menuValueCents / r.pointCost,
        progress: Math.min(latest.points / r.pointCost, 1),
        pointsNeeded: Math.max(r.pointCost - latest.points, 0),
        expiresAt: r.expiresAt,
        fetchedAt: latest.fetchedAt.toISOString(),
        source: latest.source,
        valueFlag: null,
      });
    }
  }

  // "Poor use": 30%+ below the median value within the same program. "Best": top value overall.
  const valued = rows.filter((r) => r.centsPerPoint !== null);
  for (const programId of new Set(valued.map((r) => r.programId))) {
    const inProgram = valued.filter((r) => r.programId === programId);
    if (inProgram.length < 2) continue;
    const med = median(inProgram.map((r) => r.centsPerPoint!));
    for (const r of inProgram) if (r.centsPerPoint! < med * 0.7) r.valueFlag = "poor";
  }
  if (valued.length >= 2) {
    const top = valued.reduce((a, b) => (b.centsPerPoint! > a.centsPerPoint! ? b : a));
    top.valueFlag = "best";
  }

  return rows.sort((a, b) => (b.centsPerPoint ?? -1) - (a.centsPerPoint ?? -1));
}
