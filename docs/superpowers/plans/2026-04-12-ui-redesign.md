# Vimi UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Vimi's generic glass-morphism aesthetic with a futuristic-elegant design — deep purple base, neon cyan + electric violet accents, vertical sidebar, and Cormorant Garamond + Outfit + DM Sans typography.

**Architecture:** Pure CSS and JSX restyling — zero backend, data, or feature changes. Existing class names in JSX are preserved wherever possible; their CSS bodies are rewritten in-place in `src/index.css`. The `Sidebar` component is rewritten from a bottom dock to a 64px vertical icon rail and wired into `App.tsx`, which gets a new `flex h-screen` layout with a system bar and status strip.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, vanilla CSS (`src/index.css`), Google Fonts (Cormorant Garamond, Outfit, DM Sans), Vite dev server

---

## File Map

| File | Type | What changes |
|---|---|---|
| `src/index.css` | Modify | Full overhaul: fonts, CSS variables, all class rewrites, new `.hud-label` |
| `src/components/Sidebar.tsx` | Modify | Rewrite `Sidebar` component → 64px vertical icon rail; keep `SECTION_DETAILS` + `Section` exports |
| `src/App.tsx` | Modify | Layout restructure (flex h-screen), add `SystemBar` + `StatusStrip`, use `<Sidebar>`, update `VimiPage` + `MiniOrbLauncher` + `SideInfoPanel` |
| `src/components/ChatSection.tsx` | Modify | Add header row, restyle bubbles and metadata |
| `src/components/TasksSection.tsx` | Modify | Update inline Tailwind color tokens on toggle button |
| `src/components/RemindersSection.tsx` | Modify | Update inline Tailwind color tokens on toggle button |
| `src/SignInForm.tsx` | Modify | Fix hardcoded stone/white color tokens |

---

## Task 1: CSS Foundation

**Files:**
- Modify: `src/index.css`

This is the highest-leverage task. Updating class bodies in-place immediately reskins every panel, button, input, and chip across the entire app.

- [ ] **Step 1: Replace the entire contents of `src/index.css`**

