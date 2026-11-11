// Contract between the chat agent and the chat UI components:
// - Produced by (Dev 2): lib/scoring/suggest.ts (RankedPick), lib/agent/tools.ts (ApprovalRequest)
// - Consumed by (Dev 1): app/(krumms)/chat/RankedGrid.tsx, app/(krumms)/chat/ApprovalCard.tsx
// Frozen: changes need a PR that names the other dev.
// `import type` keeps orders.ts (PayPal server SDK, secret keys) out of the client bundle.
import type { CapturedPurchase } from "@/lib/paypal/orders";

/** One row of the `suggestMeals` tool output; RankedGrid renders the list, and its Order button uses `canCheckout`. */
export interface RankedPick {
  programId: string;
  item: string;
  priceCents: number;
  score: number; // compare within one result list only
  reasons: string[]; // built in code, e.g. "+72 pts → Garden Grain Bowl ready"
  pointsEarned: number;
  unlocks: string | null; // reward reached by balance + pending + pointsEarned
  offer: string | null;
  canCheckout: boolean; // demo-diner only
}

/** `requestApproval` tool input (written by the agent); ApprovalCard shows it before any PayPal popup. */
export interface ApprovalRequest {
  programId: string;
  item: string;
  amountCents: number;
  rewardImpact: string; // e.g. "+72 pts → Garden Grain Bowl ready"
}

/** `requestApproval` tool output: ApprovalCard's onResult → addToolOutput in Chat.tsx → back to the agent. */
export type ApprovalResult =
  | { status: "paid"; purchase: CapturedPurchase }
  | { status: "denied" }
  | { status: "failed"; error: string };
