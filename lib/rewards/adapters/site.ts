// Shared by the site adapters: open the balance page in a logged-in browser and read it once the rewards data is there.
import { errors, type Page } from "playwright-core";
import { PageNotReadyError, type RawRewardsPage, type RewardsAdapter } from "../types";

// Worst case per read is about 85 s, inside the 120 s idle timeout kernel.ts gives each browser.
const NAVIGATION_TIMEOUT_MS = 45_000; // until the page's HTML has loaded
const REWARDS_RENDER_TIMEOUT_MS = 30_000; // then until loadedText shows
const SETTLE_TIMEOUT_MS = 10_000; // then, best effort, until the network is quiet so the whole list is there

export interface SiteConfig extends Pick<RewardsAdapter, "programId" | "domain" | "balanceUrl"> {
  /** Text that only shows once the rewards data has rendered, e.g. the heading above the reward list. */
  loadedText: RegExp;
}

/** An adapter for a site whose balance page shows everything needed, so only the site details differ. */
export function siteAdapter(site: SiteConfig): RewardsAdapter {
  const { programId, domain, balanceUrl } = site;
  return { programId, domain, balanceUrl, extract: (page) => readBalancePage(page, site) };
}

/** RewardsAdapter.extract for a SiteConfig; the contract is on RewardsAdapter.extract in types.ts. */
async function readBalancePage(page: Page, site: SiteConfig): Promise<RawRewardsPage> {
  await page.goto(site.balanceUrl, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });

  if (!(await showsText(page, site.loadedText))) {
    const redirected = new URL(page.url()).pathname !== new URL(site.balanceUrl).pathname;
    if (redirected) return snapshot(page); // e.g. to a login page: the caller judges the URL
    throw new PageNotReadyError(
      `${site.programId}: the balance page never showed its rewards (no text matching ${site.loadedText}). ` +
        "It may still be loading, or the site isn't showing the account (expired login, or blocked).",
    );
  }

  await page.waitForLoadState("networkidle", { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});
  return snapshot(page);
}

/** Waits for the text to show. False only on a timeout; anything else (crashed page, closed browser) throws. */
async function showsText(page: Page, text: RegExp): Promise<boolean> {
  try {
    await page.getByText(text).first().waitFor({ timeout: REWARDS_RENDER_TIMEOUT_MS });
    return true;
  } catch (err) {
    if (err instanceof errors.TimeoutError) return false;
    throw err;
  }
}

async function snapshot(page: Page): Promise<RawRewardsPage> {
  return { url: page.url(), text: await page.innerText("body"), screenshot: await page.screenshot({ fullPage: true }) };
}
