import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth/server";
import { db } from "../../../../lib/db";
import { refreshRewards } from "../../../../lib/rewards/refresh";

export const dynamic = "force-dynamic";
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
  let open = true; // false once the client has gone: the refresh still finishes and saves its Balance
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };

      try {
        const result = await refreshRewards(connection.id, {
          onLiveView: (liveViewUrl) => send({ step: "browser", liveViewUrl }),
          onExtracting: () => send({ step: "extracting" }),
        });
        send(
          result.ok
            ? {
                step: "done",
                ok: true,
                points: result.rewards.points,
                rewards: result.rewards.rewards.length,
                fetchedAt: result.fetchedAt.toISOString(),
              }
            : { step: "done", ok: false, status: result.status, error: result.error },
        );
      } catch (err) {
        console.error("rewards refresh failed:", err);
        send({ step: "done", ok: false, status: "ERROR", error: "The rewards site couldn't be read right now. Try again." });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      open = false;
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
