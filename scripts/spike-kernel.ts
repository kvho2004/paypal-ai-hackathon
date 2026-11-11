import "dotenv/config";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import type { Page } from "playwright-core";
import { createConnection, startLogin, waitForLogin, withBrowser } from "../lib/rewards/kernel";
import type { RawRewardsPage } from "../lib/rewards/types";

/**
 * Feasibility test: can Kernel read a real restaurant rewards account?
 *   Q1  Does Kernel's hosted login complete? (an unsolved CAPTCHA counts as no)
 *   Q2  Does the balance page load in a stealth browser?
 *   Q3  Can the page be read repeatedly (--runs times)?
 * Usage: npx tsx scripts/spike-kernel.ts <program> [--url=<balance page>] [--runs=3]
 *
 * Raw page text and screenshots go to .spike/ (gitignored: real account data).
 * Progress is appended to docs/spike-log.md; check the screenshots before writing a verdict.
 */

// Login domain and balance page per program. Override a wrong balance page with --url.
const PROGRAMS: Record<string, { domain: string; balanceUrl: string }> = {
  starbucks: { domain: "starbucks.com", balanceUrl: "https://www.starbucks.com/rewards/my-rewards" },
  chipotle: { domain: "chipotle.com", balanceUrl: "https://www.chipotle.com/order/rewards/exchange" },
  panera: { domain: "panerabread.com", balanceUrl: "https://www.panerabread.com/en-us/mypanera/rewards.html" },
};

// Phrases from bot-block pages (Akamai, PerimeterX, Cloudflare). Not "captcha": normal pages mention reCAPTCHA.
const BLOCKED_RE = /access denied|are you a robot|unusual traffic|verify you are human|press & hold/i;
const LOGIN_PATH_RE = /sign-?in|log-?in/i;
const LOG = "docs/spike-log.md";

const et = (opts: Intl.DateTimeFormatOptions) => new Date().toLocaleString("en-CA", { timeZone: "America/New_York", hour12: false, ...opts });
const time = () => et({ hour: "2-digit", minute: "2-digit" });
const log = async (line: string) => {
  console.log(line);
  await appendFile(LOG, `${line}\n`);
};

/** Reads the balance page. Same shape as RewardsAdapter.extract, so it can become a program adapter. */
async function extract(page: Page, balanceUrl: string): Promise<RawRewardsPage> {
  await page.goto(balanceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(3_000); // SPA balance widgets often render late
  return {
    url: page.url(),
    text: await page.innerText("body").catch(() => ""),
    screenshot: await page.screenshot({ fullPage: true }),
  };
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { url: { type: "string" }, runs: { type: "string", default: "3" } },
  });
  const program = positionals[0];
  const cfg = PROGRAMS[program];
  const runs = Number(values.runs);
  if (!cfg || !Number.isInteger(runs) || runs < 1) {
    throw new Error(`Usage: spike-kernel.ts <${Object.keys(PROGRAMS).join("|")}> [--url=] [--runs=3]`);
  }
  const balanceUrl = values.url ?? cfg.balanceUrl;
  const profile = `spike-${program}`;
  const outDir = `.spike/${program}`;
  await mkdir(outDir, { recursive: true });

  await log(`\n## ${program}: ${et({ year: "numeric", month: "2-digit", day: "2-digit" })} ${time()} ET`);
  await log(`- balance URL: \`${balanceUrl}\`; credentials not saved, so automatic re-login is untested`);

  // Q1: hosted login, started from the balance page so the session ends up there.
  const conn = await createConnection({ profile, domain: cfg.domain, loginUrl: balanceUrl, saveCredentials: false });

  if (conn.status === "ACTIVE") {
    await log(`- ${time()} Q1 login: YES (reused login from an earlier run)`);
  } else {
    console.log(`\nOpen this link and log in with your ${program} account:\n\n  ${await startLogin(conn.authId)}\n`);
    const steps: string[] = [];
    const result = await waitForLogin(conn.authId, {
      onChange: (s) => {
        steps.push(`${s.flowStep ?? s.flowStatus} ${time()}`);
        console.log(`  ${time()} ${s.flowStatus} / ${s.flowStep}${s.error ? `: ${s.error}` : ""}`);
      },
    });

    const ok = result.status === "ACTIVE";
    await log(`- ${time()} Q1 login: ${ok ? "YES" : "NO"} (${steps.join(" → ")})${result.error ? `; error: ${result.errorCode ?? "?"}, ${result.error}` : ""}`);
    if (!ok) return;
  }

  // Run 1 answers Q2; all runs answer Q3. Each run opens a new browser with the saved login.
  for (let run = 1; run <= runs; run++) {
    const label = `${run === 1 ? "Q2" : "Q3"} run ${run}/${runs}`;
    try {
      const raw = await withBrowser(profile, (page) => extract(page, balanceUrl));
      await writeFile(`${outDir}/run-${run}.txt`, `${raw.url}\n\n${raw.text}`);
      if (raw.screenshot) await writeFile(`${outDir}/run-${run}.png`, raw.screenshot);

      const { hostname, pathname } = new URL(raw.url); // no query string: it can hold tokens
      let problem = "";
      if (LOGIN_PATH_RE.test(pathname)) problem = "redirected to login (saved session not used)";
      else if (BLOCKED_RE.test(raw.text)) problem = "looks like a bot-block page";
      else if (raw.text.length < 200) problem = "page nearly empty";
      await log(`- ${time()} ${label}: ${problem ? `FAIL, ${problem}` : "OK"} (${hostname}${pathname}, ${raw.text.length} chars)`);
    } catch (e) {
      await log(`- ${time()} ${label}: FAIL, ${String((e as Error).message ?? e).split("\n")[0].slice(0, 120)}`);
    }
  }

  await log(`- verdict: _check ${outDir}/run-*.png, then write it here by hand_`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
