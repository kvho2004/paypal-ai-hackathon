# Krumms Demo Video Script

Nov 9, 2026

## Overview

The script runs about 2:55 with roughly 390 spoken words, which leaves a few seconds of buffer under the 3:00 limit.

- **Pace:** about 150 words per minute, relaxed and conversational, like explaining the app to a friend.
- **Cast:** one narrator (the Producer or whoever sounds most natural). The agent's replies appear as on-screen text, not voiceover.
- **Story:** a student with too many food apps finds the best deal, pays with PayPal, and watches rewards update. It follows the demo story in the development plan.
- **Restaurants on screen:** Demo Diner (the working rewards flow and PayPal merchant) and Basil Bowl (a second fictional program the student hasn't joined yet). No real brands appear.

## Script

Each row is one shot. Read the voiceover column aloud; the on-screen column tells the editor and devs what must be visible.

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00–0:08 | Phone home screen. A folder of five fictional food apps, each with a points badge. | "Okay, real question. How many food apps are on your phone right now? Because I had five." |
| 0:08–0:20 | Stat overlay: "26% of loyalty points go unspent. About $10B in missed savings every year." Small source line underneath. | "Five apps, five point balances, and I was still eating ramen on a Tuesday because I never knew which reward was actually worth using. And that's super common. Billions in rewards just sit there or expire." |
| 0:20–0:24 | Title card: **Krumms**. "Stop leaving crumbs on the table." | "So we built Krumms." |
| 0:24–0:48 | Krumms home. Link PayPal, with the sandbox label visible. Agent message types out: "You've spent $86 on food this month, mostly at Demo Diner and Basil Bowl. You're in Demo Diner Rewards, but not Basil Bowl's." | "Krumms is one AI agent for all your food rewards. It starts with your PayPal activity to see where you actually eat. And it already caught something I missed: I go to Basil Bowl every week, and I've earned zero points there." |
| 0:48–1:08 | Connect accounts, then Demo Diner, then the hosted login page. Cut to the cloud browser live view navigating to the points page. | "Next, I connect my rewards account. I log in on a secure hosted page, so Krumms never sees my password. Then the agent opens its own browser and reads my points for me." |
| 1:08–1:28 | Rewards view (AG Grid) fills in. Sort by cents per point. Highlight a green "best value" row, then a red "poor use" row. | "Everything lands in one view, ranked by what each point is actually worth. Green is a great deal. Red is you wasting points. Like, this free cookie for 200 points? Please don't." |
| 1:28–1:38 | Chat. User types: "lunch under $8, nothing fried, and stop suggesting burgers" | "Now I can just talk to it, like a friend who's weirdly good with money." |
| 1:38–2:06 | Agent reply with an in-chat grid of three ranked picks. Top pick: "Grain bowl at Demo Diner, $7.25. Puts you 1 visit from a free drink." A "No burgers" preference chip appears. | "It checks my balances, my budget, and what I don't want, and it remembers that. No burgers until I say so. Top pick is a seven-dollar grain bowl at Demo Diner, and it gets me one visit away from a free drink." |
| 2:06–2:26 | Approval card (item, price, reward impact), then Approve, then PayPal sandbox checkout, then success. Progress bar jumps. A text arrives on a phone: "1 visit from a free drink at Demo Diner." | "The agent sets up the order, but nothing gets paid until I approve it. One tap, pay with PayPal, done. My progress updates right away, and I get a text: one more visit to a free drink." |
| 2:26–2:38 | Agent card: "Want to join Basil Bowl Rewards?" Approve. "You're in." | "And remember Basil Bowl? Krumms asks if I want to join their rewards. I say yes, and it handles the sign-up." |
| 2:38–2:50 | Architecture slide with tool names as text. | "Under the hood: PayPal for purchase history and agentic checkout, Claude as the agent, Kernel for the browser, plus AG Grid, Render, APIMatic, Zapier, and Postman." |
| 2:50–2:55 | End card: Krumms, hosted demo URL, GitHub repo. | "Krumms. Eat well, spend less, and stop leaving crumbs on the table." |

## Production notes and rules checklist

Record the voiceover separately from the screen takes, then cut the screen to fit the voice. That keeps the timing tight and lets you redo a line without re-recording the demo.

**Recording tips**

- Read the full script aloud with a timer before recording. If it runs over 2:50, use the trim plan below.
- Reset with the `DEMO_MODE` script before every take so balances and the $86 figure match the voiceover.
- Speed-ramp the slow parts (cloud browser loading, PayPal approval) and add a small "2x" tag so judges know it's the real flow.
- Hold for about one second on the approval card. "Nothing gets paid until I approve it" is the trust moment PayPal cares about most.
- Add captions. Many judges watch without sound.
- Keep music royalty-free and low under the voice.

**Hackathon rules**

- [ ] Final cut under 3:00 (target 2:55)
- [ ] Shows the real app running in a browser, not Figma screens
- [ ] No third-party trademarks or logos: fictional restaurant names only. If the real-program spike works, call it "a real coffee chain's rewards account" and blur its branding
- [ ] Tool names on the architecture slide as text, unless you've confirmed logo use is allowed
- [ ] Sandbox label visible during PayPal steps
- [ ] Uploaded to YouTube as public, link added to the submission form
- [ ] Source for the stat overlay shown on screen and listed in the README

## Trim plan

If the read runs long, cut in this order. Each cut saves about 4 to 8 seconds, and none of them removes the PayPal or AI story.

1. Drop "And that's super common." from the opening.
2. Drop the cookie joke at 1:08 ("Like, this free cookie for 200 points? Please don't.").
3. Shorten the architecture line to: "Built on PayPal, Claude, and Kernel, with AG Grid, Render, APIMatic, Zapier, and Postman."
4. Make the Basil Bowl sign-up a silent 3-second shot with the text "Joined Basil Bowl Rewards" on screen.

Never cut the approval and PayPal checkout shot or the ranked chat reply. Those carry the agentic commerce story.

## Sources

- Stat overlay (26.2% of loyalty points unspent, about $10B in missed savings): [Antavo Global Customer Loyalty Report 2026, via GCN](https://gcn.com/?p=21979)
