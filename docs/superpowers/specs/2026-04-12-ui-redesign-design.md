# Vimi UI Redesign — Design Spec
**Date:** 2026-04-12  
**Status:** Approved

---

## Overview

Full UI/UX redesign of the Vimi voice assistant app. The goal is to replace the current "generic glass morphism" aesthetic with a **Neo-Holographic HUD** style — futuristic, elegant, and grounded in the existing galaxy/space theme. The primary change is from a passive decorative dark UI to an **active command interface** that feels alive and purposeful.

**Approved direction:** Neo-Holographic HUD with deep purple base + neon cyan accents + electric violet structural elements.

---

## Design System

### Color Palette

```css
--bg:           #05020f   /* deepest background */
--bg2:          #080514   /* secondary background */
--panel:        rgba(18, 8, 42, 0.88)    /* primary panel surface */
--panel2:       rgba(12, 5, 30, 0.75)    /* secondary panel surface */
--border:       rgba(0, 255, 180, 0.1)   /* cyan border (active/interactive) */
--border-v:     rgba(120, 80, 255, 0.18) /* violet border (structural) */
--cyan:         #00ffb8   /* primary accent — active states, glows, CTAs */
--cyan-dim:     rgba(0, 255, 184, 0.55)  /* muted cyan */
--violet:       #8c5fff   /* secondary accent — structural, sidebar, panels */
--violet-dim:   rgba(140, 95, 255, 0.5)  /* muted violet */
--ink:          #e4e0ff   /* primary text */
--ink2:         rgba(170, 150, 230, 0.7) /* secondary text */
--ink3:         rgba(100, 85, 160, 0.55) /* muted/label text */
```

### Typography

| Role | Font | Usage |
|---|---|---|
| Display | **Syne** (700–800) | Page titles, section headings, orb title |
| HUD labels | **Rajdhani** (600) | ALL_CAPS labels, nav text, system chips, status |
| System data | **Space Mono** (400) | Timestamps, version strings, message metadata |
| Body | **DM Sans** (300–500) | Chat messages, descriptions, input fields |

All four fonts loaded from Google Fonts. Body font replaces current Aptos/Trebuchet.  
Heading serif (Iowan Old Style) removed — Syne takes over all display roles.

### Background

- Base: `#05020f` (deeper than current `#090412`)  
- Radial purple bloom glows (keep current soft-galaxy effect, intensify slightly)  
- Subtle grid overlay: `rgba(0,255,180,0.025)` at `48px × 48px` — barely visible, adds depth  
- Two-layer starfield (keep existing `starfield-near` / `starfield-far` animations)

### Panel Style

**Before:** `rounded-[32px]`, semi-transparent frosted glass, `rgba(17,10,35,0.88)`  
**After:**
- `rounded-2xl` (16px) — tighter, more architectural
- `border: 1px solid rgba(120,80,255,0.18)` — violet structural border
- Top highlight: `::before` pseudo-element gradient `transparent → rgba(120,80,255,0.25) → transparent`
- Panels are **darker** (`rgba(12,5,30,0.75)`) with less blur — more defined edges

### Buttons

**Primary (Send / Approve):**
- `background: rgba(0,255,180,0.08)`, `border: 1px solid rgba(0,255,180,0.25)`
- `color: rgba(0,255,180,0.85)`, Rajdhani, uppercase, letter-spacing
- Hover: `background: rgba(0,255,180,0.13)` + subtle glow

**Secondary (Disconnect / Sign out):**
- `background: rgba(120,80,255,0.07)`, `border: 1px solid rgba(120,80,255,0.22)`
- `color: rgba(180,150,255,0.8)`

**Reject:**
- `background: rgba(255,80,100,0.08)`, `border: 1px solid rgba(255,80,100,0.2)`

---

## Layout

### Sidebar (new — replaces top nav)

64px fixed-width left rail:

- **Top:** 36×36px orb logo (purple radial gradient)
- **Nav items:** 44×44px rounded squares, icon + 7px Rajdhani label beneath
  - Active state: `rgba(0,255,180,0.07)` background + `1px solid rgba(0,255,180,0.18)` border + **2px neon cyan left-edge indicator bar** with glow
  - Inactive: icon at `rgba(140,120,200,0.45)` opacity
- **Right edge:** gradient neon stripe (`linear-gradient violet → cyan → transparent`)
- **Bottom:** 6px cyan status dot + 30px user avatar circle

Sections (in order): Vimi (chat) · Focus (tasks) · Care (reminders) · Pay (payments) · Pulse (budgets) · Moments (events)

### System Bar

36px horizontal strip above content:

- Left: breadcrumb — `VIMI › PRESENCE MODE` in Rajdhani, ink3 / cyan-active
- Right: mode chip (IDLE/LISTENING/etc) + auto-listen chip + Space Mono date

### Content Area

Two-column: `flex-1` main + `230px` right panel.

### Status Strip (bottom)

Height ~28px, system label row in Space Mono:
`VIMI SYSTEM ONLINE · CONVEX CONNECTED · ELEVENLABS TTS READY`

---

## Components

### Voice Orb (CentralOrb)

