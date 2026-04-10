import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const upsertProfile = mutation({
  args: {
    biography: v.optional(v.string()),
    preferences: v.optional(v.array(v.string())),
    goals: v.optional(v.array(v.string())),
    routines: v.optional(v.array(v.string())),
    communicationStyle: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    const payload = {
      userId,
      biography: args.biography ?? existing?.biography,
      preferences: args.preferences ?? existing?.preferences ?? [],
      goals: args.goals ?? existing?.goals ?? [],
      routines: args.routines ?? existing?.routines ?? [],
      communicationStyle: args.communicationStyle ?? existing?.communicationStyle,
      timezone: args.timezone ?? existing?.timezone,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", payload);
  },
});

export const listMemories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("userMemories")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const addMemory = mutation({
  args: {
    note: v.string(),
    source: v.union(v.literal("chat"), v.literal("voice"), v.literal("manual"), v.literal("agent")),
    confidence: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db.insert("userMemories", {
      userId,
      note: args.note,
      source: args.source,
      confidence: args.confidence,
      tags: args.tags ?? [],
      createdAt: Date.now(),
      lastReferencedAt: Date.now(),
    });
  },
});
