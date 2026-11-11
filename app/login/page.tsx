import { redirect } from "next/navigation";
import BrandMark from "../components/BrandMark";
import { safeNext, sessionSecretConfigured } from "../../lib/auth/session";
import { getCurrentUser } from "../../lib/auth/server";
import LoginForm from "./LoginForm";

// Depends on the cookie and on environment variables, so never prerender it.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  // In demo mode the sign-in details are shown, so judges can try the app without asking for credentials.
  const demo =
    process.env.DEMO_MODE === "true" && process.env.DEMO_STUDENT_EMAIL && process.env.DEMO_STUDENT_PASSWORD
      ? { email: process.env.DEMO_STUDENT_EMAIL, password: process.env.DEMO_STUDENT_PASSWORD }
      : null;

  return (
    <div className="krumms flex items-center justify-center px-6 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark className="h-20 w-24" />
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-brand-text">Krumms</h1>
          <p className="mt-1 text-sm text-muted">One app, one agent, all your restaurant rewards.</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="mb-4 font-display text-xl font-semibold">Sign in</h2>
          {sessionSecretConfigured() ? (
            <LoginForm next={next} />
          ) : (
            <p role="alert" className="text-sm text-danger">
              Sign-in is not configured on this server (SESSION_SECRET is missing).
            </p>
          )}
        </div>

        {demo && (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-brand-soft p-4 text-xs">
            <p className="font-medium text-brand-text">Demo student account</p>
            <p className="mt-1 text-muted">
              Email: <code className="text-k-fg">{demo.email}</code>
            </p>
            <p className="text-muted">
              Password: <code className="text-k-fg">{demo.password}</code>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
