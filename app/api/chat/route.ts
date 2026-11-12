import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { APICallError, convertToModelMessages, isStepCount, RetryError, streamText, validateUIMessages } from "ai";
import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { makeTools, type AgentUIMessage } from "@/lib/agent/tools";
import { getSessionUserId } from "@/lib/auth/server";

const MODEL = "claude-opus-5-5";
const EFFORT = "medium"; // Opus 5.5's default, set explicitly. Try "low" if replies are slow on camera.
const MAX_STEPS = 8; // tool calls + replies per user message; the demo turns take about 3
const MAX_OUTPUT_TOKENS = 64_000; // per step, thinking included: a ceiling for runaway steps, not a target

export const dynamic = "force-dynamic";
// No route timeout on Render's Node server, so a turn with a 30-60 s refreshRewards isn't cut off.

/** POST { messages: UIMessage[] } -> UI message stream (for useChat). */
export async function POST(req: Request) {
  // Middleware already requires a session; the tools need the user id anyway.
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const tools = makeTools(userId);
  const body = (await req.json().catch(() => null)) as { messages?: unknown } | null;
  let messages: AgentUIMessage[];
  try {
    // The browser sends the whole history, tool results included. This checks their shape against the tool
    // schemas, not that they're true: a forged requestApproval "paid" result would mislead the reply, but no
    // money moves, since only the PayPal capture route writes Purchase rows.
    messages = await validateUIMessages<AgentUIMessage>({ messages: body?.messages, tools });
  } catch (err) {
    console.error("chat: invalid messages:", err);
    return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  }

  // Opus 5.5: thinking stays on (it can't be disabled), no temperature, and tool choice stays "auto"
  // (forcing a tool returns a 400). `fallbacks: "default"` retries a declined request on a fallback model.
  const result = streamText({
    model: anthropic(MODEL),
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    // One tool call at a time, in the order Claude wrote them. Two preference updates can't overwrite each
    // other, and an update written before suggestMeals (as the prompt asks) is saved before it reads prefs.
    toolCallConcurrency: 1,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    providerOptions: { anthropic: { effort: EFFORT, fallbacks: "default" } satisfies AnthropicLanguageModelOptions },
    abortSignal: req.signal, // the user closed the tab or pressed stop: stop generating
    onStepFinish: ({ response }) => {
      if (!response.modelId.startsWith(MODEL)) console.warn(`chat: a fallback model answered (${response.modelId})`);
    },
  });

  return result.toUIMessageStreamResponse<AgentUIMessage>({
    originalMessages: messages,
    // The UI words the ending: "content-filter" means Claude declined, and "tool-calls" or "length" means the
    // turn stopped before a reply (the step limit or the token cap).
    messageMetadata: ({ part }) => (part.type === "finish" ? { finishReason: part.finishReason } : undefined),
    onError: friendlyError,
  });
}

/** The message the user sees in place of a raw error. Details go to the server log only. */
function friendlyError(error: unknown): string {
  console.error("chat failed:", error);
  // After the SDK's own retries, a 429 or 5xx arrives wrapped in a RetryError.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause) && (cause.statusCode === 429 || (cause.statusCode ?? 0) >= 500)) {
    return "Krumm is busy right now. Try again in a moment.";
  }
  return "Something went wrong on our side. Try again.";
}
