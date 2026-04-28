# Vimi Memory Platform Integration Plan

## Context

This plan adapts the useful memory patterns from Omi into Vimi without copying the parts that do not fit the current product direction.

Out of scope for now:

- Wearables.
- Always-listening or ambient recording.
- SDKs, MCP, public developer platform, or open-source marketplace positioning.
- Continuous screen capture or desktop surveillance-style context.

Allowed, but only under explicit user control:

- One-time or session-scoped screen viewing when the user asks Vimi for help with something on screen.
- Temporary visual context that is discarded by default unless the user explicitly asks Vimi to remember it.

The goal is narrower and more valuable for Vimi today: improve how Vimi turns intentional conversations into durable memory, summaries, action items, reminders, and useful follow-up.

Vimi should keep explicit user control over listening. The user starts, stops, or enters a specific mode. Vimi should never silently listen in the background.

The same rule applies to screen context. Vimi may look at the screen only when the user explicitly asks, and the UI should make it obvious when screen context is being captured or used.

---

## Product Direction

Vimi should evolve from a voice/chat assistant with memory into a personal memory-and-action system.

The core loop should become:

1. User intentionally talks to Vimi.
2. Vimi captures a controlled conversation session.
3. Vimi produces a structured memory.
4. Vimi extracts useful follow-up: tasks, reminders, events, decisions, preferences, goals, and routines.
5. Vimi stores the memory semantically.
6. Vimi uses that memory later to answer and act with context.

This is the part of Omi worth learning from: not the wearable, but the way conversations become structured, queryable, actionable memory.

Screen context should be treated differently from memory. It is useful as immediate context for help, debugging, writing, design review, or navigation, but it should not automatically become long-term memory.

---

## Existing Vimi Foundation

Vimi already has several pieces needed for this:

- `src/hooks/useVoiceRecorder.ts` records user speech, detects silence, and transcribes via ElevenLabs STT.
- `src/hooks/useVoiceChat.ts` handles voice modes, streaming assistant responses, TTS, auto-listen, and interruption.
- `src/hooks/useVAD.ts` detects speech while Vimi is speaking.
- `convex/schema.ts` already has `userMemories`, `sessionSummaries`, `chatMessages`, `toolExecutions`, and `pendingApprovals`.
- `convex/chat/tools.ts` already supports Gmail, Calendar, internal tasks, reminders, and events.
- `convex/chat/prompts.ts` already asks the model to extract profile updates and memory notes.

The current gap is that Vimi stores memory mostly as individual notes and chat history. It does not yet treat a conversation as a first-class object with transcript, summary, action items, events, and metadata.

---

## Phase 1 - Conversation Memories

Add a first-class table for structured conversation memories.

Suggested table:

```ts
conversationMemories: defineTable({
  userId: v.id("users"),
  source: v.union(
    v.literal("voice"),
    v.literal("chat"),
    v.literal("meeting"),
    v.literal("manual"),
  ),
  title: v.string(),
  overview: v.string(),
  category: v.optional(v.string()),
  transcriptText: v.optional(v.string()),
  transcriptSegmentsJson: v.optional(v.string()),
  actionItemsJson: v.optional(v.string()),
  eventsJson: v.optional(v.string()),
  decisionsJson: v.optional(v.string()),
  tags: v.array(v.string()),
  embedding: v.optional(v.array(v.float64())),
  discarded: v.optional(v.boolean()),
  startedAt: v.optional(v.number()),
  finishedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_userId_createdAt", ["userId", "createdAt"])
  .index("by_userId_source", ["userId", "source"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["userId"],
  });
```

Keep `userMemories` for small facts about the user. Use `conversationMemories` for complete episodes.

Example:

- `userMemories`: "The user prefers short spoken responses."
- `conversationMemories`: "Planning conversation about April budget and upcoming rent payment."

Deliverables:

- Add schema table.
- Add internal mutation to save a conversation memory.
- Add internal query/action for semantic retrieval of relevant conversation memories.
- Inject relevant conversation memories into planner context alongside `userMemories`.

---

## Phase 2 - Structured Memory Extraction

Extend the planner output so Vimi can create rich memory objects from a conversation.

Suggested JSON shape addition:

```json
{
  "conversationMemory": {
    "title": "Budget planning for April",
    "overview": "The user reviewed recurring expenses and wants to reduce food delivery spending.",
    "category": "finance",
    "actionItems": [
      {
        "description": "Review delivery spending this weekend",
        "dueDate": "2026-04-18",
        "confidence": 0.8
      }
    ],
    "events": [],
    "decisions": [
      "The user wants to cap delivery spending this month."
    ],
    "tags": ["finance", "budget", "spending"]
  }
}
```

Rules for the model:

- Create `conversationMemory` only when the interaction contains reusable context.
- Do not store trivial commands like "open tasks" or "stop".
- Store decisions, plans, preferences, goals, routines, and commitments.
- Keep memory factual. Do not infer sensitive facts unless the user clearly states them.
- For voice mode, avoid making the spoken answer long just because memory extraction happened.

Deliverables:

- Update planner prompt.
- Update PlannerOutput types.
- Persist extracted conversation memory.
- Generate embedding from `title + overview + tags + transcriptText`.
- Keep memory persistence non-fatal if embeddings fail.

---

## Phase 3 - Controlled Meeting Mode

Add an explicit mode for longer conversations. This is not always-listening. The user must start and stop it.

Potential UI states:

- `idle`
- `listening`
- `thinking`
- `speaking`
- `meeting`

Meeting mode behavior:

1. User clicks "Meeting" or says "start meeting mode".
2. Vimi shows a clear active recording state.
3. Vimi records/transcribes in chunks or utterances.
4. User clicks stop or says "stop meeting mode".
5. Vimi summarizes the session and extracts action items/events/decisions.
6. Vimi asks for confirmation before creating external actions if risk is medium/high.

Initial implementation can be simple:

- Reuse the existing recorder.
- Append each finalized transcript to a session buffer.
- Do not attempt speaker diarization yet.
- Do not stream raw audio to the backend.
- Do not record while mode is off.

Later improvement:

- Replace blob-per-utterance STT with streaming STT.
- Add segment timestamps.
- Add optional manual speaker labels.

Deliverables:

- Add UI entry point for Meeting Mode.
- Add local session buffer in frontend or backend.
- Add backend action to process a completed session into a `conversationMemory`.
- Show the resulting summary/action items in the chat.

---

## Phase 4 - Implicit Action Extraction

Vimi already creates tasks/reminders/events when the user asks directly. Add support for implied follow-up inside richer conversations.

Examples:

- "Tomorrow I need to call Sofia about the contract."
- "Remind me to check the budget when I get home."
- "Let's meet with Carlos next Tuesday at 3."
- "I should send that invoice before Friday."

Desired behavior:

- If confidence is high and action is low risk, create the internal task/reminder/event.
- If action touches external systems or sends communication, use approval.
- If date/time is ambiguous, ask a short clarification.
- Avoid creating lots of noisy tasks from vague statements.

Implementation options:

1. Reuse existing `toolCalls` from the planner.
2. Add `suggestedActions` to `conversationMemory`.
3. For Meeting Mode, present suggested actions first and let the user approve them in bulk.

Recommended first version:

- For normal voice/chat: use existing `toolCalls`.
- For Meeting Mode: save suggested actions and ask before creating them.

Deliverables:

- Add prompt rules for implicit commitments.
- Add confidence threshold guidance.
- Add UI display for suggested actions after a meeting/session.
- Wire approved suggested actions to existing tools.

---

## Phase 5 - Memory Review And Control

Because Vimi is personal, the user needs control over what gets remembered.

Add a Memory section or extend the chat side panel with:

- Recent conversation memories.
- Search memories.
- Delete/discard memory.
- Mark memory as important.
- Edit title/overview/tags.
- Toggle whether a memory can be used in future context.

Suggested schema additions:

```ts
isPinned: v.optional(v.boolean()),
isActive: v.optional(v.boolean()),
importance: v.optional(v.number()),
```

Default:

- `isActive: true`
- `discarded: false`
- `importance: 0.5`

Privacy principle:

- If the user deletes or disables a memory, it should not be retrieved into planner context.
- Avoid hidden memory. The user should be able to inspect what Vimi remembers.

Deliverables:

- Add query to list memories.
- Add mutations to update/delete/discard memories.
- Add UI for memory review.
- Filter inactive/discarded memories from retrieval.

---

## Phase 6 - Proactive But Controlled Nudges

Vimi should eventually be proactive, but not noisy.

Use cases:

- Follow up on tasks implied in past conversations.
- Surface a relevant memory before answering.
- Suggest creating a reminder when the user mentions a future commitment.
- Notify when a stored commitment is near due.

Rules:

- No background listening.
- No unsolicited stream of advice.
- Rate limit nudges.
- Make nudges dismissible.
- Let the user disable proactive behavior.

Suggested controls:

- `Proactive suggestions: off / low / normal`
- `Reminder nudges: on/off`
- `Memory suggestions: on/off`

Implementation:

- Use Convex cron jobs to scan pending reminders/tasks.
- Use stored memories only, not live microphone input.
- Save generated nudges as assistant messages or notifications.

Deliverables:

- Add user preference fields.
- Add scheduled nudge evaluation.
- Add deduplication so Vimi does not repeat the same suggestion.
- Add UI toggle.

