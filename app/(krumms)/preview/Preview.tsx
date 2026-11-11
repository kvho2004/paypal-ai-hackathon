"use client";

import { useState } from "react";
import ApprovalCard from "../chat/ApprovalCard";
import type { ApprovalRequest, ApprovalResult, RankedPick } from "../chat/agentTypes";
import RankedGrid from "../chat/RankedGrid";
import type { RewardRow } from "../../../lib/views/rewards";

// Sample data in the shape the agent will return. Not real recommendations.
const SAMPLE_PICKS: RankedPick[] = [
  {
    programId: "demo-diner",
    item: "Garden Grain Bowl",
    priceCents: 925,
    score: 0.91,
    reasons: ["Under your $10 budget", "No fried food", "Gets you closer to a free entree"],
    pointsEarned: 92,
    unlocks: "a free entree",
    offer: "$2 off any bowl",
    canCheckout: true,
  },
  {
    programId: "demo-diner",
    item: "Seasoned Fries + drink",
    priceCents: 650,
    score: 0.62,
    reasons: ["Cheapest filling option"],
    pointsEarned: 65,
    unlocks: null,
    offer: null,
    canCheckout: true,
  },
  {
    programId: "other-place",
    item: "Soup of the day",
    priceCents: 700,
    score: 0.4,
    reasons: ["Within budget"],
    pointsEarned: 0,
    unlocks: null,
    offer: null,
    canCheckout: false,
  },
];

/** A scratch harness for the chat pieces: pick a row, approve it, and see the exact result the agent receives. */
export default function Preview({ clientId, rewardRows }: { clientId: string | null; rewardRows: RewardRow[] }) {
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [result, setResult] = useState<ApprovalResult | null>(null);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-brand-text">RankedGrid: meal picks</h2>
        <RankedGrid
          picks={SAMPLE_PICKS}
          onOrder={(pick) => {
            setResult(null);
            setRequest({
              programId: pick.programId,
              item: pick.item,
              amountCents: pick.priceCents,
              rewardImpact: `About ${pick.pointsEarned} points pending${pick.unlocks ? `, which gets you ${pick.unlocks}` : ""}.`,
            });
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-brand-text">ApprovalCard</h2>
        {!request ? (
          <p className="text-sm text-muted">Press Order on a pick above. Approving makes a real sandbox payment.</p>
        ) : clientId ? (
          <ApprovalCard key={`${request.item}:${request.amountCents}`} request={request} clientId={clientId} onResult={setResult} />
        ) : (
          <p className="text-sm text-danger">PAYPAL_MERCHANT_CLIENT_ID is missing.</p>
        )}
        {result && (
          <pre className="mt-3 max-w-md overflow-x-auto rounded-xl bg-brand-soft p-3 text-xs">
            onResult: {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-brand-text">RankedGrid: reward rankings</h2>
        <RankedGrid rows={rewardRows} />
      </section>
    </div>
  );
}
