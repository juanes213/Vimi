# Vimi UI/UX Theme Plan - Omi Glass + Perplexity Space

## Context

Vimi already has a strong visual identity: dark galaxy background, purple/cyan accents, glass panels, a central voice orb, and an assistant-first dashboard layout.

The next direction should keep the sense of space and intelligence, but make the interface feel more refined, calm, and premium. The target is less "galaxy HUD" and more "glass operating system for a personal AI".

Inspiration:

- Omi: glassy mobile surfaces, soft depth, friendly memory-assistant framing, clean conversation/task/memory structure.
- Perplexity: restrained dark UI, teal/aqua identity, minimal chrome, focused input experience, high readability.
- Vimi: personal voice companion, desktop-first, elegant assistant presence, memory/action dashboard.

The result should feel like:

> A private AI cockpit made of layered glass, deep space neutrals, and precise teal light.

---

## What Changes

Current Vimi leans heavily into:

- Purple galaxy gradients.
- Starfield layers.
- Neon cyan/violet HUD treatment.
- Large glowing orb as the visual center.
- Dense dark panels with strong colored borders.
- Decorative background blooms.

The new theme should shift toward:

- Frosted glass surfaces over a deep near-black space background.
- Teal/aqua as the primary accent, inspired by Perplexity.
- Indigo/violet as a secondary atmospheric accent, not the dominant theme.
- Fewer literal stars and less sci-fi grid language.
- Cleaner information hierarchy.
- Softer but more realistic glass feel.
- More whitespace and calmer panels.
- A modern assistant workspace instead of a decorative space dashboard.

---

## Design Principles

- **Controlled depth:** use glass, blur, border highlights, and shadows to create layers.
- **Readable first:** text contrast and spacing matter more than glow effects.
- **Teal intelligence:** use teal/aqua for active, listening, selected, and primary action states.
- **Violet atmosphere:** keep violet/indigo only as background depth and occasional secondary accent.
- **Less literal galaxy:** reduce visible stars, grids, and decorative blobs.
- **Premium restraint:** fewer borders, fewer all-caps labels, less neon.
- **Assistant-centered:** Vimi remains the primary action surface, but the orb should feel polished, not game-like.
- **Personal OS:** memories, tasks, approvals, calendar, and chat should feel like parts of one private system.

---

## Visual Direction

### Palette

Replace the current purple-first palette with a neutral/teal/indigo palette.

Suggested CSS variables:

```css
:root {
  --bg: #050708;
  --bg-elevated: #0a0f12;
  --bg-soft: #0d1418;

  --glass-strong: rgba(13, 22, 26, 0.72);
  --glass-medium: rgba(16, 25, 30, 0.56);
  --glass-soft: rgba(255, 255, 255, 0.045);

  --border-strong: rgba(179, 255, 240, 0.18);
  --border-soft: rgba(255, 255, 255, 0.08);
  --border-muted: rgba(137, 160, 170, 0.12);

  --teal: #20e3c2;
  --teal-soft: rgba(32, 227, 194, 0.18);
  --teal-muted: rgba(32, 227, 194, 0.62);

  --aqua: #8defff;
  --indigo: #6674ff;
  --violet: #9b7cff;

  --ink: #eef8f6;
  --ink-muted: rgba(216, 235, 232, 0.72);
  --ink-faint: rgba(180, 204, 201, 0.48);

  --danger: #ff6b7a;
  --warning: #ffd166;
  --success: #20e3c2;
}
```

Usage:

- Background: near-black green/blue neutral.
- Primary accent: teal.
- Secondary accent: indigo/violet.
- Text: off-white with cool green tint.
- Panels: translucent charcoal, not purple.
- Borders: white/teal hairlines.

Avoid:

- Dominant purple surfaces.
- Heavy cyan neon everywhere.
- Pink/fuchsia for normal listening states.
- Large decorative blobs.

---

## Background System

Current `soft-galaxy` should become more like subtle deep-space glass:

- Base near-black background.
- Very soft radial depth from teal/indigo, barely visible.
- Optional subtle noise texture via CSS gradients.
- Very sparse star points, or remove starfield entirely on dashboard.
- Remove obvious grid overlay from the main background.
- Keep motion minimal.

Suggested direction:

```css
.space-glass-bg {
  background:
    radial-gradient(circle at 50% -20%, rgba(32, 227, 194, 0.10), transparent 32%),
    radial-gradient(circle at 85% 12%, rgba(102, 116, 255, 0.10), transparent 28%),
    linear-gradient(180deg, #071013 0%, #050708 50%, #030405 100%);
}
```

If stars remain:

- Lower opacity dramatically.
- Use fewer layers.
- Do not animate constantly.
- Treat stars as atmospheric texture, not the theme.

---

## Glass Surface System

The main visual upgrade should be surfaces.

