import type { Metadata } from "next";
import Link from "next/link";
import { EARN_RATE, WELCOME_BONUS } from "../_lib/data";
import { currentAccount } from "../_lib/session";
import { Alert, Card, Field, button, linkClass } from "../_lib/ui";

export const metadata: Metadata = { title: "Join Rewards" };

// Keyed by the ?error= code that /demo-diner/auth/join redirects back with.
const ERRORS = new Map([
  ["invalid", "Please enter your name, a valid email and a password of at least 8 characters."],
  ["exists", "An account with this email already exists. Try signing in instead."],
  ["terms", "Please agree to the program terms to join."],
]);

export default async function JoinPage({ searchParams }: PageProps<"/demo-diner/join">) {
  const account = await currentAccount();

  if (account) {
    return (
      <Card title="You're already a member" subtitle={`You're signed in as ${account.email}.`}>
        <Link href="/demo-diner/rewards" className={`w-full ${button.primary}`}>
          View my rewards
        </Link>
      </Card>
    );
  }

  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? ERRORS.get(error) : undefined;

  return (
    <Card
      title="Join Demo Diner Rewards"
      subtitle={`It's free. Earn ${EARN_RATE} points per $1 and get ${WELCOME_BONUS} bonus points when you join.`}
    >
      {errorMessage && <Alert>{errorMessage}</Alert>}

      <form method="post" action="/demo-diner/auth/join" className="space-y-4">
        <Field label="Full name" id="name" type="text" autoComplete="name" required />
        <Field label="Email" id="email" type="email" autoComplete="email" required />
        <Field label="Password" id="password" type="password" autoComplete="new-password" minLength={8} required />
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="terms" className="mt-1 accent-[#b3261e]" required />
          <span>I agree to the Demo Diner Rewards program terms and to receive my points balance by email.</span>
        </label>
        <button type="submit" className={`w-full ${button.primary}`}>
          Create account
        </button>
      </form>

      <p className="text-sm text-stone-600">
        Already a member?{" "}
        <Link href="/demo-diner/login" className={linkClass}>
          Sign in
        </Link>
      </p>
    </Card>
  );
}