```css
/* ─── FONTS ──────────────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Outfit:wght@200;300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ─── VARIABLES ───────────────────────────────────────────────────────── */
:root {
  --bg:          #05020f;
  --bg2:         #080514;
  --panel:       rgba(18, 8, 42, 0.9);
  --panel2:      rgba(12, 5, 30, 0.76);
  --border:      rgba(0, 255, 180, 0.1);
  --border-v:    rgba(120, 80, 255, 0.18);
  --cyan:        #00ffb8;
  --cyan-dim:    rgba(0, 255, 184, 0.55);
  --violet:      #8c5fff;
  --violet-dim:  rgba(140, 95, 255, 0.5);
  --ink:         #e4e0ff;
  --ink2:        rgba(170, 150, 230, 0.7);
  --ink3:        rgba(100, 85, 160, 0.55);
  /* legacy aliases kept for Tailwind inline refs */
  --page-ink:    #e4e0ff;
  --page-muted:  rgba(170, 150, 230, 0.7);
  --panel-border: rgba(120, 80, 255, 0.18);
  --panel-shadow: rgba(3, 0, 14, 0.5);
}

/* ─── BASE ────────────────────────────────────────────────────────────── */
html {
  background: var(--bg);
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background: transparent;
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
  font-weight: 300;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-weight: 300;
  letter-spacing: -0.01em;
}

button, input, textarea, select {
  font: inherit;
}

::selection {
  background: rgba(149, 109, 255, 0.24);
  color: #ffffff;
}

/* ─── BACKGROUND ──────────────────────────────────────────────────────── */
.soft-galaxy {
  background:
    radial-gradient(circle at 50% 16%, rgba(91, 54, 188, 0.35), transparent 18%),
    radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 0.05), transparent 14%),
    radial-gradient(circle at 82% 20%, rgba(115, 173, 255, 0.1),  transparent 20%),
    radial-gradient(circle at 72% 80%, rgba(227, 104, 255, 0.08), transparent 20%),
    linear-gradient(180deg, #080414 0%, #05020f 45%, #040110 100%);
}

/* subtle HUD grid overlay — apply to any relative container */
.hud-grid-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(0, 255, 180, 0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 180, 0.022) 1px, transparent 1px);
  background-size: 48px 48px;
}

/* ─── STARFIELD ───────────────────────────────────────────────────────── */
.starfield {
  opacity: 0.55;
  background-repeat: repeat;
  will-change: opacity;
}

.starfield-near {
  background-image:
    radial-gradient(circle, rgba(255, 255, 255, 0.82) 0 0.8px, transparent 1px),
    radial-gradient(circle, rgba(182, 197, 255, 0.5)  0 0.7px, transparent 0.95px);
  background-size: 150px 150px, 220px 220px;
  background-position: 0 0, 40px 70px;
  animation: twinkleDrift 16s ease-in-out infinite;
}

.starfield-far {
  opacity: 0.3;
  background-image:
    radial-gradient(circle, rgba(255, 255, 255, 0.75) 0 0.65px, transparent 0.95px),
    radial-gradient(circle, rgba(236, 184, 255, 0.42) 0 0.55px, transparent 0.9px);
  background-size: 240px 240px, 320px 320px;
  background-position: 20px 35px, 110px 120px;
  animation: twinkleDriftSlow 22s ease-in-out infinite;
}

/* ─── PANELS ──────────────────────────────────────────────────────────── */
.panel-surface {
  @apply rounded-2xl border backdrop-blur-xl;
  border-color: var(--border-v);
  background: linear-gradient(160deg, rgba(18, 8, 42, 0.92) 0%, rgba(10, 5, 26, 0.84) 100%);
  box-shadow:
    0 24px 64px rgba(3, 0, 14, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  position: relative;
  overflow: hidden;
}

.panel-surface::before {
  content: '';
  position: absolute;
  top: 0; left: 15%; right: 15%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(120, 80, 255, 0.28), transparent);
  pointer-events: none;
}

.panel-soft {
  @apply rounded-2xl border backdrop-blur-lg;
  border-color: var(--border-v);
  background: linear-gradient(160deg, rgba(14, 6, 34, 0.84) 0%, rgba(8, 4, 22, 0.74) 100%);
  box-shadow:
    0 12px 32px rgba(3, 0, 14, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
  position: relative;
  overflow: hidden;
}

.panel-soft::before {
  content: '';
  position: absolute;
  top: 0; left: 15%; right: 15%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(120, 80, 255, 0.2), transparent);
  pointer-events: none;
}

/* ─── HUD LABEL ───────────────────────────────────────────────────────── */
/* Usage: <p className="hud-label">Today</p> */
.hud-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Outfit', sans-serif;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(0, 255, 180, 0.55);
}

.hud-label::before {
  content: '';
  display: inline-block;
  flex-shrink: 0;
  width: 14px;
  height: 1px;
  background: linear-gradient(90deg, rgba(0, 255, 180, 0.5), transparent);
}

/* ─── STATUS CHIP ─────────────────────────────────────────────────────── */
.status-chip {
  @apply inline-flex items-center rounded-full border px-3 py-1;
  font-family: 'Outfit', sans-serif;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  border-color: rgba(120, 80, 255, 0.22);
  background: rgba(120, 80, 255, 0.06);
  color: rgba(180, 150, 255, 0.75);
}

/* ─── INPUT ───────────────────────────────────────────────────────────── */
.surface-input {
  @apply w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all;
  border-color: rgba(120, 80, 255, 0.2);
  background: rgba(8, 4, 22, 0.8);
  color: var(--ink);
  font-family: 'DM Sans', sans-serif;
  font-weight: 300;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.surface-input::placeholder {
  color: var(--ink3);
}

.surface-input:focus {
  border-color: rgba(0, 255, 180, 0.35);
  box-shadow:
    0 0 0 3px rgba(0, 255, 180, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

/* ─── BUTTONS ─────────────────────────────────────────────────────────── */
.primary-button {
  @apply inline-flex items-center justify-center rounded-full px-5 py-2.5 transition-all disabled:cursor-not-allowed disabled:opacity-40;
  font-family: 'Outfit', sans-serif;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(0, 255, 180, 0.9);
  background: rgba(0, 255, 180, 0.08);
  border: 1px solid rgba(0, 255, 180, 0.28);
  box-shadow: 0 0 20px rgba(0, 255, 180, 0.04);
}

.primary-button:hover:not(:disabled) {
  background: rgba(0, 255, 180, 0.13);
  box-shadow: 0 0 28px rgba(0, 255, 180, 0.1);
  transform: translateY(-1px);
}

.secondary-button {
  @apply inline-flex items-center justify-center rounded-full border px-5 py-2.5 transition-all;
  font-family: 'Outfit', sans-serif;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border-color: rgba(120, 80, 255, 0.24);
  background: rgba(120, 80, 255, 0.07);
  color: rgba(180, 150, 255, 0.8);
}

.secondary-button:hover {
  background: rgba(120, 80, 255, 0.13);
  color: rgba(210, 190, 255, 0.9);
}

/* auth aliases */
.auth-input-field { @apply surface-input; }
.auth-button      { @apply primary-button w-full; }

/* ─── FLOATING ORB ────────────────────────────────────────────────────── */
.floating-orb {
  animation: floatOrb 9s ease-in-out infinite;
}

.glow-pulse {
  animation: pulseGlow 10s ease-in-out infinite;
}

/* ─── FADE RISE ───────────────────────────────────────────────────────── */
.fade-rise {
  animation: fadeRise 0.75s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.delay-1 { animation-delay: 0.12s; }
.delay-2 { animation-delay: 0.22s; }

/* ─── GALAXY ORB IDLE ─────────────────────────────────────────────────── */
.galaxy-orb-idle {
  background:
    radial-gradient(circle at 34% 28%,
      rgba(230, 215, 255, 0.97),
      rgba(150, 100, 255, 0.9) 38%,
      rgba(80, 35, 180, 0.93) 65%,
      rgba(30, 10, 80, 0.98) 100%);
  box-shadow:
    0 0 0 1px rgba(180, 150, 255, 0.15),
    0 20px 60px rgba(120, 80, 255, 0.3),
    0 0 80px rgba(0, 255, 180, 0.06);
}

/* ─── VOICE ORB ───────────────────────────────────────────────────────── */
.voice-orb {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.voice-orb.is-idle {
  background:
    radial-gradient(circle at 34% 28%,
      rgba(230, 215, 255, 0.97),
      rgba(150, 100, 255, 0.9) 38%,
      rgba(80, 35, 180, 0.93) 65%,
      rgba(30, 10, 80, 0.98) 100%);
  box-shadow:
    0 0 0 1px rgba(180, 150, 255, 0.15),
    0 28px 90px rgba(100, 65, 255, 0.3),
    0 0 120px rgba(0, 255, 180, 0.06);
}

.voice-orb.is-listening {
  background:
    radial-gradient(circle at 34% 28%,
      rgba(255, 255, 255, 0.95),
      rgba(255, 172, 226, 0.94) 28%,
      rgba(237, 77, 161, 0.92) 58%,
      rgba(94, 22, 95, 0.98) 100%);
  box-shadow:
    0 28px 90px rgba(236, 86, 180, 0.32),
    0 0 110px rgba(255, 143, 206, 0.1);
  animation: orbListen 1.2s ease-in-out infinite;
}

.voice-orb.is-speaking {
  background:
    radial-gradient(circle at 34% 28%,
      rgba(255, 255, 255, 0.95),
      rgba(168, 241, 255, 0.92) 26%,
      rgba(88, 182, 255, 0.88) 56%,
      rgba(15, 71, 124, 0.98) 100%);
  box-shadow:
    0 28px 90px rgba(66, 181, 255, 0.28),
    0 0 120px rgba(0, 255, 180, 0.08);
  animation: orbSpeak 1.6s ease-in-out infinite;
}

.voice-orb.is-thinking {
  background:
    radial-gradient(circle at 34% 28%,
      rgba(230, 215, 255, 0.97),
      rgba(150, 100, 255, 0.9) 38%,
      rgba(80, 35, 180, 0.93) 65%,
      rgba(30, 10, 80, 0.98) 100%);
  box-shadow:
    0 28px 90px rgba(140, 95, 255, 0.3),
    0 0 120px rgba(180, 130, 255, 0.1);
  animation: orbThink 1.4s linear infinite;
}

/* ─── VOICE BARS / DOTS ───────────────────────────────────────────────── */
.voice-bar {
  display: inline-block;
  width: 3px;
  margin: 0 2px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  transform-origin: center;
  transition: height 80ms ease-out;
}

.voice-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(240, 239, 255, 0.75);
  display: inline-block;
  animation: dotBounce 1.3s ease-in-out infinite;
}

.voice-dot:nth-child(2) { animation-delay: 0.15s; }
.voice-dot:nth-child(3) { animation-delay: 0.30s; }

/* ─── SCROLLBAR ───────────────────────────────────────────────────────── */
::-webkit-scrollbar       { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(120, 80, 255, 0.25);
  border-radius: 999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(140, 95, 255, 0.42);
}

/* ─── ANIMATIONS ──────────────────────────────────────────────────────── */
@keyframes fadeRise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes floatOrb {
  0%, 100% { transform: translateY(0) scale(1); }
  50%       { transform: translateY(-8px) scale(1.02); }
}

@keyframes pulseGlow {
  0%, 100% { transform: scale(1); opacity: 0.94; }
  50%       { transform: scale(1.04); opacity: 1; }
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.7; box-shadow: 0 0 6px var(--cyan); }
  50%       { opacity: 1;   box-shadow: 0 0 14px var(--cyan), 0 0 28px rgba(0,255,180,0.25); }
}

@keyframes twinkleDrift {
  0%, 100% { opacity: 0.44; transform: translate3d(0, 0, 0); }
  50%       { opacity: 0.62; transform: translate3d(-4px, 3px, 0); }
}

@keyframes twinkleDriftSlow {
  0%, 100% { opacity: 0.22; transform: translate3d(0, 0, 0); }
  50%       { opacity: 0.36; transform: translate3d(3px, -2px, 0); }
}

@keyframes orbListen {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.06); }
}

@keyframes orbSpeak {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.035); }
}

@keyframes orbThink {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50%       { transform: scale(1.03) rotate(3deg); }
}

@keyframes dotBounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
  40%            { transform: translateY(-4px); opacity: 1; }
}
```

