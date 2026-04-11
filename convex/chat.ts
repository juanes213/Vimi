import { getAuthUserId } from "@convex-dev/auth/server";
import OpenAI from "openai";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  AGENTIC_CONTINUATION_PROMPT,
  buildPlannerSystemContent,
  parsePlannerToolCalls,
  VOICE_ADDENDUM,
} from "./chat/prompts";
import { executeToolCall, toolRegistry } from "./chat/tools";
import type {
  AgenticContinuationOutput,
  PlannerOutput,
  PlannerToolCall,
  SourceType,
  ToolContext,
  ToolHistoryEntry,
  ToolName,
} from "./chat/types";
import { chunkText, detectApprovalDecision, detectChatCommand, safeJsonParse } from "./chat/utils";
import { requireAuthUserId } from "./lib/auth";

const openai = new OpenAI({
  baseURL: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY ?? "missing-groq-api-key",
});

// Dedicated embeddings client — Groq does not expose /embeddings.
// Set OPENAI_API_KEY in Convex env for semantic memory. Without it, memory
// falls back to FIFO (most recent) retrieval — everything else still works.
const OPENAI_EMBEDDINGS_KEY = process.env.OPENAI_API_KEY;
const openaiEmbeddings = OPENAI_EMBEDDINGS_KEY
  ? new OpenAI({ baseURL: "https://api.openai.com/v1", apiKey: OPENAI_EMBEDDINGS_KEY })
  : null;

const PLANNER_MODEL = process.env.VIMI_PLANNER_MODEL ?? "openai/gpt-oss-120b";
const EMBEDDINGS_MODEL = "text-embedding-3-small"; // 1536 dims — must match schema vectorIndex
const internalChatApi = internal.chat as Record<string, any>;

type MemoryContextItem = {
  note: string;
  tags: string[];
  confidence?: number;
};

type RecentMemoryRecord = MemoryContextItem & {
  _id: Id<"userMemories">;
};

export const listMessages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();
  },
});

export const sendMessage = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await ctx.scheduler.runAfter(0, internal.chat.processUserMessage, {
      userId,
      text: args.text,
    });
  },
});

export const processUserMessage = internalAction({
  args: {
    userId: v.id("users"),
    text: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    await handleUserMessage(ctx, args.userId, args.text, "text");
  },
});

