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
import { requireAuthUserId } from "./lib/auth";
import {
  buildDraftEmailRaw,
  calendarUrl,
  gmailUrl,
  googleApiFetch,
  withGoogleAccessToken,
} from "./lib/google";

const openai = new OpenAI({
  baseURL: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY ?? "missing-groq-api-key",
});

const PLANNER_MODEL = process.env.VIMI_PLANNER_MODEL ?? "openai/gpt-oss-120b";

type ApprovalDecision = "approved" | "rejected";
type ToolApprovalPolicy = "never" | "always" | "proactive_only";
type SourceType = "voice" | "text" | "ui";

type ToolName =
  | "gmail.searchInbox"
  | "gmail.readThread"
  | "gmail.createDraft"
  | "gmail.sendEmail"
  | "calendar.listEvents"
  | "calendar.createEvent"
  | "calendar.updateEvent"
  | "internal.createTask"
  | "internal.createReminder"
  | "internal.createEvent";

type PlannerToolCall = {
  name: ToolName;
  args: Record<string, unknown>;
  reason?: string;
};

type PlannerOutput = {
  assistantReply: string;
  toolCalls: PlannerToolCall[];
  profileUpdate?: {
    biography?: string;
    preferences?: string[];
    goals?: string[];
    routines?: string[];
    communicationStyle?: string;
    timezone?: string;
  };
  memoryNotes?: Array<{
    note: string;
    tags?: string[];
    confidence?: number;
  }>;
};

type ChatCommand = {
  name: "clear_chat";
};

type ToolResult = {
  summary: string;
  result?: Record<string, unknown>;
};

type ToolContext = {
  runQuery: any;
  runMutation: any;
  runAction?: any;
};

type ToolDefinition = {
  description: string;
  risk: "low" | "medium" | "high";
  approvalPolicy: ToolApprovalPolicy;
  buildApprovalSummary: (args: Record<string, unknown>) => string;
  execute: (
    ctx: ToolContext,
    userId: Id<"users">,
    args: Record<string, unknown>,
  ) => Promise<ToolResult>;
};

const APPROVE_PATTERNS = [
  /^\s*yes\b/i,
  /^\s*send it\b/i,
  /^\s*do it\b/i,
  /^\s*go ahead\b/i,
  /^\s*create it\b/i,
  /^\s*approve\b/i,
];

const REJECT_PATTERNS = [
  /^\s*no\b/i,
  /^\s*cancel\b/i,
  /^\s*don't do that\b/i,
  /^\s*do not do that\b/i,
  /^\s*stop\b/i,
  /^\s*reject\b/i,
];

