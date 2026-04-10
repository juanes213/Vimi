import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

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