export const streamChat = httpAction(async (ctx, request) => {
  const userId = await getAuthUserId(ctx);
  const origin = request.headers.get("origin") ?? "*";

  if (!userId) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) {
    return new Response("Missing text", {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };
      const emitText = (text: string) => {
        for (const piece of chunkText(text)) {
          sendEvent("delta", { text: piece });
        }
      };
      void (async () => {
        try {
          const command = detectChatCommand(text);
          if (command?.name === "clear_chat") {
            await ctx.runMutation(internal.chat.clearChatMessagesForUser, { userId });
            sendEvent("done", { ok: true });
            return;
          }

          const sourceMessageId = await ctx.runMutation(internal.chat.insertUserMessage, { userId, text });

          // Check pending approvals
          const pendingApprovals = await ctx.runQuery(internal.chat.getPendingApprovalsForUser, { userId });
          const approvalDecision = detectApprovalDecision(text);

          if (approvalDecision && pendingApprovals.length === 1) {
            const resolved = await ctx.runAction(internal.chat.resolveApprovalAction, {
              userId,
              approvalId: pendingApprovals[0]._id,
              decision: approvalDecision,
              source: "voice",
            });
            emitText(String(resolved?.assistantText ?? "Done."));
            sendEvent("done", { ok: true });
            return;
          }

          if (approvalDecision && pendingApprovals.length > 1) {
            const msg = "I have more than one approval waiting. Open the pending approvals list and choose the one you want me to resolve.";
            await ctx.runMutation(internal.chat.saveAssistantMessage, { userId, text: msg, parsedType: "approval.clarification" });
            emitText(msg);
            sendEvent("done", { ok: true });
            return;
          }

          // Semantic memory retrieval (non-fatal)
          let semanticMemories: Array<{ note: string; tags: string[]; confidence?: number }> | undefined;
          try {
            const queryEmbedding = await generateEmbedding(text);
            semanticMemories = await ctx.runAction(internalChatApi.searchRelevantMemories, {
              userId,
              queryEmbedding,
            });
          } catch { /* non-fatal — falls back to FIFO */ }

          const plannerContext = await ctx.runQuery(internal.chat.getPlannerContext, { userId });
          const contextWithMemories = semanticMemories
            ? { ...plannerContext, memories: semanticMemories }
            : plannerContext;
          const planned = await planAssistantResponse(text, contextWithMemories, "voice");

          // Phase 1: emit assistantReply IMMEDIATELY before tools run
          if (planned.assistantReply.trim()) {
            emitText(planned.assistantReply.trim());
          }

          // Persist profile/memory in background (non-blocking)
          void persistProfileUpdates(ctx, userId, planned.profileUpdate, planned.profileReplace);
          void persistMemoryNotes(ctx, userId, planned.memoryNotes, "voice");

          // Phase 2: run agentic loop — pass empty assistantReply to avoid double-emit
          const planWithoutReply: PlannerOutput = { ...planned, assistantReply: "" };
          const { fragments, firstToolName } = await runAgenticLoop(
            ctx, userId, text, planWithoutReply, "voice", sourceMessageId,
          );

          // Emit tool result fragments
          for (const fragment of fragments.filter(Boolean)) {
            emitText(fragment);
          }

          // Save the final outcome without duplicating the spoken acknowledgment.
          const assistantText =
            fragments.filter(Boolean).join("\n\n").trim() ||
            planned.assistantReply.trim() ||
            "I'm here.";
          await ctx.runMutation(internal.chat.saveAssistantMessage, {
            userId,
            text: assistantText,
            parsedType: firstToolName ?? planned.toolCalls[0]?.name,
          });

          sendEvent("done", { ok: true });
        } catch (error) {
          sendEvent("error", { message: String(error) });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
});

export const resolveApprovalAction = internalAction({
  args: {
    userId: v.id("users"),
    approvalId: v.id("pendingApprovals"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    source: v.union(v.literal("voice"), v.literal("text"), v.literal("ui")),
  },
  handler: async (ctx, args): Promise<{ assistantText: string }> => {
    const approval: any = await ctx.runQuery(internal.chat.getPendingApprovalById, {
      approvalId: args.approvalId,
    });
    if (!approval || approval.userId !== args.userId) {
      return { assistantText: "I could not find that approval request." };
    }
    if (approval.status !== "pending") {
      return { assistantText: "That request has already been resolved." };
    }

    const execution = approval.toolExecutionId
      ? await ctx.runQuery(internal.chat.getToolExecutionById, {
          executionId: approval.toolExecutionId,
        })
      : null;

    if (args.decision === "rejected") {
      await ctx.runMutation(internal.approvals.updateApprovalStatus, {
        approvalId: approval._id,
        status: "rejected",
      });
      if (execution) {
        await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
          executionId: execution._id,
          status: "cancelled",
          resultSummary: "User rejected the action.",
        });
      }
      const assistantText: string = `Okay, I cancelled the request to ${approval.humanSummary.toLowerCase()}.`;
      await ctx.runMutation(internal.chat.saveAssistantMessage, {
        userId: args.userId,
        text: assistantText,
        relatedApprovalId: approval._id,
        parsedType: approval.toolName,
      });
      return { assistantText };
    }

    await ctx.runMutation(internal.approvals.updateApprovalStatus, {
      approvalId: approval._id,
      status: "approved",
    });

    if (!execution) {
      const assistantText = "I approved that request, but I could not find the execution context.";
      await ctx.runMutation(internal.chat.saveAssistantMessage, {
        userId: args.userId,
        text: assistantText,
        relatedApprovalId: approval._id,
        parsedType: approval.toolName,
      });
      return { assistantText };
    }

    const toolArgs = safeJsonParse<Record<string, unknown>>(approval.toolArgsJson, {});
    try {
      await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
        executionId: execution._id,
        status: "running",
      });
      const result = await executeToolCall(ctx, args.userId, approval.toolName as ToolName, toolArgs);
      await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
        executionId: execution._id,
        status: "completed",
        resultSummary: result.summary,
        resultJson: JSON.stringify(result.result ?? {}),
      });
      await ctx.runMutation(internal.approvals.updateApprovalStatus, {
        approvalId: approval._id,
        status: "resolved",
      });
      await ctx.runMutation(internal.chat.saveAssistantMessage, {
        userId: args.userId,
        text: result.summary,
        relatedApprovalId: approval._id,
        relatedExecutionId: execution._id,
        parsedType: approval.toolName,
      });
      return { assistantText: result.summary };
    } catch (error) {
      const message = `I could not finish that action: ${String(error)}`;
      await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
        executionId: execution._id,
        status: "failed",
        error: String(error),
      });
      await ctx.runMutation(internal.chat.saveAssistantMessage, {
        userId: args.userId,
        text: message,
        relatedApprovalId: approval._id,
        relatedExecutionId: execution._id,
        parsedType: approval.toolName,
      });
      return { assistantText: message };
    }
  },
});

