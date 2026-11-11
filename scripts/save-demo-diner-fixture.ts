import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { demoDiner } from "../lib/rewards/adapters/demo-diner";
import { withBrowser } from "../lib/rewards/kernel";
import { isLoginPage } from "../lib/rewards/types";
import { FIXTURE_ACCOUNT, FIXTURE_PATH } from "./demo-diner-fixture";

/**
 * Saves the Demo Diner rewards page text, as the adapter reads it in a Kernel browser, to fixtures/demo-diner-rewards.txt.
 * Usage: npx tsx scripts/save-demo-diner-fixture.ts
 * Logs in by filling the site's own form with a demo account (no Managed Auth, no saved profile). Rerun after
 * changing the Demo Diner pages or data, then check it with scripts/test-extract.ts.
 * Reads the hosted site by default, not your working tree: deploy first, or set DEMO_DINER_URL to a tunnel.
 * Also checks the logged-out case: the adapter must hand back a page refresh.ts reports as NEEDS_AUTH.
 */
async function main() {
  console.log(`Reading ${demoDiner.balanceUrl} in a Kernel browser`);
  const rewardsPath = new URL(demoDiner.balanceUrl).pathname;

  const text = await withBrowser(undefined, async (page) => {
    const loggedOut = await demoDiner.extract(page);
    if (!isLoginPage(loggedOut.url)) throw new Error(`Logged out, expected a login page but got ${loggedOut.url}`);
    console.log(`  logged out: ${new URL(loggedOut.url).pathname} is a login page (refresh.ts reports NEEDS_AUTH)`);

    await page.fill("#email", FIXTURE_ACCOUNT.email);
    await page.fill("#password", FIXTURE_ACCOUNT.password);
    // The form redirects back to the rewards page on success; a wrong password stays on the login page and times out.
    await Promise.all([page.waitForURL((url) => url.pathname === rewardsPath), page.click("button[type=submit]")]);

    const raw = await demoDiner.extract(page);
    if (new URL(raw.url).pathname !== rewardsPath) throw new Error(`Logged in, but ended on ${raw.url}`);
    console.log(`  logged in as ${FIXTURE_ACCOUNT.email}: read ${raw.text.length} chars`);
    return raw.text;
  });

  await mkdir(dirname(FIXTURE_PATH), { recursive: true });
  await writeFile(FIXTURE_PATH, text.endsWith("\n") ? text : `${text}\n`);
  console.log(`Saved ${FIXTURE_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
