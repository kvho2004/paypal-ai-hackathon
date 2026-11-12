"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type SubmitEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import type { AgentUIMessage } from "../../../lib/agent/tools";
import type { Prefs } from "../../../lib/agent/prefs";
import type { ApprovalRequest, ApprovalResult } from "./agentTypes";
import ApprovalCard from "./ApprovalCard";
import RankedGrid from "./RankedGrid";

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

// The demo prompts, word for word (dev2-tuesday.md §5). Ordering happens from the grid's Order button.
const DEMO_PROMPTS = [
  "Where have I been eating?",
  "Lunch under $8, nothing fried, and stop suggesting burgers",
  "What are my rewards worth?",
];

const TOOL_LABELS: Record<string, string> = {
  getPurchaseSummary: "Checking your PayPal purchases…",
  getRewards: "Looking up your rewards…",
  refreshRewards: "Reading your rewards account (this takes up to a minute)…",
  rankRedemptions: "Ranking your rewards…",
  suggestMeals: "Finding meals…",
  updatePreferences: "Saving your preferences…",
  requestApproval: "Preparing the approval…",
};

/** Resubmit once the user has answered an approval card, so the agent reports what the payment did. Not for server tools. */
function approvalAnswered({ messages }: { messages: UIMessage[] }): boolean {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return false;
  const lastPart = last.parts.at(-1);
  return !!lastPart && lastPart.type === "tool-requestApproval" && "state" in lastPart && lastPart.state === "output-available";
}

