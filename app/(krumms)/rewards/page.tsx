import Link from "next/link";
import { requireUser } from "../../../lib/auth/server";
import { getRewardRows } from "../../../lib/views/rewards";
import { Card, PageHeader, StatTile } from "../../components/ui";
import RewardsGrid from "./RewardsGrid";

// Balances change, so read them at request time.
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const user = await requireUser();
  const rows = await getRewardRows(user.id);
  const programs = new Set(rows.map((r) => r.programId)).size;
  const ready = rows.filter((r) => r.pointsNeeded === 0).length;
  const best = rows.find((r) => r.valueFlag === "best");

  return (
    <section>
      <PageHeader title="Your rewards" subtitle="Every reward across your programs, best value per point first." />
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No rewards yet.{" "}
            <Link href="/connect" className="font-medium text-brand-text underline underline-offset-4">
              Connect a rewards account
            </Link>{" "}
            to see them here.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-4">
            <StatTile label="Programs" value={programs} />
            <StatTile label="Rewards" value={rows.length} />
            <StatTile label="Ready to redeem" value={ready} hint="you have enough points" />
            {best && <StatTile label="Best value" value={`${best.centsPerPoint!.toFixed(2)}¢`} hint={best.reward} />}
          </div>
          <Card className="p-3">
            <RewardsGrid rows={rows} />
          </Card>
        </>
      )}
    </section>
  );
}
