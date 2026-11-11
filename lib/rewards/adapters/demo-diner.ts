import { siteAdapter } from "./site";

// Our fictional site (app/demo-diner). Kernel's cloud browser can't reach localhost, so this points at the hosted
// copy by default. Set DEMO_DINER_URL to read another copy, e.g. a tunnel to `npm run dev`. `||`, not `??`: an empty
// DEMO_DINER_URL= (as copied from .env.example) must also fall back.
const BASE_URL = (process.env.DEMO_DINER_URL || "https://krumms-web.onrender.com/demo-diner").replace(/\/+$/, "");

export const demoDiner = siteAdapter({
  programId: "demo-diner",
  domain: new URL(BASE_URL).hostname,
  // Logged out, this redirects to /demo-diner/login, which refresh.ts reports as NEEDS_AUTH.
  balanceUrl: `${BASE_URL}/rewards`,
  // The heading above the reward list. The page renders on the server, so it shows together with the balance.
  loadedText: /redeem your points/i,
});
