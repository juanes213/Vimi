import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  buildDraftEmailRaw,
  calendarUrl,
  gmailUrl,
  googleApiFetch,
  withGoogleAccessToken,
} from "../lib/google";
import type {
  ToolContext,
  ToolDefinition,
  ToolName,
} from "./types";

export const toolRegistry: Record<ToolName, ToolDefinition> = {
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

export async function executeToolCall(
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
