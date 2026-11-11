import type { RewardsAdapter } from "../types";
import { chipotle } from "./chipotle";
import { demoDiner } from "./demo-diner";

const ADAPTERS: RewardsAdapter[] = [chipotle, demoDiner];

/** The adapter for a program (same IDs as lib/paypal/merchants.ts), or undefined if there isn't one. */
export function getAdapter(programId: string): RewardsAdapter | undefined {
  return ADAPTERS.find((a) => a.programId === programId);
}
