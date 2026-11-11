import type { RewardsAdapter } from "../types";
import { chipotle } from "./chipotle";

const ADAPTERS: RewardsAdapter[] = [chipotle];

/** The adapter for a program (same IDs as lib/paypal/merchants.ts), or undefined if there isn't one. */
export function getAdapter(programId: string): RewardsAdapter | undefined {
  return ADAPTERS.find((a) => a.programId === programId);
}
