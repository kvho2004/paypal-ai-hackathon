// Shared contract for the rewards pipeline:
// kernel.ts -> adapter.extract -> extract.ts -> refresh.ts (saves a Balance)
import type { Page } from "playwright-core";
import { z } from "zod";

export type ConnectionStatus = "PENDING" | "ACTIVE" | "NEEDS_AUTH" | "EXTRACT_FAILED";
export type BalanceSource = "live" | "screenshot" | "manual" | "mock";

export interface RawRewardsPage {
  url: string; // final URL; a login page here means the session expired
  text: string; // visible page text, sent to the LLM
  screenshot?: Uint8Array; // PNG for the vision fallback
}

export interface SignUpInfo {
  name: string;
  email: string;
}

export type SignUpResult = { ok: true } | { ok: false; reason: string };

export interface RewardsAdapter {
  programId: string; // same IDs as lib/paypal/merchants.ts, e.g. "demo-diner"
  domain: string; // Kernel auth connection domain
  balanceUrl: string;
  extract(page: Page): Promise<RawRewardsPage>; // assumes the page is already logged in
  signUp?(page: Page, user: SignUpInfo): Promise<SignUpResult>; // only after user approval
}

// Every field is required; anything the page doesn't show must be null, never guessed.
export const RewardItemSchema = z.object({
  name: z.string().trim().min(1).describe("Reward name exactly as shown"),
  pointCost: z.number().int().nonnegative().describe("Points needed to redeem"),
  expiresAt: z.iso.date().nullable().describe("YYYY-MM-DD, or null if not shown"),
});

export const ExtractedRewardsSchema = z.object({
  points: z.number().int().nonnegative().describe("Current points balance"),
  rewards: z
    .array(RewardItemSchema)
    .describe("Rewards redeemable with points, each with its point cost; empty if none. Not coupons or offers."),
  tierProgress: z
    .object({
      tierName: z.string().trim().min(1),
      current: z.number().nonnegative(),
      target: z.number().positive(),
    })
    .nullable()
    .describe("Progress toward the next tier, or null if not shown"),
});

export type RewardItem = z.infer<typeof RewardItemSchema>;
export type ExtractedRewards = z.infer<typeof ExtractedRewardsSchema>;

// Returned by refreshRewards(connectionId); used by the Render worker and the agent tool.
export type RefreshResult =
  | { ok: true; rewards: ExtractedRewards; fetchedAt: Date }
  | { ok: false; status: "NEEDS_AUTH" | "EXTRACT_FAILED"; error: string };
