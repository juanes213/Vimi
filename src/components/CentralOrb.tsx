import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { VoiceMode } from "../hooks/useVoiceChat";
import type { OrbTone } from "../lib/orbTone";
import { cn } from "../lib/utils";

type OrbPalette = {
  core: string;
  mid: string;
  edge: string;
  accent: string;
  accentSoft: string;
  glow: string;
};

type OrbCssVars = CSSProperties & {
  "--orb-core": string;
  "--orb-mid": string;
  "--orb-edge": string;
  "--orb-accent": string;
  "--orb-accent-soft": string;
  "--orb-glow": string;
  "--orb-intensity": number;
  "--orb-scale": number;
  "--orb-squash-x": number;
  "--orb-squash-y": number;
  "--orb-wobble": string;
};

export function getOrbPalette(mode: VoiceMode, tone: OrbTone, intensity: number): OrbPalette {
  const palettes: Record<OrbTone, OrbPalette> = {
    calm: {
      core: "rgba(245, 253, 255, 0.95)",
      mid: "rgba(141, 239, 255, 0.50)",
      edge: "rgba(102, 116, 255, 0.24)",
      accent: "rgba(141, 239, 255, 0.88)",
      accentSoft: "rgba(32, 227, 194, 0.24)",
      glow: "rgba(32, 227, 194, 0.18)",
    },
    active: {
      core: "rgba(255, 255, 255, 0.98)",
      mid: "rgba(32, 227, 194, 0.68)",
      edge: "rgba(102, 116, 255, 0.32)",
      accent: "rgba(32, 227, 194, 0.95)",
      accentSoft: "rgba(141, 239, 255, 0.30)",
      glow: "rgba(32, 227, 194, 0.28)",
    },
    warm: {
      core: "rgba(255, 250, 252, 0.98)",
      mid: "rgba(255, 151, 203, 0.55)",
      edge: "rgba(111, 121, 255, 0.28)",
      accent: "rgba(255, 151, 203, 0.86)",
      accentSoft: "rgba(155, 124, 255, 0.26)",
      glow: "rgba(255, 151, 203, 0.22)",
    },
    alert: {
      core: "rgba(255, 253, 245, 0.98)",
      mid: "rgba(255, 209, 102, 0.58)",
      edge: "rgba(255, 107, 122, 0.24)",
      accent: "rgba(255, 209, 102, 0.88)",
      accentSoft: "rgba(255, 107, 122, 0.22)",
      glow: "rgba(255, 190, 92, 0.24)",
    },
    success: {
      core: "rgba(249, 255, 253, 0.98)",
      mid: "rgba(104, 255, 218, 0.62)",
      edge: "rgba(141, 239, 255, 0.30)",
      accent: "rgba(104, 255, 218, 0.92)",
      accentSoft: "rgba(141, 239, 255, 0.28)",
      glow: "rgba(104, 255, 218, 0.24)",
    },
  };

  if (mode === "thinking" && tone === "calm") {
    return {
      ...palettes.calm,
      mid: `rgba(102, 116, 255, ${0.42 + intensity * 0.12})`,
      edge: "rgba(155, 124, 255, 0.26)",
      accent: "rgba(155, 124, 255, 0.74)",
    };
  }

  return palettes[tone];
}

