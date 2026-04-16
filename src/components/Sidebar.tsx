import type { ComponentType, SVGProps } from "react";
import { cn } from "../lib/utils";

export type Section =
  | "tasks"
  | "reminders"
  | "payments"
  | "budgets"
  | "events"
  | "chat";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const SECTION_DETAILS: Record<
  Section,
  {
    label: string;
    eyebrow: string;
    description: string;
    accent: string;
    aura: string;
    shadow: string;
    dockLabel: string;
    icon: IconComponent;
  }
> = {
  chat: {
    label: "Vimi",
    eyebrow: "Presence mode",
    description: "A space to talk, decide, and set in motion what matters most with Vimi.",
    accent: "#d97757",
    aura: "#f4c7a0",
    shadow: "rgba(217, 119, 87, 0.35)",
    dockLabel: "Vimi",
    icon: CompanionIcon,
  },
  tasks: {
    label: "Focus",
    eyebrow: "Focus mode",
    description: "Your important commitments, without the rigidity of a corporate dashboard.",
    accent: "#688b7c",
    aura: "#b6d2c4",
    shadow: "rgba(104, 139, 124, 0.28)",
    dockLabel: "Focus",
    icon: TaskIcon,
  },
  reminders: {
    label: "Care",
    eyebrow: "Care mode",
    description: "Follow-ups and reminders with a human tone, designed to move actions without overwhelming you.",
    accent: "#c58a63",
    aura: "#f0d0b2",
    shadow: "rgba(197, 138, 99, 0.3)",
    dockLabel: "Care",
    icon: BellIcon,
  },
  payments: {
    label: "Payments",
    eyebrow: "Rhythm mode",
    description: "Recurring payments and financial commitments — visible, clear, and calm.",
    accent: "#6d7ea8",
    aura: "#c8d1eb",
    shadow: "rgba(109, 126, 168, 0.3)",
    dockLabel: "Payments",
    icon: CardIcon,
  },
  budgets: {
    label: "Pulse",
    eyebrow: "Balance mode",
    description: "Budget with a soft read: less cold control, more awareness.",
    accent: "#8a7361",
    aura: "#e2cbb7",
    shadow: "rgba(138, 115, 97, 0.28)",
    dockLabel: "Pulse",
    icon: PulseIcon,
  },
  events: {
    label: "Moments",
    eyebrow: "Life mode",
    description: "Your upcoming meetings and events with the feel of a livable calendar.",
    accent: "#8f7bb5",
    aura: "#d7d0ea",
    shadow: "rgba(143, 123, 181, 0.28)",
    dockLabel: "Moments",
    icon: CalendarIcon,
  },
};

export const NAV_ITEMS = (
  Object.entries(SECTION_DETAILS) as Array<[Section, (typeof SECTION_DETAILS)[Section]]>
).map(([id, detail]) => ({
  id,
  ...detail,
}));

export interface SidebarProps {
  active: Section;
  onChange: (s: Section) => void;
}

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="relative z-10 flex h-screen w-16 shrink-0 flex-col items-center border-r border-[rgba(255,255,255,0.07)] py-5" style={{ background: "rgba(7, 13, 16, 0.82)", backdropFilter: "blur(24px) saturate(1.2)" }}>

      {/* Logo orb */}
      <div
        className="mb-4 h-9 w-9 shrink-0 rounded-[11px] border border-[rgba(255,255,255,0.12)]"
        style={{
          background: "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.92), rgba(255,255,255,0.18) 20%, rgba(32,227,194,0.22) 55%, rgba(7,16,14,0.96) 100%)",
          boxShadow: "0 0 18px rgba(32,227,194,0.15), 0 4px 14px rgba(0,0,0,0.5)",
        }}
      />

      {/* Nav items */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              title={item.label}
              className={cn(
                "group relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200",
                isActive
                  ? "border border-[rgba(32,227,194,0.16)] bg-[rgba(32,227,194,0.07)]"
                  : "hover:bg-[rgba(255,255,255,0.05)]",
              )}
            >
              {/* active left indicator */}
              {isActive && (
                <span
                  className="absolute -left-[9px] top-1/4 h-1/2 w-0.5 rounded-r-full"
                  style={{
                    background: "var(--teal)",
                    boxShadow: "0 0 8px var(--teal), 0 0 16px rgba(32,227,194,0.3)",
                    animation: "glowPulse 3s ease-in-out infinite",
                  }}
                />
              )}
              <item.icon
                className="h-4 w-4"
                style={{ color: isActive ? "var(--teal)" : "rgba(180,204,201,0.38)" }}
              />
              <span
                className="text-[7px] font-['Geist'] font-normal tracking-[0.06em] uppercase leading-none"
                style={{ color: isActive ? "rgba(32,227,194,0.7)" : "rgba(180,204,201,0.32)" }}
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
          style={{ background: "var(--teal)", boxShadow: "0 0 6px var(--teal)" }}
        />
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] text-[11px] font-['Geist']"
          style={{
            background: "rgba(32,227,194,0.12)",
            color: "rgba(32,227,194,0.8)",
            boxShadow: "0 0 10px rgba(32,227,194,0.08)",
          }}
        >
          V
        </div>
      </div>
    </aside>
  );
}

function TaskIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 6h10" strokeLinecap="round" />
      <path d="M9 12h10" strokeLinecap="round" />
      <path d="M9 18h10" strokeLinecap="round" />
      <path d="m4.5 6.5 1.7 1.7L8.9 5.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.5 12.5 1.7 1.7 2.7-2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.5 18.5 1.7 1.7 2.7-2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M9 18h6m-8-1.4c.8-.8 1.2-2 1.2-3.1V10a3.8 3.8 0 1 1 7.6 0v3.5c0 1.1.4 2.3 1.2 3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" strokeLinecap="round" />
      <path d="M7 15h3" strokeLinecap="round" />
    </svg>
  );
}

function PulseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M3 12h3.5l2.1-4.5L12 17l2.4-5h6.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 6.5a2 2 0 1 1 0 4" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" strokeLinecap="round" />
      <path d="M8.5 13h3M8.5 16.5h7" strokeLinecap="round" />
    </svg>
  );
}

function CompanionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M12 20c4.4 0 7-2.5 7-5.6 0-2.1-1.3-4-3.2-4.9-.2-3.1-1.8-5.2-3.8-5.2S8.4 6.4 8.2 9.5C6.3 10.4 5 12.3 5 14.4 5 17.5 7.6 20 12 20Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.6 13.1h.01M14.4 13.1h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 16c.6.5 1.2.8 2 .8s1.4-.3 2-.8" strokeLinecap="round" />
    </svg>
  );
}
