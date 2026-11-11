import { requireUser } from "../../../lib/auth/server";
import { getPurchaseSummary } from "../../../lib/purchases";

// Query at request time, never at build time (the database is not reachable for static prerendering).
export const dynamic = "force-dynamic";

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function PurchasesPage() {
  const user = await requireUser();
  const rows = await getPurchaseSummary(user.id, 30);
  const totalCents = rows.reduce((sum, r) => sum + r.totalCents, 0);
  const visits = rows.reduce((sum, r) => sum + r.visits, 0);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Where you eat</h1>
      <p className="mt-1 text-sm opacity-70">
        Last 30 days from PayPal: {usd(totalCents)} across {visits} purchases.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm opacity-70">No purchases yet.</p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/15">
              <th className="py-2 pr-4 font-medium">Restaurant</th>
              <th className="py-2 pr-4 font-medium">Visits</th>
              <th className="py-2 pr-4 font-medium">Spend</th>
              <th className="py-2 font-medium">Rewards</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.merchant}
                className="border-b border-black/5 dark:border-white/10"
              >
                <td className="py-2 pr-4">{r.merchant}</td>
                <td className="py-2 pr-4">{r.visits}</td>
                <td className="py-2 pr-4">{usd(r.totalCents)}</td>
                <td className="py-2">
                  {r.programId ? (
                    <span className="opacity-70">{r.programId}</span>
                  ) : (
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                      Not enrolled
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