- [ ] **Step 2: Start dev server and verify the app renders**

```bash
npm run dev
```

Open `http://localhost:5173` (or whatever port Vite picks). Expected: app loads, fonts change to DM Sans/Cormorant, panels have violet borders, buttons are cyan-tinted. No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: CSS foundation — Cormorant + Outfit + DM Sans, violet/cyan palette"
```

---

## Task 2: Sidebar — Vertical Icon Rail

**Files:**
- Modify: `src/components/Sidebar.tsx`

Rewrite the `Sidebar` component only. Keep `SECTION_DETAILS`, `Section` type, and all icon components — they are imported by `App.tsx`.

- [ ] **Step 1: Replace the `Sidebar` function (lines 101–151) with the new vertical rail**

Replace from `export function Sidebar(` through the closing `}` with:

```tsx
export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="relative z-10 flex h-screen w-16 shrink-0 flex-col items-center border-r border-[rgba(120,80,255,0.18)] bg-gradient-to-b from-[rgba(14,6,36,0.97)] to-[rgba(10,4,28,0.97)] py-5">
      {/* right-edge gradient line */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[rgba(120,80,255,0.35)] to-transparent" />

      {/* Logo orb */}
      <div
        className="mb-4 h-9 w-9 shrink-0 rounded-[11px] border border-[rgba(180,150,255,0.2)]"
        style={{
          background: "radial-gradient(circle at 34% 28%, rgba(220,200,255,0.95), rgba(140,90,255,0.88) 45%, rgba(42,14,110,0.97) 100%)",
          boxShadow: "0 0 20px rgba(120,80,255,0.35), 0 4px 16px rgba(0,0,0,0.5)",
        }}
      />

      {/* Nav items */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon as ComponentType<SVGProps<SVGSVGElement>>;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              title={item.label}
              className={cn(
                "group relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200",
                isActive
                  ? "border border-[rgba(0,255,180,0.18)] bg-[rgba(0,255,180,0.07)]"
                  : "hover:bg-[rgba(120,80,255,0.08)]",
              )}
            >
              {/* active left indicator */}
              {isActive && (
                <span
                  className="absolute -left-[9px] top-1/4 h-1/2 w-0.5 rounded-r-full"
                  style={{
                    background: "var(--cyan)",
                    boxShadow: "0 0 8px var(--cyan), 0 0 16px rgba(0,255,180,0.3)",
                    animation: "glowPulse 3s ease-in-out infinite",
                  }}
                />
              )}
              <Icon
                className="h-4 w-4"
                style={{ color: isActive ? "var(--cyan)" : "rgba(140,120,200,0.45)" }}
              />
              <span
                className="text-[7px] font-['Outfit'] font-normal tracking-[0.1em] uppercase leading-none"
                style={{ color: isActive ? "rgba(0,255,180,0.65)" : "rgba(100,85,160,0.5)" }}
              >
                {item.dockLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom: status + avatar */}
      <div className="flex flex-col items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--cyan)", boxShadow: "0 0 6px var(--cyan)" }}
        />
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(120,80,255,0.3)] text-[11px] font-['Outfit']"
          style={{
            background: "linear-gradient(135deg, rgba(120,80,255,0.5), rgba(60,30,140,0.8))",
            color: "rgba(200,180,255,0.9)",
            boxShadow: "0 0 12px rgba(120,80,255,0.2)",
          }}
        >
          V
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify `ComponentType` and `SVGProps` are imported at the top**

