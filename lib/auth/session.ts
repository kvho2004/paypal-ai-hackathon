// Signed session cookie: "<payload>.<signature>", where the payload is { uid, exp } and the signature is an
// HMAC-SHA256 with SESSION_SECRET. Uses Web Crypto only, so it runs both in Next middleware (Edge) and in Node.
// Nothing is stored on the server: a valid signature that has not expired is the login.

export const SESSION_COOKIE = "krumms_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

const encoder = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  // A fixed fallback is fine for local development only; production must set a real secret.
  if (process.env.NODE_ENV !== "production") return "dev-only-session-secret-do-not-use-in-production";
  throw new Error("SESSION_SECRET (at least 32 characters) is required in production");
}

/** False when production has no usable SESSION_SECRET. Sign-in cannot work then, and callers should say so. */
export function sessionSecretConfigured(): boolean {
  try {
    secret();
    return true;
  } catch {
    return false;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** A cookie value that proves `userId` signed in. `nowMs` is a parameter so expiry can be tested. */
export async function signSession(userId: string, nowMs: number = Date.now()): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ uid: userId, exp: Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS })),
  );
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(sig))}`;
}

/** The user id in a session token, or null if it is missing, tampered with, malformed, or expired. */
export async function verifySession(token: string | undefined, nowMs: number = Date.now()): Promise<string | null> {
  const [payload, sig] = token?.split(".") ?? [];
  if (!payload || !sig) return null;
  try {
    // crypto.subtle.verify compares in constant time.
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(), fromBase64Url(sig), encoder.encode(payload));
    if (!valid) return null;
    const { uid, exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (typeof uid !== "string" || typeof exp !== "number" || exp * 1000 <= nowMs) return null;
    return uid;
  } catch {
    return null;
  }
}

/** Only paths inside this app, never another site or a protocol-relative URL. */
export function safeNext(next: unknown, fallback = "/purchases"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}
