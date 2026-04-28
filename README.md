# Vimi

Vimi is a personal life assistant built around voice, memory, and practical execution.

The project explores a simple idea: an assistant should not only chat. It should help you organize your life, remember useful context, and turn intent into concrete actions such as tasks, reminders, calendar events, and email workflows.

Vimi is currently a private/personal project, not an open-source assistant platform.

## Scope

Vimi is designed to be:

- A voice-first personal assistant.
- A desktop and web app for daily organization.
- A memory-aware assistant that can remember preferences, goals, routines, and useful context over time.
- An action-oriented agent that can create tasks, reminders, events, drafts, and calendar updates.
- A controlled assistant: the user decides when Vimi listens or acts.


Future work may include on-demand screen help and meeting/session summaries, but those features should stay explicit, user-triggered, and privacy-conscious.

## Current Capabilities

### Voice Interaction

- Microphone recording from the browser/Electron app.
- Silence detection to finalize a spoken request.
- Speech-to-text using ElevenLabs STT.
- Streaming assistant responses from the Convex HTTP API.
- Text-to-speech using ElevenLabs TTS.
- Voice interruption while Vimi is speaking.
- Auto-listen mode after Vimi finishes responding.

### Personal Organization

Vimi includes dedicated sections for:

- Tasks
- Reminders
- Events
- Recurring payments
- Budgets
- Chat history
- Pending approvals

### Agent Tools

The assistant can call internal and external tools, including:

- Create internal tasks.
- Create internal reminders.
- Create internal events.
- Search Gmail.
- Read Gmail threads.
- Create Gmail drafts.
- Send Gmail messages with approval.
- List Google Calendar events.
- Create and update Google Calendar events.

High-risk actions can require explicit approval before execution.

### Memory

Vimi has early memory infrastructure:

- User profile fields for biography, preferences, goals, routines, communication style, and timezone.
- User memory notes with tags, confidence, and optional embeddings.
- Semantic memory retrieval using OpenAI embeddings when configured.
- Rolling session summaries for older chat history.

The next planned step is structured conversation memory: complete conversation/session records with summaries, decisions, action items, and retrievable context.

### Integrations

Current external integration:

- Google OAuth
- Gmail
- Google Calendar

Google tokens are stored in Convex and encrypted by the app's token storage layer.

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Convex backend
- Convex Auth
- Electron desktop shell
- ElevenLabs STT/TTS
- Groq-compatible OpenAI chat API endpoint for planning
- OpenAI embeddings for semantic memory

## Project Structure

```text
src/
  components/        React UI sections and shared components
  hooks/             Voice, TTS, VAD, Electron bridge hooks
  lib/               Frontend utilities and theme helpers
  App.tsx            Main app shell
  main.tsx           React/Convex entry point

convex/
  chat.ts            Agent loop, streaming chat, memory persistence
  chat/              Prompts, tool registry, types, utilities
  schema.ts          Convex data model
  integrations.ts    Google OAuth integration
  reminders.ts       Reminder delivery logic
  tasks.ts           Task CRUD
  events.ts          Event CRUD
  budgets.ts         Budget CRUD
  recurringPayments.ts

electron/
  main.cjs           Electron main process
  preload.cjs        Safe renderer bridge
```

## Environment Variables

Frontend:

```env
VITE_CONVEX_URL=
VITE_ELEVENLABS_API_KEY=
VITE_ELEVENLABS_VOICE_ID=
VITE_ELEVENLABS_MODEL=
```

Convex/backend:

```env
GROQ_BASE_URL=
GROQ_API_KEY=
VIMI_PLANNER_MODEL=
OPENAI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
TOKEN_ENCRYPTION_KEY=
```

Notes:

- `OPENAI_API_KEY` is used for embeddings. If it is missing, Vimi should still work, but semantic memory retrieval falls back to recency-based memory.
- `VITE_ELEVENLABS_API_KEY` is required for voice transcription and speech playback.
- Google integration requires the Google OAuth variables.

## Development

Install dependencies:

```bash
npm install
```

Run frontend, Convex, and Electron together:

```bash
npm run dev
```

Run web frontend and Convex only:

```bash
npm run dev:web
```

Build the web app:

```bash
npm run build
```

Build the Windows Electron app:

```bash
npm run dist
```

Run the project checks:

```bash
npm run lint
```

## Current Product Direction

The core product direction is:

1. Keep listening explicit and user-controlled.
2. Make voice interaction feel natural and interruptible.
3. Strengthen memory so Vimi can remember context over time.
4. Convert conversations into useful actions and follow-up.
5. Keep approvals clear for risky external actions.
6. Improve the UI into a calm, glass-like personal AI workspace.

## Planned Work

Near-term plans are documented under `docs/superpowers/plans/`.

Current planning themes:

- Structured conversation memory.
- Memory review and deletion controls.
- Controlled meeting mode.
- On-demand screen help.
- UI/UX refinement around glassmorphism and state-driven tones.
- A more elegant animated assistant presence/orb.

These are plans, not all shipped features.

## Privacy and Control Principles

Vimi should be personal and useful without becoming invasive.

- Vimi should not always listen.
- Vimi should not silently capture screen context.
- External/high-risk actions should be clear and approval-driven.
- Memories should become inspectable and deletable.
- Screen help, when implemented, should be on-demand and temporary by default.

## Status

Vimi is under active development. The app already supports voice chat, internal organization tools, Google integration, action approvals, and early semantic memory. The larger memory/session platform and on-demand screen workflows are still in planning or early implementation.

