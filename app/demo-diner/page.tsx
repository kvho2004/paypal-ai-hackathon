import Link from "next/link";
import { EARN_RATE, REWARDS, WELCOME_BONUS } from "./_lib/data";
import { currentAccount } from "./_lib/session";
import { Section, button } from "./_lib/ui";

const MENU = [
  { name: "Buttermilk Pancake Stack", price: "$7.25" },
  { name: "Garden Grain Bowl", price: "$7.95" },
  { name: "Crispy Chicken Sandwich", price: "$8.50" },
  { name: "Diner Classic Burger", price: "$9.25" },
  { name: "Seasoned Fries", price: "$3.25" },
  { name: "Thick Milkshake", price: "$4.75" },
];

const cheapestReward = Math.min(...REWARDS.map((r) => r.pointCost));

export default async function DemoDinerHome() {
  const account = await currentAccount();

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
        <p className="text-sm font-bold uppercase tracking-widest text-[#b3261e]">Demo Diner Rewards</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Breakfast all day. Rewards every visit.</h1>
        <p className="mt-3 max-w-xl text-stone-600">
          Earn {EARN_RATE} points for every $1 and trade them for coffee, pancakes, bowls and more.
          New members get {WELCOME_BONUS} bonus points.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {account ? (
            <Link href="/demo-diner/rewards" className={button.primary}>
              View my rewards
            </Link>
          ) : (
            <>
              <Link href="/demo-diner/join" className={button.primary}>
                Join for free
              </Link>
              <Link href="/demo-diner/login" className={button.secondary}>
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      <Section id="menu" title="Menu favorites">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MENU.map((item) => (
            <li key={item.name} className="flex justify-between rounded-xl bg-white p-4 ring-1 ring-stone-200">
              <span className="font-semibold">{item.name}</span>
              <span className="text-stone-600">{item.price}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-stone-600">
          {REWARDS.length} rewards to choose from, starting at {cheapestReward} points.
        </p>
      </Section>
    </div>
  );
}
