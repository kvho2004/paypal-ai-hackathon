// Small building blocks shared by the Krumms pages. Server-safe: no hooks, no client state.
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-text">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}>{children}</div>;
}

/** A big number with a label, for the summary row at the top of a page. */
export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="flex-1 basis-40">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-brand-text">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Badge({ tone, children }: { tone: "brand" | "accent" | "success"; children: ReactNode }) {
  const tones = {
    brand: "bg-brand-soft text-brand-text",
    accent: "bg-accent text-[#4a3700]",
    success: "bg-success/15 text-success",
  } as const;
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