---

## Phase 7 - On-Demand Screen Help

Add an explicit "look at my screen" capability. This is not continuous screen capture. It is a user-triggered context snapshot or short controlled session.

Use cases:

- "Vimi, look at my screen and help me understand this error."
- "Can you see this page and tell me what to do next?"
- "Look at this UI and tell me what looks wrong."
- "Help me write a reply based on what's open."
- "Check this form before I submit it."

Activation rules:

- The user must click a button or ask Vimi to look.
- Vimi should ask for OS/browser permission if required.
- Vimi should show a visible state like `screen context active`.
- Default mode should capture one screenshot/frame, not a continuous stream.
- A short live screen session can exist later, but it must have a clear stop button and timeout.

Suggested modes:

- `screen_snapshot`: capture one screenshot and send it with the user's prompt.
- `screen_session`: optional later mode where Vimi can inspect screen updates for a short period.

Recommended first version:

1. Add a "Look" button near the voice orb or chat input.
2. Capture a single screenshot when clicked.
3. Send the screenshot plus the user's current text/voice request to the assistant.
4. Do not store the screenshot by default.
5. Let the user explicitly say "remember this" if the visual context should become a memory.

Electron implementation notes:

- Prefer Electron's `desktopCapturer` for the desktop app.
- Keep the permission flow explicit.
- If multiple screens/windows are available, ask the user to choose.
- Avoid saving image files unless needed for upload/processing.
- If temporary files are needed, delete them after the request finishes.

Web implementation notes:

- Use `navigator.mediaDevices.getDisplayMedia` for browser screen capture.
- Capture one frame to canvas, then immediately stop the tracks.
- Clearly communicate that browser permission is controlled by the browser.

Backend/memory behavior:

- Add a source type like `screen_snapshot` only for request metadata.
- Do not add screenshots to `conversationMemories` automatically.
- If the user asks Vimi to remember the situation, save a text summary of what mattered, not the raw image by default.
- For sensitive content, Vimi should summarize only what is needed for the task.

Deliverables:

- Add frontend screen capture utility.
- Add Electron bridge method for one-time screen snapshot.
- Add request path that supports text plus image context.
- Add UI state showing when Vimi is using screen context.
- Add prompt rules for temporary visual context.
- Add explicit "remember this" behavior if user wants it saved.

---

## Phase 8 - Optional External App Hooks

This is not SDK/MCP and not a public platform. It is a small personal automation layer inspired by Omi's webhook idea.

Possible internal-only table:

```ts
automationHooks: defineTable({
  userId: v.id("users"),
  name: v.string(),
  trigger: v.union(
    v.literal("conversation_memory_created"),
    v.literal("task_created"),
    v.literal("reminder_created"),
  ),
  webhookUrl: v.string(),
  enabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});
```

Examples:

- Send every meeting summary to a private Notion endpoint.
- Send finance summaries to a spreadsheet endpoint.
- Send selected action items to another personal tool.

Keep this later. It is useful, but not needed before the memory model is strong.

Deliverables:

- Add personal webhook table.
- Add internal dispatcher with retries.
- Add per-hook enable/disable.
- Never expose public app marketplace behavior.

---

## Recommended Implementation Order

1. Add `conversationMemories` schema and persistence.
2. Extend planner output to create structured conversation memories.
3. Retrieve conversation memories semantically in planner context.
4. Add Memory Review UI.
5. Add controlled Meeting Mode.
6. Add suggested actions after Meeting Mode.
7. Add proactive nudges with strict controls.
8. Add on-demand screen help.
9. Add optional personal automation hooks.

Do not start with webhooks, SDKs, or continuous capture. The memory model should come first. On-demand screen help is useful, but it should stay explicit, temporary, and user-triggered.

---

## Acceptance Criteria

Vimi should pass these behavior checks:

- User can still fully control when Vimi listens.
- Vimi does not listen in the background.
- A meaningful voice conversation produces a structured memory.
- The memory includes a short title, overview, tags, and useful action items when present.
- Vimi can answer future questions using older relevant memories, not only recent chat.
- User can inspect and delete remembered conversations.
- Vimi does not create external/high-risk actions without approval.
- Meeting Mode is explicit and visibly active.
- Proactive suggestions can be disabled.
- Vimi can look at the screen only after explicit user action.
- One-time screen snapshots are not stored as long-term memory by default.

---

## Design Principles

- Explicit consent over ambient capture.
- Screen context is temporary unless the user asks Vimi to remember it.
- Memory should be useful, inspectable, and deletable.
- Actions should be grounded in user intent.
- Low-risk internal organization can be fast.
- External or irreversible actions need approval.
- Start personal and practical; avoid platform complexity.
