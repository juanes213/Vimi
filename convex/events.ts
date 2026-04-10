import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("events")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db.insert("events", {
      ...args,
      userId,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const event = await ctx.db.get(args.id);
    if (!event || event.userId !== userId) {
      throw new Error("Event not found");
    }
    await ctx.db.delete(args.id);
  },
});
