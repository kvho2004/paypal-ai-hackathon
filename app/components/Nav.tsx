"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "./BrandMark";

const LINKS = [
  { href: "/chat", label: "Chat" },
  { href: "/rewards", label: "Rewards" },
  { href: "/purchases", label: "Purchases" },
  { href: "/connect", label: "Connect" },
];

export default function Nav({ userName }: { userName?: string }) {
  const pathname = usePathname();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login"; // full load, so no signed-in page stays cached in the router
  }

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="h-8 w-10" />
          <span className="font-display text-2xl font-semibold tracking-tight text-brand-text">Krumms</span>
        </Link>
        <ul className="flex flex-wrap gap-1 text-sm font-medium">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3.5 py-1.5 transition-colors ${
                    active ? "bg-brand text-brand-contrast" : "text-k-fg/70 hover:bg-brand-soft hover:text-brand-text"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        {userName && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="rounded-full bg-brand-soft px-3 py-1 text-brand-text">{userName}</span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-full border border-line px-3 py-1 text-muted hover:bg-brand-soft hover:text-brand-text"
            >
              Sign out
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
