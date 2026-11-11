import Link from "next/link";
import { DEMO_USER_ID } from "../../../lib/purchases";
import { getRewardRows } from "../../../lib/views/rewards";
import RewardsGrid from "./RewardsGrid";

// Balances change, so read them at request time.
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const rows = await getRewardRows(DEMO_USER_ID);
  const programs = new Set(rows.map((r) => r.programId)).size;
  const ready = rows.filter((r) => r.pointsNeeded === 0).length;

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Your rewards</h1>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm opacity-70">
          No rewards yet.{" "}
          <Link href="/connect" className="underline underline-offset-4">
            Connect a rewards account
          </Link>{" "}
          to see them here.
        </p>
      ) : (
        <>
          <p className="mt-1 mb-5 text-sm opacity-70">
            {rows.length} rewards across {programs} {programs === 1 ? "program" : "programs"}, {ready} ready to
            redeem. Sorted by value per point.
          </p>
          <RewardsGrid rows={rows} />
        </>
      )}
    </section>
  );
}
