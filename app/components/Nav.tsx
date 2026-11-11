"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "./BrandMark";

// Simple 24x24 outline icons for the phone tab bar.
const ICONS = {
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  rewards: "M12 3l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.4l6-.9L12 3z",
  purchases: "M6 3h12v18l-3-2-3 2-3-2-3 2V3z M9 8h6 M9 12h6",
  connect: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
} as const;

const LINKS = [
  { href: "/chat", label: "Chat", icon: ICONS.chat },
  { href: "/rewards", label: "Rewards", icon: ICONS.rewards },
  { href: "/purchases", label: "Purchases", icon: ICONS.purchases },
  { href: "/connect", label: "Connect", icon: ICONS.connect },
];

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

/**
 * Wide screens: logo, pill links and the signed-in student in one top bar.
 * Phones: a slim top bar (logo and Sign out) plus a bottom tab bar, so the nav never wraps onto extra rows.
 */
export default function Nav({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login"; // full load, so no signed-in page stays cached in the router
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-2.5 sm:px-6 sm:py-3">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="h-7 w-9 sm:h-8 sm:w-10" />
            <span className="font-display text-xl font-semibold tracking-tight text-brand-text sm:text-2xl">Krumms</span>
          </Link>

          <nav aria-label="Primary" className="hidden sm:block">
            <ul className="flex gap-1 text-sm font-medium">
              {LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={`rounded-full px-3.5 py-1.5 transition-colors ${
                      isActive(href)
                        ? "bg-brand text-brand-contrast"
                        : "text-k-fg/70 hover:bg-brand-soft hover:text-brand-text"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {userName && (
            <div className="ml-auto flex shrink-0 items-center gap-3 text-sm">
              <span className="hidden whitespace-nowrap rounded-full bg-brand-soft px-3 py-1 text-brand-text lg:inline">
                {userName}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="whitespace-nowrap rounded-full border border-line px-3 py-1 text-muted hover:bg-brand-soft hover:text-brand-text"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {LINKS.map(({ href, label, icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  isActive(href) ? "text-brand-text" : "text-muted"
                }`}
              >
                <span className={`rounded-full px-4 py-1 ${isActive(href) ? "bg-brand-soft" : ""}`}>
                  <Icon path={icon} />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
