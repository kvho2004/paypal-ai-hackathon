// Login cookie: the member's email plus an HMAC signature. Signed rather than stored server-side,
// so a Kernel profile's saved login keeps working across server restarts and redeploys.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import type { Account } from "./data";
import { getAccount } from "./store";

const COOKIE = "dd_session";
const COOKIE_PATH = "/demo-diner";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const SECRET = process.env.DEMO_DINER_SECRET ?? "demo-diner-fictional-site";

const DEFAULT_AFTER_LOGIN = "/demo-diner/rewards";

const hmac = (value: string) => createHmac("sha256", SECRET).update(value).digest("base64url");

/** "<base64url email>.<signature>" */
function encodeToken(email: string): string {
  const value = Buffer.from(email, "utf8").toString("base64url");
  return `${value}.${hmac(value)}`;
}

/** The email in a token, or null if the token is missing or its signature doesn't match. */
function decodeToken(token: string | undefined): string | null {
  const [value, sig] = token?.split(".") ?? [];
  if (!value || !sig) return null;
  const expected = Buffer.from(hmac(value));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return Buffer.from(value, "base64url").toString("utf8");
}

/** The signed-in member, or null. A cookie for an account lost in a restart counts as signed out. */
export async function currentAccount(): Promise<Account | null> {
  const email = decodeToken((await cookies()).get(COOKIE)?.value);
  return (email && getAccount(email)) || null;
}

/** Where to go after signing in. Only paths inside Demo Diner, never another site. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/demo-diner/") ? next : DEFAULT_AFTER_LOGIN;
}

/** Adds the login cookie to `res`. Marked Secure only over HTTPS, so plain-http local testing still works. */
export function signIn(res: NextResponse, req: NextRequest, email: string): NextResponse {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol;
  res.cookies.set(COOKIE, encodeToken(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: proto.startsWith("https"),
    path: COOKIE_PATH,
    maxAge: MAX_AGE,
  });
  return res;
}

export function signOut(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
  return res;
}
