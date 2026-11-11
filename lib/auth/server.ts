import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "../db";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession } from "./session";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

/** The signed-in user's id from the cookie, or null. Does not touch the database. */
export async function getSessionUserId(): Promise<string | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** The signed-in user, or null if signed out or the account no longer exists. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true } });
  return user?.email ? { id: user.id, name: user.name, email: user.email } : null;
}

/** For pages: the signed-in user, or a redirect to the login page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Adds the session cookie to `res`. Marked Secure only over HTTPS, so plain-http local testing still works. */
export async function startSession(res: NextResponse, req: NextRequest, userId: string): Promise<NextResponse> {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol;
  res.cookies.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: proto.startsWith("https"),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export function endSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

// Failed sign-ins per email, kept in memory: enough to stop a guessing script on a single demo server.
const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000;
const g = globalThis as { __loginFailures?: Map<string, number[]> };
const failures = (g.__loginFailures ??= new Map<string, number[]>());

function recentFailures(key: string, now: number): number[] {
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, recent);
  return recent;
}

export const isLockedOut = (email: string, now = Date.now()) => recentFailures(email, now).length >= MAX_FAILURES;
export const recordFailure = (email: string, now = Date.now()) => void recentFailures(email, now).push(now);
export const clearFailures = (email: string) => void failures.delete(email);