const PLANNER_SYSTEM_PROMPT = `You are Vimi, a proactive personal life assistant.
You help the user organize life, execute practical actions, and remember who they are over time.

You must respond with valid JSON only using this exact shape:
{
  "assistantReply": "natural language, concise",
  "toolCalls": [{ "name": "tool.name", "args": { ... }, "reason": "optional short reason" }],
  "profileUpdate": {
    "biography": "optional",
    "preferences": ["optional"],
    "goals": ["optional"],
    "routines": ["optional"],
    "communicationStyle": "optional",
    "timezone": "optional"
  },
  "memoryNotes": [{ "note": "...", "tags": ["..."], "confidence": 0.8 }]
}

Rules:
- Always include assistantReply and toolCalls.
- toolCalls can be empty.
- Only use these tools:
  - gmail.searchInbox { "query": string, "maxResults"?: number }
  - gmail.readThread { "threadId": string }
  - gmail.createDraft { "to": string, "subject": string, "body": string, "cc"?: string[], "bcc"?: string[] }
  - gmail.sendEmail { "to": string, "subject": string, "body": string, "cc"?: string[], "bcc"?: string[] }
  - calendar.listEvents { "timeMin"?: string, "timeMax"?: string, "maxResults"?: number }
  - calendar.createEvent { "title": string, "start": string, "end"?: string, "description"?: string, "timeZone"?: string }
  - calendar.updateEvent { "eventId": string, "title"?: string, "start"?: string, "end"?: string, "description"?: string, "timeZone"?: string }
  - internal.createTask { "title": string, "priority"?: "high" | "medium" | "low", "dueDate"?: string, "description"?: string }
  - internal.createReminder { "text": string, "date"?: string, "time"?: string, "triggerAt"?: string, "deliveryChannels"?: ["in_app"] | ["in_app","gmail"] }
  - internal.createEvent { "title": string, "date": string, "time"?: string }
- If the user is sharing identity, preferences, routines, goals, career, likes/dislikes, capture that in profileUpdate and/or memoryNotes.
- If the user asks to send an email, use gmail.sendEmail.
- If the user asks to draft an email, use gmail.createDraft.
- If the user asks to check inbox or search email, use gmail.searchInbox.
- If the user asks for the latest, newest, or most recent email, use gmail.searchInbox with maxResults: 1.
- For gmail.searchInbox, translate natural requests into Gmail search operators when useful:
  from:, to:, subject:, has:attachment, older_than:, newer_than:, after:, before:, and quoted phrases.
- Example: "the email Maria Fernando sent last month about the invoice" can become something like from:"Maria Fernando" "invoice" older_than:0d newer_than:30d.
- gmail.searchInbox already returns sender, subject, date, snippet, and body preview for top matches, so prefer it for "find/show/tell me what this email says" requests.
- Use gmail.readThread only when you already have an explicit Gmail thread/message id.
- If the user asks about calendar or scheduling, use calendar tools.
- For calendar.createEvent and calendar.updateEvent, use ISO or RFC3339 datetimes. If the user gives only a start time, default the event to 1 hour.
- If the user asks for a tiny reminder like "in 30m", use internal.createReminder with triggerAt in ISO format when possible.
- Keep assistantReply brief, warm, and conversational.`;