const MAX_AGENTIC_ITERATIONS = 4;

async function executeToolCallInLoop(
  ctx: ToolContext,
  userId: Id<"users">,
  toolCall: PlannerToolCall,
  sourceMessageId: Id<"chatMessages">,
  source: SourceType,
): Promise<{ fragment: string; historyEntry: ToolHistoryEntry | null }> {
  if (!(toolCall.name in toolRegistry)) {
    return { fragment: "", historyEntry: null };
  }

  const definition = toolRegistry[toolCall.name];
  const executionId = await ctx.runMutation(internal.chat.createToolExecutionRecord, {
    userId,
    toolName: toolCall.name,
    toolArgsJson: JSON.stringify(toolCall.args ?? {}),
    status: "pending",
    sourceMessageId,
  });

  if (definition.approvalPolicy === "always") {
    const humanSummary = definition.buildApprovalSummary(toolCall.args);
    const approvalId = await ctx.runMutation(internal.approvals.createPendingApproval, {
      userId,
      toolName: toolCall.name,
      humanSummary,
      toolArgsJson: JSON.stringify(toolCall.args ?? {}),
      approvalMode: source === "voice" ? "voice" : "hybrid",
      expiresAt: Date.now() + 15 * 60 * 1000,
      requestedByMessageId: sourceMessageId,
      toolExecutionId: executionId,
    });
    await ctx.runMutation(internal.chat.linkExecutionApproval, { executionId, approvalId });
    await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
      executionId,
      status: "awaiting_approval",
    });
    const fragment = `I'm ready to ${humanSummary.toLowerCase()}. Just say yes, or approve it from the side panel.`;
    return {
      fragment,
      historyEntry: { toolName: toolCall.name, args: toolCall.args ?? {}, result: "awaiting_approval", success: false },
    };
  }

  try {
    await ctx.runMutation(internal.chat.updateToolExecutionStatus, { executionId, status: "running" });
    const result = await executeToolCall(ctx, userId, toolCall.name, toolCall.args ?? {});
    await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
      executionId,
      status: "completed",
      resultSummary: result.summary,
      resultJson: JSON.stringify(result.result ?? {}),
    });
    return {
      fragment: result.summary,
      historyEntry: { toolName: toolCall.name, args: toolCall.args ?? {}, result: result.summary, success: true },
    };
  } catch (error) {
    const errMsg = `I could not complete ${toolCall.name}: ${String(error)}`;
    await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
      executionId,
      status: "failed",
      error: String(error),
    });
    return {
      fragment: errMsg,
      historyEntry: { toolName: toolCall.name, args: toolCall.args ?? {}, result: errMsg, success: false },
    };
  }
}

