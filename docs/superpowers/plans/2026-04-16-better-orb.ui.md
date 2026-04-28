You are an expert frontend engineer working inside an existing React + Vite project.

Your task is to redesign and upgrade the current `CentralOrb` into a premium audiovisual AI presence inspired by the feel of Apple Intelligence / modern Siri:

* fluid
* luminous
* soft
* elegant
* minimal
* calm but alive
* highly responsive to real audio

This should NOT look like a mascot, robot, cartoon, or gaming effect.
It must feel like a refined “AI presence”.

IMPORTANT:

* Do NOT break existing functionality
* Reuse the current project architecture
* Keep the implementation production-ready
* Prioritize smoothness, polish, subtlety, and performance
* Avoid overdesign

---

## EXISTING CONTEXT

The project already has:

* React + Vite
* a `CentralOrb` component
* a `useVoiceChat()` hook
* voice state such as:

  * `activeMode` → "idle" | "listening" | "thinking" | "speaking"
  * `micLevel` → current microphone/input level

You must extend this architecture rather than replacing it blindly.

---

## PRIMARY GOAL

Transform the orb into a premium animated AI core with:

1. Apple-Intelligence-style visual language
2. Fluid layered gradients and glow
3. Smooth breathing in idle state
4. Listening animation reacting to input audio
5. Thinking state with subtle movement
6. Speaking animation synced to REAL TTS output amplitude
7. Dynamic tone/color changes based on conversational context
8. High-quality motion, soft edges, blur, translucency, and elegant depth

---

## DESIGN DIRECTION

The final visual should feel like:

* a luminous neural presence
* a floating intelligent energy field
* soft plasma / fluid light
* premium operating-system-level visual design
* elegant ambient intelligence

Avoid:

* hard outlines
* robotic faces
* emoji aesthetics
* sci-fi HUD overload
* neon gamer look
* aggressive motion
* cheap glow spam

Use:

* layered radial gradients
* soft blur
* translucent shells
* gentle animated deformations
* subtle bloom
* restrained color transitions

---

## VISUAL COMPOSITION

Build the orb from layered elements, using only HTML/CSS/React (no static image):

1. Background aura layer
2. Outer fluid shell
3. Mid shell / translucent distortion layer
4. Inner luminous core
5. Highlight sheen / specular layer
6. Optional ambient wave rings when active

All layers should be circular or near-organic and smoothly animated.

Use absolute positioning and CSS transforms.
Prefer CSS-based gradients and blur over canvas unless absolutely necessary.

---

## MOTION SYSTEM

Implement a state-driven motion system.

### IDLE

The orb should:

* breathe slowly
* slightly shimmer
* have very subtle drift
* feel alive even when inactive

Motion:

* slow scale oscillation
* tiny glow modulation
* maybe slight inner gradient movement

### LISTENING

The orb should:

* react to microphone amplitude in real time
* expand/contract softly
* brighten based on input level
* feel attentive and open

Motion:

* scale tied to live audio/input level
* glow intensity tied to input level
* gentle outer ripple response
* no harsh spikes

### THINKING

The orb should:

* become more focused
* show soft internal movement
* subtly rotate / drift / refract
* suggest processing without becoming busy

Motion:

* slow inner rotation or gradient drift
* slight contraction and concentration
* slightly deeper color palette

### SPEAKING

The orb should:

* pulse in sync with REAL TTS output audio amplitude
* emit subtle responsive ripples
* feel expressive and alive
* visually “speak” with the audio

This is the most important part:
DO NOT fake this with a generic speaking animation if real TTS audio data is available.
Use actual TTS audio amplitude or analyser data.

---

## REAL TTS AUDIO SYNC (CRITICAL)

You must connect the visual speaking animation to the real TTS playback audio.

Implement support for an `HTMLAudioElement` or `AudioBufferSourceNode` being used by TTS playback.

Use the Web Audio API:

* create or reuse an `AudioContext`
* connect the TTS playback source to an `AnalyserNode`
* read frequency/time-domain data in real time
* derive a normalized amplitude/envelope value
* feed that amplitude into the orb animation loop

### Required behavior

When TTS audio is playing:

* orb pulse scale must respond to real amplitude
* glow must intensify with real amplitude
* optional wave rings can emit more strongly on peaks
* speaking visual must stop when audio stops

### Implementation requirements

Create a reusable hook, for example:

```ts
useAudioAnalyzer(audioElementOrSource)
```

It should return something like:

```ts
{
  level: number, // normalized 0..1
  isPlaying: boolean
}
```

