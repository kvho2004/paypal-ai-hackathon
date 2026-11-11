import type { ConnectApi } from "../connect/ConnectFlow";

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * A fake of Dev 2's connect routes, returning the exact shapes in dev2-dev1-team-split.md, so ConnectFlow can be
 * tried before the real routes exist. Nothing here talks to Kernel; the numbers are sample values.
 * `outcome` picks the ending, to exercise the error states too.
 */
export function makeConnectStub(outcome: "ok" | "extract-failed" | "needs-auth" = "ok"): ConnectApi {
  let polls = 0;
  return {
    async start() {
      polls = 0;
      await wait(500);
      return { connectionId: "stub-connection", hostedUrl: "/demo-diner/login" };
    },
    async status() {
      polls += 1;
      if (polls < 2) return { status: "PENDING", error: null };
      return outcome === "needs-auth"
        ? { status: "NEEDS_AUTH", error: "Stub: the login was not completed." }
        : { status: "ACTIVE", error: null };
    },
    async refresh(_connectionId, onEvent, signal) {
      await wait(700, signal);
      onEvent({ step: "browser", liveViewUrl: "/demo-diner" });
      await wait(1500, signal);
      onEvent({ step: "extracting" });
      await wait(1200, signal);
      if (outcome === "extract-failed") {
        onEvent({ step: "done", ok: false, status: "EXTRACT_FAILED", error: "Stub: the rewards never showed on the page." });
      } else {
        onEvent({ step: "done", ok: true, points: 620, rewards: 9, fetchedAt: new Date().toISOString() });
      }
    },
  };
}
