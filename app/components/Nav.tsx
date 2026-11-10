"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/chat", label: "Chat" },
  { href: "/rewards", label: "Rewards" },
  { href: "/purchases", label: "Purchases" },
  { href: "/connect", label: "Connect" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Krumms
        </Link>
        <ul className="flex gap-4 text-sm">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "font-semibold underline underline-offset-4"
                      : "opacity-70 hover:opacity-100"
                  }
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
