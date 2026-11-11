"use client";

import { useMemo, useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { CapturedPurchase } from "../../../lib/paypal/orders";
import type { ApprovalRequest, ApprovalResult } from "./agentTypes";

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

type Phase = "idle" | "paid" | "denied" | "failed";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

/**
 * The approval step of agentic checkout: nothing is charged until the student approves here.
 * Shows what they are about to buy, what it does for their rewards, and a clear sandbox label. Deny ends it
 * with nothing charged; the PayPal button is the approval. The card reports exactly one final result through
 * `onResult` (paid, denied or failed) and handles every PayPal state itself, including a closed popup.
 */
export default function ApprovalCard({
  request,
  clientId,
  onResult,
}: {
  request: ApprovalRequest;
  clientId: string;
  onResult: (result: ApprovalResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<string | null>(null); // retryable: popup closed, PayPal hiccup
  const [paid, setPaid] = useState<CapturedPurchase | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const scriptOptions = useMemo(() => ({ clientId, currency: "USD", intent: "capture" }), [clientId]);

  function deny() {
    setPhase("denied");
    onResult({ status: "denied" });
  }

  const shell = "max-w-md rounded-2xl border p-5";

  if (phase === "paid" && paid) {
    return (
      <div className={`${shell} border-success/40 bg-success/10`} role="status">
        <p className="font-display text-xl font-semibold text-success">
          Paid {usd(paid.amountCents)} to Demo Diner
        </p>
        <p className="mt-1 text-sm text-muted">PayPal sandbox transaction {paid.paypalTxnId}. Saved to your purchases.</p>
      </div>
    );
  }
  if (phase === "denied") {
    return (
      <div className={`${shell} border-line bg-surface`} role="status">
        <p className="font-medium">You denied this order.</p>
        <p className="mt-1 text-sm text-muted">Nothing was charged.</p>
      </div>
    );
  }
  if (phase === "failed") {
    return (
      <div className={`${shell} border-danger/40 bg-danger/10`} role="alert">
        <p className="font-medium text-danger">We could not confirm this payment.</p>
        <p className="mt-1 text-sm text-muted">
          {failure ?? "Something went wrong."} Check your purchases before trying again, so you are not charged twice.
        </p>
      </div>
    );
  }

  return (
    <div className={`${shell} border-line bg-surface shadow-sm`} role="group" aria-label="Approve this order">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Approve this order?</p>
          <p className="mt-1 font-medium">{request.item}</p>
          <p className="text-xs text-muted">at Demo Diner · pay with PayPal</p>
        </div>
        <p className="shrink-0 font-display text-2xl font-semibold text-brand-text">{usd(request.amountCents)}</p>
      </div>

      <div className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-text">What it does for your rewards</p>
        <p className="mt-1">{request.rewardImpact}</p>
      </div>

      <p className="mt-3 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-[#4a3700]">
        Sandbox: no real money moves
      </p>

      <div className="mt-4">
        <PayPalScriptProvider options={scriptOptions}>
          <PayPalButtons
            style={{ layout: "vertical", shape: "rect" }}
            createOrder={async () => {
              setNotice(null);
              const order = await post<{ orderId: string }>("/api/paypal/create-order", {
                programId: request.programId,
                item: request.item,
                amountCents: request.amountCents,
              });
              return order.orderId;
            }}
            onApprove={async (data) => {
              try {
                const purchase = await post<CapturedPurchase>("/api/paypal/capture-order", { orderId: data.orderID });
                setPaid(purchase);
                setPhase("paid");
                onResult({ status: "paid", purchase });
              } catch (e) {
                // The student approved in PayPal but the capture did not confirm, so money may or may not have moved.
                const error = e instanceof Error ? e.message : "Capture failed";
                setFailure(error);
                setPhase("failed");
                onResult({ status: "failed", error });
              }
            }}
            onCancel={() => setNotice("The PayPal window was closed. Nothing was charged. Try again, or deny.")}
            onError={() => setNotice("PayPal had a problem starting this payment. Nothing was charged. Please try again.")}
          />
        </PayPalScriptProvider>
      </div>

      {notice && (
        <p role="alert" className="mt-2 text-sm text-muted">
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={deny}
        className="mt-3 w-full rounded-full border border-line px-3 py-2 text-sm font-medium text-muted hover:bg-brand-soft hover:text-brand-text"
      >
        Deny
      </button>
    </div>
  );
}