async function runAgenticLoop(
  ctx: ToolContext,
  userId: Id<"users">,
  userText: string,
  initialPlan: PlannerOutput,
  source: SourceType,
  sourceMessageId: Id<"chatMessages">,
): Promise<{ fragments: string[]; firstToolName?: string }> {
  const fragments: string[] = [];
  const toolHistory: ToolHistoryEntry[] = [];
  const firstToolName = initialPlan.toolCalls[0]?.name;

  let pendingToolCalls = initialPlan.toolCalls;
  let iteration = 0;

  while (pendingToolCalls.length > 0 && iteration < MAX_AGENTIC_ITERATIONS) {
    iteration++;
    const iterationHistory: ToolHistoryEntry[] = [];

    for (const toolCall of pendingToolCalls) {
      const { fragment, historyEntry } = await executeToolCallInLoop(
        ctx, userId, toolCall, sourceMessageId, source,
      );
      if (fragment) fragments.push(fragment);
      if (historyEntry) {
        iterationHistory.push(historyEntry);
        toolHistory.push(historyEntry);
      }
    }

    // At max iterations: stop without another LLM call
    if (iteration >= MAX_AGENTIC_ITERATIONS) break;

    // Only call LLM continuation if we have successful tool results to reason about
    const successfulResults = iterationHistory.filter((e) => e.success);
    if (successfulResults.length === 0) break;

    const toolResultsBlock = successfulResults
      .map((e) => `Tool: ${e.toolName}\nResult: ${e.result}`)
      .join("\n\n");

    try {
      const continuation = await openai.chat.completions.create({
        model: PLANNER_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: source === "voice"
              ? `${AGENTIC_CONTINUATION_PROMPT}

VOICE CONTINUATION RULES:
- No markdown.
- Do not repeat a new acknowledgment like "Sure" or "Got it" because Vimi already did that.
- Continue directly with the result in natural spoken language.`
              : AGENTIC_CONTINUATION_PROMPT,
          },
          {
            role: "user",
            content: `Original user request: ${userText}\n\nTool results:\n${toolResultsBlock}`,
          },
        ],
      });

      const parsed = safeJsonParse<AgenticContinuationOutput>(
        continuation.choices[0]?.message?.content ?? "",
        { assistantReply: "", toolCalls: [], done: true },
      );

      // Replace mechanical tool summaries with LLM synthesis if we got a good reply
      if (parsed.assistantReply.trim()) {
        // Remove the raw tool result fragments from this iteration (last iterationHistory.length items)
        // and replace with the synthesized reply
        const itemsToReplace = iterationHistory.filter((e) => e.success).length;
        fragments.splice(fragments.length - itemsToReplace, itemsToReplace, parsed.assistantReply.trim());
      }

      if (parsed.done || !parsed.toolCalls?.length) {
        pendingToolCalls = [];
      } else {
        pendingToolCalls = parsePlannerToolCalls(parsed.toolCalls);
      }
    } catch {
      // LLM continuation failed — keep raw tool summaries and stop
      pendingToolCalls = [];
    }
  }

  return { fragments, firstToolName };
}

async function handleUserMessage(
  ctx: ToolContext,
  userId: Id<"users">,
  text: string,
  source: SourceType,
) {
  const command = detectChatCommand(text);
  if (command?.name === "clear_chat") {
    await ctx.runMutation(internal.chat.clearChatMessagesForUser, { userId });
    return "";
  }

  const sourceMessageId = await ctx.runMutation(internal.chat.insertUserMessage, {
    userId,
    text,
  });

  const pendingApprovals = await ctx.runQuery(internal.chat.getPendingApprovalsForUser, { userId });
  const approvalDecision = detectApprovalDecision(text);

  if (approvalDecision && pendingApprovals.length === 1) {
    const resolved = await ctx.runAction?.(internal.chat.resolveApprovalAction, {
      userId,
      approvalId: pendingApprovals[0]._id,
      decision: approvalDecision,
      source,
    });
    return String(resolved?.assistantText ?? "Done.");
  }

  if (approvalDecision && pendingApprovals.length > 1) {
    const assistantText =
      "I have more than one approval waiting. Open the pending approvals list and choose the one you want me to resolve.";
    await ctx.runMutation(internal.chat.saveAssistantMessage, {
      userId,
      text: assistantText,
      parsedType: "approval.clarification",
    });
    return assistantText;
  }

  // Semantic memory retrieval (non-fatal — falls back to FIFO in getPlannerContext)
  let semanticMemories: Array<{ note: string; tags: string[]; confidence?: number }> | undefined;
  try {
    const queryEmbedding = await generateEmbedding(text);
    semanticMemories = await ctx.runAction?.(internalChatApi.searchRelevantMemories, {
      userId,
      queryEmbedding,
    });
  } catch {
    // Falls back to FIFO memory retrieval from getPlannerContext
  }

  const plannerContext = await ctx.runQuery(internal.chat.getPlannerContext, { userId });
  // Override FIFO memories with semantic results if available
  const contextWithMemories = semanticMemories
    ? { ...plannerContext, memories: semanticMemories }
    : plannerContext;
  const planned = await planAssistantResponse(text, contextWithMemories, source);

  await persistProfileUpdates(ctx, userId, planned.profileUpdate, planned.profileReplace);
  await persistMemoryNotes(ctx, userId, planned.memoryNotes, source);

  const { fragments, firstToolName } = await runAgenticLoop(
    ctx, userId, text, planned, source, sourceMessageId,
  );

  const assistantText =
    fragments.filter(Boolean).join("\n\n").trim() ||
    planned.assistantReply.trim() ||
    "I'm here.";
  await ctx.runMutation(internal.chat.saveAssistantMessage, {
    userId,
    text: assistantText,
    parsedType: firstToolName ?? planned.toolCalls[0]?.name,
  });
  return assistantText;
}

