import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const toolExecutionStatus = v.union(
  v.literal("pending"),
  v.literal("awaiting_approval"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const approvalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("resolved"),
);

const integrationStatus = v.union(
  v.literal("connected"),
  v.literal("disconnected"),
  v.literal("needs_reauth"),
  v.literal("error"),
);

const applicationTables = {
  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    priority: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("overdue")),
    createdAt: v.number(),
    source: v.union(v.literal("manual"), v.literal("chat"), v.literal("agent")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_status", ["userId", "status"]),

  reminders: defineTable({
    userId: v.id("users"),
    text: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
    triggerAt: v.optional(v.number()),
    deliveryChannels: v.optional(v.array(v.union(v.literal("in_app"), v.literal("gmail")))),
    deliveryStatus: v.optional(
      v.union(v.literal("pending"), v.literal("sent"), v.literal("dismissed"), v.literal("failed")),
    ),
    origin: v.union(v.literal("manual"), v.literal("chat"), v.literal("agent")),
    status: v.union(v.literal("pending"), v.literal("completed")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_triggerAt", ["userId", "triggerAt"])
    .index("by_deliveryStatus_triggerAt", ["deliveryStatus", "triggerAt"]),

  recurringPayments: defineTable({
    userId: v.id("users"),
    name: v.string(),
    amount: v.number(),
    frequency: v.string(),
    nextDueDate: v.number(),
    category: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("paused")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_nextDueDate", ["userId", "nextDueDate"]),

  budgets: defineTable({
    userId: v.id("users"),
    category: v.string(),
    amount: v.number(),
    month: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_month", ["userId", "month"])
    .index("by_userId_category", ["userId", "category"]),

  events: defineTable({
    userId: v.id("users"),
    title: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
    externalId: v.optional(v.string()),
    externalSource: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"]),

  chatMessages: defineTable({
    userId: v.id("users"),
    text: v.string(),
    createdAt: v.number(),
    parsedType: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant")),
    relatedApprovalId: v.optional(v.id("pendingApprovals")),
    relatedExecutionId: v.optional(v.id("toolExecutions")),
  }).index("by_userId_createdAt", ["userId", "createdAt"]),

  integrations: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    accountLabel: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    scopes: v.array(v.string()),
    status: integrationStatus,
    connectedAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_provider", ["userId", "provider"])
    .index("by_userId_status", ["userId", "status"]),

  oauthAccounts: defineTable({
    userId: v.id("users"),
    integrationId: v.id("integrations"),
    provider: v.string(),
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    tokenMetadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_provider", ["userId", "provider"])
    .index("by_integrationId", ["integrationId"]),

  toolExecutions: defineTable({
    userId: v.id("users"),
    toolName: v.string(),
    toolArgsJson: v.string(),
    resultSummary: v.optional(v.string()),
    resultJson: v.optional(v.string()),
    error: v.optional(v.string()),
    status: toolExecutionStatus,
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    sourceMessageId: v.optional(v.id("chatMessages")),
    pendingApprovalId: v.optional(v.id("pendingApprovals")),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_status", ["userId", "status"]),

  pendingApprovals: defineTable({
    userId: v.id("users"),
    toolName: v.string(),
    humanSummary: v.string(),
    toolArgsJson: v.string(),
    approvalMode: v.union(v.literal("voice"), v.literal("text"), v.literal("ui"), v.literal("hybrid")),
    status: approvalStatus,
    createdAt: v.number(),
    expiresAt: v.number(),
    resolvedAt: v.optional(v.number()),
    requestedByMessageId: v.optional(v.id("chatMessages")),
    toolExecutionId: v.optional(v.id("toolExecutions")),
  })
    .index("by_userId_status_createdAt", ["userId", "status", "createdAt"])
    .index("by_toolExecutionId", ["toolExecutionId"]),

  userProfiles: defineTable({
    userId: v.id("users"),
    biography: v.optional(v.string()),
    preferences: v.array(v.string()),
    goals: v.array(v.string()),
    routines: v.array(v.string()),
    communicationStyle: v.optional(v.string()),
    timezone: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  userMemories: defineTable({
    userId: v.id("users"),
    source: v.union(v.literal("chat"), v.literal("voice"), v.literal("manual"), v.literal("agent")),
    note: v.string(),
    confidence: v.optional(v.number()),
    tags: v.array(v.string()),
    createdAt: v.number(),
    lastReferencedAt: v.optional(v.number()),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_lastReferencedAt", ["userId", "lastReferencedAt"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
