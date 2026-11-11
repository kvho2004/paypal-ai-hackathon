import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CURRENT_TIER,
  EARN_RATE,
  NEXT_TIER,
  OFFERS,
  REWARDS,
  WELCOME_BONUS,
  firstName,
  type Account,
  type Activity,
  type Reward,
} from "../_lib/data";
import { fmtDate, fmtPoints, fmtPointsChange } from "../_lib/format";
import { currentAccount } from "../_lib/session";
import { Alert, Section } from "../_lib/ui";

export const metadata: Metadata = { title: "My Rewards" };

export default async function RewardsPage({ searchParams }: PageProps<"/demo-diner/rewards">) {
  const account = await currentAccount();
  if (!account) redirect("/demo-diner/login?next=/demo-diner/rewards");
  const { welcome } = await searchParams;

  return (
    <div className="space-y-10">
      {welcome && (
        <Alert tone="info">
          Welcome to Demo Diner Rewards, {firstName(account)}! {WELCOME_BONUS} bonus points have been added to your account.
        </Alert>
      )}

      <MemberCard account={account} />

      <Section title="Redeem your points" subtitle="Show your account at the register to redeem.">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REWARDS.map((reward) => (
            <RewardCard key={reward.name} reward={reward} balance={account.points} />
          ))}
        </ul>
      </Section>

      {/* Offers: discounts and bonus-point promos, not paid for with points. */}
      <Section title="Offers for you">
        <ul className="grid gap-4 sm:grid-cols-3">
          {OFFERS.map((offer) => (
            <li key={offer.title} className="rounded-xl border-2 border-dashed border-[#f6c445] bg-[#fffaf0] p-4">
              <h3 className="font-bold">{offer.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{offer.details}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Recent activity">
        <ActivityTable activity={account.activity} />
      </Section>
    </div>
  );
}

function MemberCard({ account }: { account: Account }) {
  const tierPct = Math.min(100, Math.round((account.lifetimePoints / NEXT_TIER.lifetimeTarget) * 100));

  return (
    <section className="grid gap-6 rounded-2xl bg-[#b3261e] p-6 text-white shadow-sm sm:grid-cols-[auto_1fr] sm:items-center">
      <div>
        <h1 className="text-sm font-bold uppercase tracking-widest text-white/80">{firstName(account)}&apos;s points</h1>
        <p className="mt-1 text-6xl font-black tabular-nums">{fmtPoints(account.points)}</p>
        <p className="text-white/80">points available</p>
      </div>

      <div className="space-y-2 sm:border-l sm:border-white/25 sm:pl-6">
        <p className="font-semibold">
          {CURRENT_TIER} member since {fmtDate(account.memberSince, { month: "long", year: "numeric" })}
        </p>
        <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-[#f6c445]" style={{ width: `${tierPct}%` }} />
        </div>
        <p className="text-sm text-white/90">
          {fmtPoints(account.lifetimePoints)} / {fmtPoints(NEXT_TIER.lifetimeTarget)} lifetime points to {NEXT_TIER.name} status
        </p>
        <p className="text-xs text-white/70">Earn {EARN_RATE} points for every $1. Points expire 12 months after you earn them.</p>
      </div>
    </section>
  );
}

function RewardCard({ reward, balance }: { reward: Reward; balance: number }) {
  const pointsShort = reward.pointCost - balance;

  return (
    <li className="flex flex-col rounded-xl bg-white p-4 ring-1 ring-stone-200">
      <h3 className="font-bold">{reward.name}</h3>
      <p className="mt-1 flex-1 text-sm text-stone-600">{reward.description}</p>
      {reward.availableThrough && (
        <p className="mt-2 text-xs font-semibold text-amber-700">
          Limited time: available through {fmtDate(reward.availableThrough)}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-black text-[#b3261e]">{fmtPoints(reward.pointCost)} pts</span>
        {pointsShort > 0 ? (
          <span className="text-stone-500">{fmtPoints(pointsShort)} more to go</span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">Ready to redeem</span>
        )}
      </div>
    </li>
  );
}

function ActivityTable({ activity }: { activity: Activity[] }) {
  return (
    <table className="w-full overflow-hidden rounded-xl bg-white text-sm ring-1 ring-stone-200">
      <thead className="bg-stone-100 text-left text-stone-600">
        <tr>
          <th className="px-4 py-2 font-semibold">Date</th>
          <th className="px-4 py-2 font-semibold">Activity</th>
          <th className="px-4 py-2 text-right font-semibold">Points</th>
        </tr>
      </thead>
      <tbody>
        {activity.map((entry, i) => (
          <tr key={i} className="border-t border-stone-100">
            <td className="whitespace-nowrap px-4 py-2 text-stone-600">{fmtDate(entry.date)}</td>
            <td className="px-4 py-2">{entry.description}</td>
            <td className={`px-4 py-2 text-right font-semibold tabular-nums ${entry.points < 0 ? "text-stone-500" : "text-emerald-700"}`}>
              {fmtPointsChange(entry.points)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