async function generateEmbedding(text: string): Promise<number[]> {
  if (!openaiEmbeddings) {
    throw new Error("No OPENAI_API_KEY configured — skipping embeddings");
  }
  const response = await openaiEmbeddings.embeddings.create({
    model: EMBEDDINGS_MODEL,
    input: text.slice(0, 8192),
  });
  return response.data[0].embedding;
}

async function planAssistantResponse(
  userText: string,
  context: {
    profile: unknown;
    memories: unknown[];
    integrations: unknown[];
    recentMessages: unknown[];
    sessionSummary?: string;
  },
  source: SourceType,
): Promise<PlannerOutput> {
  try {
    const systemContent = buildPlannerSystemContent(
      source,
      {
        sessionSummary: context.sessionSummary,
        profile: (context.profile as { timezone?: string } | null | undefined) ?? undefined,
      },
      context,
    );

    const completion = await openai.chat.completions.create({
      model: PLANNER_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userText },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = safeJsonParse<PlannerOutput>(content, {
      assistantReply: "I understood. I'll keep helping from here.",
      toolCalls: [],
    });
    return {
      assistantReply: typeof parsed.assistantReply === "string" ? parsed.assistantReply : "",
      toolCalls: parsePlannerToolCalls(parsed.toolCalls),
      profileUpdate:
        parsed.profileUpdate && typeof parsed.profileUpdate === "object"
          ? parsed.profileUpdate
          : undefined,
      profileReplace:
        parsed.profileReplace && typeof parsed.profileReplace === "object"
          ? parsed.profileReplace
          : undefined,
      memoryNotes: Array.isArray(parsed.memoryNotes) ? parsed.memoryNotes : undefined,
    };
  } catch (error) {
    return {
      assistantReply: `I had trouble planning that request right now: ${String(error)}`,
      toolCalls: [],
    };
  }
}

async function persistProfileUpdates(
  ctx: ToolContext,
  userId: Id<"users">,
  profileUpdate: PlannerOutput["profileUpdate"],
  profileReplace: PlannerOutput["profileReplace"],
) {
  // Handle explicit replacements first (higher specificity)
  if (profileReplace) {
    const hasReplace =
      (profileReplace.goals?.length ?? 0) > 0 ||
      (profileReplace.preferences?.length ?? 0) > 0 ||
      (profileReplace.routines?.length ?? 0) > 0;
    if (hasReplace) {
      await ctx.runMutation(internal.chat.replaceProfileArraysFromAgent, {
        userId,
        goals: profileReplace.goals,
        preferences: profileReplace.preferences,
        routines: profileReplace.routines,
      });
    }
  }

  // Then handle additive updates
  if (!profileUpdate) return;
  const hasContent =
    !!profileUpdate.biography ||
    !!profileUpdate.communicationStyle ||
    !!profileUpdate.timezone ||
    (profileUpdate.preferences?.length ?? 0) > 0 ||
    (profileUpdate.goals?.length ?? 0) > 0 ||
    (profileUpdate.routines?.length ?? 0) > 0;
  if (!hasContent) return;

  await ctx.runMutation(internal.chat.upsertProfileFromAgent, {
    userId,
    biography: profileUpdate.biography,
    preferences: profileUpdate.preferences,
    goals: profileUpdate.goals,
    routines: profileUpdate.routines,
    communicationStyle: profileUpdate.communicationStyle,
    timezone: profileUpdate.timezone,
  });
}

async function persistMemoryNotes(
  ctx: ToolContext,
  userId: Id<"users">,
  memoryNotes: PlannerOutput["memoryNotes"],
  source: SourceType,
) {
  if (!memoryNotes?.length) return;
  for (const memory of memoryNotes) {
    if (!memory?.note?.trim()) continue;
    let embedding: number[] | undefined;
    try {
      embedding = await generateEmbedding(memory.note.trim());
    } catch {
      // Embedding failure is non-fatal — memory is still saved without embedding
    }
    await ctx.runMutation(internal.chat.addMemoryFromAgent, {
      userId,
      note: memory.note.trim(),
      tags: Array.isArray(memory.tags) ? memory.tags.map(String) : [],
      confidence: typeof memory.confidence === "number" ? memory.confidence : undefined,
      source: source === "voice" ? "voice" : "chat",
      embedding,
    });
  }
}

export const insertUserMessage = internalMutation({
  args: {
    userId: v.id("users"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatMessages", {
      userId: args.userId,
      text: args.text,
      createdAt: Date.now(),
      role: "user",
    });
  },
});

