import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { getAdapter } from "../lib/rewards/adapters";
import { extractRewards } from "../lib/rewards/extract";
import { profileName, withBrowser } from "../lib/rewards/kernel";
import { ensureLogin } from "./ensure-login";

/**
 * Reads a program's balance page through its adapter in a Kernel browser, then extracts it. No database.
 * Usage: npx tsx scripts/test-adapter.ts <programId> [--runs=3] [--login]
 *   --login  log in again even if Kernel thinks the profile is logged in
 * Page text and screenshots go to .spike/<programId>/ (gitignored: real account data).
 */
async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { runs: { type: "string", default: "3" }, login: { type: "boolean", default: false } },
  });
  const programId = positionals[0];
  const adapter = getAdapter(programId);
  const runs = Number(values.runs);
  if (!adapter || !Number.isInteger(runs) || runs < 1) {
    throw new Error("Usage: test-adapter.ts <programId> [--runs=3] [--login]");
  }

  const profile = profileName("test", programId); // same profile as test-refresh.ts, so one login serves both
  await ensureLogin(profile, adapter, { force: values.login });

  const outDir = `.spike/${programId}`;
  await mkdir(outDir, { recursive: true });

  let failures = 0;
  for (let run = 1; run <= runs; run++) {
    try {
      const raw = await withBrowser(profile, (page) => adapter.extract(page));
      await writeFile(`${outDir}/adapter-run-${run}.txt`, `${raw.url}\n\n${raw.text}`);
      if (raw.screenshot) await writeFile(`${outDir}/adapter-run-${run}.png`, raw.screenshot);

      const result = await extractRewards(raw.text);
      if (!result.ok) throw new Error(result.error);
      const { points, rewards, offers } = result.rewards;
      console.log(`run ${run}/${runs}: OK, ${points} points, ${rewards.length} rewards, ${offers.length} offers`);
    } catch (err) {
      failures++;
      console.log(`run ${run}/${runs}: FAIL, ${(err as Error).message}`);
    }
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