const toolRegistry: Record<ToolName, ToolDefinition> = {
  "gmail.searchInbox": {
    description: "Search Gmail inbox",
    risk: "low",
    approvalPolicy: "never",
    buildApprovalSummary: (args) => `Search Gmail for "${String(args.query ?? "")}"`,
    execute: async (ctx, userId, args) => {
      const query = String(args.query ?? "").trim();
      const maxResults = Math.min(Number(args.maxResults ?? 5) || 5, 10);
      const response = await withGoogleAccessToken(ctx, internal, userId, async (token) =>
        googleApiFetch(
          token,
          `${gmailUrl("/messages")}?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
        ),
      );
      if (!response.ok) throw new Error(`Gmail search failed: ${response.status}`);
      const payload = (await response.json()) as {
        messages?: Array<{ id: string; threadId: string }>;
        resultSizeEstimate?: number;
      };
      const messages = payload.messages ?? [];
      const detailedMessages =
        messages.length === 0
          ? []
          : await withGoogleAccessToken(ctx, internal, userId, async (token) =>
              Promise.all(
                messages.slice(0, Math.min(messages.length, 3)).map(async (message) => {
                  const detailResponse = await googleApiFetch(
                    token,
                    gmailUrl(
                      `/messages/${encodeURIComponent(message.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
                    ),
                  );
                  if (!detailResponse.ok) {
                    return {
                      id: message.id,
                      threadId: message.threadId,
                    };
                  }
                  const detailPayload = (await detailResponse.json()) as {
                    id?: string;
                    threadId?: string;
                    snippet?: string;
                    internalDate?: string;
                    payload?: {
                      headers?: Array<{ name?: string; value?: string }>;
                    };
                  };
                  const headers = detailPayload.payload?.headers ?? [];
                  const getHeader = (name: string) =>
                    headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value;

                  return {
                    id: detailPayload.id ?? message.id,
                    threadId: detailPayload.threadId ?? message.threadId,
                    subject: getHeader("Subject"),
                    from: getHeader("From"),
                    date: getHeader("Date"),
                    snippet: detailPayload.snippet,
                    internalDate: detailPayload.internalDate,
                    bodyPreview: extractEmailBodyPreview(detailPayload),
                  };
                }),
              ),
            );

      const latestMessage = detailedMessages[0];
      return {
        summary:
          messages.length === 0
            ? `I did not find emails for "${query}".`
            : latestMessage?.subject || latestMessage?.from || latestMessage?.snippet
              ? [
                  `I found ${messages.length} email result${messages.length === 1 ? "" : "s"} for "${query}".`,
                  latestMessage.from ? `Latest sender: ${latestMessage.from}.` : undefined,
                  latestMessage.date ? `Date: ${latestMessage.date}.` : undefined,
                  latestMessage.subject ? `Subject: ${latestMessage.subject}.` : undefined,
                  latestMessage.snippet ? `Preview: ${latestMessage.snippet}.` : undefined,
                  latestMessage.bodyPreview ? `Body: ${latestMessage.bodyPreview}.` : undefined,
                ]
                  .filter(Boolean)
                  .join(" ")
              : `I found ${messages.length} email result${messages.length === 1 ? "" : "s"} for "${query}".`,
        result: {
          query,
          messages: detailedMessages.length > 0 ? detailedMessages : messages,
          resultSizeEstimate: payload.resultSizeEstimate ?? messages.length,
        },
      };
    },
  },
  "gmail.readThread": {
    description: "Read a Gmail thread",
    risk: "low",
    approvalPolicy: "never",
    buildApprovalSummary: (args) => `Read Gmail thread ${String(args.threadId ?? "")}`,
    execute: async (ctx, userId, args) => {
      const threadId = String(args.threadId ?? "").trim();
      const payload = await withGoogleAccessToken(ctx, internal, userId, async (token) => {
        const threadResponse = await googleApiFetch(
          token,
          gmailUrl(`/threads/${encodeURIComponent(threadId)}?format=full`),
        );
        if (threadResponse.ok) {
          return await threadResponse.json();
        }

        const messageResponse = await googleApiFetch(
          token,
          gmailUrl(`/messages/${encodeURIComponent(threadId)}?format=full`),
        );
        if (!messageResponse.ok) {
          throw new Error(`Gmail read thread failed: ${threadResponse.status}`);
        }
        return await messageResponse.json();
      });

      const threadMessages = Array.isArray((payload as { messages?: unknown[] }).messages)
        ? ((payload as { messages: Array<Record<string, unknown>> }).messages ?? [])
        : [payload as Record<string, unknown>];
      const latestMessage = threadMessages.at(-1);
      const bodyPreview = latestMessage ? extractEmailBodyPreview(latestMessage) : undefined;

      return {
        summary: [
          `I pulled the Gmail thread ${threadId}.`,
          bodyPreview ? `Body: ${bodyPreview}.` : undefined,
        ]
          .filter(Boolean)
          .join(" "),
        result: payload as Record<string, unknown>,
      };
    },
  },
  "gmail.createDraft": {
    description: "Create an email draft",
    risk: "medium",
    approvalPolicy: "never",
    buildApprovalSummary: (args) => `Create a draft email to ${String(args.to ?? "")}`,
    execute: async (ctx, userId, args) => {
      const raw = buildDraftEmailRaw({
        to: String(args.to ?? ""),
        subject: String(args.subject ?? ""),
        body: String(args.body ?? ""),
        cc: Array.isArray(args.cc) ? args.cc.map(String) : undefined,
        bcc: Array.isArray(args.bcc) ? args.bcc.map(String) : undefined,
      });
      const response = await withGoogleAccessToken(ctx, internal, userId, async (token) =>
        googleApiFetch(token, gmailUrl("/drafts"), {
          method: "POST",
          body: JSON.stringify({ message: { raw } }),
        }),
      );
      if (!response.ok) throw new Error(`Gmail create draft failed: ${response.status}`);
      const payload = await response.json();
      return {
        summary: `I created a Gmail draft for ${String(args.to ?? "the recipient")}.`,
        result: payload as Record<string, unknown>,
      };
    },
  },
  "gmail.sendEmail": {
    description: "Send an email via Gmail",
    risk: "high",
    approvalPolicy: "always",
    buildApprovalSummary: (args) =>
      `Send an email to ${String(args.to ?? "the recipient")} with subject "${String(args.subject ?? "")}"`,
    execute: async (ctx, userId, args) => {
      const raw = buildDraftEmailRaw({
        to: String(args.to ?? ""),
        subject: String(args.subject ?? ""),
        body: String(args.body ?? ""),
        cc: Array.isArray(args.cc) ? args.cc.map(String) : undefined,
        bcc: Array.isArray(args.bcc) ? args.bcc.map(String) : undefined,
      });
      const response = await withGoogleAccessToken(ctx, internal, userId, async (token) =>
        googleApiFetch(token, gmailUrl("/messages/send"), {
          method: "POST",
          body: JSON.stringify({ raw }),
        }),
      );
      if (!response.ok) throw new Error(`Gmail send failed: ${response.status}`);
      const payload = await response.json();
      return {
        summary: `I sent the email to ${String(args.to ?? "the recipient")}.`,
        result: payload as Record<string, unknown>,
      };
    },
  },
  "calendar.listEvents": {
    description: "List calendar events",
    risk: "low",
    approvalPolicy: "never",
    buildApprovalSummary: () => "List upcoming Google Calendar events",
    execute: async (ctx, userId, args) => {
      const params = new URLSearchParams();
      params.set("singleEvents", "true");
      params.set("orderBy", "startTime");
      params.set("maxResults", String(Math.min(Number(args.maxResults ?? 10) || 10, 20)));
      if (args.timeMin) params.set("timeMin", String(args.timeMin));
      if (args.timeMax) params.set("timeMax", String(args.timeMax));
      const response = await withGoogleAccessToken(ctx, internal, userId, async (token) =>
        googleApiFetch(token, `${calendarUrl("/events")}?${params.toString()}`),
      );
      if (!response.ok) throw new Error(`Calendar list failed: ${response.status}`);
      const payload = await response.json();
      return {
        summary: `I checked your calendar and found ${Array.isArray(payload.items) ? payload.items.length : 0} event(s).`,
        result: payload as Record<string, unknown>,
      };
    },
  },
  "calendar.createEvent": {
    description: "Create a calendar event",
    risk: "medium",
    approvalPolicy: "never",
    buildApprovalSummary: (args) => `Create a calendar event "${String(args.title ?? "")}"`,
    execute: async (ctx, userId, args) => {
      const normalized = normalizeCalendarEventTiming(args.start, args.end, args.timeZone);
      const payload = {
        summary: String(args.title ?? ""),
        description: args.description ? String(args.description) : undefined,
        ...normalized,
      };
      const response = await withGoogleAccessToken(ctx, internal, userId, async (token) =>
        googleApiFetch(token, calendarUrl("/events"), {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar create failed: ${response.status} ${errorText}`);
      }
      const created = (await response.json()) as { id?: string };
      if (created.id) {
        await ctx.runMutation(internal.chat.createEventFromCalendarTool, {
          userId,
          title: String(args.title ?? ""),
          date: normalized.localStart.getTime(),
          time: extractTimeLabel(normalized.localStart.toISOString()),
          externalId: created.id,
          externalSource: "google_calendar",
        });
      }
      return {
        summary: `I created the calendar event "${String(args.title ?? "")}".`,
        result: created as Record<string, unknown>,
      };
    },
  },
  "calendar.updateEvent": {
    description: "Update a calendar event",
    risk: "medium",
    approvalPolicy: "never",
    buildApprovalSummary: (args) => `Update calendar event ${String(args.eventId ?? "")}`,
    execute: async (ctx, userId, args) => {
      const eventId = String(args.eventId ?? "");
      const payload: Record<string, unknown> = {};
      if (args.title) payload.summary = String(args.title);
      if (args.description) payload.description = String(args.description);
      if (args.start || args.end) {
        const normalized = normalizeCalendarEventTiming(args.start, args.end, args.timeZone);
        payload.start = normalized.start;
        payload.end = normalized.end;
      }
      const response = await withGoogleAccessToken(ctx, internal, userId, async (token) =>
        googleApiFetch(token, calendarUrl(`/events/${encodeURIComponent(eventId)}`), {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar update failed: ${response.status} ${errorText}`);
      }
      const updated = await response.json();
      return {
        summary: "I updated the calendar event.",
        result: updated as Record<string, unknown>,
      };
    },
  },
  "internal.createTask": {
    description: "Create an internal Vimi task",
    risk: "low",
    approvalPolicy: "never",
    buildApprovalSummary: (args) => `Create task "${String(args.title ?? "")}"`,
    execute: async (ctx, userId, args) => {
      const id = await ctx.runMutation(internal.chat.createTaskFromAgent, {
        userId,
        title: String(args.title ?? ""),
        description: args.description ? String(args.description) : undefined,
        priority: args.priority ? String(args.priority) : undefined,
        dueDate: args.dueDate ? new Date(String(args.dueDate)).getTime() : undefined,
      });
      return {
        summary: `I created the task "${String(args.title ?? "")}".`,
        result: { id },
      };
    },
  },
  "internal.createReminder": {
    description: "Create an internal reminder or timer",
    risk: "low",
    approvalPolicy: "never",
    buildApprovalSummary: (args) => `Create reminder "${String(args.text ?? "")}"`,
    execute: async (ctx, userId, args) => {
      const triggerAt = args.triggerAt ? new Date(String(args.triggerAt)).getTime() : undefined;
      const date = args.date
        ? new Date(String(args.date)).getTime()
        : triggerAt ?? Date.now() + 30 * 60 * 1000;
      const id = await ctx.runMutation(internal.chat.createReminderFromAgent, {
        userId,
        text: String(args.text ?? ""),
        date,
        time: args.time ? String(args.time) : undefined,
        triggerAt,
        deliveryChannels: normalizeDeliveryChannels(args.deliveryChannels),
      });
      return {
        summary: `I created the reminder "${String(args.text ?? "")}".`,
        result: { id },
      };
    },
  },
  "internal.createEvent": {
    description: "Create an internal event",
    risk: "low",
    approvalPolicy: "never",
    buildApprovalSummary: (args) => `Create event "${String(args.title ?? "")}"`,
    execute: async (ctx, userId, args) => {
      const date = new Date(String(args.date ?? "")).getTime();
      const id = await ctx.runMutation(internal.chat.createEventFromAgent, {
        userId,
        title: String(args.title ?? ""),
        date,
        time: args.time ? String(args.time) : undefined,
      });
      return {
        summary: `I created the event "${String(args.title ?? "")}".`,
        result: { id },
      };
    },
  },
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
      void (async () => {
        try {
          const assistantText = await handleUserMessage(ctx, userId, text, "voice");
          for (const piece of chunkText(assistantText)) {
            sendEvent("delta", { text: piece });
          }
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

  const plannerContext = await ctx.runQuery(internal.chat.getPlannerContext, { userId });
  const planned = await planAssistantResponse(text, plannerContext);

  await persistProfileUpdates(ctx, userId, planned.profileUpdate);
  await persistMemoryNotes(ctx, userId, planned.memoryNotes, source);

  const assistantFragments: string[] = [];
  if (planned.assistantReply.trim() && planned.toolCalls.length === 0) {
    assistantFragments.push(planned.assistantReply.trim());
  }

  for (const toolCall of planned.toolCalls) {
    if (!(toolCall.name in toolRegistry)) continue;
    const executionId = await ctx.runMutation(internal.chat.createToolExecutionRecord, {
      userId,
      toolName: toolCall.name,
      toolArgsJson: JSON.stringify(toolCall.args ?? {}),
      status: "pending",
      sourceMessageId,
    });

    const definition = toolRegistry[toolCall.name];
    if (definition.approvalPolicy === "always") {
      const humanSummary = definition.buildApprovalSummary(toolCall.args);
      const approvalId = await ctx.runMutation(internal.approvals.createPendingApproval, {
        userId,
        toolName: toolCall.name,
        humanSummary,
        toolArgsJson: JSON.stringify(toolCall.args ?? {}),
        approvalMode: "hybrid",
        expiresAt: Date.now() + 15 * 60 * 1000,
        requestedByMessageId: sourceMessageId,
        toolExecutionId: executionId,
      });
      await ctx.runMutation(internal.chat.linkExecutionApproval, {
        executionId,
        approvalId,
      });
      await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
        executionId,
        status: "awaiting_approval",
      });
      assistantFragments.push(
        `I'm ready to ${humanSummary.toLowerCase()}. Just say yes, or approve it from the side panel.`,
      );
      continue;
    }

    try {
      await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
        executionId,
        status: "running",
      });
      const result = await executeToolCall(ctx, userId, toolCall.name, toolCall.args ?? {});
      await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
        executionId,
        status: "completed",
        resultSummary: result.summary,
        resultJson: JSON.stringify(result.result ?? {}),
      });
      assistantFragments.push(result.summary);
    } catch (error) {
      const message = `I could not complete ${toolCall.name}: ${String(error)}`;
      await ctx.runMutation(internal.chat.updateToolExecutionStatus, {
        executionId,
        status: "failed",
        error: String(error),
      });
      assistantFragments.push(message);
    }
  }

  const assistantText = assistantFragments.filter(Boolean).join("\n\n").trim() || "I'm here.";
  await ctx.runMutation(internal.chat.saveAssistantMessage, {
    userId,
    text: assistantText,
    parsedType: planned.toolCalls[0]?.name,
  });
  return assistantText;
}