export const saveAssistantMessage = internalMutation({
  args: {
    userId: v.id("users"),
    text: v.string(),
    parsedType: v.optional(v.string()),
    relatedApprovalId: v.optional(v.id("pendingApprovals")),
    relatedExecutionId: v.optional(v.id("toolExecutions")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("chatMessages", {
      userId: args.userId,
      text: args.text,
      createdAt: Date.now(),
      role: "assistant",
      parsedType: args.parsedType,
      relatedApprovalId: args.relatedApprovalId,
      relatedExecutionId: args.relatedExecutionId,
    });

    // Trigger rolling summarization when message count exceeds threshold
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .collect();
    if (messages.length > 20) {
      await ctx.scheduler.runAfter(0, internal.chat.summarizeOldMessages, { userId: args.userId });
    }

    return id;
  },
});

export const clearChatMessagesForUser = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});

export const createTaskFromAgent = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      userId: args.userId,
      title: args.title,
      description: args.description,
      dueDate: args.dueDate,
      priority: args.priority,
      status: "pending",
      createdAt: Date.now(),
      source: "agent",
    });
  },
});

export const createReminderFromAgent = internalMutation({
  args: {
    userId: v.id("users"),
    text: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
    triggerAt: v.optional(v.number()),
    deliveryChannels: v.optional(v.array(v.union(v.literal("in_app"), v.literal("gmail")))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reminders", {
      userId: args.userId,
      text: args.text,
      date: args.date,
      time: args.time,
      triggerAt: args.triggerAt ?? args.date,
      deliveryChannels: args.deliveryChannels ?? ["in_app"],
      deliveryStatus: "pending",
      origin: "agent",
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const createEventFromAgent = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("events", {
      userId: args.userId,
      title: args.title,
      date: args.date,
      time: args.time,
      createdAt: Date.now(),
    });
  },
});

export const createEventFromCalendarTool = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
    externalId: v.string(),
    externalSource: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_userId_date", (q) => q.eq("userId", args.userId))
      .collect();
    const duplicate = existing.find(
      (event) => event.externalId === args.externalId && event.externalSource === args.externalSource,
    );
    if (duplicate) return duplicate._id;

    return await ctx.db.insert("events", {
      userId: args.userId,
      title: args.title,
      date: args.date,
      time: args.time,
      externalId: args.externalId,
      externalSource: args.externalSource,
      createdAt: Date.now(),
    });
  },
});

export const createToolExecutionRecord = internalMutation({
  args: {
    userId: v.id("users"),
    toolName: v.string(),
    toolArgsJson: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("awaiting_approval"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    sourceMessageId: v.optional(v.id("chatMessages")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("toolExecutions", {
      userId: args.userId,
      toolName: args.toolName,
      toolArgsJson: args.toolArgsJson,
      status: args.status,
      createdAt: Date.now(),
      sourceMessageId: args.sourceMessageId,
    });
  },
});

export const linkExecutionApproval = internalMutation({
  args: {
    executionId: v.id("toolExecutions"),
    approvalId: v.id("pendingApprovals"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.executionId, {
      pendingApprovalId: args.approvalId,
    });
  },
});

export const updateToolExecutionStatus = internalMutation({
  args: {
    executionId: v.id("toolExecutions"),
    status: v.union(
      v.literal("pending"),
      v.literal("awaiting_approval"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    resultSummary: v.optional(v.string()),
    resultJson: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.executionId, {
      status: args.status,
      resultSummary: args.resultSummary,
      resultJson: args.resultJson,
      error: args.error,
      completedAt:
        args.status === "completed" || args.status === "failed" || args.status === "cancelled"
          ? Date.now()
          : undefined,
    });
  },
});

export const getPendingApprovalsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pendingApprovals")
      .withIndex("by_userId_status_createdAt", (q) => q.eq("userId", args.userId).eq("status", "pending"))
      .order("desc")
      .collect();
  },
});

