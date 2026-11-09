import "dotenv/config";
import { db } from "../lib/db";

// Round-trip check: confirms the Render database is reachable through the Prisma client.
async function main() {
  const [purchases, programs] = await Promise.all([db.purchase.count(), db.program.count()]);
  console.log(`DB OK. purchases=${purchases} programs=${programs}`);
}

main()
  .catch((e) => {
    console.error("DB check failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