async function planAssistantResponse(
  userText: string,
  context: {
    profile: unknown;
    memories: unknown[];
    integrations: unknown[];
    recentMessages: unknown[];
  },
): Promise<PlannerOutput> {
  try {
    const completion = await openai.chat.completions.create({
      model: PLANNER_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${PLANNER_SYSTEM_PROMPT}\n\nCurrent time context:\n${JSON.stringify({
            nowIso: new Date().toISOString(),
            defaultTimeZone: "America/Bogota",
          })}\n\nCurrent context:\n${JSON.stringify(context)}`,
        },
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
      toolCalls: Array.isArray(parsed.toolCalls)
        ? parsed.toolCalls.filter(
            (toolCall): toolCall is PlannerToolCall =>
              !!toolCall &&
              typeof toolCall === "object" &&
              typeof (toolCall as PlannerToolCall).name === "string" &&
              typeof (toolCall as PlannerToolCall).args === "object",
          )
        : [],
      profileUpdate:
        parsed.profileUpdate && typeof parsed.profileUpdate === "object"
          ? parsed.profileUpdate
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
) {
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
    await ctx.runMutation(internal.chat.addMemoryFromAgent, {
      userId,
      note: memory.note.trim(),
      tags: Array.isArray(memory.tags) ? memory.tags.map(String) : [],
      confidence: typeof memory.confidence === "number" ? memory.confidence : undefined,
      source: source === "voice" ? "voice" : "chat",
    });
  }
}

async function executeToolCall(
  ctx: ToolContext,
  userId: Id<"users">,
  toolName: ToolName,
  args: Record<string, unknown>,
) {
  const tool = toolRegistry[toolName];
  if (!tool) throw new Error(`Unsupported tool: ${toolName}`);

  try {
    const result = await tool.execute(ctx, userId, args);
    if (toolName.startsWith("gmail.") || toolName.startsWith("calendar.")) {
      await ctx.runMutation(internal.integrations.saveIntegrationSync, {
        userId,
        provider: "google",
        lastSyncAt: Date.now(),
        status: "connected",
      });
    }
    return result;
  } catch (error) {
    if (toolName.startsWith("gmail.") || toolName.startsWith("calendar.")) {
      const message = String(error);
      await ctx.runMutation(internal.integrations.saveIntegrationSync, {
        userId,
        provider: "google",
        lastSyncAt: Date.now(),
        lastError: message,
        status:
          message.includes("401") || message.includes("invalid_grant") || message.includes("invalid_token")
            ? "needs_reauth"
            : "connected",
      });
    }
    throw error;
  }
}

function detectApprovalDecision(text: string): ApprovalDecision | null {
  if (APPROVE_PATTERNS.some((pattern) => pattern.test(text))) return "approved";
  if (REJECT_PATTERNS.some((pattern) => pattern.test(text))) return "rejected";
  return null;
}

function detectChatCommand(text: string): ChatCommand | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === "/cls") {
    return { name: "clear_chat" };
  }
  return null;
}

function safeJsonParse<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function chunkText(text: string) {
  const clean = text.trim();
  if (!clean) return [] as string[];

  const chunks: string[] = [];
  let remaining = clean;
  while (remaining.length > 0) {
    if (remaining.length <= 120) {
      chunks.push(remaining);
      break;
    }
    const slice = remaining.slice(0, 120);
    const splitAt = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(", "), slice.lastIndexOf(" "));
    const index = splitAt > 30 ? splitAt + 1 : 120;
    chunks.push(remaining.slice(0, index));
    remaining = remaining.slice(index).trimStart();
  }
  return chunks;
}

function normalizeDeliveryChannels(raw: unknown): Array<"in_app" | "gmail"> {
  if (!Array.isArray(raw)) return ["in_app"];
  const channels = raw
    .map((value) => String(value))
    .filter((value): value is "in_app" | "gmail" => value === "in_app" || value === "gmail");
  return channels.length > 0 ? Array.from(new Set(channels)) : ["in_app"];
}

function extractTimeLabel(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeCalendarEventTiming(startInput: unknown, endInput: unknown, timeZoneInput: unknown) {
  const timeZone = typeof timeZoneInput === "string" && timeZoneInput.trim()
    ? timeZoneInput.trim()
    : "America/Bogota";

  const startRaw = String(startInput ?? "").trim();
  if (!startRaw) {
    throw new Error("Calendar event is missing a start date/time.");
  }

  const startDate = new Date(startRaw);
  if (Number.isNaN(startDate.getTime())) {
    throw new Error(
      `Calendar event start must be an ISO/RFC3339 date-time. Received: ${startRaw}`,
    );
  }

  const endRaw = String(endInput ?? "").trim();
  const endDate =
    endRaw && !Number.isNaN(new Date(endRaw).getTime())
      ? new Date(endRaw)
      : new Date(startDate.getTime() + 60 * 60 * 1000);

  return {
    start: {
      dateTime: toCalendarDateTime(startRaw, startDate),
      timeZone,
    },
    end: {
      dateTime: toCalendarDateTime(endRaw || endDate.toISOString(), endDate),
      timeZone,
    },
    localStart: startDate,
  };
}

function toCalendarDateTime(raw: string, parsed: Date) {
  const trimmed = raw.trim();
  if (trimmed && /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    return trimmed;
  }
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  const sec = String(parsed.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}`;
}

function extractEmailBodyPreview(message: Record<string, unknown>) {
  const payload = message.payload as Record<string, unknown> | undefined;
  const text = extractPlainTextFromPayload(payload)?.replace(/\s+/g, " ").trim();
  if (!text) {
    return undefined;
  }
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

function extractPlainTextFromPayload(payload?: Record<string, unknown>): string | undefined {
  if (!payload) {
    return undefined;
  }

  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : undefined;
  const body = payload.body as Record<string, unknown> | undefined;
  const data = typeof body?.data === "string" ? body.data : undefined;
  const parts = Array.isArray(payload.parts) ? (payload.parts as Array<Record<string, unknown>>) : [];

  if (mimeType === "text/plain" && data) {
    return decodeBase64UrlUtf8(data);
  }

  for (const part of parts) {
    const plain = extractPlainTextFromPayload(part);
    if (plain) {
      return plain;
    }
  }

  if (data) {
    return decodeBase64UrlUtf8(data);
  }

  return undefined;
}

function decodeBase64UrlUtf8(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
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
    return await ctx.db.insert("chatMessages", {
      userId: args.userId,
      text: args.text,
      createdAt: Date.now(),
      role: "assistant",
      parsedType: args.parsedType,
      relatedApprovalId: args.relatedApprovalId,
      relatedExecutionId: args.relatedExecutionId,
    });
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
    const [profile, recentMessages, memories, integrations] = await Promise.all([
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .unique(),
      ctx.db
        .query("chatMessages")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(12),
      ctx.db
        .query("userMemories")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(10),
      ctx.db
        .query("integrations")
        .withIndex("by_userId_status", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);

    return {
      profile,
      recentMessages: [...recentMessages].reverse().map((message) => ({
        role: message.role,
        text: message.text,
        parsedType: message.parsedType,
      })),
      memories: memories.map((memory) => ({
        note: memory.note,
        tags: memory.tags,
        confidence: memory.confidence,
      })),
      integrations: integrations.map((integration) => ({
        provider: integration.provider,
        status: integration.status,
        accountLabel: integration.accountLabel,
        lastSyncAt: integration.lastSyncAt,
      })),
    };
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("userMemories", {
      userId: args.userId,
      note: args.note,
      tags: args.tags,
      confidence: args.confidence,
      source: args.source,
      createdAt: Date.now(),
    });
  },
});
