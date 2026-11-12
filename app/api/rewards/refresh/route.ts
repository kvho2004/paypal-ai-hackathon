import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth/server";
import { db } from "../../../../lib/db";
import { refreshRewards } from "../../../../lib/rewards/refresh";
import type { RefreshEvent, RefreshResult } from "../../../../lib/rewards/types";

export const dynamic = "force-dynamic";

const DEMO_HOLD_MS = 3_000; // in DEMO_MODE, the browser stays open this long after the read so the live view can be filmed
// No route timeout on Render's Node server, so the 30-60 s read isn't cut off.

/**
 * POST { connectionId } -> NDJSON, one event per line (the shapes ConnectFlow reads):
 * { step: "browser", liveViewUrl } -> { step: "extracting" } -> { step: "done", ok, ... }
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { connectionId?: unknown } | null;
  const connectionId = typeof body?.connectionId === "string" ? body.connectionId : null;
  const connection = connectionId ? await db.connection.findFirst({ where: { id: connectionId, userId } }) : null;
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Once the client has gone, enqueue throws; the refresh still finishes and saves its Balance.
      const send = (event: RefreshEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {}
      };

      try {
        const result = await refreshRewards(connection.id, {
          onLiveView: (liveViewUrl) => send({ step: "browser", liveViewUrl }),
          onExtracting: () => send({ step: "extracting" }),
          holdOpenMs: process.env.DEMO_MODE === "true" ? DEMO_HOLD_MS : 0,
        });
        send(toDoneEvent(result));
      } catch (err) {
        console.error("rewards refresh failed:", err);
        send({ step: "done", ok: false, status: "ERROR", error: "The rewards site couldn't be read right now. Try again." });
      } finally {
        try {
          controller.close();
        } catch {} // already closed because the client left
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

function toDoneEvent(result: RefreshResult): RefreshEvent {
  if (!result.ok) return { step: "done", ok: false, status: result.status, error: result.error };
  return {
    step: "done",
    ok: true,
    points: result.rewards.points,
    rewards: result.rewards.rewards.length,
    fetchedAt: result.fetchedAt.toISOString(),
  };
}
