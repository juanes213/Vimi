import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuthUserId } from "./lib/auth";

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("pendingApprovals")
      .withIndex("by_userId_status_createdAt", (q) => q.eq("userId", userId).eq("status", "pending"))
      .order("desc")
      .collect();
  },
});

export const approvePendingApproval = action({
  args: { approvalId: v.id("pendingApprovals") },
  handler: async (ctx, args): Promise<{ assistantText: string }> => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.runAction(internal.chat.resolveApprovalAction, {
      userId,
      approvalId: args.approvalId,
      decision: "approved",
      source: "ui",
    });
  },
});

export const rejectPendingApproval = action({
  args: { approvalId: v.id("pendingApprovals") },
  handler: async (ctx, args): Promise<{ assistantText: string }> => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.runAction(internal.chat.resolveApprovalAction, {
      userId,
      approvalId: args.approvalId,
      decision: "rejected",
      source: "ui",
    });
  },
});

export const createPendingApproval = internalMutation({
  args: {
    userId: v.id("users"),
    toolName: v.string(),
    humanSummary: v.string(),
    toolArgsJson: v.string(),
    approvalMode: v.union(v.literal("voice"), v.literal("text"), v.literal("ui"), v.literal("hybrid")),
    expiresAt: v.number(),
    requestedByMessageId: v.optional(v.id("chatMessages")),
    toolExecutionId: v.optional(v.id("toolExecutions")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pendingApprovals", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateApprovalStatus = internalMutation({
  args: {
    approvalId: v.id("pendingApprovals"),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("expired"), v.literal("resolved")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.approvalId, {
      status: args.status,
      resolvedAt: args.status === "pending" ? undefined : Date.now(),
    });
  },
});