`src/components/Sidebar.tsx` line 1 should already have:
```tsx
import type { ComponentType, SVGProps } from "react";
```
If not, add it.

- [ ] **Step 3: Start dev server and verify sidebar component renders in isolation**

The sidebar won't appear in the app yet (App.tsx still uses its own nav). We'll wire it in Task 3. Just confirm no TypeScript errors with:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: vertical icon sidebar with cyan active indicator"
```

---

## Task 3: App.tsx — Layout Restructure

**Files:**
- Modify: `src/App.tsx`

Replace the top-nav + grid layout with the sidebar-driven `flex h-screen` structure. Also adds `SystemBar` and `StatusStrip` helper components at the bottom of the file.

- [ ] **Step 1: Add `Sidebar` to the App.tsx import**

Line 10 currently reads:
```tsx
import { SECTION_DETAILS, type Section } from "./components/Sidebar";
```
Change to:
```tsx
import { Sidebar, SECTION_DETAILS, type Section } from "./components/Sidebar";
```

- [ ] **Step 2: Replace the `Dashboard` return JSX**

Find the `return (` in `Dashboard()` (around line 244). Replace the entire return block with:

```tsx
  return (
    <div className="soft-galaxy hud-grid-bg relative flex h-screen overflow-hidden">
      <BackgroundEffects />

      <Sidebar active={activePage} onChange={setActivePage} />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <SystemBar today={today} activeMode={voice.activeMode} activePage={activePage} />

        <div className="flex flex-1 overflow-hidden">
          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="fade-rise mx-auto w-full max-w-3xl">
              {activePage === "chat" ? (
                <VimiPage voice={voice} orbStyle={orbStyle} />
              ) : (
                <FeaturePage section={activePage} />
              )}
            </div>
          </main>

          <SideInfoPanel
            activeDetail={activeDetail}
            activeMode={voice.activeMode}
            autoListen={voice.autoListen}
            onToggleAutoListen={() => voice.setAutoListen((value) => !value)}
            today={today}
            userName={userName}
            googleIntegration={googleIntegration}
            pendingApprovals={pendingApprovals}
            onConnectGoogle={handleConnectGoogle}
            onDisconnectGoogle={handleDisconnectGoogle}
            onApprove={handleApprove}
            onReject={handleReject}
            isElectron={electron.isElectron}
            getAutoStart={electron.getAutoStart}
            setAutoStart={electron.setAutoStart}
          />
        </div>

        <StatusStrip />
      </div>

      <MiniOrbLauncher mode={voice.activeMode} onClick={launchVimi} />
    </div>
  );
```

- [ ] **Step 3: Update `SideInfoPanel` component wrapper**

Find `function SideInfoPanel(` and its `return (`. Replace the outer `<aside>` wrapper:

```tsx
  return (
    <aside className="fade-rise delay-1 flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-[rgba(120,80,255,0.14)] bg-gradient-to-b from-[rgba(14,6,36,0.9)] to-[rgba(8,4,22,0.85)] px-3.5 py-4">
      <div className="flex flex-col gap-3">
```

And close with `</div></aside>` instead of the current `</div></aside>`.

Then update each card inside `SideInfoPanel` from `<div className="panel-soft p-5">` to `<div className="panel-soft p-4">` for tighter right-panel spacing.

Replace the label `<p className="text-xs uppercase tracking-[0.22em] text-slate-500">` pattern inside each card with `<p className="hud-label">`. There are 5 such labels: "Today", "Current mode", "Connected", "Google", "Pending approvals".

- [ ] **Step 4: Add `SystemBar` helper at bottom of App.tsx** (before the last `}`)

```tsx
function SystemBar({
  today,
  activeMode,
  activePage,
}: {
  today: string;
  activeMode: VoiceMode;
  activePage: Section;
}) {
  const detail = SECTION_DETAILS[activePage];
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-[rgba(120,80,255,0.12)] bg-[rgba(5,2,15,0.72)] px-5">
      <div className="flex items-center gap-2">
        <span className="font-['Outfit'] text-[10px] uppercase tracking-[0.2em] text-[rgba(100,85,160,0.55)]">
          Vimi
        </span>
        <span className="text-[10px] text-[rgba(0,255,180,0.25)]">›</span>
        <span className="font-['Outfit'] text-[10px] uppercase tracking-[0.2em] text-[rgba(0,255,180,0.65)]">
          {detail.eyebrow}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="status-chip">{activeMode}</span>
        <span className="font-['Outfit'] text-[10px] text-[rgba(100,85,160,0.5)]">{today}</span>
      </div>
    </div>
  );
}

function StatusStrip() {
  return (
    <div className="flex h-7 shrink-0 items-center gap-5 border-t border-[rgba(0,255,180,0.06)] bg-[rgba(3,1,10,0.88)] px-5">
      {[
        { color: "var(--cyan)",   label: "Vimi online" },
        { color: "var(--violet)", label: "Convex connected" },
        { color: "var(--cyan)",   label: "TTS ready" },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 4px ${color}` }}
          />
          <span className="font-['Outfit'] text-[9px] uppercase tracking-[0.1em] text-[rgba(100,85,160,0.48)]">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Visual check in browser**

Open `http://localhost:5173`. Expected:
- Vertical sidebar on the left with violet border
- System bar at top with breadcrumb
- Status strip at bottom
- Right info panel with `hud-label` style labels
- No horizontal nav visible

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: flex h-screen layout with sidebar, system bar, status strip"
```

---

## Task 4: VimiPage — Orb and Typography

**Files:**
- Modify: `src/App.tsx` — `VimiPage`, `CentralOrb`, `MiniOrbLauncher`, `TextInput`

- [ ] **Step 1: Replace `VimiPage` function body**

```tsx
function VimiPage({
  voice,
  orbStyle,
}: {
  voice: ReturnType<typeof useVoiceChat>;
  orbStyle: CSSProperties;
}) {
  return (
    <div className="flex flex-col items-center gap-6 pt-2 text-center">
      {/* Orb */}
      <div className="fade-rise delay-1">
        <CentralOrb
          mode={voice.activeMode}
          level={voice.micLevel}
          orbStyle={orbStyle}
          onClick={voice.activeMode === "idle" ? voice.startListening : voice.stopAll}
        />
      </div>

      {/* Title */}
      <div className="fade-rise delay-2 max-w-lg">
        <p className="font-['Outfit'] text-[10px] uppercase tracking-[0.26em] text-[rgba(0,255,180,0.55)]">
          Vimi · Presence Mode
        </p>
        <h1 className="mt-3 text-4xl leading-tight text-white sm:text-5xl">
          Your life,{" "}
          <em className="not-italic text-[rgba(200,180,255,0.85)]">your orbit.</em>
        </h1>
        <p className="mt-4 font-['DM_Sans'] text-sm font-light leading-7 text-[rgba(100,85,160,0.7)]">
          {voice.activeMode === "idle"     && "Tap the orb to talk with Vimi"}
          {voice.activeMode === "listening" && "Listening — speak naturally"}
          {voice.activeMode === "thinking"  && "Vimi is thinking…"}
          {voice.activeMode === "speaking"  && "Vimi is speaking. Tap or talk to interrupt."}
        </p>
      </div>

      {(voice.activeMode === "speaking" || voice.activeMode === "thinking") && (
        <button type="button" onClick={voice.stopAll} className="secondary-button !px-5 !py-2 text-xs">
          Stop
        </button>
      )}

      {/* Transcript + input */}
      <div className="fade-rise delay-2 w-full">
        <div className="panel-soft overflow-hidden" style={{ height: "clamp(200px, 30vh, 360px)" }}>
          {/* panel header */}
          <div className="flex items-center justify-between border-b border-[rgba(120,80,255,0.1)] px-4 py-2.5">
            <span className="hud-label">Conversation</span>
          </div>
          <ChatTranscript liveAssistant={voice.liveAssistant} activeMode={voice.activeMode} />
        </div>
        <TextInput onSend={voice.interruptAndSend} disabled={voice.activeMode === "thinking"} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `CentralOrb` to add concentric rings and corner brackets**

```tsx
function CentralOrb({
  mode,
  level,
  orbStyle,
  onClick,
}: {
  mode: VoiceMode;
  level: number;
  orbStyle: CSSProperties;
  onClick: () => void;
}) {
  return (
    /* Corner-bracket frame */
    <div className="relative inline-flex items-center justify-center p-8">
      {/* corner brackets */}
      {(["tl","tr","bl","br"] as const).map((corner) => (
        <span
          key={corner}
          className="absolute"
          style={{
            top:    corner.startsWith("t") ? 0 : "auto",
            bottom: corner.startsWith("b") ? 0 : "auto",
            left:   corner.endsWith("l")   ? 0 : "auto",
            right:  corner.endsWith("r")   ? 0 : "auto",
            width: 16, height: 16,
            borderColor: "rgba(0,255,180,0.35)",
            borderStyle: "solid",
            borderWidth: corner === "tl" ? "1.5px 0 0 1.5px"
                       : corner === "tr" ? "1.5px 1.5px 0 0"
                       : corner === "bl" ? "0 0 1.5px 1.5px"
                       :                   "0 1.5px 1.5px 0",
          }}
        />
      ))}

      {/* outer ring */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full border border-[rgba(0,255,180,0.07)]"
        style={{ animation: "orbThink 12s linear infinite" }}
      />
      {/* mid dashed ring */}
      <span
        className="pointer-events-none absolute inset-4 rounded-full border border-dashed border-[rgba(120,80,255,0.18)]"
        style={{ animation: "orbThink 20s linear infinite reverse" }}
      />

      <button
        type="button"
        onClick={onClick}
        aria-label={mode === "idle" ? "Talk to Vimi" : "Stop"}
        className={cn(
          "voice-orb relative h-32 w-32 cursor-pointer border-none outline-none transition-transform duration-300 active:scale-95 sm:h-36 sm:w-36",
          mode === "idle"      && "is-idle floating-orb",
          mode === "listening" && "is-listening",
          mode === "thinking"  && "is-thinking",
          mode === "speaking"  && "is-speaking",
        )}
        style={mode === "idle" ? orbStyle : undefined}
      >
        <div className="absolute inset-[-8%] rounded-full border border-[rgba(255,255,255,0.07)] bg-white/[0.015] blur-sm" />
        <div className="absolute inset-[14%] rounded-full border border-[rgba(255,255,255,0.14)] bg-white/[0.04] backdrop-blur-sm" />
        <div className="absolute inset-[30%] rounded-full border border-[rgba(255,255,255,0.12)] bg-white/[0.03]" />

        <div className="absolute inset-0 flex items-center justify-center">
          {mode === "idle" && (
            <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-white" strokeWidth="1.6" stroke="currentColor">
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
            </svg>
          )}
          {mode === "listening" && <OrbAudioBars level={level} />}
          {mode === "thinking"  && (
            <span className="flex gap-2">
              <span className="voice-dot !h-2.5 !w-2.5" />
              <span className="voice-dot !h-2.5 !w-2.5" />
              <span className="voice-dot !h-2.5 !w-2.5" />
            </span>
          )}
          {mode === "speaking" && <OrbSpeakingWave />}
        </div>

        {mode !== "idle" && (
          <div
            className={cn(
              "absolute inset-0 rounded-full",
              mode === "listening" && "animate-ping opacity-15 ring-4 ring-fuchsia-300/60",
              mode === "speaking"  && "animate-ping opacity-12 ring-4 ring-cyan-300/50",
              mode === "thinking"  && "animate-pulse opacity-15 ring-4 ring-violet-300/50",
            )}
            style={{ animationDuration: mode === "thinking" ? "1.4s" : "1.2s" }}
          />
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Replace `MiniOrbLauncher`**

```tsx
function MiniOrbLauncher({ mode, onClick }: { mode: VoiceMode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-10 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border text-white transition-all duration-300 hover:scale-105",
        mode === "idle" ? "galaxy-orb-idle border-[rgba(180,150,255,0.15)]" : "voice-orb is-thinking",
      )}
      aria-label="Open Vimi"
      title="Open Vimi"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" strokeWidth="1.6" stroke="currentColor">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 4: Replace `TextInput`**

```tsx
function TextInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
      <input
        className="surface-input flex-1 text-sm"
        placeholder="Send a message to Vimi…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={disabled}
      />
      <button type="submit" disabled={!input.trim() || disabled} className="primary-button shrink-0 px-5">
        Send
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Visual check**

Verify in browser: orb has concentric rings + corner brackets, heading uses Cormorant Garamond, italic "your orbit." in soft purple, chat panel has header row.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: orb rings + brackets, Cormorant headings, elegant TextInput"
```

---

## Task 5: FeaturePage — Section Header

**Files:**
- Modify: `src/App.tsx` — `FeaturePage` function

- [ ] **Step 1: Replace `FeaturePage` function**

```tsx
function FeaturePage({ section }: { section: Exclude<Section, "chat"> }) {
  const detail = SECTION_DETAILS[section];
  const Icon = detail.icon as ComponentType<SVGProps<SVGSVGElement>>;

  return (
    <div className="flex flex-col gap-5">
      {/* Section header */}
      <div className="panel-surface fade-rise px-7 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="font-['Outfit'] text-[10px] uppercase tracking-[0.24em] text-[rgba(0,255,180,0.55)]">
              {detail.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl text-white">{detail.label}</h2>
            <p className="mt-3 font-['DM_Sans'] text-sm font-light leading-7 text-[rgba(100,85,160,0.7)]">
              {detail.description}
            </p>
          </div>

          <div className="panel-soft flex items-center gap-4 self-start px-5 py-4">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${detail.aura}, ${detail.accent})`,
                boxShadow: `0 14px 34px ${detail.shadow}`,
              }}
            >
              <Icon className="h-5 w-5 text-white" />
            </span>
            <div>
              <p className="font-['Outfit'] text-sm font-medium text-white">{detail.label}</p>
              <p className="mt-0.5 font-['DM_Sans'] text-xs font-light text-[rgba(100,85,160,0.65)]">
                Dedicated view
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section content */}
      <div className="panel-surface fade-rise delay-1 p-5 sm:p-6">
        {renderUtility(section)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify feature pages render correctly**

Click Focus, Care, Pay, Pulse, Moments in the sidebar. Each should show a refined section header with Cormorant heading.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: elegant FeaturePage section header with Cormorant headings"
```

---

## Task 6: ChatSection — Bubble Restyling

**Files:**
- Modify: `src/components/ChatSection.tsx`

- [ ] **Step 1: Replace the `ChatTranscript` return JSX**

Replace from `return (` through the final `);` with:

```tsx
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3">
        <div className="flex min-h-full flex-col gap-3 py-3">
          {!hasConversation && (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <p className="font-['Cormorant_Garamond'] text-lg font-light text-[rgba(160,145,210,0.6)]">
                Your conversation will appear here.
              </p>
              <p className="mt-1 font-['Outfit'] text-[10px] uppercase tracking-[0.2em] text-[rgba(100,85,160,0.45)]">
                Tap the orb to begin
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg._id}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div className="flex max-w-[88%] flex-col gap-1">
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm font-light leading-relaxed",
                    msg.role === "user"
                      ? "rounded-br-sm bg-[rgba(0,255,180,0.07)] text-[rgba(220,255,245,0.9)] ring-1 ring-[rgba(0,255,180,0.15)]"
                      : "rounded-bl-sm bg-[rgba(120,80,255,0.07)] text-[rgba(170,150,230,0.85)] ring-1 ring-[rgba(120,80,255,0.16)]",
                  )}
                >
                  <p>{msg.text.replace(/\{[\s\S]*"action"[\s\S]*\}/, "").trim() || msg.text}</p>
                </div>
                <p
                  className={cn(
                    "font-['Outfit'] text-[9px] uppercase tracking-[0.14em]",
                    msg.role === "user"
                      ? "text-right text-[rgba(0,255,180,0.35)]"
                      : "text-[rgba(120,80,255,0.45)]",
                  )}
                >
                  {msg.role === "user" ? "You" : "Vimi"}
                  {msg.parsedType && (
                    <span className="ml-2 text-[rgba(100,85,160,0.5)]">
                      · {msg.parsedType.replace("create_", "created — ")}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}

          {showLiveAssistant && (
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-[rgba(120,80,255,0.07)] px-4 py-2.5 text-sm font-light leading-relaxed text-[rgba(170,150,230,0.85)] ring-1 ring-[rgba(120,80,255,0.16)]">
                <p>
                  {liveText}
                  <span className="ml-1 inline-block h-3.5 w-px animate-pulse bg-[rgba(0,255,180,0.7)] align-middle" />
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 2: Verify chat renders**

In the Vimi (chat) view, confirm: user bubbles are cyan-tinted, Vimi bubbles are violet-tinted, metadata labels are Outfit uppercase.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatSection.tsx
git commit -m "feat: cyan/violet chat bubbles with Outfit metadata labels"
```

---

## Task 7: TasksSection — Toggle Button Colors

**Files:**
- Modify: `src/components/TasksSection.tsx`

The panel, input, button classes all update automatically from Task 1. Only the inline Tailwind color tokens on the toggle button need updating.

- [ ] **Step 1: Update section heading and `TaskCard` toggle button**

In `TasksSection`, replace:
```tsx
<h2 className="text-2xl font-semibold text-white">Today's focus</h2>
<p className="text-sm leading-6 text-slate-400">
```
With:
```tsx
<h2 className="text-3xl text-white">Today's focus</h2>
<p className="font-['DM_Sans'] text-sm font-light leading-6 text-[rgba(100,85,160,0.65)]">
```

In `TaskCard`, replace the toggle button className:
```tsx
className={cn(
  "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
  task.status === "completed"
    ? "border-[rgba(0,255,180,0.4)] bg-[rgba(0,255,180,0.12)] text-[rgba(0,255,180,0.9)]"
    : "border-[rgba(120,80,255,0.3)] bg-[rgba(120,80,255,0.06)] text-transparent hover:border-[rgba(120,80,255,0.5)]",
)}
```

Replace task title completed style:
```tsx
className={cn(
  "text-sm text-white",
  task.status === "completed" && "text-[rgba(100,85,160,0.5)] line-through decoration-[rgba(120,80,255,0.3)]",
)}
```

Replace the delete button:
```tsx
<button onClick={onDelete} className="font-['Outfit'] text-xs tracking-widest text-[rgba(100,85,160,0.4)] transition-colors hover:text-[rgba(255,80,100,0.7)]">
  ✕
</button>
```

- [ ] **Step 2: Update the empty state**

```tsx
<div className="panel-soft px-6 py-10 text-center">
  <p className="font-['Cormorant_Garamond'] text-xl font-light text-[rgba(160,145,210,0.7)]">No tasks yet.</p>
  <p className="mt-2 font-['DM_Sans'] text-sm font-light leading-6 text-[rgba(100,85,160,0.55)]">
    Start with one small decision and let Vimi turn it into progress.
  </p>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TasksSection.tsx
git commit -m "feat: tasks section — violet toggle, Cormorant heading, elegant palette"
```

---

## Task 8: RemindersSection — Toggle Button Colors

**Files:**
- Modify: `src/components/RemindersSection.tsx`

- [ ] **Step 1: Update heading**

Replace:
```tsx
<h2 className="text-2xl font-semibold text-white">Pending reminders</h2>
<p className="text-sm leading-6 text-slate-400">
```
With:
```tsx
<h2 className="text-3xl text-white">Pending reminders</h2>
<p className="font-['DM_Sans'] text-sm font-light leading-6 text-[rgba(100,85,160,0.65)]">
```

- [ ] **Step 2: Update toggle button (currently uses stone/white colors)**

Replace:
```tsx
className={cn(
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
  reminder.status === "completed"
    ? "border-stone-900 bg-stone-900 text-white"
    : "border-stone-300 bg-white/70 text-transparent hover:border-stone-500",
)}
```
With:
```tsx
className={cn(
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
  reminder.status === "completed"
    ? "border-[rgba(0,255,180,0.4)] bg-[rgba(0,255,180,0.12)] text-[rgba(0,255,180,0.9)]"
    : "border-[rgba(120,80,255,0.3)] bg-[rgba(120,80,255,0.06)] text-transparent hover:border-[rgba(120,80,255,0.5)]",
)}
```

- [ ] **Step 3: Update text colors**

Replace `className={cn("text-sm font-semibold text-white", reminder.status === "completed" && "text-slate-500 line-through")}`:
```tsx
className={cn(
  "text-sm text-white",
  reminder.status === "completed" && "text-[rgba(100,85,160,0.5)] line-through decoration-[rgba(120,80,255,0.3)]",
)}
```

Replace the delete button `className="text-sm text-slate-500 transition-colors hover:text-red-300"`:
```tsx
className="font-['Outfit'] text-xs tracking-widest text-[rgba(100,85,160,0.4)] transition-colors hover:text-[rgba(255,80,100,0.7)]"
```

- [ ] **Step 4: Update empty state**

```tsx
<div className="panel-soft px-6 py-10 text-center">
  <p className="font-['Cormorant_Garamond'] text-xl font-light text-[rgba(160,145,210,0.7)]">No reminders saved yet.</p>
  <p className="mt-2 font-['DM_Sans'] text-sm font-light leading-6 text-[rgba(100,85,160,0.55)]">
    This space works best when it nudges you calmly instead of sounding like an alarm.
  </p>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/RemindersSection.tsx
git commit -m "feat: reminders section — violet palette, elegant empty state"
```

---

## Task 9: SignInForm + AuthPage

**Files:**
- Modify: `src/SignInForm.tsx`
- Modify: `src/App.tsx` — `AuthPage` function

- [ ] **Step 1: Fix hardcoded stone/white colors in `SignInForm.tsx`**

Replace the "toggle flow" button:
```tsx
<button
  type="button"
  className="font-['Outfit'] text-sm font-light text-[rgba(180,150,255,0.8)] transition-colors hover:text-[rgba(0,255,180,0.8)]"
  onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
>
```

Replace the surrounding `<div className="text-center text-sm text-stone-500">`:
```tsx
<div className="text-center font-['DM_Sans'] text-sm font-light text-[rgba(100,85,160,0.6)]">
```

Replace the `<hr>` divider section:
```tsx
<div className="my-5 flex items-center justify-center gap-4">
  <div className="h-px flex-1 bg-[rgba(120,80,255,0.15)]" />
  <span className="font-['Outfit'] text-[10px] uppercase tracking-[0.22em] text-[rgba(100,85,160,0.5)]">or</span>
  <div className="h-px flex-1 bg-[rgba(120,80,255,0.15)]" />
</div>
```

- [ ] **Step 2: Update `AuthPage` in `App.tsx`**

In `AuthPage`, replace the `<h1>` and intro text:
```tsx
<h1 className="mt-6 max-w-3xl text-4xl font-light leading-tight text-white sm:text-5xl">
  Your life, decided by you.{" "}
  <em className="not-italic text-[rgba(200,180,255,0.8)]">Executed by Vimi.</em>
</h1>
<p className="mt-5 max-w-2xl font-['DM_Sans'] text-base font-light leading-7 text-[rgba(100,85,160,0.7)] sm:text-lg">
  Vimi should feel like an intelligent companion with agency: warm, clear, and ready to
  turn intent into motion.
</p>
```

Replace the `<h2>` in the sign-in panel:
```tsx
<h2 className="mt-1 text-3xl font-light text-white">Step into your orbit</h2>
```

Replace pillar article titles:
```tsx
<p className="font-['Outfit'] text-sm font-medium tracking-wide text-white">{pillar.title}</p>
<p className="mt-2 font-['DM_Sans'] text-sm font-light leading-6 text-[rgba(100,85,160,0.7)]">{pillar.body}</p>
```

Replace `<p className="text-sm uppercase tracking-[0.24em] text-slate-400">Welcome to Vimi</p>`:
```tsx
<p className="font-['Outfit'] text-[10px] uppercase tracking-[0.26em] text-[rgba(0,255,180,0.55)]">Welcome to Vimi</p>
```

- [ ] **Step 3: Final visual pass — check all pages**

Visit in browser:
- Auth page: Cormorant headings, DM Sans body, violet/cyan palette throughout
- Chat view: orb + rings, elegant heading, cyan/violet bubbles
- Focus: section header, violet checkboxes, empty state
- Care: same treatment
- Right panel: `hud-label` style, tighter cards

- [ ] **Step 4: Final commit**

```bash
git add src/SignInForm.tsx src/App.tsx
git commit -m "feat: auth page and sign-in form — full palette and typography update"
```

---

## Self-Review Checklist

- [x] **CSS foundation** — all class bodies updated, Google Fonts loaded, CSS vars defined
- [x] **Sidebar** — vertical 64px rail, active indicator, logo, avatar
- [x] **Layout** — flex h-screen, SystemBar, StatusStrip, sidebar wired
- [x] **VimiPage** — orb rings + brackets, Cormorant heading, italic accent
- [x] **FeaturePage** — section header with Cormorant h2, DM Sans body
- [x] **ChatSection** — cyan/violet bubbles, Outfit metadata
- [x] **TasksSection** — toggle palette, empty state, delete button
- [x] **RemindersSection** — toggle palette, empty state, delete button
- [x] **SignInForm** — no stone/white hardcodes remaining
- [x] **AuthPage** — headings, body, pillar cards updated
- [ ] **PaymentsSection, BudgetsSection, EventsSection** — not explicitly tasked; the CSS class updates from Task 1 will restyle panels/buttons/inputs automatically. If those sections have any inline `text-slate-*`, `bg-white/`, or `border-white/` colors on interactive elements (checkboxes, toggles, delete buttons), apply the same substitution pattern used in Tasks 7–8.
