// Demo Diner's own data: a fictional restaurant, so nothing here comes from Krumms.
// Demo account history matches the "Demo Diner" purchases in scripts/seed-sandbox.ts
// ($9.50, $8.25, $11.00) at 10 points per $1, rounded down.

export const EARN_RATE = 10; // points per $1
export const WELCOME_BONUS = 100;
export const CURRENT_TIER = "Regular";
export const NEXT_TIER = { name: "Gold Booth", lifetimeTarget: 2500 };

export interface Reward {
  name: string;
  description: string;
  pointCost: number;
  availableThrough?: string; // YYYY-MM-DD, last day the reward can be redeemed
}

export const REWARDS: Reward[] = [
  { name: "Bottomless Drip Coffee", description: "Any size, refills on us.", pointCost: 150 },
  { name: "Seasoned Fries", description: "Crispy, golden and fried to order.", pointCost: 250 },
  {
    name: "Pumpkin Pie Slice",
    description: "Seasonal favorite with whipped cream.",
    pointCost: 300,
    availableThrough: "2026-11-30",
  },
  { name: "Thick Milkshake", description: "Vanilla, chocolate or strawberry.", pointCost: 350 },
  { name: "Buttermilk Pancake Stack", description: "Three pancakes, butter and maple syrup.", pointCost: 450 },
  { name: "Garden Grain Bowl", description: "Quinoa, roasted vegetables, avocado and lemon tahini.", pointCost: 650 },
  { name: "Crispy Chicken Sandwich", description: "Buttermilk-fried chicken, slaw and pickles.", pointCost: 700 },
  { name: "Diner Classic Burger", description: "Quarter-pound patty, cheddar and house sauce.", pointCost: 800 },
  { name: "Blue Plate Special", description: "Any entrée with a side and a drink.", pointCost: 1200 },
];

// Member offers: discounts and bonus-point promos, not redeemed with points.
export const OFFERS = [
  { title: "Double Points Tuesdays", details: "Earn 20 points for every $1 you spend on Tuesdays." },
  { title: "$2 off any bowl", details: "Show this offer at the register. Redeem by Nov 20, 2026." },
  { title: "Bring a friend", details: "You both get 100 bonus points when they join Demo Diner Rewards." },
];

export interface Activity {
  date: string; // YYYY-MM-DD
  description: string;
  points: number; // negative for redemptions
}

export interface Account {
  email: string; // lowercase, the login
  password: string; // fictional site: plain text, in memory only
  name: string;
  memberSince: string; // YYYY-MM-DD
  points: number;
  lifetimePoints: number;
  activity: Activity[]; // newest first
}

export const firstName = (account: Account) => account.name.split(" ")[0];

export const DEMO_ACCOUNTS: Account[] = [
  {
    email: "alex@demodiner.test",
    password: "pancakes123",
    name: "Alex Rivera",
    memberSince: "2025-09-02",
    points: 620,
    lifetimePoints: 1840,
    activity: [
      { date: "2026-11-06", description: "Order #4471 · $11.00", points: 110 },
      { date: "2026-11-04", description: "Order #4398 · $8.25", points: 82 },
      { date: "2026-10-29", description: "Order #4310 · $9.50", points: 95 },
      { date: "2026-10-21", description: "Redeemed Bottomless Drip Coffee", points: -150 },
      { date: "2026-10-14", description: "Order #4152 · $7.40", points: 74 },
    ],
  },
  {
    email: "sam@demodiner.test",
    password: "waffles123",
    name: "Sam Chen",
    memberSince: "2024-02-17",
    points: 1330,
    lifetimePoints: 2410,
    activity: [
      { date: "2026-11-07", description: "Order #4489 · $12.60", points: 126 },
      { date: "2026-11-03", description: "Double Points Tuesday · $9.80", points: 196 },
      { date: "2026-10-25", description: "Redeemed Thick Milkshake", points: -350 },
      { date: "2026-10-18", description: "Order #4207 · $10.15", points: 101 },
    ],
  },
];
