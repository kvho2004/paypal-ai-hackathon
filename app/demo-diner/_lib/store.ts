// In-memory member store. Resets to the demo accounts when the server restarts.
import { DEMO_ACCOUNTS, WELCOME_BONUS, type Account } from "./data";

// Kept on globalThis so dev hot reloads and separate route bundles share one store.
const g = globalThis as { __demoDinerAccounts?: Map<string, Account> };
const accounts = (g.__demoDinerAccounts ??= new Map(
  DEMO_ACCOUNTS.map((a) => [a.email, structuredClone(a)] as const),
));

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function getAccount(email: string): Account | undefined {
  return accounts.get(normalizeEmail(email));
}

export function authenticate(email: string, password: string): Account | undefined {
  const account = getAccount(email);
  return account && account.password === password ? account : undefined;
}

export type JoinResult = { ok: true; account: Account } | { ok: false; error: "invalid" | "exists" };

export function createAccount(input: { name: string; email: string; password: string }): JoinResult {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.password.length < 8) {
    return { ok: false, error: "invalid" };
  }
  if (accounts.has(email)) return { ok: false, error: "exists" };

  const today = new Date().toISOString().slice(0, 10);
  const account: Account = {
    email,
    password: input.password,
    name,
    memberSince: today,
    points: WELCOME_BONUS,
    lifetimePoints: WELCOME_BONUS,
    activity: [{ date: today, description: "Welcome bonus", points: WELCOME_BONUS }],
  };
  accounts.set(email, account);
  return { ok: true, account };
}
