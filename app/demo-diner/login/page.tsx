import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DEMO_ACCOUNTS } from "../_lib/data";
import { currentAccount, safeNext } from "../_lib/session";
import { Alert, Card, Field, button, linkClass } from "../_lib/ui";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/demo-diner/login">) {
  const { error, signed_out, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (await currentAccount()) redirect(next);

  return (
    <Card title="Sign in to Demo Diner Rewards" subtitle="Check your points and see what you can redeem.">
      {error === "invalid" && <Alert>Incorrect email or password. Please try again.</Alert>}
      {signed_out && <Alert tone="info">You&apos;ve been signed out.</Alert>}

      <form method="post" action="/demo-diner/auth/login" className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" id="email" type="email" autoComplete="username" required />
        <Field label="Password" id="password" type="password" autoComplete="current-password" required />
        <button type="submit" className={`w-full ${button.primary}`}>
          Sign in
        </button>
      </form>

      <p className="text-sm text-stone-600">
        New here?{" "}
        <Link href="/demo-diner/join" className={linkClass}>
          Join Demo Diner Rewards
        </Link>
      </p>

      <details className="rounded-lg bg-[#fdf6ec] p-3 text-xs text-stone-600">
        <summary className="cursor-pointer font-semibold">Demo accounts (fictional site)</summary>
        <ul className="mt-2 space-y-1 font-mono">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              {a.email} / {a.password}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