export const getPendingApprovalById = internalQuery({
  args: { approvalId: v.id("pendingApprovals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.approvalId);
  },
});

export const getToolExecutionById = internalQuery({
  args: { executionId: v.id("toolExecutions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.executionId);
  },
});

export const getPlannerContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const [profile, recentMessages, memories, integrations, latestSummary] = await Promise.all([
      ctx.db.query("userProfiles").withIndex("by_userId", (q) => q.eq("userId", args.userId)).unique(),
      ctx.db.query("chatMessages").withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId)).order("desc").take(12),
      ctx.db.query("userMemories").withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId)).order("desc").take(10),
      ctx.db.query("integrations").withIndex("by_userId_status", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("sessionSummaries").withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId)).order("desc").first(),
    ]);

    return {
      profile,
      recentMessages: [...recentMessages].reverse().map((message) => ({
        role: message.role,
        text: message.text,
        parsedType: message.parsedType,
      })),
      memories: memories.map((m) => ({ note: m.note, tags: m.tags, confidence: m.confidence })),
      integrations: integrations.map((integration) => ({
        provider: integration.provider,
        status: integration.status,
        accountLabel: integration.accountLabel,
        lastSyncAt: integration.lastSyncAt,
      })),
      sessionSummary: latestSummary?.summaryText,
    };
  },
});

// Vector search must run in action context — called from handleUserMessage/streamChat
export const searchRelevantMemories = internalAction({
  args: {
    userId: v.id("users"),
    queryEmbedding: v.array(v.float64()),
  },
  handler: async (ctx, args): Promise<MemoryContextItem[]> => {
    const vectorResults = await ctx.vectorSearch("userMemories", "by_embedding", {
      vector: args.queryEmbedding,
      limit: 8,
      filter: (q) => q.eq("userId", args.userId),
    });

    // Fetch full docs for vector results (vectorSearch only returns _id + _score)
    const vectorDocs: Array<RecentMemoryRecord | null> = await Promise.all(
      vectorResults.map((r) => ctx.runQuery(internalChatApi.getMemoryById, { memoryId: r._id })),
    );

    // Also fetch 3 most recent for guaranteed recency
    const recentMemories: RecentMemoryRecord[] = await ctx.runQuery(internalChatApi.getRecentMemories, {
      userId: args.userId,
      limit: 3,
    });

    const vectorIds = new Set(vectorResults.map((r) => String(r._id)));
    const recentExtra: RecentMemoryRecord[] = recentMemories.filter(
      (r) => !vectorIds.has(String(r._id)),
    );

    return [...vectorDocs.filter((doc): doc is RecentMemoryRecord => doc !== null), ...recentExtra].map(
      (m) => ({
        note: m.note,
        tags: m.tags,
        confidence: m.confidence,
      }),
    );
  },
});

export const getMemoryById = internalQuery({
  args: { memoryId: v.id("userMemories") },
  handler: async (ctx, args): Promise<RecentMemoryRecord | null> => {
    const memory = await ctx.db.get(args.memoryId);
    if (!memory) return null;
    return {
      _id: memory._id,
      note: memory.note,
      tags: memory.tags,
      confidence: memory.confidence,
    };
  },
});

export const getRecentMemories = internalQuery({
  args: { userId: v.id("users"), limit: v.number() },
  handler: async (ctx, args): Promise<RecentMemoryRecord[]> => {
    const results = await ctx.db
      .query("userMemories")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit);
    return results.map((m) => ({
      _id: m._id,
      note: m.note,
      tags: m.tags,
      confidence: m.confidence,
    }));
  },
});

export const upsertProfileFromAgent = internalMutation({
  args: {
    userId: v.id("users"),
    biography: v.optional(v.string()),
    preferences: v.optional(v.array(v.string())),
    goals: v.optional(v.array(v.string())),
    routines: v.optional(v.array(v.string())),
    communicationStyle: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    const mergeList = (current: string[] = [], incoming: string[] = []) =>
      Array.from(new Set([...current, ...incoming].map((value) => value.trim()).filter(Boolean)));

    if (existing) {
      await ctx.db.patch(existing._id, {
        biography: args.biography ?? existing.biography,
        preferences: mergeList(existing.preferences, args.preferences ?? []),
        goals: mergeList(existing.goals, args.goals ?? []),
        routines: mergeList(existing.routines, args.routines ?? []),
        communicationStyle: args.communicationStyle ?? existing.communicationStyle,
        timezone: args.timezone ?? existing.timezone,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId: args.userId,
      biography: args.biography,
      preferences: mergeList([], args.preferences ?? []),
      goals: mergeList([], args.goals ?? []),
      routines: mergeList([], args.routines ?? []),
      communicationStyle: args.communicationStyle,
      timezone: args.timezone,
      updatedAt: Date.now(),
    });
  },
});

export const addMemoryFromAgent = internalMutation({
  args: {
    userId: v.id("users"),
    note: v.string(),
    tags: v.array(v.string()),
    confidence: v.optional(v.number()),
    source: v.union(v.literal("chat"), v.literal("voice"), v.literal("manual"), v.literal("agent")),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("userMemories", {
      userId: args.userId,
      note: args.note,
      tags: args.tags,
      confidence: args.confidence,
      source: args.source,
      embedding: args.embedding,
      createdAt: Date.now(),
      lastReferencedAt: Date.now(), // fixed: was never set on insert
    });
  },
});

// --- Profile replace (Issue 7) ---

export const replaceProfileArraysFromAgent = internalMutation({
  args: {
    userId: v.id("users"),
    goals: v.optional(v.array(v.string())),
    preferences: v.optional(v.array(v.string())),
    routines: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.goals !== undefined) patch.goals = args.goals.map((g) => g.trim()).filter(Boolean);
    if (args.preferences !== undefined) patch.preferences = args.preferences.map((p) => p.trim()).filter(Boolean);
    if (args.routines !== undefined) patch.routines = args.routines.map((r) => r.trim()).filter(Boolean);

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId: args.userId,
      biography: undefined,
      preferences: args.preferences ?? [],
      goals: args.goals ?? [],
      routines: args.routines ?? [],
      updatedAt: Date.now(),
    });
  },
});