function useSmoothedLevel(targetLevel: number) {
  const [level, setLevel] = useState(0);
  const targetRef = useRef(targetLevel);
  const currentRef = useRef(0);

  useEffect(() => {
    targetRef.current = targetLevel;
  }, [targetLevel]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      currentRef.current += (targetRef.current - currentRef.current) * 0.16;
      setLevel((current) => {
        const next = currentRef.current;
        return Math.abs(current - next) > 0.006 ? next : current;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return level;
}

export function CentralOrb({
  mode,
  micLevel,
  speechLevel,
  tone,
  orbStyle,
  onClick,
  isSpeaking,
}: {
  mode: VoiceMode;
  micLevel: number;
  speechLevel: number;
  tone: OrbTone;
  orbStyle?: CSSProperties;
  onClick?: () => void;
  isSpeaking?: boolean;
}) {
  const fallbackSpeakingLevel = mode === "speaking" && !isSpeaking ? 0.24 : 0;
  const rawLevel =
    mode === "listening"
      ? micLevel
      : mode === "speaking"
        ? Math.max(speechLevel, fallbackSpeakingLevel)
        : mode === "thinking"
          ? 0.18
          : 0.08;
  const intensity = useSmoothedLevel(Math.min(1, Math.max(0, rawLevel)));
  const palette = useMemo(() => getOrbPalette(mode, tone, intensity), [mode, tone, intensity]);
  const scale = 1 + intensity * (mode === "listening" ? 0.055 : mode === "speaking" ? 0.045 : 0.01);
  const squashX = 1 + intensity * (mode === "listening" ? 0.07 : mode === "speaking" ? 0.055 : 0.012);
  const squashY = 1 - intensity * (mode === "listening" ? 0.025 : mode === "speaking" ? 0.02 : 0.004);
  const wobble = `${Math.sin(intensity * Math.PI) * 4}px`;
  const svgId = useId().replace(/:/g, "");

  const style = {
    "--orb-core": palette.core,
    "--orb-mid": palette.mid,
    "--orb-edge": palette.edge,
    "--orb-accent": palette.accent,
    "--orb-accent-soft": palette.accentSoft,
    "--orb-glow": palette.glow,
    "--orb-intensity": intensity,
    "--orb-scale": scale,
    "--orb-squash-x": squashX,
    "--orb-squash-y": squashY,
    "--orb-wobble": wobble,
    ...orbStyle,
  } satisfies OrbCssVars;

  return (
    <div className={cn("ai-orb-stage", `is-${mode}`, `tone-${tone}`)} style={style}>
      <span className="ai-orb-aura" />
      <span className="ai-orb-field ai-orb-field-back" />
      <span className="ai-orb-field ai-orb-field-front" />

      <button
        type="button"
        onClick={onClick}
        aria-label={mode === "idle" ? "Talk to Vimi" : "Stop Vimi"}
        className="ai-orb"
      >
        <svg className="ai-orb-svg" viewBox="0 0 520 360" aria-hidden="true">
          <defs>
            <radialGradient id={`${svgId}-base`} cx="50%" cy="50%" r="50%">
              <stop offset="75%" stopColor="rgba(10, 15, 30, 0.95)" />
              <stop offset="95%" stopColor="rgba(5, 10, 20, 0.5)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
            </radialGradient>
            <radialGradient id={`${svgId}-core`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={palette.core} />
              <stop offset="30%" stopColor={palette.accent} />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <radialGradient id={`${svgId}-mid`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={palette.mid} />
              <stop offset="70%" stopColor={palette.edge} />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <radialGradient id={`${svgId}-glow`} cx="50%" cy="50%" r="50%">
              <stop offset="40%" stopColor={palette.accentSoft} />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <filter id={`${svgId}-blur-sm`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
            <filter id={`${svgId}-blur-md`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="15" />
            </filter>
            <filter id={`${svgId}-blur-lg`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="25" />
            </filter>
          </defs>

          <g className="ai-orb-layers">
            {/* Dark deep base */}
            <ellipse cx="260" cy="180" rx="230" ry="170" fill={`url(#${svgId}-base)`} />
            
            {/* Outer soft teal/green glow */}
            <ellipse cx="260" cy="180" rx="200" ry="140" fill={`url(#${svgId}-glow)`} filter={`url(#${svgId}-blur-lg)`} opacity="0.8" />
            
            {/* Accent rim 1 */}
            <ellipse cx="260" cy="180" rx="210" ry="150" fill="none" stroke={palette.accentSoft} strokeWidth="1" opacity="0.3" filter={`url(#${svgId}-blur-sm)`} />

            {/* Mid layer deep blueish */}
            <ellipse cx="260" cy="180" rx="175" ry="120" fill={`url(#${svgId}-mid)`} />
            
            {/* Accent rim 2 */}
            <ellipse cx="260" cy="180" rx="160" ry="105" fill="none" stroke={palette.mid} strokeWidth="1.5" opacity="0.5" />

            {/* Bright Core */}
            <ellipse cx="260" cy="180" rx="90" ry="50" fill={`url(#${svgId}-core)`} filter={`url(#${svgId}-blur-sm)`} />
            
            {/* Core highlight */}
            <ellipse cx="260" cy="180" rx="40" ry="20" fill={palette.core} filter={`url(#${svgId}-blur-md)`} />
          </g>
        </svg>
      </button>
    </div>
  );
}
