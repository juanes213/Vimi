import type { Id } from "../_generated/dataModel";

export type ApprovalDecision = "approved" | "rejected";
export type ToolApprovalPolicy = "never" | "always" | "proactive_only";
export type SourceType = "voice" | "text" | "ui";

export type ToolName =
  | "gmail.searchInbox"
  | "gmail.readThread"
  | "gmail.createDraft"
  | "gmail.sendEmail"
  | "calendar.listEvents"
  | "calendar.createEvent"
  | "calendar.updateEvent"
  | "internal.createTask"
  | "internal.createReminder"
  | "internal.createEvent";

export type PlannerToolCall = {
  name: ToolName;
  args: Record<string, unknown>;
  reason?: string;
};

export type PlannerOutput = {
  assistantReply: string;
  toolCalls: PlannerToolCall[];
  profileUpdate?: {
    biography?: string;
    preferences?: string[];
    goals?: string[];
    routines?: string[];
    communicationStyle?: string;
    timezone?: string;
  };
  profileReplace?: {
    goals?: string[];
    preferences?: string[];
    routines?: string[];
  };
  memoryNotes?: Array<{
    note: string;
    tags?: string[];
    confidence?: number;
  }>;
};

export type AgenticContinuationOutput = {
  assistantReply: string;
  toolCalls: PlannerToolCall[];
  done: boolean;
};

export type ToolHistoryEntry = {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  success: boolean;
};

export type ChatCommand = {
  name: "clear_chat";
};

export type ToolResult = {
  summary: string;
  result?: Record<string, unknown>;
};

export type ToolContext = {
  runQuery: any;
  runMutation: any;
  runAction?: any;
};

export type ToolDefinition = {
  description: string;
  risk: "low" | "medium" | "high";
  approvalPolicy: ToolApprovalPolicy;
  buildApprovalSummary: (args: Record<string, unknown>) => string;
  execute: (
    ctx: ToolContext,
    userId: Id<"users">,
    args: Record<string, unknown>,
  ) => Promise<ToolResult>;
};
