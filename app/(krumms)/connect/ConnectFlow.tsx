"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { readNdjson } from "../../../lib/ndjson";
import type { RefreshEvent } from "../../../lib/rewards/types";

// The route contract from dev2-dev1-team-split.md. Dev 2 owns the routes; this component only consumes them.
export type ConnectionStatus = "PENDING" | "ACTIVE" | "NEEDS_AUTH";

export interface ConnectApi {
  start(program: string): Promise<{ connectionId: string; hostedUrl: string }>;
  status(program: string, connectionId: string): Promise<{ status: ConnectionStatus; error: string | null }>;
  /** Streams the refresh; calls onEvent for each step. Resolves when the stream ends. */
  refresh(connectionId: string, onEvent: (event: RefreshEvent) => void, signal: AbortSignal): Promise<void>;
}

const POLL_MS = 2000;
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000; // matches Kernel's hosted-login timeout

/** Narrow an untrusted stream line to a RefreshEvent, or null if it is not one. */
export function toRefreshEvent(value: unknown): RefreshEvent | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== "object") return null;
  if (v.step === "browser" && typeof v.liveViewUrl === "string") return { step: "browser", liveViewUrl: v.liveViewUrl };
  if (v.step === "extracting") return { step: "extracting" };
  if (v.step === "done" && v.ok === true && typeof v.points === "number" && typeof v.rewards === "number") {
    return { step: "done", ok: true, points: v.points, rewards: v.rewards, fetchedAt: String(v.fetchedAt ?? "") };
  }
  if (v.step === "done" && v.ok === false) {
    return { step: "done", ok: false, status: String(v.status ?? "EXTRACT_FAILED"), error: String(v.error ?? "") };
  }
  return null;
}

/** Only http(s) URLs are opened or embedded, whatever the server sends. Relative URLs resolve against this site. */
function safeHttpUrl(url: string): string | null {
  try {
    const u = new URL(url, window.location.origin);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) throw new Error("Connecting accounts is not available on this server yet.");
  if (res.status === 401) throw new Error("Your session ended. Sign in again.");
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

const realApi: ConnectApi = {
  start: async (program) => json(await fetch(`/api/connect/${encodeURIComponent(program)}`, { method: "POST" })),
  status: async (program, connectionId) =>
    json(await fetch(`/api/connect/${encodeURIComponent(program)}?connectionId=${encodeURIComponent(connectionId)}`)),
  refresh: async (connectionId, onEvent, signal) => {
    const res = await fetch("/api/rewards/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId }),
      signal,
    });
    if (!res.ok || !res.body) await json(res).then(() => Promise.reject(new Error("The server sent no data.")));
    await readNdjson(res.body!, (value) => {
      const event = toRefreshEvent(value);
      if (event) onEvent(event);
    });
  },
};

type Phase = "idle" | "starting" | "login" | "reading" | "done" | "error";
type Failure = { message: string; retry: "connect" | "read" };

/**
 * Connect a rewards account: the student logs in on a page hosted by Kernel (Krumms never sees the password),
 * then the agent opens its own browser and reads the balance while the student watches.
 */
