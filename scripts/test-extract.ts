import "dotenv/config";
import { access, readFile } from "node:fs/promises";
import { NEXT_TIER, OFFERS, REWARDS } from "../app/demo-diner/_lib/data";
import { appearsInText, extractRewards } from "../lib/rewards/extract";
import { FIXTURE_ACCOUNT, FIXTURE_PATH } from "./demo-diner-fixture";

/**
 * Runs extract.ts on saved page text, without a browser.
 * Usage: npx tsx scripts/test-extract.ts [page.txt ...]
 *   With no files, reads .spike/chipotle/run-1.txt and .spike/panera/run-1.txt if present (gitignored, from the spike).
 * Always checks fixtures/demo-diner-rewards.txt against Demo Diner's own data, plus made-up pages: one with known
 * values and some that must be rejected, not guessed. Calls Claude, so it needs ANTHROPIC_API_KEY.
 */

const DEFAULT_FILES = [".spike/chipotle/run-1.txt", ".spike/panera/run-1.txt"];

// Pages that must be rejected: no points balance is shown, so any number would be a guess.
const MUST_REJECT: Record<string, string> = {
  "login page": "Sign in to Example Rewards\nEmail\nPassword\nForgot your password?\nSign in\nNew here? Create an account",
  "rewards page without a balance": [
    "Example Cafe Rewards",
    "Redeem your points",
    "Free Coffee  150 pts",
    "Breakfast Sandwich  450 pts",
    "Offers for you",
    "$2 off any bowl. Redeem by Nov 20, 2026.",
  ].join("\n"),
};

// A made-up page whose result is known exactly, including comma-formatted numbers. Unlike the Demo Diner fixture
// (620 points), its balance has a comma, and it needs no deploy to change.
const KNOWN_PAGE = [
  "Hi, Sam",
  "1,330 points available",
  "2,410 / 2,500 lifetime points to Gold status",
  "Redeem your points",
  "Free Coffee  150 pts",
  "Blue Plate Special  1,200 pts  Available through Nov 30, 2026",
  "Offers for you",
  "Double Points Tuesdays: earn 20 points per $1 on Tuesdays.",
  "Recent activity",
  "Nov 7, 2026  Order #4489 · $12.60  +126",
].join("\n");

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures++;
};

/** Checks two lists hold the same items in any order, and prints what's missing or extra if not. */
const checkSameItems = (label: string, got: string[], want: string[]) => {
  const missing = want.filter((w) => !got.includes(w));
  const extra = got.filter((g) => !want.includes(g));
  check(missing.length === 0 && extra.length === 0 && got.length === want.length, label);
  for (const m of missing) console.log(`     missing  ${m}`);
  for (const e of extra) console.log(`     extra    ${e}`);
};

const exists = (file: string) => access(file).then(() => true, () => false);

// The "is this number on the page" guard, checked without calling Claude: [number, text, expected].
const NUMBER_CASES: Array<[number, string, boolean]> = [
  [1330, "1,330 pts", true],
  [1330, "1330 pts", true],
  [330, "1,330 pts", false],
  [1, "1,330 pts", false],
  [12, "$12.60", false],
  [60, "$12.60", false],
  [98, "980 POINTS", false],
  [150, "costs 150.", true],
  [150, "150, 200 or 250", true],
];

