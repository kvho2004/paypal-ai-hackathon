"use client";

import { useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";

const MEALS = [
  { item: "Veggie wrap", amountCents: 825 },
  { item: "Chicken bowl", amountCents: 950 },
  { item: "Fries + drink", amountCents: 650 },
];

type Paid = { amountCents: number; programId: string; paypalTxnId: string };

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Sandbox checkout at Demo Diner. The PayPal buttons are loaded with the Demo Diner app's
 * client id (the payee); the buyer logs in as the student sandbox account in the popup.
 */
export default function CheckoutDemo({ clientId }: { clientId: string }) {
  const [meal, setMeal] = useState(MEALS[0]);
  const [paid, setPaid] = useState<Paid | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json as T;
  }

  if (paid) {
    return (
      <div className="max-w-md rounded-2xl border border-success/40 bg-success/10 p-6">
        <p className="font-display text-xl font-semibold text-success">Paid {usd(paid.amountCents)} to Demo Diner</p>
        <p className="mt-1 text-sm text-muted">PayPal transaction {paid.paypalTxnId}. Purchase saved.</p>
        <a
          href="/purchases"
          className="mt-4 inline-block rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-contrast"
        >
          See it in your purchases
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-muted">Choose a meal</legend>
        {MEALS.map((m) => {
          const selected = meal.item === m.item;
          return (
            <label
              key={m.item}
              className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
                selected ? "border-brand-text bg-brand-soft" : "border-line bg-surface hover:bg-brand-soft/50"
              }`}
            >
              <span className="flex items-center gap-3 font-medium">
                <input
                  type="radio"
                  name="meal"
                  checked={selected}
                  onChange={() => setMeal(m)}
                  className="accent-[#2f398e]"
                />
                {m.item}
              </span>
              <span className="font-display text-lg text-brand-text">{usd(m.amountCents)}</span>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-5">
        <PayPalScriptProvider options={{ clientId, currency: "USD", intent: "capture" }}>
          <PayPalButtons
            // Remount when the meal changes so PayPal re-reads the order.
            key={meal.item}
            style={{ layout: "vertical", shape: "rect" }}
            createOrder={async () => {
              setError(null);
              const order = await post<{ orderId: string }>("/api/paypal/create-order", {
                programId: "demo-diner",
                item: meal.item,
                amountCents: meal.amountCents,
              });
              return order.orderId;
            }}
            onApprove={async (data) => {
              try {
                setPaid(await post<Paid>("/api/paypal/capture-order", { orderId: data.orderID }));
              } catch (e) {
                setError(e instanceof Error ? e.message : "Payment capture failed");
              }
            }}
            onError={() => setError("PayPal reported an error. Please try again.")}
          />
        </PayPalScriptProvider>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <p className="mt-4 text-xs text-muted">
        Sandbox only: no real money moves. Log in as the student sandbox account to approve.
      </p>
    </div>
  );
}
