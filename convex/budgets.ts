import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("budgets").order("desc").collect();
  },
});

export const listByMonth = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("budgets")
      .withIndex("by_month", (q) => q.eq("month", args.month))
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
    return await ctx.db.insert("budgets", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("budgets") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
