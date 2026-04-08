import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("recurringPayments").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    amount: v.number(),
    frequency: v.string(),
    nextDueDate: v.number(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("recurringPayments", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const toggleStatus = mutation({
  args: { id: v.id("recurringPayments") },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.id);
    if (!payment) throw new Error("Payment not found");
    await ctx.db.patch(args.id, {
      status: payment.status === "active" ? "paused" : "active",
    });
  },
});

export const remove = mutation({
  args: { id: v.id("recurringPayments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
