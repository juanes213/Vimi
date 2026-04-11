import type { ApprovalDecision, ChatCommand } from "./types";

const APPROVE_PATTERNS = [
  /^\s*yes\b/i,
  /^\s*send it\b/i,
  /^\s*do it\b/i,
  /^\s*go ahead\b/i,
  /^\s*create it\b/i,
  /^\s*approve\b/i,
];

const REJECT_PATTERNS = [
  /^\s*no\b/i,
  /^\s*cancel\b/i,
  /^\s*don't do that\b/i,
  /^\s*do not do that\b/i,
  /^\s*stop\b/i,
  /^\s*reject\b/i,
];

export function detectApprovalDecision(text: string): ApprovalDecision | null {
  if (APPROVE_PATTERNS.some((pattern) => pattern.test(text))) return "approved";
  if (REJECT_PATTERNS.some((pattern) => pattern.test(text))) return "rejected";
  return null;
}

export function detectChatCommand(text: string): ChatCommand | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === "/cls") {
    return { name: "clear_chat" };
  }
  return null;
}

export function safeJsonParse<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function chunkText(text: string) {
  const clean = text.trim();
  if (!clean) return [] as string[];

  const chunks: string[] = [];
  let remaining = clean;
  while (remaining.length > 0) {
    if (remaining.length <= 120) {
      chunks.push(remaining);
      break;
    }
    const slice = remaining.slice(0, 120);
    const splitAt = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(", "), slice.lastIndexOf(" "));
    const index = splitAt > 30 ? splitAt + 1 : 120;
    chunks.push(remaining.slice(0, index));
    remaining = remaining.slice(index).trimStart();
  }
  return chunks;
}