- **Frame:** 160px, corner bracket accents (`::before/::after` on wrapper)
- **Rings:** outer ring (`inset: -8px`, slow 12s rotation) + mid dashed ring (`inset: 8px`, 20s reverse rotation)
- **Core:** 110px, deep purple radial gradient, violet box-shadow, cyan outer halo
- **States:** idle (float animation, static gradient) / listening (fuchsia tones, scale pulse) / thinking (violet, slow rotation) / speaking (cyan-blue, wave scale)
- **Mini orb** (floating launcher): keep but restyle — match sidebar logo style

### ChatTranscript

- Panel: dark violet glass, cyan top-gradient highlight, `rounded-2xl`
- Header row: `CONVERSATION LOG` label + message count in Space Mono
- User bubbles: cyan-tinted (`rgba(0,255,180,0.07)` bg, cyan border), `border-radius: 12px 12px 2px 12px`
- Vimi bubbles: violet-tinted (`rgba(120,80,255,0.07)` bg, violet border), `border-radius: 2px 12px 12px 12px`
- Message metadata: Space Mono, `YOU · 14:32` / `VIMI · 14:32`
- Live cursor: cyan blinking caret (`rgba(0,255,180,0.8)`)

### TextInput

- `background: rgba(10,5,26,0.8)`, violet border, Rajdhani send button
- Focus: cyan border + `box-shadow: 0 0 0 3px rgba(0,255,180,0.06)`

### SideInfoPanel (right panel)

Cards redesigned from `panel-soft` to tighter HUD cards:
- 12px border-radius, violet border, `::before` top highlight
- Labels: Rajdhani uppercase cyan, preceded by short gradient line
- Values: Syne 15px bold
- Sub-text: DM Sans 11px ink3

Cards: Today's date · Mode status + auto-listen toggle · Connected user · Google integration · Pending approvals

### Feature Sections (tasks, reminders, etc.)

- Section header: Rajdhani eyebrow + Syne page title + sub description
- List items: horizontal dividers (`rgba(120,80,255,0.08)`), priority dot indicators (red/amber/cyan), Space Mono metadata
- Checkboxes: `rgba(0,255,180,0.3)` border, cyan checkmark on done
- Section page icon badge: linear gradient `violet → cyan` with matching glow

### Status Chips (badges)

Replace current `status-chip`:
- `font-family: Rajdhani`, `letter-spacing: 0.18em`, `text-transform: uppercase`
- Online: cyan palette  
- Inactive/idle: violet palette  
- Error/reject: red palette

---

## CSS Architecture

All changes live in `src/index.css` (globals) and component files. No new files created.

### Strategy: update existing classes in-place

To avoid renaming class names across all JSX files, **rewrite the CSS of existing classes** to match the new design. No JSX class-name changes required for core panel/button/input classes.

| Existing class | What changes |
|---|---|
| `panel-surface` | Darker bg, 16px radius, violet border, `::before` top highlight |
| `panel-soft` | Same treatment, slightly lighter surface |
| `primary-button` | Cyan HUD style (bg, border, Rajdhani font, uppercase) |
| `secondary-button` | Violet HUD style |
| `surface-input` | Darker bg, violet border, cyan focus ring |
| `status-chip` | Rajdhani uppercase, cyan/violet/red palette variants |
| `soft-galaxy` | Deepen background base, add grid overlay |

### New global classes to add (genuinely new concepts)

| Class | Purpose |
|---|---|
| `.hud-label` | Rajdhani uppercase label with gradient prefix line — used in right panel cards |
| `.hud-grid-bg` | Subtle grid overlay (reusable helper) |

### Google Fonts import

Add to top of `index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Rajdhani:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=Space+Mono&display=swap');
```

Update `:root` font-family to `'DM Sans', sans-serif`.  
Update `h1,h2,h3,h4` to `'Syne', sans-serif` with `font-weight: 700`.

---

## Files to Modify

| File | Change |
|---|---|
| `src/index.css` | New font imports, full CSS variable overhaul, all class redesigns, new HUD classes, new animations |
| `src/App.tsx` | Replace top nav with sidebar, add system bar, add status strip, update orb styles |
| `src/components/Sidebar.tsx` | Rewrite into vertical icon sidebar component |
| `src/components/ChatSection.tsx` | Restyle chat bubbles, add header row, new meta labels |
| `src/components/TasksSection.tsx` | HUD list items with priority dots |
| `src/components/RemindersSection.tsx` | Same list treatment |
| `src/components/PaymentsSection.tsx` | Same list treatment |
| `src/components/BudgetsSection.tsx` | Same list treatment |
| `src/components/EventsSection.tsx` | Same list treatment |

---

## Animations

| Name | Target | Spec |
|---|---|---|
| `orbRingRotate` | Sidebar + orb rings | 12s / 20s linear infinite, one reversed |
| `orbFloat` | Central orb | 8s ease-in-out `translateY(-6px) scale(1.015)` |
| `starDrift` | Starfield | Keep existing, slight opacity increase |
| `hudScan` | Optional scanline effect on active panels | 4s ease-in-out opacity pulse |
| `fadeRise` | Page load | Keep existing |

---

## Out of Scope

- New features or data changes
- Backend / Convex schema changes
- Mobile responsive overhaul (desktop-first; Electron app)
- Dark/light theme toggle