export default function Chat({ clientId, initialPrefs }: { clientId: string | null; initialPrefs: Prefs }) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, addToolOutput, status, error, clearError, stop, setMessages } = useChat<AgentUIMessage>({
    transport,
    sendAutomaticallyWhen: approvalAnswered,
  });
  const [input, setInput] = useState("");
  // Saved preferences when this chat began: the page-load value, or the value a cleared chat had reached.
  const [baseline, setBaseline] = useState(initialPrefs);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Preference chips: the latest updatePreferences result in this chat, else the baseline.
  const prefs = useMemo(() => {
    let latest = baseline;
    for (const m of messages) {
      for (const p of m.parts) {
        if (p.type === "tool-updatePreferences" && p.state === "output-available") latest = p.output.prefs;
      }
    }
    return latest;
  }, [messages, baseline]);

  // Scroll when a message is added or the status changes, not on every streamed token (that fights the user's scrolling).
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, status]);

  /** Returns whether the message was sent (it isn't while a reply is streaming). */
  function send(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || busy) return false;
    clearError();
    void sendMessage({ text: trimmed });
    return true;
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (send(input)) setInput("");
  }

  function newChat() {
    stop();
    clearError();
    setBaseline(prefs); // the saved preferences outlive the chat
    setMessages([]);
  }

  const last = messages.at(-1);
  const ending = status === "ready" && last?.role === "assistant" ? endingNote(last.metadata?.finishReason) : null;
  const badRequest = error?.message.includes("Invalid messages");

  return (
    <div className="flex flex-col gap-4">
      <PrefChips prefs={prefs} />

      {messages.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">Try one of these, or ask your own question.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                className="rounded-full border border-line bg-brand-soft px-3 py-1.5 text-left text-sm text-brand-text hover:border-brand"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4" aria-live="polite">
        {messages.map((m) => (
          <MessageView
            key={m.id}
            message={m}
            clientId={clientId}
            onOrder={(item) => send(`Order the ${item}`)}
            onApprovalResult={(toolCallId, result) =>
              void addToolOutput({ tool: "requestApproval", toolCallId, output: result })
            }
          />
        ))}
        {status === "submitted" && <Chip>Thinking…</Chip>}
        {ending && <p className="text-sm text-muted">{ending}</p>}
        {error && (
          <div role="alert" className="rounded-xl border border-line bg-surface p-3 text-sm text-danger">
            {badRequest ? "This chat got out of sync. Start a fresh chat to continue." : error.message}
            {badRequest && (
              <button type="button" onClick={newChat} className="ml-3 underline">
                New chat
              </button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-20 flex gap-2 sm:bottom-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your meals or rewards"
          aria-label="Message"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm shadow-sm outline-none focus:border-brand"
        />
        {busy ? (
          <button type="button" onClick={stop} className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm">
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-contrast disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
      {messages.length > 0 && (
        <button type="button" onClick={newChat} className="self-start text-xs text-muted underline">
          New chat
        </button>
      )}
    </div>
  );
}

function endingNote(reason: string | undefined): string | null {
  if (reason === "content-filter") return "Krumm can't help with that one. Ask about your meals or rewards instead.";
  if (reason === "tool-calls" || reason === "length") return "Krumm stopped before finishing. Ask again, or try a narrower question.";
  return null;
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="self-start rounded-full bg-brand-soft px-3 py-1 text-xs text-brand-text">{children}</span>;
}

function PrefChips({ prefs }: { prefs: Prefs }) {
  const chips = [
    ...prefs.blocklist.map((t) => `No ${t}`),
    ...prefs.diet.map((t) => `Diet: ${t}`),
    ...(prefs.budgetCents ? [`Budget ${usd(prefs.budgetCents)}`] : []),
  ];
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Saved preferences">
      <span className="text-xs text-muted">Saved preferences:</span>
      {chips.map((c) => (
        <Chip key={c}>{c}</Chip>
      ))}
    </div>
  );
}

function MessageView({
  message,
  clientId,
  onOrder,
  onApprovalResult,
}: {
  message: AgentUIMessage;
  clientId: string | null;
  onOrder: (item: string) => void;
  onApprovalResult: (toolCallId: string, result: ApprovalResult) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col gap-3 ${isUser ? "items-end" : "items-start"}`}>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          if (!part.text) return null;
          return (
            <p
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                isUser ? "bg-brand text-brand-contrast" : "border border-line bg-surface"
              }`}
            >
              {part.text}
            </p>
          );
        }
        if (!isToolUIPart(part)) return null;
        if (part.state === "output-error") {
          return <Chip key={i}>That step failed. Krumm will tell you what happened.</Chip>;
        }
        // The approval card has its own states; every other tool shows a chip until its output arrives.
        if (part.type !== "tool-requestApproval" && part.state !== "output-available") {
          return <Chip key={i}>{TOOL_LABELS[part.type.slice("tool-".length)] ?? "Working…"}</Chip>;
        }
        switch (part.type) {
          case "tool-suggestMeals":
            return part.output.picks.length === 0 ? null : (
              <div key={i} className="w-full">
                <RankedGrid picks={part.output.picks} onOrder={(pick) => onOrder(pick.item)} />
              </div>
            );
          case "tool-rankRedemptions":
            return part.output.rows.length === 0 ? null : (
              <div key={i} className="w-full">
                <RankedGrid rows={part.output.rows} />
              </div>
            );
          case "tool-requestApproval":
            return (
              <ApprovalPart
                key={i}
                part={part}
                clientId={clientId}
                onResult={(r) => onApprovalResult(part.toolCallId, r)}
              />
            );
          default:
            return null; // no UI of its own: the chip above covered the wait
        }
      })}
    </div>
  );
}

function ApprovalPart({
  part,
  clientId,
  onResult,
}: {
  part: Extract<AgentUIMessage["parts"][number], { type: "tool-requestApproval" }>;
  clientId: string | null;
  onResult: (r: ApprovalResult) => void;
}) {
  if (part.state === "output-available") {
    const out = part.output;
    if (out.status === "paid") {
      return (
        <p role="status" className="rounded-xl border border-success px-4 py-2.5 text-sm font-medium text-success">
          ✓ Paid {usd(out.purchase.amountCents)} with PayPal (sandbox).
        </p>
      );
    }
    const failed = out.status === "failed";
    return (
      <p className={`rounded-xl border border-line px-4 py-2.5 text-sm ${failed ? "text-danger" : "text-muted"}`}>
        {failed ? `Payment didn't go through: ${out.error}` : "Order cancelled. Nothing was charged."}
      </p>
    );
  }
  if (part.state !== "input-available") return <Chip>{TOOL_LABELS.requestApproval}</Chip>;
  if (!clientId) return <p className="text-sm text-danger">PayPal checkout isn&apos;t set up on this server.</p>;
  const request: ApprovalRequest = part.input;
  return (
    <ApprovalCard
      key={`${request.item}:${request.amountCents}`}
      request={request}
      clientId={clientId}
      onResult={onResult}
    />
  );
}
