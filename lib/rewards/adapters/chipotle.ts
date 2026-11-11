import { siteAdapter } from "./site";

// Reads only work for about 10 minutes after a login. After that, Chipotle's bot protection blocks the account data
// and refresh reports EXTRACT_FAILED (docs/spike-log.md, "chipotle: repeat reads").
export const chipotle = siteAdapter({
  programId: "chipotle",
  domain: "chipotle.com",
  balanceUrl: "https://www.chipotle.com/order/rewards/exchange",
  // The heading above the reward list, which renders seconds after the page. Not the balance: the footer shows that
  // early, even when the account data is blocked.
  loadedText: /redeem your points/i,
});
