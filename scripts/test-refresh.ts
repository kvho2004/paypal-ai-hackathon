import "dotenv/config";
import { isDeepStrictEqual } from "node:util";
import { parseArgs } from "node:util";
import { db } from "../lib/db";
import { getAdapter } from "../lib/rewards/adapters";
import { profileName } from "../lib/rewards/kernel";
import { refreshRewards } from "../lib/rewards/refresh";
import { ensureLogin } from "./ensure-login";

/**
 * Runs refreshRewards start to finish against the database in DATABASE_URL, and checks each saved Balance row.
 * Usage: npx tsx scripts/test-refresh.ts <programId> [--runs=3] [--login] [--keep]
 *   --login  log in again even if Kernel thinks the profile is logged in
 *   --keep   leave the test Connection and Balance rows in the database (deleted by default)
 * Uses its own user id ("test") and connection id ("test-<programId>"), so it never touches real users' rows.
 */
const TEST_USER = "test";

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      runs: { type: "string", default: "3" },
      login: { type: "boolean", default: false },
      keep: { type: "boolean", default: false },
    },
  });
  const programId = positionals[0];
  const adapter = getAdapter(programId);
  const runs = Number(values.runs);
  if (!adapter || !Number.isInteger(runs) || runs < 1) {
    throw new Error("Usage: test-refresh.ts <programId> [--runs=3] [--login] [--keep]");
  }

  // refreshRewards finds the browser profile from the connection's user and program, so this is test-<programId>.
  const kernelAuthId = await ensureLogin(profileName(TEST_USER, programId), adapter, { force: values.login });
  const connectionId = `test-${programId}`;
  await db.connection.upsert({
    where: { id: connectionId },
    create: { id: connectionId, userId: TEST_USER, programId, kernelAuthId, status: "PENDING" },
    update: { kernelAuthId, status: "PENDING" },
  });

  let failures = 0;
  try {
    for (let run = 1; run <= runs; run++) {
      const result = await refreshRewards(connectionId);
      if (!result.ok) {
        failures++;
        console.log(`run ${run}/${runs}: FAIL, ${result.status}: ${result.error}`);
        continue;
      }

      // The saved row must match what refreshRewards returned.
      const saved = await db.balance.findFirstOrThrow({ where: { connectionId }, orderBy: { fetchedAt: "desc" } });
      const { points, ...rest } = result.rewards;
      const matches =
        saved.points === points &&
        saved.source === "live" &&
        saved.fetchedAt.getTime() === result.fetchedAt.getTime() &&
        isDeepStrictEqual(saved.rewards, rest);
      if (!matches) failures++;
      console.log(
        `run ${run}/${runs}: ${matches ? "OK" : "FAIL, saved row doesn't match"}, ${points} points, ` +
          `${rest.rewards.length} rewards, ${rest.offers.length} offers, saved at ${saved.fetchedAt.toISOString()}`,
      );
    }
    const status = (await db.connection.findUniqueOrThrow({ where: { id: connectionId } })).status;
    console.log(`connection status: ${status}`);
  } finally {
    if (!values.keep) {
      await db.$transaction([
        db.balance.deleteMany({ where: { connectionId } }),
        db.connection.delete({ where: { id: connectionId } }),
      ]);
      console.log("deleted the test rows (use --keep to leave them)");
    }
    await db.$disconnect();
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