If there is no live TTS audio source available yet:

* create the abstraction and integration point cleanly
* keep a graceful fallback animation
* clearly mark where the real TTS element/source should be attached

IMPORTANT:
The code should be architected so that once the TTS audio element is available, the sync works immediately without refactoring the orb.

---

## STATE MODEL

Support these states:

```ts
type VoiceMode = "idle" | "listening" | "thinking" | "speaking";
type OrbTone = "calm" | "active" | "warm" | "alert" | "success";
```

The orb should combine:

* mode
* live mic/input level
* live TTS playback level
* tone

Use the proper source for each state:

* listening → use microphone/input level
* speaking → use TTS analyzer level
* idle/thinking → mostly ambient motion

---

## COLOR / TONE SYSTEM

Create a palette system like:

```ts
function getOrbPalette(mode: VoiceMode, tone: OrbTone, intensity: number)
```

Desired tonal direction:

* calm → blue-violet / indigo / soft white
* active → cyan-violet with more energy
* warm → magenta-violet / rose-blue blend
* alert → amber-coral soft warning
* success → cool cyan-white

All color transitions must be smooth and elegant.
No abrupt color switches.

Use interpolation and CSS transitions where possible.

---

## COMPONENT API

Refactor or update `CentralOrb` so it can accept:

```ts
{
  mode: VoiceMode;
  micLevel: number;
  speechLevel: number;
  tone: OrbTone;
  orbStyle?: React.CSSProperties;
  onClick?: () => void;
  isSpeaking?: boolean;
}
```

Then determine the active visual intensity source internally:

* if mode === "speaking" and speechLevel exists, use speechLevel
* if mode === "listening", use micLevel
* otherwise use ambient animation

---

## REQUIRED NEW HOOKS / UTILITIES

Implement clean reusable utilities/hooks such as:

1. `useAudioAnalyzer(...)`

   * analyzes real playback audio from TTS
   * returns normalized audio level

2. `inferToneFromAssistant(...)`

   * maps app context / parsed action / response type into `OrbTone`

3. Optional:
   `useOrbMotion(...)`

   * centralizes motion values and smoothing

Use smoothing/interpolation to avoid jitter:

* lerp
* moving average
* or simple dampening

The motion must feel fluid, not noisy.

---

## ANIMATION IMPLEMENTATION

Use CSS + React state + requestAnimationFrame where appropriate.

Add polished CSS keyframes for:

* breathing
* slow drift
* soft pulsing
* ripple expansion
* glow shimmer

But do NOT rely only on CSS for speaking:
real speech pulsing must be driven by analyzed TTS amplitude.

For audio-reactive motion, use inline transform/glow values updated from smoothed live levels.

---

## PERFORMANCE REQUIREMENTS

Keep animations performant:

* use transform and opacity whenever possible
* avoid layout thrashing
* minimize expensive repaints
* be careful with too many huge blurred layers
* keep it smooth on modern laptops

Use `requestAnimationFrame` carefully for the live analyzer loop.
Clean up audio nodes and animation frames properly.

---

## APPLE-STYLE MOTION PRINCIPLES

Follow these motion principles:

* smooth acceleration/deceleration
* no twitching
* no exaggerated bouncing
* soft transitions
* restrained elegance
* visually intelligent, not playful

The orb should feel expensive.

---

## INTEGRATION IN APP.TSX

Update the current integration so that `App.tsx` passes:

* `mode={voice.activeMode}`
* `micLevel={voice.micLevel}`
* `speechLevel={ttsAudioLevel}`
* `tone={inferredTone}`
* `isSpeaking={ttsIsPlaying}`

If a TTS audio element already exists in the app:

* connect it to the analyzer hook

If not:

* create a clear placeholder interface for future attachment
* do not invent fake architecture disconnected from the real app

---

## FALLBACK BEHAVIOR

If TTS analyzer data is unavailable:

* keep a subtle speaking animation fallback
* do not break the orb
* make it easy to replace with real data later

---

## DELIVERABLES

Generate:

1. updated `CentralOrb.tsx`
2. any new hooks needed (especially `useAudioAnalyzer`)
3. CSS additions in `index.css`
4. minimal `App.tsx` integration changes
5. short inline comments explaining how to attach the real TTS audio source

Keep the code modular, readable, and realistic for production.

---

## FINAL EXPECTATION

The result should feel like:

* an elegant AI presence
* premium OS-level interaction design
* visually synced to live speech
* subtle, responsive, and emotionally intelligent

The user should immediately feel:
“this is alive, refined, and high-end.”