// --- Session summarization (Issue 1) ---

export const getMessagesForSummary = internalQuery({
  args: { userId: v.id("users"), limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("asc")
      .take(args.limit);
  },
});

export const saveSessionSummary = internalMutation({
  args: {
    userId: v.id("users"),
    summaryText: v.string(),
    coveredMessageCount: v.number(),
    oldestMessageCreatedAt: v.number(),
    newestMessageCreatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessionSummaries", {
      userId: args.userId,
      summaryText: args.summaryText,
      coveredMessageCount: args.coveredMessageCount,
      oldestMessageCreatedAt: args.oldestMessageCreatedAt,
      newestMessageCreatedAt: args.newestMessageCreatedAt,
      createdAt: Date.now(),
    });
  },
});

export const deleteOldMessages = internalMutation({
  args: {
    userId: v.id("users"),
    olderThanOrEqualCreatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const toDelete = await ctx.db
      .query("chatMessages")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", args.userId).lte("createdAt", args.olderThanOrEqualCreatedAt),
      )
      .collect();

    // Guard: skip messages linked to non-resolved approvals
    const unresolved = await ctx.db
      .query("pendingApprovals")
      .withIndex("by_userId_status_createdAt", (q) =>
        q.eq("userId", args.userId).eq("status", "pending"),
      )
      .collect();
    const protectedMessageIds = new Set(
      unresolved.map((a) => a.requestedByMessageId).filter(Boolean),
    );

    for (const msg of toDelete) {
      if (!protectedMessageIds.has(msg._id)) {
        await ctx.db.delete(msg._id);
      }
    }
  },
});

export const summarizeOldMessages = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const messages: Array<{ _id: string; role: string; text: string; createdAt: number }> =
      await ctx.runQuery(internal.chat.getMessagesForSummary, {
        userId: args.userId,
        limit: 100,
      });

    if (messages.length < 20) return; // Not enough to summarize yet

    const toSummarize = messages.slice(0, 20);
    const transcript = toSummarize
      .map((m) => `${m.role === "user" ? "User" : "Vimi"}: ${m.text}`)
      .join("\n");

    let summaryText: string;
    try {
      const completion = await openai.chat.completions.create({
        model: PLANNER_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a memory compression assistant. Summarize the following conversation in 3-5 sentences. Capture: key topics discussed, decisions made, preferences and goals revealed, and any tasks or actions taken. Write in third person. Be factual and concise.",
          },
          { role: "user", content: transcript },
        ],
      });
      summaryText = completion.choices[0]?.message?.content?.trim() ?? "";
    } catch {
      return; // Summarization failure is non-fatal
    }

    if (!summaryText) return;

    await ctx.runMutation(internal.chat.saveSessionSummary, {
      userId: args.userId,
      summaryText,
      coveredMessageCount: toSummarize.length,
      oldestMessageCreatedAt: toSummarize[0].createdAt,
      newestMessageCreatedAt: toSummarize[toSummarize.length - 1].createdAt,
    });

    await ctx.runMutation(internal.chat.deleteOldMessages, {
      userId: args.userId,
      olderThanOrEqualCreatedAt: toSummarize[toSummarize.length - 1].createdAt,
    });
  },
});

