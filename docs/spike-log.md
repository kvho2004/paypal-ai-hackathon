# Kernel spike log

Can Kernel read a real restaurant rewards program? Each run of `scripts/spike-kernel.ts` appends a section below. Q3 checks that the page text can be captured repeatedly; reading points from that text is tested separately in `extract.ts`.

**Verdict (Nov 9, 23:00 ET):** Two real programs work through Kernel: **Chipotle** (login with a verification code; balance plus full reward list with point costs, read 3/3) and **Panera** (balance, next-reward progress and offers, read 3/3). **Starbucks is blocked**: it rejects logins from Kernel's browser even when the password is typed by hand. Demo Diner stays the guaranteed demo path; Chipotle is the stronger real-program candidate because its page lists point costs.

## starbucks: 2026-11-09 18:56 ET
- balance URL: `https://www.starbucks.com/account/rewards`; credentials not saved, so automatic re-login is untested
- 19:03 Q1 login: NO, inconclusive. Kernel reached the Starbucks sign-in and submitted 3 times; Starbucks rejected each. Starbucks' own site also failed for this account in a normal browser ("Something went wrong on our end"), so the cause is Starbucks-side, not Kernel. Stopped to avoid an account lockout.

## chipotle: 2026-11-09 22:21 ET
- balance URL: `https://www.chipotle.com/order/account/rewards`; credentials not saved, so automatic re-login is untested
- stopped before login: wrong balance URL, rerun below

## chipotle: 2026-11-09 22:27 ET
- balance URL: `https://www.chipotle.com/order/rewards/exchange`; credentials not saved, so automatic re-login is untested
- 22:31 Q1 login: NO (DISCOVERING 22:27 → AWAITING_INPUT 22:28 → SUBMITTING 22:29 → AWAITING_INPUT 22:29 → SUBMITTING 22:29 → AWAITING_INPUT 22:30 → SUBMITTING 22:30 → COMPLETED 22:31); error: The login flow failed. Please try again or contact support if the issue persists.

## chipotle: 2026-11-09 22:33 ET
- balance URL: `https://www.chipotle.com/order/rewards/exchange`; credentials not saved, so automatic re-login is untested
- 22:35 Q1 login: YES (DISCOVERING 22:33 → AWAITING_INPUT 22:34 → SUBMITTING 22:34 → AWAITING_INPUT 22:35 → SUBMITTING 22:35 → COMPLETED 22:35)
- 22:36 Q2 run 1/3: OK (www.chipotle.com/order/rewards/exchange, 1676 chars)
- 22:36 Q3 run 2/3: OK (www.chipotle.com/order/rewards/exchange, 1636 chars)
- 22:37 Q3 run 3/3: OK (www.chipotle.com/order/rewards/exchange, 1636 chars)
- verdict: **WORKS.** Screenshots show the logged-in Rewards Exchange page in all 3 runs: points balance plus 25 rewards with point costs. Balance and reward list identical across runs (run 1 had one extra late-rendered line). Login needed email + password + a verification code, entered on Kernel's hosted page. The previous attempt (22:27) failed with a generic `flow_failed` and the cause is unknown, so login can be flaky.

## starbucks: 2026-11-09 22:39 ET
- balance URL: `https://www.starbucks.com/rewards/my-rewards`; credentials not saved, so automatic re-login is untested
- Q1 login: **NO.** Inside Kernel's browser, Starbucks answered with its normal "Please check your email or password and try again", even though the same credentials work in a normal browser. Typing the password by hand in Kernel's live view got the same error, so it isn't Kernel's typing: Starbucks rejects logins from Kernel's cloud browser (most likely bot detection that shows a fake wrong-password error).
- verdict: **BLOCKED.** Not fixable for the MVP.

## panera: 2026-11-09 22:51 ET
- balance URL: `https://www.panerabread.com/en-us/mypanera/rewards.html`; credentials not saved, so automatic re-login is untested
- 22:55 Q1 login: YES (DISCOVERING 22:51 → AWAITING_INPUT 22:51 → SUBMITTING 22:53 → AWAITING_INPUT 22:54 → SUBMITTING 22:55 → COMPLETED 22:55)
- 22:56 Q2 run 1/3: OK (www.panerabread.com/en-us/mypanera/rewards.html, 2082 chars)
- 22:56 Q3 run 2/3: OK (www.panerabread.com/en-us/mypanera/rewards.html, 2082 chars)
- 22:56 Q3 run 3/3: OK (www.panerabread.com/en-us/mypanera/rewards.html, 2082 chars)
- verdict: **WORKS.** Screenshots show the logged-in MyPanera Rewards & Offers page in all 3 runs, with identical text each time: points balance, points expiry date, points needed for the next reward, and current offers with redeem-by dates. Unlike Chipotle, this page doesn't list rewards with point costs (that's behind "Explore Rewards"), so value-per-point scoring would need a second page or catalog data.
