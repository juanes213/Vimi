import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    priority: v.optional(v.string()),
    source: v.union(v.literal("manual"), v.literal("chat"), v.literal("agent")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db.insert("tasks", {
      ...args,
      userId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("overdue")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }
    await ctx.db.delete(args.id);
  },
});