Current panels are dark purple cards with colored borders. Replace them with frosted glass surfaces.

Surface levels:

1. **App shell glass:** sidebar, right panel, system bar.
2. **Primary glass:** chat panel, active assistant surface, memory summary panels.
3. **Secondary glass:** list items, approval rows, compact cards.
4. **Interactive glass:** buttons, chips, toggles, inputs.

Suggested classes:

```css
.glass-shell {
  background: rgba(7, 13, 16, 0.72);
  backdrop-filter: blur(28px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.36),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.glass-panel {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.075),
    rgba(255, 255, 255, 0.035)
  );
  backdrop-filter: blur(24px) saturate(1.25);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}

.glass-hairline {
  border-color: rgba(179, 255, 240, 0.16);
}
```

Radius guidance:

- Repeated list cards: 8px.
- Panels: 12px.
- App shell/nav: 14px max.
- Orb remains circular.

The goal is realistic glass, not bubbly glassmorphism.

---

## Typography

The current Cormorant + Outfit + DM Sans direction is elegant but slightly editorial/fantasy. For the Omi/Perplexity mix, move closer to product clarity.

Recommended typography:

- Primary UI/body: `Inter`, `DM Sans`, or `Geist`.
- Labels: same family, medium weight, small size.
- Display: avoid ornate serif for everyday UI. Keep a refined display only for the auth/landing moment if desired.

Recommended option:

```css
@import url("https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap");
```

Usage:

- App UI: Geist.
- Chat body: DM Sans or Geist.
- Headings: Geist 500/600.
- Avoid wide all-caps labels except for tiny system chips.

Tone:

- Less poetic.
- More precise.
- More modern.
- Still warm through copy, spacing, and motion.

---

## Layout Direction

Keep the current desktop app structure:

- Left sidebar.
- Main assistant/chat/work area.
- Right context panel.
- Bottom/system status can remain, but should be quieter.

Changes:

- Make the sidebar feel like a glass rail, not a sci-fi instrument strip.
- Reduce right panel visual weight.
- Increase main content width slightly for conversation and memory cards.
- Use fewer nested panels.
- Treat sections as glass sheets separated by spacing, not cards inside cards.

Suggested shell:

```tsx
<div className="space-glass-bg app-shell">
  <Sidebar className="glass-shell" />
  <main className="workspace">
    <SystemBar />
    <AssistantSurface />
  </main>
  <ContextPanel className="glass-shell" />
</div>
```

---

## Sidebar UX

Current sidebar can stay vertical, but visually soften it.

Changes:

- Background: translucent dark glass.
- Active indicator: small teal glow or thin left line.
- Icons: neutral by default, teal when active.
- Labels: less tracking, better readability.
- Remove strong violet stripe.
- Add a clear "Memory" destination when memory features are implemented.
- Add future "Look" action for screen help as an icon button, separated from nav.

Sidebar order:

1. Vimi
2. Memory
3. Tasks
4. Reminders
5. Events
6. Payments
7. Budgets

Optional utility zone:

- Look at screen.
- Settings.
- Profile/account.

---

## Assistant Surface

The assistant surface should be the hero of the app, but calmer.

Current orb:

- Large glowing galaxy sphere.
- Strong purple radial gradient.
- Decorative rings and corner brackets.

New direction:

- Glass orb or luminous teal lens.
- Less fuchsia/purple.
- Fewer rings.
- No corner brackets.
- State changes should be clear but elegant.

States:

- Idle: translucent glass sphere with subtle teal core.
- Listening: teal pulse and live audio waveform.
- Thinking: slow internal shimmer, small rotating highlight.
- Speaking: aqua wave/ripple.
- Screen context active: small glass badge with screen icon and teal border.
- Meeting mode: persistent top/session bar, not just orb animation.

Suggested orb feel:

```css
.voice-orb.is-idle {
  background:
    radial-gradient(circle at 34% 24%, rgba(255,255,255,0.92), rgba(255,255,255,0.16) 18%, transparent 36%),
    radial-gradient(circle at 50% 60%, rgba(32,227,194,0.28), rgba(102,116,255,0.18) 54%, rgba(255,255,255,0.04) 100%);
  border: 1px solid rgba(255,255,255,0.16);
  box-shadow:
    inset 0 1px 18px rgba(255,255,255,0.12),
    0 28px 90px rgba(32,227,194,0.12);
}
```

Interaction:

- Keep click-to-talk.
- Keep stop behavior.
- Add secondary actions near input, not around the orb:
  - Keyboard/send.
  - Look at screen.
  - Meeting mode.
  - Memory review.

---

## Chat UX

Move away from colorful bubbles as the main visual motif.

New direction:

- Messages as clean glass rows or subtle bubbles.
- User message: slightly brighter glass, right aligned.
- Vimi message: left aligned, very soft teal edge.
- Metadata: quiet, not too uppercase.
- Live assistant text should feel like streaming text inside a glass response, not a terminal.

Recommended changes:

- Use `max-width: 70ch` for long responses.
- Add timestamps only on hover or in faint metadata.
- Add action chips under assistant responses when tools ran:
  - `Created task`
  - `Checked calendar`
  - `Approval needed`
  - `Memory saved`
- Add memory badge when a message created memory.

Chat should become a history of useful moments, not only conversational bubbles.

---

## Input UX

Perplexity's strength is the focused input surface. Vimi should adopt that feeling.

Input should become a large glass command bar:

- Rounded 14px or 16px.
- One-line default, grows to two or three lines.
- Embedded action icons:
  - Mic.
  - Screen/look.
  - Meeting.
  - Send.
- Active mode indicator inside or above the input.
- Placeholder changes by context:
  - `Ask Vimi anything...`
  - `Tell Vimi what to remember...`
  - `Ask about what is on screen...`
  - `Meeting mode is recording...`

Avoid:

- A separate tiny send button that feels detached.
- Too many labels explaining features.
- Large instructional copy in the app.

---

## Memory UX

Since the memory plan is now central, the UI should prepare for it.

Add a Memory section later with:

- Timeline of memories.
- Search bar.
- Filters:
  - Conversations.
  - Facts about me.
  - Decisions.
  - Action items.
  - Screen notes.
- Memory cards with:
  - Title.
  - Summary.
  - Tags.
  - Source icon: voice, chat, meeting, screen.
  - Created date.
  - Actions: pin, disable, delete.

Visual style:

- Memory cards should be flatter than current panels.
- Use small teal source indicators.
- Use indigo only for secondary tags.
- Use glass hover states.

Card radius:

- 8px for repeated memory cards.
- 12px for the containing memory surface.

---

## Screen Context UX

Since Vimi should be able to look at the screen on demand, the UI needs a clear pattern.

Controls:

- Add a screen/look icon near the input.
- Tooltip: `Look at screen`.
- On click, capture one screenshot.
- Show a small preview chip: `Screen added`.
- Let the user remove it before sending.
- After response, discard visual context by default.

States:

- `Ready to look`
- `Capturing screen`
- `Screen added`
- `Screen context active`
- `Screen discarded`

Rules:

- No hidden screen capture.
- No persistent visual memory unless user asks.
- Visible state whenever screen context is attached.
- One screenshot first; live session later.

Visual treatment:

- Screen context chip should be glass with teal border.
- If the screenshot preview is shown, keep it small and unobtrusive.
- Do not create a large preview card unless the user expands it.

---

## Meeting Mode UX

Meeting Mode should feel distinct from normal listening.

Entry:

- Button/icon near input.
- Voice command can also start it.

Active state:

- Top glass session bar:
  - `Meeting mode`
  - elapsed time
  - transcript count or waveform
  - stop button
- Orb can show a quieter recording state.
- Keep the stop action obvious.

After stop:

- Generate a glass summary sheet:
  - Summary.
  - Decisions.
  - Action items.
  - Suggested reminders/events.
  - Save/delete controls.

Avoid:

- Hiding the recording state only in the orb.
- Making meeting mode look like always-listening.

---

## Right Context Panel

Current right panel includes today, mode, connected user, Google, approvals. Keep the function, soften the visuals.

New style:

- Glass shell with section dividers instead of many heavy nested cards.
- Top: compact profile/status.
- Middle: mode and active context.
- Bottom: integrations and approvals.

Suggested sections:

- `Now`
  - date
  - active mode
  - auto-listen state
- `Context`
  - screen attached
  - meeting active
  - memory retrieval active
- `Integrations`
  - Google status
- `Approvals`
  - pending approvals

UX improvement:

- Pending approvals should look actionable and serious.
- Use danger/warning only where needed.
- Approve/reject buttons should be clear, not just decorative.

---

## Feature Pages

Tasks, reminders, payments, budgets, and events should inherit the glass theme but become more practical.

General treatment:

- Less decorative headers.
- Compact list rows.
- 8px row radius.
- Clear empty states.
- Inline quick actions.
- Teal for completion/active.
- Amber/red for due/overdue/risk.

Tasks:

- Priority indicators.
- Due date chip.
- Source chip: manual, chat, voice, meeting.

Reminders:

- Delivery channel icons.
- Trigger time prominent.

Events:

- Calendar sync indicator.
- Today/upcoming grouping.

Payments/Budgets:

- More numeric hierarchy.
- Avoid heavy glass on each number.
- Use small sparklines/progress only if useful.

---

## Component Mapping

Files likely affected:

- `src/index.css`
- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ChatSection.tsx`
- `src/components/TasksSection.tsx`
- `src/components/RemindersSection.tsx`
- `src/components/PaymentsSection.tsx`
- `src/components/BudgetsSection.tsx`
- `src/components/EventsSection.tsx`
- `src/hooks/useVoiceChat.ts` if new UI state labels are needed.
- `src/hooks/useElectronBridge.ts` later for screen context UI.

CSS class migration:

- Keep existing class names where possible to reduce churn.
- Rename only when the concept changes:
  - `soft-galaxy` -> `space-glass-bg`
  - `panel-surface` can remain but become glass.
  - `panel-soft` can remain but become secondary glass.
  - `status-chip` can remain but become quieter.
  - Add `glass-shell`, `glass-panel`, `context-chip`, `mode-bar`.

---

## Implementation Phases

### Phase 1 - Visual Foundation

- Replace global color tokens.
- Replace background system.
- Add glass surface classes.
- Reduce starfield/grid intensity.
- Remove decorative blob backgrounds.
- Update typography.
- Restyle buttons, inputs, chips, scrollbars.

Acceptance:

- App immediately feels less purple and more teal/black glass.
- Existing pages still render without layout changes.
- Text contrast remains strong.

### Phase 2 - App Shell

- Restyle sidebar as glass rail.
- Restyle right context panel.
- Restyle system bar and status strip.
- Reduce nested cards.
- Add quiet section dividers.

Acceptance:

- Main shell feels unified.
- Navigation is readable.
- Context panel is useful without dominating the page.

### Phase 3 - Assistant Surface

- Redesign central orb into glass lens.
- Remove corner bracket treatment.
- Add calmer mode states.
- Restyle chat panel and input command bar.
- Add placeholders and icon slots for future screen/meeting actions.

Acceptance:

- Voice interaction remains obvious.
- Input feels like the primary command surface.
- The app feels more premium and less game-like.

### Phase 4 - Memory-Ready UI

- Add visual patterns for memory saved/retrieved.
- Add source chips.
- Add planned Memory nav item, even if hidden behind feature flag until backend exists.
- Create memory card visual spec.

Acceptance:

- UI has a clear place for future memory work.
- Chat/tool results can show when memory was saved.

### Phase 5 - Screen Context UI

- Add `Look at screen` icon/button.
- Add `Screen added` chip and removal control.
- Add screen-context active state.
- Add compact screenshot preview pattern.

Acceptance:

- User can always tell when screen context is attached.
- Screen context is visually temporary.

### Phase 6 - Meeting Mode UI

- Add meeting mode entry.
- Add active meeting bar.
- Add post-meeting summary sheet layout.
- Add suggested actions UI.

Acceptance:

- Meeting Mode cannot be confused with silent background listening.
- Summary and action extraction have a clear review surface.

### Phase 7 - Feature Page Polish

- Restyle tasks/reminders/events/payments/budgets with the new glass system.
- Add better dense list treatment.
- Replace remaining purple/galaxy hardcoded colors.
- Add consistent empty states.

Acceptance:

- Every page feels part of the same product.
- No old purple-heavy components remain.

---

## Motion

Motion should be quieter.

Keep:

- Small fade/slide on page changes.
- Subtle orb breathing.
- Listening waveform.
- Hover glass highlights.

Reduce/remove:

- Constant star drift.
- Aggressive ping rings.
- Spinning rings.
- Big glow pulses.

Motion principles:

- Movement should confirm state, not decorate.
- Listening/speaking can move.
- Idle should barely move.
- Respect `prefers-reduced-motion`.

---

## Accessibility And Usability

Checks required:

- Text contrast on glass surfaces.
- Focus rings visible on all buttons.
- Input usable at small widths.
- No text trapped inside tiny chips.
- Buttons maintain stable width.
- Hover states do not shift layout.
- Active listening, meeting, and screen states are visible without relying only on color.

Recommended:

- Add icon plus label for high-risk actions.
- Keep approve/reject buttons full text.
- Use `aria-label` for icon-only controls.
- Tooltips for mic, screen, meeting, memory actions.

---

## Out Of Scope

- Backend memory implementation.
- Screen capture implementation.
- New SDK/MCP/developer platform UI.
- Public marketplace.
- Wearable/device pairing UI.
- Full mobile redesign.
- Light theme.

This plan only defines the UI/UX direction and implementation order for the next visual system.

---

## Success Criteria

The redesign is successful if:

- Vimi feels more like a premium glass AI workspace than a neon galaxy dashboard.
- The app still feels personal and space-inspired.
- Teal/aqua becomes the primary active identity.
- Purple becomes atmospheric instead of dominant.
- The assistant orb feels elegant and tactile.
- The input feels central, modern, and Perplexity-like.
- Memory, meeting mode, and screen context all have clear future homes in the UI.
- The user can always tell when Vimi is listening, looking, thinking, or speaking.

