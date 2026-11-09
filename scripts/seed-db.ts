import "dotenv/config";
import { db } from "../lib/db";
import { DEMO_USER_ID } from "../lib/purchases";

/** Creates the demo user that purchases are attached to. Safe to rerun. */
async function main() {
  const user = await db.user.upsert({
    where: { id: DEMO_USER_ID },
    create: {
      id: DEMO_USER_ID,
      name: "Demo Student",
      paypalSandboxEmail: process.env.SEED_RECIPIENT_EMAIL ?? null,
      prefs: {},
    },
    update: {},
  });
  console.log(`Demo user ready: ${user.id}`);
}

main()
  .catch((e) => {
    console.error("seed-db failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
