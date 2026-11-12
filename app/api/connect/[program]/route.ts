import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth/server";
import { db } from "../../../../lib/db";
import { getAdapter } from "../../../../lib/rewards/adapters";
import { createConnection, getAuthState, profileName, startLogin } from "../../../../lib/rewards/kernel";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ program: string }> };

const WAKE_TIMEOUT_MS = 45_000;

/**
 * A sleeping host (Render's free tier) answers its first request with an error page, and Kernel's login would
 * record that as "website_error". One request first wakes it. Best effort: a failure here changes nothing.
 */
async function wakeSite(url: string): Promise<void> {
  await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(WAKE_TIMEOUT_MS) }).catch(() => {});
}

/** POST -> { connectionId, hostedUrl }. Starts a Kernel hosted login; the user logs in there, so Krumms never sees the password. */
export async function POST(_req: Request, { params }: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { program } = await params;
  const adapter = getAdapter(program);
  if (!adapter) return NextResponse.json({ error: "Unknown rewards program" }, { status: 404 });

  try {
    await wakeSite(adapter.balanceUrl);
    const auth = await createConnection({
      profile: profileName(userId, program),
      domain: adapter.domain,
      loginUrl: adapter.balanceUrl, // as scripts/ensure-login.ts: the session ends up on the balance page
      saveCredentials: false,
    });
    const hostedUrl = await startLogin(auth.authId);

    // One Connection per user and program: reconnecting reuses the row. Not atomic (the schema has no unique key on
    // userId + programId), so a double-click could race and create two rows; ConnectFlow is busy while starting.
    const existing = await db.connection.findFirst({ where: { userId, programId: program } });
    const data = { kernelAuthId: auth.authId, status: "PENDING" };
    const connection = existing
      ? await db.connection.update({ where: { id: existing.id }, data })
      : await db.connection.create({ data: { id: randomUUID(), userId, programId: program, ...data } });
    return NextResponse.json({ connectionId: connection.id, hostedUrl });
  } catch (err) {
    console.error("connect: start failed:", err);
    return NextResponse.json({ error: "Could not start the login. Try again." }, { status: 502 });
  }
}

/** GET ?connectionId= -> { status, error }. The page polls this while the user logs in. Also saves the status on the Connection. */
export async function GET(req: Request, { params }: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { program } = await params;
  const connectionId = new URL(req.url).searchParams.get("connectionId");
  const connection = connectionId
    ? await db.connection.findFirst({ where: { id: connectionId, userId, programId: program } })
    : null;
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  try {
    const auth = await getAuthState(connection.kernelAuthId);
    if (auth.status !== connection.status) {
      await db.connection.update({ where: { id: connection.id }, data: { status: auth.status } });
    }
    return NextResponse.json({ status: auth.status, error: auth.error });
  } catch (err) {
    console.error("connect: status failed:", err);
    return NextResponse.json({ error: "Could not check the login. Try again." }, { status: 502 });
  }
}
