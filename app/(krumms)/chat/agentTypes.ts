// The contract between Dev 1's chat components (RankedGrid, ApprovalCard) and Dev 2's agent, copied from
// dev2-dev1-team-split.md. Dev 2 owns lib/agent/types.ts; when that file lands on main, replace the bodies below
// with `export type { RankedPick, ApprovalRequest, ApprovalResult } from "../../../lib/agent/types";` so there is
// one source of truth. Until then, any change here must match that doc.
import type { CapturedPurchase } from "../../../lib/paypal/orders";

export interface RankedPick {
  programId: string;
  item: string;
  priceCents: number;
  score: number;
  reasons: string[];
  pointsEarned: number; // points this order should earn; shown as pending, never as already earned
  unlocks: string | null; // e.g. "a free entree"
  offer: string | null;
  canCheckout: boolean; // only Demo Diner can be paid in the sandbox
}

export interface ApprovalRequest {
  programId: string;
  item: string;
  amountCents: number;
  rewardImpact: string;
}

export type ApprovalResult =
  | { status: "paid"; purchase: CapturedPurchase }
  | { status: "denied" }
  | { status: "failed"; error: string };
