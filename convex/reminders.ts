import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";
import { buildDraftEmailRaw, gmailUrl, googleApiFetch, withGoogleAccessToken } from "./lib/google";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("reminders")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db.insert("reminders", {
      ...args,
      userId,
      triggerAt: args.time ? undefined : args.date,
      deliveryChannels: ["in_app"],
      deliveryStatus: "pending",
      origin: "manual",
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("reminders"),
    status: v.union(v.literal("pending"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const reminder = await ctx.db.get(args.id);
    if (!reminder || reminder.userId !== userId) {
      throw new Error("Reminder not found");
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const remove = mutation({
  args: { id: v.id("reminders") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const reminder = await ctx.db.get(args.id);
    if (!reminder || reminder.userId !== userId) {
      throw new Error("Reminder not found");
    }
    await ctx.db.delete(args.id);
  },
});

export const dispatchDueReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const dueReminders = await ctx.runQuery(internal.reminders.getDuePendingReminders, {
      now: Date.now(),
    });

    for (const reminder of dueReminders) {
      const channels = reminder.deliveryChannels ?? ["in_app"];
      let delivered = false;
      let lastError: string | undefined;

      if (channels.includes("in_app")) {
        await ctx.runMutation(internal.chat.saveAssistantMessage, {
          userId: reminder.userId,
          text: `Reminder: ${reminder.text}`,
          parsedType: "reminder.delivery",
        });
        delivered = true;
      }

      if (channels.includes("gmail")) {
        try {
          const integration = await ctx.runQuery(internal.integrations.getIntegrationForProvider, {
            userId: reminder.userId,
            provider: "google",
          });

          const recipient = integration?.accountLabel?.includes("@")
            ? integration.accountLabel
            : undefined;

          if (recipient) {
            const raw = buildDraftEmailRaw({
              to: recipient,
              subject: `Vimi reminder: ${reminder.text}`,
              body: `Reminder from Vimi:\n\n${reminder.text}`,
            });

            await withGoogleAccessToken(ctx, internal, reminder.userId, async (token) => {
              const response = await googleApiFetch(token, gmailUrl("/messages/send"), {
                method: "POST",
                body: JSON.stringify({ raw }),
              });
              if (!response.ok) {
                throw new Error(`Reminder email failed: ${response.status} ${await response.text()}`);
              }
            });

            delivered = true;
          }
        } catch (error) {
          lastError = String(error);
        }
      }

      await ctx.runMutation(internal.reminders.finishReminderDelivery, {
        reminderId: reminder._id,
        deliveryStatus: delivered ? "sent" : "failed",
        error: lastError,
      });
    }
  },
});

export const getDuePendingReminders = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reminders")
      .withIndex("by_deliveryStatus_triggerAt", (q) =>
        q.eq("deliveryStatus", "pending").lte("triggerAt", args.now),
      )
      .collect();
  },
});

export const finishReminderDelivery = internalMutation({
  args: {
    reminderId: v.id("reminders"),
    deliveryStatus: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reminderId, {
      deliveryStatus: args.deliveryStatus,
    });

    if (args.error) {
      const reminder = await ctx.db.get(args.reminderId);
      if (reminder) {
        await ctx.db.insert("chatMessages", {
          userId: reminder.userId,
          text: `I could not deliver reminder "${reminder.text}": ${args.error}`,
          createdAt: Date.now(),
          role: "assistant",
          parsedType: "reminder.delivery_error",
        });
      }
    }
  },
});
