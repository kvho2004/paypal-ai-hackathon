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

/** True if the URL is a sign-in or login page: as a RawRewardsPage.url, the site's session has expired. */
export function isLoginPage(url: string): boolean {
  return /sign-?in|log-?in/i.test(new URL(url).pathname);
}

export interface SignUpInfo {
  name: string;
  email: string;
}

export type SignUpResult = { ok: true } | { ok: false; reason: string };

/** Thrown by an adapter when the balance page loads but its rewards data never shows. */
export class PageNotReadyError extends Error {
  name = "PageNotReadyError";
}

export interface RewardsAdapter {
  programId: string; // same IDs as lib/paypal/merchants.ts, e.g. "demo-diner"
  domain: string; // Kernel auth connection domain
  balanceUrl: string;
  /**
   * Reads the balance page in a browser that should already be logged in. Returns either the balance page once its
   * rewards data shows, or the page the site redirected to (refresh.ts checks that URL for a login page).
   * Throws PageNotReadyError if the data never shows: refresh.ts records that as EXTRACT_FAILED. Any other error
   * (browser, network) is treated as temporary and thrown on for a retry.
   */
  extract(page: Page): Promise<RawRewardsPage>;
  signUp?(page: Page, user: SignUpInfo): Promise<SignUpResult>; // only after user approval
}

// Every field is required; anything the page doesn't show must be null, never guessed.
export const RewardItemSchema = z.object({
  name: z.string().trim().min(1).describe("Reward name exactly as shown"),
  pointCost: z.number().int().nonnegative().describe("Points needed to redeem"),
  expiresAt: z.iso.date().nullable().describe("YYYY-MM-DD, or null if not shown"),
});

export const OfferSchema = z.object({
  name: z.string().trim().min(1).describe("Offer headline exactly as shown, e.g. \"$2 off any bowl\""),
  details: z.string().trim().min(1).nullable().describe("Conditions or fine print as shown, or null if none"),
  expiresAt: z.iso.date().nullable().describe("YYYY-MM-DD redeem-by date, or null if not shown"),
});

// refresh.ts saves everything except `points` in Balance.rewards (JSON): { rewards, offers, tierProgress }.
export const ExtractedRewardsSchema = z.object({
  points: z.number().int().nonnegative().describe("Current points balance"),
  rewards: z
    .array(RewardItemSchema)
    .describe("Rewards redeemable with points, each with its point cost; empty if none. Not coupons or offers."),
  offers: z
    .array(OfferSchema)
    .describe("Deals that don't cost points: discounts, coupons, bonus-point promos; empty if none."),
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
export type Offer = z.infer<typeof OfferSchema>;
export type ExtractedRewards = z.infer<typeof ExtractedRewardsSchema>;

// One line of the /api/rewards/refresh stream. ConnectFlow.tsx keeps its own copy of this shape and checks each line
// before use; keep the two in step. `status` on a failure is a RefreshResult status, or "ERROR" when the read threw.
export type RefreshEvent =
  | { step: "browser"; liveViewUrl: string }
  | { step: "extracting" }
  | { step: "done"; ok: true; points: number; rewards: number; fetchedAt: string }
  | { step: "done"; ok: false; status: string; error: string };

// Returned by refreshRewards(connectionId); used by the Render worker and the agent tool.
export type RefreshResult =
  | { ok: true; rewards: ExtractedRewards; fetchedAt: Date }
  | { ok: false; status: "NEEDS_AUTH" | "EXTRACT_FAILED"; error: string };
