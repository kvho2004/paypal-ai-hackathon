# Krumms Demo Video Script

Nov 10, 2026

## Overview

The script runs about 2:50 with roughly 390 spoken words, which leaves a few seconds of buffer under the 3:00 limit. It opens with a real student problem, backs it with numbers, then shows Krumms solving it end to end.

- **Pace:** about 140 words per minute. Relaxed and natural, like talking to a classmate. No performing.
- **Cast:** one narrator, on camera for the opening and the ending, voiceover for the demo. The agent's replies appear as on-screen text.
- **Recurring thread:** "my favorite burrito place." It opens the video, comes back in the demo, and pays off with a free entrée.
- **Places on screen:** two clearly fictional restaurants, a burrito spot and a café. No real brand names or logos appear anywhere, in the narration or on screen (Official Rules, section 4).

**Loop tracker**

| Loop | Opened | Closed |
| --- | --- | --- |
| Never redeemed a reward at my favorite burrito place | 0:00 | 1:55, the order gets me to a free entrée |
| Can an AI agent close the gap between food insecurity and unused rewards? | 0:28 | The whole demo, wrapped up at 2:40 |
| A café I visit weekly where I earn nothing | 0:38 | 2:17, the agent signs me up |
| Can I trust an AI with my money? | 1:55 | 2:05, nothing happens until I approve it |

## Script

Each row is one shot. Personal details in the opening (how often, how long) should be changed to match whoever narrates, so they're true.

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00–0:08 | Narrator on camera, phone in hand. | "There's a burrito place near campus I go to probably twice a week. I've been in their rewards program for over a year, and I've never actually redeemed anything." |
| 0:08–0:28 | Narrator on camera. Simple text overlays for each stat, with the source in small text. | "That sounds like a small thing, but for a lot of students it isn't. Depending on the study, somewhere between one in five and one in three college students deal with food insecurity. For students on Pell Grants, it's close to thirty percent. And about a quarter of loyalty points never get used. That's food people already paid for." |
| 0:28–0:38 | Narrator on camera. | "So we wanted to see if an AI agent could close that gap. Find the food money that's already sitting in your rewards apps and actually get it to you." |
| 0:38–1:00 | Krumms home screen, link PayPal (sandbox label visible), then Krumm's summary of where you've been spending, with one place flagged "Not in rewards." | "This is Krumms. I linked my PayPal, and it looked at where my food money actually goes. Most of it's my favorite burrito place, which wasn't a surprise. But it also noticed a café I go to almost every week, and I'm not in their rewards program at all. That's a lot of visits that earned me nothing." |
| 1:00–1:28 | Hosted login, then the cloud browser reading the rewards page, then the rewards grid (AG Grid) filling in and sorting by value. | "To see my points, I log in on a secure page, so Krumms never gets my password. Then the agent opens its own browser and reads my rewards for me. Everything shows up in one place, ranked by what each reward is really worth, so I'm not spending points on something small when they could cover a whole meal." |
| 1:28–1:55 | Chat. User types "lunch under $10, something filling, no burgers." Krumm replies with three ranked picks in a grid and a "No burgers" chip. | "Then I just ask for what I need. Lunch under ten dollars, something filling, and no burgers. It checks my points and my budget, remembers what I said, and the top pick is a bowl from my favorite burrito place, because it gets me to a free entrée." |
| 1:55–2:17 | Approval card (item, price, reward impact). Hold one second. Then PayPal sandbox checkout, then the paw stamps filling up. | "That's the part I like most. It does the work. It finds the reward, sets up the order, and pays with PayPal, but it can't spend anything on its own. I see the price and what it does for my rewards, and nothing happens until I approve it. This is PayPal's sandbox, so no actual burrito today, but the flow is the same." |
| 2:17–2:27 | Krumm's card "Want to join this café's rewards?", then approve. | "It also offered to sign me up for that café's rewards, so those weekly visits finally count for something." |
| 2:27–2:40 | Architecture slide, tool names as plain text, no logos. | "Krumms is built on PayPal's Agent Toolkit for checkout and PayPal transaction data for purchase history, with Claude as the agent, Kernel for the browser, AG Grid, Render, and APIMatic." |
| 2:40–2:50 | Narrator on camera, then the end card with the Krumms logo, hosted demo URL, and GitHub repo. | "A free entrée isn't going to fix food insecurity. But when you're stretching every dollar, it matters. That's why we built Krumms." |

