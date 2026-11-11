import { NextResponse } from "next/server";
import { endSession } from "../../../../lib/auth/server";

export const dynamic = "force-dynamic";

/** POST -> clears the session cookie. */
export async function POST() {
  return endSession(NextResponse.json({ ok: true }));
}