export default function ConnectFlow({
  programId,
  programName,
  api = realApi,
}: {
  programId: string;
  programName: string;
  api?: ConnectApi;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<{ points: number; rewards: number } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  // Each attempt gets a number; results from an older attempt (or after unmount) are ignored.
  const run = useRef(0);
  const connectionId = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopEverything = useCallback(() => {
    run.current += 1;
    abort.current?.abort();
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);
  useEffect(() => stopEverything, [stopEverything]);

  const fail = (message: string, retry: Failure["retry"]) => {
    setFailure({ message, retry });
    setPhase("error");
  };

  async function read(id: string, myRun: number) {
    setPhase("reading");
    setExtracting(false);
    setLiveViewUrl(null);
    abort.current = new AbortController();
    let finished = false;
    try {
      await api.refresh(
        id,
        (event) => {
          if (run.current !== myRun) return;
          if (event.step === "browser") setLiveViewUrl(safeHttpUrl(event.liveViewUrl));
          else if (event.step === "extracting") setExtracting(true);
          else if (event.ok) {
            finished = true;
            setResult({ points: event.points, rewards: event.rewards });
            setPhase("done");
          } else {
            finished = true;
            if (event.status === "NEEDS_AUTH") fail(`${programName} asked you to log in again.`, "connect");
            else fail(event.error || `We could not read your ${programName} rewards.`, "read");
          }
        },
        abort.current.signal,
      );
      if (run.current === myRun && !finished) fail("The read ended before it finished.", "read");
    } catch (e) {
      if (run.current !== myRun) return; // cancelled on purpose
      fail(e instanceof Error ? e.message : "The read failed.", "read");
    }
  }

  function poll(id: string, myRun: number, startedAt: number) {
    pollTimer.current = setTimeout(async () => {
      if (run.current !== myRun) return;
      try {
        const { status, error } = await api.status(programId, id);
        if (run.current !== myRun) return;
        if (status === "ACTIVE") return void read(id, myRun);
        if (status === "NEEDS_AUTH") return fail(error || "The login did not complete.", "connect");
        if (Date.now() - startedAt > LOGIN_TIMEOUT_MS) return fail("The login timed out.", "connect");
        poll(id, myRun, startedAt);
      } catch (e) {
        if (run.current === myRun) fail(e instanceof Error ? e.message : "Could not check the login.", "connect");
      }
    }, POLL_MS);
  }

  async function connect() {
    stopEverything();
    const myRun = run.current;
    setFailure(null);
    setResult(null);
    setLoginUrl(null);
    setPhase("starting");
    // Open the tab now, inside the click: browsers block window.open after an await.
    const tab = window.open("", "_blank");
    try {
      const started = await api.start(programId);
      if (run.current !== myRun) return tab?.close();
      const url = safeHttpUrl(started.hostedUrl);
      if (!url) throw new Error("The server returned an invalid login link.");
      connectionId.current = started.connectionId;
      setLoginUrl(url);
      if (tab) {
        tab.opener = null; // the login page must not be able to reach back into Krumms
        tab.location.href = url;
      }
      setPhase("login");
      poll(started.connectionId, myRun, Date.now());
    } catch (e) {
      tab?.close();
      if (run.current === myRun) fail(e instanceof Error ? e.message : "Could not start connecting.", "connect");
    }
  }

  function retryRead() {
    if (!connectionId.current) return connect();
    stopEverything();
    setFailure(null);
    void read(connectionId.current, run.current);
  }

  const steps = [
    { label: "You log in on a secure page", active: phase === "starting" || phase === "login", done: phase === "reading" || phase === "done" },
    { label: "The agent opens its own browser", active: phase === "reading" && !extracting, done: (phase === "reading" && extracting) || phase === "done" },
    { label: "It reads your points and rewards", active: phase === "reading" && extracting, done: phase === "done" },
  ];
  const busy = phase === "starting" || phase === "login" || phase === "reading";

  return (
    <div className="max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold">{programName} Rewards</p>
          <p className="mt-1 text-sm text-muted">
            You log in on a page hosted by Kernel, so Krumms never sees your password.
          </p>
        </div>
        {(phase === "idle" || phase === "done") && (
          <button
            type="button"
            onClick={connect}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-contrast"
          >
            {phase === "done" ? "Reconnect" : `Connect ${programName}`}
          </button>
        )}
      </div>

      {phase !== "idle" && (
        <ol className="mt-5 space-y-2 text-sm">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-3">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  s.done ? "bg-success text-white" : s.active ? "bg-brand text-brand-contrast" : "border border-line text-muted"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span className={s.active ? "font-medium" : "text-muted"}>{s.label}</span>
              {s.active && busy && <span className="text-xs text-muted">in progress…</span>}
            </li>
          ))}
        </ol>
      )}

      <div aria-live="polite" className="mt-4 space-y-3 text-sm">
        {phase === "starting" && <p className="text-muted">Starting a secure login…</p>}

        {phase === "login" && loginUrl && (
          <p>
            Finish logging in on the page that opened.{" "}
            <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-text underline underline-offset-4">
              Open the login page
            </a>{" "}
            if it did not appear. This page updates by itself when you are done.
          </p>
        )}

        {phase === "reading" && (
          <>
            <p className="text-muted">
              {extracting ? "Reading your points and rewards from the page…" : "Opening your rewards page in the agent's browser…"}
            </p>
            {liveViewUrl && (
              <div>
                <iframe
                  src={liveViewUrl}
                  title={`Live view of the agent's browser on ${programName}`}
                  referrerPolicy="no-referrer"
                  className="h-72 w-full rounded-xl border border-line bg-k-bg"
                />
                <a href={liveViewUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-brand-text underline underline-offset-4">
                  Open the live view in a new tab
                </a>
              </div>
            )}
          </>
        )}

        {phase === "done" && result && (
          <div className="rounded-xl border border-success/40 bg-success/10 p-4">
            <p className="font-display text-lg font-semibold text-success">
              {programName} connected: {result.points.toLocaleString("en-US")} pts, {result.rewards} rewards
            </p>
            <Link href="/rewards" className="mt-2 inline-block font-medium text-brand-text underline underline-offset-4">
              See your rewards
            </Link>
          </div>
        )}

        {phase === "error" && failure && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4">
            <p className="font-medium text-danger">{failure.message}</p>
            <button
              type="button"
              onClick={failure.retry === "read" ? retryRead : connect}
              className="mt-3 rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium hover:bg-brand-soft"
            >
              {failure.retry === "read" ? "Try reading again" : "Connect again"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
