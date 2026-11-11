// The contract between the chat components (RankedGrid, ApprovalCard) and the agent. It lives in
// lib/agent/types.ts (Dev 2); this re-export keeps the components' existing imports working.
export type { RankedPick, ApprovalRequest, ApprovalResult } from "../../../lib/agent/types";
