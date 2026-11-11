import { requireUser } from "../../../lib/auth/server";
import { getPurchaseSummary } from "../../../lib/purchases";
import { Badge, Card, PageHeader, StatTile } from "../../components/ui";

// Query at request time, never at build time (the database is not reachable for static prerendering).
export const dynamic = "force-dynamic";

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

// Program ids are slugs ("demo-diner"); show the restaurant's name. Unknown merchants already carry their own name.
const PROGRAM_NAMES: Record<string, string> = {
  "demo-diner": "Demo Diner",
  starbucks: "Starbucks",
  chipotle: "Chipotle",
  panera: "Panera Bread",
};
const displayName = (merchant: string, programId: string | null) =>
  (programId && PROGRAM_NAMES[programId]) || merchant;

export default async function PurchasesPage() {
  const user = await requireUser();
  const rows = await getPurchaseSummary(user.id, 30);
  const totalCents = rows.reduce((sum, r) => sum + r.totalCents, 0);
  const visits = rows.reduce((sum, r) => sum + r.visits, 0);
  const notEnrolled = rows.filter((r) => !r.programId).length;

  return (
    <section>
      <PageHeader title="Where you eat" subtitle="Your last 30 days of food purchases, read from PayPal." />

      <div className="mb-6 flex flex-wrap gap-4">
        <StatTile label="Spent" value={usd(totalCents)} hint="last 30 days" />
        <StatTile label="Purchases" value={visits} />
        <StatTile label="Restaurants" value={rows.length} />
        <StatTile
          label="Not enrolled"
          value={notEnrolled}
          hint={notEnrolled > 0 ? "no rewards program yet" : "you're in every program"}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No purchases yet.</p>
        </Card>
      ) : (
        <Card className="p-0">
          {/* Phones: a list, because four table columns do not fit in 393px. */}
          <ul className="divide-y divide-line sm:hidden">
            {rows.map((r) => (
              <li key={r.merchant} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{displayName(r.merchant, r.programId)}</p>
                  <p className="text-xs text-muted">
                    {r.visits} {r.visits === 1 ? "visit" : "visits"} · {usd(r.totalCents)}
                  </p>
                </div>
                {r.programId ? <Badge tone="brand">Member</Badge> : <Badge tone="accent">Not enrolled</Badge>}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Restaurant</th>
                <th className="px-5 py-3 font-medium">Visits</th>
                <th className="px-5 py-3 font-medium">Spend</th>
                <th className="px-5 py-3 font-medium">Rewards</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.merchant} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{displayName(r.merchant, r.programId)}</td>
                  <td className="px-5 py-3">{r.visits}</td>
                  <td className="px-5 py-3">{usd(r.totalCents)}</td>
                  <td className="px-5 py-3">
                    {r.programId ? <Badge tone="brand">Member</Badge> : <Badge tone="accent">Not enrolled</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </section>
  );
}
