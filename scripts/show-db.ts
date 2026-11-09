import "dotenv/config";
import { db } from "../lib/db";

/**
 * Print table contents without needing Prisma Studio or psql.
 * Usage: npx tsx scripts/show-db.ts [Table]   (no argument = row counts for every table)
 */
const tables = {
  User: db.user,
  Program: db.program,
  Connection: db.connection,
  Balance: db.balance,
  Purchase: db.purchase,
  CatalogItem: db.catalogItem,
  Action: db.action,
} as const;

async function main() {
  const name = process.argv[2];

  if (!name) {
    const rows = await Promise.all(
      Object.entries(tables).map(async ([table, model]) => ({
        table,
        rows: await (model as unknown as { count: () => Promise<number> }).count(),
      })),
    );
    console.table(rows);
    return;
  }

  const model = tables[name as keyof typeof tables];
  if (!model) throw new Error(`Unknown table "${name}". Choose from: ${Object.keys(tables).join(", ")}`);
  const rows = await (model as unknown as { findMany: (a: { take: number }) => Promise<unknown[]> }).findMany({ take: 100 });
  console.log(`${name}: ${rows.length} row(s) shown (max 100)`);
  console.table(rows);
}

main()
  .catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
