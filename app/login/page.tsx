import { redirect } from "next/navigation";
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Krumms</h1>
      <p className="mt-1 mb-6 text-sm opacity-70">One app for all your restaurant rewards.</p>
      {sessionSecretConfigured() ? (
        <LoginForm next={next} />
      ) : (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Sign-in is not configured on this server (SESSION_SECRET is missing).
        </p>
      )}
      {demo && (
        <div className="mt-6 rounded border border-black/10 p-3 text-xs dark:border-white/15">
          <p className="font-medium">Demo student account</p>
          <p className="mt-1 opacity-80">
            Email: <code>{demo.email}</code>
          </p>
          <p className="opacity-80">
            Password: <code>{demo.password}</code>
          </p>
        </div>
      )}
    </main>
  );
}
