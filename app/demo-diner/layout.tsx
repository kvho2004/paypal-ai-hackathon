import type { Metadata } from "next";
import Link from "next/link";
import { firstName, type Account } from "./_lib/data";
import { currentAccount } from "./_lib/session";

export const metadata: Metadata = {
  title: { default: "Demo Diner", template: "%s | Demo Diner" },
  description: "Demo Diner Rewards: a fictional restaurant loyalty program for the Krumms demo.",
};

export default async function DemoDinerLayout({ children }: { children: React.ReactNode }) {
  const account = await currentAccount();

  return (
    <div className="flex min-h-screen flex-col bg-[#fdf6ec] text-stone-900">
      <header className="bg-[#b3261e] text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/demo-diner" className="flex items-center gap-2">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-[#f6c445] font-black text-[#b3261e]">
              DD
            </span>
            <span className="text-xl font-black tracking-tight">Demo Diner</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/demo-diner#menu" className="hover:underline">Menu</Link>
            <Link href="/demo-diner/rewards" className="hover:underline">Rewards</Link>
            <AccountLinks account={account} />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-stone-300 bg-[#f6ead7] text-xs text-stone-600">
        <div className="mx-auto max-w-5xl space-y-1 px-4 py-5">
          <p>© 2026 Demo Diner · 123 Example Ave · Open daily 7am–10pm</p>
          <p>
            Demo Diner is a fictional restaurant built for the Krumms hackathon demo. It is not a real business and
            no real orders are placed.
          </p>
        </div>
      </footer>
    </div>
  );
}

function AccountLinks({ account }: { account: Account | null }) {
  if (!account) {
    return (
      <>
        <Link href="/demo-diner/login" className="hover:underline">Sign in</Link>
        <Link href="/demo-diner/join" className="rounded-full bg-[#f6c445] px-3 py-1 text-[#7a1712] hover:bg-[#ffd666]">
          Join Rewards
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="hidden text-white/80 sm:inline">Hi, {firstName(account)}</span>
      <form method="post" action="/demo-diner/auth/logout">
        <button type="submit" className="rounded-full border border-white/70 px-3 py-1 hover:bg-white/10">
          Sign out
        </button>
      </form>
    </>
  );
}