## Writing rules for this script

- No colon setups like "Here's the worst part:" or "The real test:". They sound AI-written.
- No "It wasn't X, it was Y" contrasts, no "Let's find out," no trailer-voice lines.
- Sound like a college student talking normally, but keep it professional. Minimal acting.
- Every number is exact and sourced.

## Rules check (from `docs/official-rules.txt`)

- [ ] Final cut under 3:00 (target 2:50). Judges aren't required to watch past 3:00.
- [ ] No third-party trademarks in narration or on screen. No real restaurant names, logos, or app screens.
- [ ] No copyrighted music. Royalty-free only.
- [ ] Every screen shown actually works in the build ("must function as depicted in the video").
- [ ] Footage shows the real app running in a browser, not Figma or mockups.
- [ ] Tool names on the architecture slide as plain text, no logos.
- [ ] Sandbox label visible during PayPal steps, and the narration says it's the sandbox.
- [ ] Uploaded to YouTube as public, link on the Devpost submission form.
- [ ] Submit by Thu Nov 12, 12:00 PM Pacific (3:00 PM Eastern).
- [ ] Hosted demo, sandbox credentials, and API keys keep working through the end of judging (Dec 15).

## What each scene scores

| Judging criterion | Where the script covers it |
| --- | --- |
| Technological Implementation (first tiebreaker) | 0:38 PayPal purchase history, 1:00 agent browser + extraction, 1:28 agent reasoning, 1:55 PayPal checkout, 2:27 Agent Toolkit named |
| Design | The Krumms UI throughout, especially the rewards grid and chat |
| Potential Impact | 0:08 food insecurity and unused points stats, 2:40 closing |
| Innovation | 1:55 "It does the work," an agent that acts on your rewards with your approval |
| Presentation | Problem, audience, and why it matters in the first 38 seconds, then one end-to-end flow |

## Production notes for the team

- Rename the fictional demo restaurants so they look like a burrito spot and a café (for example "Casa Bowl" and "Corner Café"). Keep them clearly fictional and not resembling any real brand.
- Seed the demo data so the bowl order reaches a free entrée at the burrito place.
- The café join step (2:17) must actually work. If `joinProgram` can't support it by filming, cut that row and drop the café mention at 0:38 too, so no loop is left open.
- Record the voiceover separately, then cut screen footage to fit it.
- Reset with the demo reset script before every take so numbers match the voiceover.
- Speed-ramp slow parts (cloud browser loading, PayPal approval) with a small "2x" tag.
- Hold one second on the approval card. It's the trust moment PayPal cares about most.
- Add captions.

## Trim plan

If the read runs long, cut in this order. None of these removes the PayPal or AI story.

1. Drop "For students on Pell Grants, it's close to thirty percent."
2. Shorten 1:00 to: "I log in on a secure page, and the agent reads my rewards in its own browser. Everything shows up in one place, ranked by what each reward is really worth."
3. Drop "That's the part I like most." at 1:55.
4. Cut the café join scene (2:17 to 2:27).

Never cut the opening, the stats, the chat pick, or the approval and PayPal checkout.

## Sources

- Pell Grant recipients 28.4% vs. 16.3% food insecurity: [Temple University Hope Center, federal BPS data](https://hope.temple.edu/newsroom/hope-blog/new-longitudinal-federal-data-reveal-troubling-reality-students-basic-needs-insecurity-persists)
- 19% lower-bound estimate of student food insecurity: [University of Illinois](https://news.illinois.edu/scholars-estimates-of-food-insecurity-among-college-students-problematic/)
- 36% of university students food insecure: [NPR Illinois, Wisconsin HOPE Lab](https://www.nprillinois.org/post/food-housing-insecurity-may-be-keeping-college-students-graduating)
- 26.2% of loyalty points unspent: [Antavo Global Customer Loyalty Report 2026, via GCN](https://gcn.com/?p=21979)
