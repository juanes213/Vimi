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
    description: "Un espacio para hablar, decidir y poner en marcha lo importante con Vimi.",
    accent: "#d97757",
    aura: "#f4c7a0",
    shadow: "rgba(217, 119, 87, 0.35)",
    dockLabel: "Vimi",
    icon: CompanionIcon,
  },
  tasks: {
    label: "Enfoque",
    eyebrow: "Focus mode",
    description: "Tus compromisos importantes, sin rigidez de dashboard corporativo.",
    accent: "#688b7c",
    aura: "#b6d2c4",
    shadow: "rgba(104, 139, 124, 0.28)",
    dockLabel: "Enfoque",
    icon: TaskIcon,
  },
  reminders: {
    label: "Cuidados",
    eyebrow: "Care mode",
    description: "Seguimientos y recordatorios con tono humano, pensados para mover acciones sin invadirte.",
    accent: "#c58a63",
    aura: "#f0d0b2",
    shadow: "rgba(197, 138, 99, 0.3)",
    dockLabel: "Cuidados",
    icon: BellIcon,
  },
  payments: {
    label: "Pagos",
    eyebrow: "Rhythm mode",
    description: "Pagos recurrentes y compromisos financieros visibles, claros y serenos.",
    accent: "#6d7ea8",
    aura: "#c8d1eb",
    shadow: "rgba(109, 126, 168, 0.3)",
    dockLabel: "Pagos",
    icon: CardIcon,
  },
  budgets: {
    label: "Pulso",
    eyebrow: "Balance mode",
    description: "Presupuesto con lectura suave: menos control frio, mas conciencia.",
    accent: "#8a7361",
    aura: "#e2cbb7",
    shadow: "rgba(138, 115, 97, 0.28)",
    dockLabel: "Pulso",
    icon: PulseIcon,
  },
  events: {
    label: "Momentos",
    eyebrow: "Life mode",
    description: "Tus proximos encuentros y eventos con una sensacion de calendario habitable.",
    accent: "#8f7bb5",
    aura: "#d7d0ea",
    shadow: "rgba(143, 123, 181, 0.28)",
    dockLabel: "Momentos",
    icon: CalendarIcon,
  },
};

const NAV_ITEMS = (
  Object.entries(SECTION_DETAILS) as Array<[Section, (typeof SECTION_DETAILS)[Section]]>
).map(([id, detail]) => ({
  id,
  ...detail,
}));

interface SidebarProps {
  active: Section;
  onChange: (s: Section) => void;
}

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <nav className="pointer-events-auto w-full max-w-4xl rounded-[28px] border border-white/70 bg-white/72 p-2 shadow-[0_24px_80px_rgba(82,64,46,0.18)] backdrop-blur-2xl">
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={cn(
                  "group rounded-[22px] px-3 py-3 text-left transition-all duration-300",
                  isActive
                    ? "translate-y-[-6px] bg-stone-900 text-white shadow-[0_18px_40px_rgba(40,31,24,0.28)]"
                    : "text-stone-600 hover:bg-white/85 hover:text-stone-900",
                )}
              >
                <span
                  className={cn(
                    "mb-2 flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300",
                    isActive ? "bg-white/18" : "bg-stone-100/80 group-hover:bg-white",
                  )}
                  style={!isActive ? { boxShadow: `inset 0 0 0 1px ${item.aura}` } : undefined}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-300",
                      isActive ? "scale-105 text-white" : "text-stone-700 group-hover:scale-105",
                    )}
                  />
                </span>
                <span className="block text-sm font-semibold">{item.dockLabel}</span>
                <span
                  className={cn(
                    "mt-0.5 hidden text-xs leading-relaxed md:block",
                    isActive ? "text-white/72" : "text-stone-400",
                  )}
                >
                  {item.eyebrow}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
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
