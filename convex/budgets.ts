import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("budgets")
      .withIndex("by_userId_month", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const listByMonth = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("budgets")
      .withIndex("by_userId_month", (q) => q.eq("userId", userId).eq("month", args.month))
      .collect();
  },
});

export const create = mutation({
  args: {
    category: v.string(),
    amount: v.number(),
    month: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db.insert("budgets", {
      ...args,
      userId,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("budgets") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const budget = await ctx.db.get(args.id);
    if (!budget || budget.userId !== userId) {
      throw new Error("Budget not found");
    }
    await ctx.db.delete(args.id);
  },
});
