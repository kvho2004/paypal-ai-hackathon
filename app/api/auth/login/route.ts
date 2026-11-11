import { NextResponse, type NextRequest } from "next/server";
import { db } from "../../../../lib/db";
import { verifyPassword } from "../../../../lib/auth/password";
import { sessionSecretConfigured } from "../../../../lib/auth/session";
import { clearFailures, isLockedOut, recordFailure, startSession } from "../../../../lib/auth/server";

export const dynamic = "force-dynamic";

/** POST { email, password } -> sets the session cookie. The error never says which of the two was wrong. */
export async function POST(req: NextRequest) {
  if (!sessionSecretConfigured()) {
    return NextResponse.json({ error: "Sign-in is not configured on this server" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();

  if (isLockedOut(email)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { email } });
  // verifyPassword also runs when the account is missing, so response time does not reveal which emails exist.
  const ok = await verifyPassword(body.password, user?.passwordHash);
  if (!user || !ok) {
    recordFailure(email);
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  clearFailures(email);
  return startSession(NextResponse.json({ ok: true, name: user.name }), req, user.id);
}
