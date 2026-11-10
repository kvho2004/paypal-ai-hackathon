// Small shared UI pieces for the Demo Diner pages.
const buttonBase = "inline-block rounded-full px-5 py-2.5 text-center font-semibold focus:outline-none focus:ring-2";

export const button = {
  primary: `${buttonBase} bg-[#b3261e] text-white hover:bg-[#961f19] focus:ring-[#b3261e]/40`,
  secondary: `${buttonBase} ring-1 ring-stone-300 hover:bg-stone-50 focus:ring-stone-400`,
};

export const linkClass = "font-semibold text-[#b3261e] hover:underline";

/** A labeled input. `id` doubles as the form field name. */
export function Field({ label, id, ...input }: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-stone-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-[#b3261e] focus:outline-none focus:ring-2 focus:ring-[#b3261e]/30"
        {...input}
      />
    </div>
  );
}

export function Alert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  const colors = tone === "error" ? "bg-red-50 text-red-800 ring-red-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ring-1 ${colors}`}>
      {children}
    </p>
  );
}

/** Narrow centered card for the sign-in and join pages. Children are spaced evenly, so missing ones leave no gap. */
export function Card({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
      <div>
        <h1 className="text-2xl font-black">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** A titled page section. */
export function Section({
  title,
  subtitle,
  children,
  ...props
}: { title: string; subtitle?: React.ReactNode } & React.ComponentProps<"section">) {
  return (
    <section {...props}>
      <h2 className="text-2xl font-black">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
