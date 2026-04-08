import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    priority: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("overdue")
    ),
    createdAt: v.number(),
    source: v.union(v.literal("manual"), v.literal("chat")),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  reminders: defineTable({
    text: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("completed")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_date", ["date"]),

  recurringPayments: defineTable({
    name: v.string(),
    amount: v.number(),
    frequency: v.string(),
    nextDueDate: v.number(),
    category: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("paused")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_nextDueDate", ["nextDueDate"]),

  budgets: defineTable({
    category: v.string(),
    amount: v.number(),
    month: v.string(),
    createdAt: v.number(),
  })
    .index("by_month", ["month"])
    .index("by_category", ["category"]),

  events: defineTable({
    title: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_date", ["date"]),

  chatMessages: defineTable({
    text: v.string(),
    createdAt: v.number(),
    parsedType: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant")),
  }).index("by_createdAt", ["createdAt"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
