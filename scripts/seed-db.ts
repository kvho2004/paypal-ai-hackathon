import "dotenv/config";
import { db } from "../lib/db";
import { hashPassword } from "../lib/auth/password";
import { DEMO_USER_ID } from "../lib/purchases";

/**
 * Creates the demo student and their Krumms login. Safe to rerun; rerunning also resets the password.
 * Needs DEMO_STUDENT_EMAIL and DEMO_STUDENT_PASSWORD (see .env.example). Only the hash is stored.
 */
async function main() {
  const email = process.env.DEMO_STUDENT_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_STUDENT_PASSWORD;
  if (!email || !password) throw new Error("Set DEMO_STUDENT_EMAIL and DEMO_STUDENT_PASSWORD in .env");
  if (password.length < 8) throw new Error("DEMO_STUDENT_PASSWORD must be at least 8 characters");

  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { id: DEMO_USER_ID },
    create: {
      id: DEMO_USER_ID,
      name: "Demo Student",
      email,
      passwordHash,
      paypalSandboxEmail: process.env.SEED_RECIPIENT_EMAIL ?? null,
      prefs: {},
    },
    update: { email, passwordHash },
  });
  console.log(`Demo student ready: ${user.id} can sign in as ${email}`);
}

main()
  .catch((e) => {
    console.error("seed-db failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
