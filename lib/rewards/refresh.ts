// Runs one rewards refresh: Kernel login state -> browser -> site adapter -> extract -> save a Balance.
// Each step's details live in its own module; this file puts them in order and records the outcome.
import { randomUUID } from "node:crypto";
import type { Connection, Prisma } from "../../app/generated/prisma/client";
import { db } from "../db";
import { getAdapter } from "./adapters";
import { extractRewards } from "./extract";
import { getAuthState, profileName, withBrowser } from "./kernel";
import { PageNotReadyError, isLoginPage, type RawRewardsPage, type RefreshResult, type RewardsAdapter } from "./types";

/** Progress callbacks for a caller that shows the refresh live (the /connect page). All optional. */
export interface RefreshHooks {
  /** The cloud browser is up; `url` is its live view. */
  onLiveView?: (url: string) => void;
  /** The page has been read; the text is now being turned into rewards. */
  onExtracting?: () => void;
  /** Keep the browser open this long after the read, so a live view can be filmed. Default 0. */
  holdOpenMs?: number;
}

type Failure = Extract<RefreshResult, { ok: false }>;
const fail = (status: Failure["status"], error: string): Failure => ({ ok: false, status, error });

/**
 * Reads a connection's rewards page, saves a Balance row, and records the outcome on Connection.status.
 * Returns NEEDS_AUTH or EXTRACT_FAILED for problems with the account or the page. Throws on database,
 * Kernel or Anthropic API errors, so a caller can retry later without marking the connection broken.
 */
export async function refreshRewards(connectionId: string, hooks: RefreshHooks = {}): Promise<RefreshResult> {
  const conn = await db.connection.findUniqueOrThrow({ where: { id: connectionId } });
  const adapter = getAdapter(conn.programId);
  if (!adapter) throw new Error(`No rewards adapter for program "${conn.programId}"`);

  const result = await readRewards(conn, adapter, hooks);

  // Save the balance (on success) and the connection's new status together.
  const status = result.ok ? "ACTIVE" : result.status;
  const writes: Prisma.PrismaPromise<unknown>[] = [db.connection.update({ where: { id: conn.id }, data: { status } })];
  if (result.ok) {
    const { points, ...rewards } = result.rewards; // Balance.rewards holds everything except points (dev.md §9)
    writes.push(
      db.balance.create({
        data: { id: randomUUID(), connectionId: conn.id, points, rewards, fetchedAt: result.fetchedAt, source: "live" },
      }),
    );
  }
  await db.$transaction(writes);

  return result;
}

/** Everything that doesn't touch the database: login check, browser, adapter, extraction. */
async function readRewards(conn: Connection, adapter: RewardsAdapter, hooks: RefreshHooks): Promise<RefreshResult> {
  const auth = await getAuthState(conn.kernelAuthId);
  if (auth.status !== "ACTIVE") return fail("NEEDS_AUTH", auth.error ?? "Kernel has no active login for this site");

  // A page that loads without its data is a result; any other error (browser, network) is thrown for a retry.
  let page: RawRewardsPage;
  try {
    page = await withBrowser(profileName(conn.userId, conn.programId), async (p, liveViewUrl) => {
      if (liveViewUrl) hooks.onLiveView?.(liveViewUrl);
      const read = await adapter.extract(p);
      if (hooks.holdOpenMs) await new Promise((r) => setTimeout(r, hooks.holdOpenMs));
      return read;
    });
  } catch (err) {
    if (err instanceof PageNotReadyError) return fail("EXTRACT_FAILED", err.message);
    throw err;
  }
  if (isLoginPage(page.url)) return fail("NEEDS_AUTH", "The site redirected to its login page");

  hooks.onExtracting?.();
  const extracted = await extractRewards(page.text);
  if (!extracted.ok) return fail("EXTRACT_FAILED", extracted.error);

  return { ok: true, rewards: extracted.rewards, fetchedAt: new Date() };
}
