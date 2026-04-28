import type { CSSProperties } from "react";
import type { VoiceMode } from "../hooks/useVoiceChat";

export type OrbTone = "calm" | "active" | "warm" | "alert" | "success";

type ThemeStyle = CSSProperties & {
  "--theme-accent": string;
  "--theme-accent-strong": string;
  "--theme-accent-soft": string;
  "--theme-secondary": string;
  "--theme-secondary-soft": string;
  "--theme-bg-aura": string;
  "--theme-bg-aura-2": string;
  "--theme-glass-border": string;
  "--theme-glass-highlight": string;
  "--theme-shadow": string;
};

export function inferToneFromAssistant(
  parsedType: string | undefined,
  mode: VoiceMode,
  pendingApprovalCount: number,
): OrbTone {
  if (pendingApprovalCount > 0) return "alert";
  if (parsedType === "reminder.delivery") return "warm";
  if (parsedType?.includes("sendEmail")) return "alert";
  if (
    parsedType?.startsWith("internal.create") ||
    parsedType?.startsWith("calendar.create") ||
    parsedType?.startsWith("calendar.update")
  ) {
    return "success";
  }
  if (mode === "listening" || mode === "speaking") return "active";
  return "calm";
}

export function getToneThemeStyle(tone: OrbTone, mode: VoiceMode): ThemeStyle {
  const themes: Record<OrbTone, Omit<ThemeStyle, keyof CSSProperties>> = {
    calm: {
      "--theme-accent": "141, 239, 255",
      "--theme-accent-strong": "#8defff",
      "--theme-accent-soft": "rgba(141, 239, 255, 0.16)",
      "--theme-secondary": "102, 116, 255",
      "--theme-secondary-soft": "rgba(102, 116, 255, 0.12)",
      "--theme-bg-aura": "rgba(70, 92, 255, 0.13)",
      "--theme-bg-aura-2": "rgba(32, 227, 194, 0.08)",
      "--theme-glass-border": "rgba(141, 239, 255, 0.12)",
      "--theme-glass-highlight": "rgba(141, 239, 255, 0.18)",
      "--theme-shadow": "rgba(32, 145, 227, 0.18)",
    },
    active: {
      "--theme-accent": "32, 227, 194",
      "--theme-accent-strong": "#20e3c2",
      "--theme-accent-soft": "rgba(32, 227, 194, 0.18)",
      "--theme-secondary": "88, 132, 255",
      "--theme-secondary-soft": "rgba(88, 132, 255, 0.14)",
      "--theme-bg-aura": "rgba(32, 227, 194, 0.13)",
      "--theme-bg-aura-2": "rgba(88, 132, 255, 0.11)",
      "--theme-glass-border": "rgba(32, 227, 194, 0.15)",
      "--theme-glass-highlight": "rgba(32, 227, 194, 0.22)",
      "--theme-shadow": "rgba(32, 227, 194, 0.20)",
    },
    warm: {
      "--theme-accent": "255, 151, 203",
      "--theme-accent-strong": "#ff97cb",
      "--theme-accent-soft": "rgba(255, 151, 203, 0.16)",
      "--theme-secondary": "155, 124, 255",
      "--theme-secondary-soft": "rgba(155, 124, 255, 0.14)",
      "--theme-bg-aura": "rgba(255, 151, 203, 0.12)",
      "--theme-bg-aura-2": "rgba(102, 116, 255, 0.11)",
      "--theme-glass-border": "rgba(255, 151, 203, 0.14)",
      "--theme-glass-highlight": "rgba(255, 151, 203, 0.20)",
      "--theme-shadow": "rgba(255, 151, 203, 0.18)",
    },
    alert: {
      "--theme-accent": "255, 209, 102",
      "--theme-accent-strong": "#ffd166",
      "--theme-accent-soft": "rgba(255, 209, 102, 0.16)",
      "--theme-secondary": "255, 107, 122",
      "--theme-secondary-soft": "rgba(255, 107, 122, 0.12)",
      "--theme-bg-aura": "rgba(255, 209, 102, 0.12)",
      "--theme-bg-aura-2": "rgba(255, 107, 122, 0.10)",
      "--theme-glass-border": "rgba(255, 209, 102, 0.16)",
      "--theme-glass-highlight": "rgba(255, 209, 102, 0.22)",
      "--theme-shadow": "rgba(255, 170, 70, 0.18)",
    },
    success: {
      "--theme-accent": "104, 255, 218",
      "--theme-accent-strong": "#68ffda",
      "--theme-accent-soft": "rgba(104, 255, 218, 0.17)",
      "--theme-secondary": "141, 239, 255",
      "--theme-secondary-soft": "rgba(141, 239, 255, 0.13)",
      "--theme-bg-aura": "rgba(104, 255, 218, 0.12)",
      "--theme-bg-aura-2": "rgba(141, 239, 255, 0.10)",
      "--theme-glass-border": "rgba(104, 255, 218, 0.15)",
      "--theme-glass-highlight": "rgba(104, 255, 218, 0.22)",
      "--theme-shadow": "rgba(104, 255, 218, 0.18)",
    },
  };

  return {
    ...themes[tone],
    filter: mode === "thinking" ? "saturate(1.04)" : undefined,
  };
}
