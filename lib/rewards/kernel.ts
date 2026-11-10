// All Kernel calls: Managed Auth (hosted login) and cloud browsers driven by Playwright.
// Knows nothing about specific sites, the LLM, or the database.
import Kernel from "@onkernel/sdk";
import type { ManagedAuth } from "@onkernel/sdk/resources/auth/connections";
import { chromium, type Browser, type Page } from "playwright-core";
import type { ConnectionStatus } from "./types";

let client: Kernel | undefined;

/** Lazy so importing this file doesn't need KERNEL_API_KEY (e.g. during next build). */
export function kernel(): Kernel {
  client ??= new Kernel(); // reads KERNEL_API_KEY, throws a clear error if missing
  return client;
}

/** Kernel profile names allow letters, numbers, dots, underscores and hyphens. */
export function profileName(userId: string, programId: string): string {
  return `${userId}-${programId}`.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 255);
}

// ---------------------------------------------------------------------------
// Managed Auth
// ---------------------------------------------------------------------------

export interface AuthState {
  authId: string;
  status: ConnectionStatus;
  flowStatus: ManagedAuth["flow_status"];
  flowStep: ManagedAuth["flow_step"];
  error: string | null; // Kernel error or the site's own message ("Incorrect password")
  errorCode: string | null; // Kernel's code, e.g. "credentials_invalid", "bot_detected"
}

function toAuthState(a: ManagedAuth): AuthState {
  let status: ConnectionStatus = "NEEDS_AUTH";
  if (a.status === "AUTHENTICATED") status = "ACTIVE";
  else if (a.flow_status === "IN_PROGRESS") status = "PENDING";

  return {
    authId: a.id,
    status,
    flowStatus: a.flow_status ?? null,
    flowStep: a.flow_step ?? null,
    error: a.error_message ?? a.website_error ?? null,
    errorCode: a.error_code ?? null,
  };
}

export interface CreateConnectionOptions {
  profile: string; // from profileName()
  domain: string; // login domain, e.g. "starbucks.com"
  loginUrl?: string; // skips discovery; needed when the login page isn't at the domain root (Demo Diner)
  saveCredentials?: boolean; // lets Kernel re-login on its own; default true
}

/** Creates the connection for this profile + domain, or updates the existing one to these options. */
export async function createConnection(opts: CreateConnectionOptions): Promise<AuthState> {
  const settings = { login_url: opts.loginUrl, save_credentials: opts.saveCredentials ?? true };
  const [existing] = (await kernel().auth.connections.list({ profile_name: opts.profile, domain: opts.domain })).items;
  if (existing) return toAuthState(await kernel().auth.connections.update(existing.id, settings));

  return toAuthState(
    await kernel().auth.connections.create({
      profile_name: opts.profile,
      domain: opts.domain,
      ...settings,
      browser: { stealth: true },
    }),
  );
}

/** Starts a login flow and returns the hosted URL to send the user to. Krumms never sees the password. */
export async function startLogin(authId: string, { recordSession = false } = {}): Promise<string> {
  // recordSession saves a video replay of the login browser, for debugging failed logins.
  return (await kernel().auth.connections.login(authId, { record_session: recordSession })).hosted_url;
}

export async function getAuthState(authId: string): Promise<AuthState> {
  return toAuthState(await kernel().auth.connections.retrieve(authId));
}

/** Polls until the login flow finishes. onChange fires whenever the flow step changes. */
export async function waitForLogin(
  authId: string,
  { timeoutMs = 10 * 60_000, intervalMs = 2_000, onChange }: {
    timeoutMs?: number;
    intervalMs?: number;
    onChange?: (s: AuthState) => void;
  } = {},
): Promise<AuthState> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  for (;;) {
    const s = await getAuthState(authId);
    const key = `${s.flowStatus}/${s.flowStep}/${s.error}`;
    if (key !== last) onChange?.(s);
    last = key;

    if (s.flowStatus && s.flowStatus !== "IN_PROGRESS") return s;
    if (Date.now() > deadline) return { ...s, error: s.error ?? "Timed out waiting for login" };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ---------------------------------------------------------------------------
// Browsers
// ---------------------------------------------------------------------------

/**
 * Runs fn in a fresh stealth Kernel browser, logged in when profile is set, and always cleans up.
 * Uses the browser's default context: a new context over CDP would silently drop the profile's cookies.
 */
export async function withBrowser<T>(
  profile: string | undefined,
  fn: (page: Page, liveViewUrl: string | null) => Promise<T>,
): Promise<T> {
  const kb = await kernel().browsers.create({
    profile: profile ? { name: profile } : undefined,
    stealth: true,
    timeout_seconds: 120,
  });
  let browser: Browser | undefined;
  try {
    browser = await chromium.connectOverCDP(kb.cdp_ws_url);
    const context = browser.contexts()[0];
    if (!context) throw new Error("Kernel browser has no default context");
    const page = context.pages()[0] ?? (await context.newPage());
    return await fn(page, kb.browser_live_view_url ?? null);
  } finally {
    await browser?.close().catch(() => {});
    await kernel().browsers.deleteByID(kb.session_id).catch(() => {});
  }
}