async function main() {
  console.log("number guard (no Claude calls)");
  for (const [n, text, expected] of NUMBER_CASES) {
    check(appearsInText(n, text) === expected, `${n} ${expected ? "found" : "not found"} in "${text}"`);
  }

  const files = process.argv.slice(2);
  if (files.length === 0) {
    for (const file of DEFAULT_FILES) {
      if (await exists(file)) files.push(file);
      else console.log(`\n${file}\n  skipped: not found (spike output is gitignored; pass page files to check others)`);
    }
  }

  for (const file of files) {
    console.log(`\n${file}`);
    const result = await extractRewards(await readFile(file, "utf8"));
    if (!result.ok) {
      check(false, `extracted (${result.error})`);
      continue;
    }
    const { points, rewards, offers, tierProgress } = result.rewards;
    check(true, `points ${points}, ${rewards.length} rewards, ${offers.length} offers, tier ${tierProgress ? "shown" : "null"}`);
    for (const r of rewards) console.log(`     reward  ${r.pointCost} pts  ${r.name}${r.expiresAt ? `  (until ${r.expiresAt})` : ""}`);
    for (const o of offers) console.log(`     offer   ${o.name}${o.expiresAt ? `  (until ${o.expiresAt})` : ""}`);
  }

  await checkDemoDiner();

  console.log("\nknown made-up page");
  const known = await extractRewards(KNOWN_PAGE);
  check(known.ok, `extracted${known.ok ? "" : ` (${known.error})`}`);
  if (known.ok) {
    const { points, rewards, offers, tierProgress } = known.rewards;
    check(points === 1330, `points 1,330 (got ${points})`);
    check(rewards.map((r) => r.pointCost).join() === "150,1200", `rewards cost 150 and 1,200 (got ${rewards.map((r) => r.pointCost).join(", ")})`);
    check(rewards.find((r) => r.pointCost === 1200)?.expiresAt === "2026-11-30", "Blue Plate Special available through 2026-11-30");
    check(offers.length === 1 && /double points/i.test(offers[0].name), `1 offer, Double Points Tuesdays (got ${offers.map((o) => o.name).join("; ") || "none"})`);
    check(tierProgress?.current === 2410 && tierProgress.target === 2500, "tier progress 2,410 / 2,500");
  }

  for (const [label, text] of Object.entries(MUST_REJECT)) {
    console.log(`\n${label}`);
    const result = await extractRewards(text);
    check(!result.ok, `rejected${result.ok ? ` (but got points ${result.rewards.points})` : `: ${result.error}`}`);
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

/** The saved Demo Diner page, checked against the site's own data, so a data change without a new fixture fails. */
async function checkDemoDiner() {
  console.log(`\n${FIXTURE_PATH} (expected: Demo Diner's data for ${FIXTURE_ACCOUNT.email})`);
  const result = await extractRewards(await readFile(FIXTURE_PATH, "utf8"));
  check(result.ok, `extracted${result.ok ? "" : ` (${result.error})`}`);
  if (!result.ok) return;

  const { points, rewards, offers, tierProgress } = result.rewards;
  check(points === FIXTURE_ACCOUNT.points, `points ${FIXTURE_ACCOUNT.points} (got ${points})`);

  const show = (r: { name: string; pointCost: number; expiresAt: string | null }) => `${r.name} ${r.pointCost} ${r.expiresAt ?? "-"}`;
  checkSameItems(
    `all ${REWARDS.length} rewards with exact names, costs and dates, nothing else`,
    rewards.map(show),
    REWARDS.map((r) => show({ ...r, expiresAt: r.availableThrough ?? null })),
  );
  checkSameItems(
    `all ${OFFERS.length} offers by name, nothing else`,
    offers.map((o) => o.name),
    OFFERS.map((o) => o.title),
  );
  // Hardcoded: the site's data has this date only inside the offer's details text.
  check(offers.find((o) => /\$2 off/.test(o.name))?.expiresAt === "2026-11-20", "$2 off any bowl redeem-by 2026-11-20");
  check(
    tierProgress?.tierName === NEXT_TIER.name &&
      tierProgress.current === FIXTURE_ACCOUNT.lifetimePoints &&
      tierProgress.target === NEXT_TIER.lifetimeTarget,
    `tier ${NEXT_TIER.name} ${FIXTURE_ACCOUNT.lifetimePoints} / ${NEXT_TIER.lifetimeTarget} (got ${JSON.stringify(tierProgress)})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
