import "dotenv/config";
import { readFile } from "node:fs/promises";
import { appearsInText, extractRewards } from "../lib/rewards/extract";

/**
 * Runs extract.ts on saved page text, without a browser.
 * Usage: npx tsx scripts/test-extract.ts [page.txt ...]
 *   With no files, reads .spike/chipotle/run-1.txt and .spike/panera/run-1.txt (gitignored, from the spike).
 * Also runs made-up pages that must be rejected, not guessed. Calls Claude, so it needs ANTHROPIC_API_KEY.
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

// A made-up page whose result is known exactly, including comma-formatted numbers.
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

  const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_FILES;

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
