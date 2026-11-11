"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not sign in");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-line bg-k-bg px-3 py-2 text-sm outline-none focus:border-brand-text";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="username" className={input} />
      </label>
      <label className="block text-sm font-medium">
        Password
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-brand px-3 py-2.5 text-sm font-medium text-brand-contrast disabled:opacity-60"
      >
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
