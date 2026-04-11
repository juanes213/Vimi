import { useEffect, useRef, useState, type CSSProperties, type ComponentType, type SVGProps } from "react";
import { Authenticated, Unauthenticated, useAction, useQuery } from "convex/react";
import { Toaster, toast } from "sonner";
import { api } from "../convex/_generated/api";
import { BudgetsSection } from "./components/BudgetsSection";
import { ChatTranscript } from "./components/ChatSection";
import { EventsSection } from "./components/EventsSection";
import { PaymentsSection } from "./components/PaymentsSection";
import { RemindersSection } from "./components/RemindersSection";
import { SECTION_DETAILS, type Section } from "./components/Sidebar";
import { TasksSection } from "./components/TasksSection";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { useVoiceChat, type VoiceMode } from "./hooks/useVoiceChat";
import { cn } from "./lib/utils";

const COMPANION_PILLARS = [
  {
    title: "Presence",
    body: "A calmer visual identity with Vimi as the emotional center of the product.",
  },
  {
    title: "Execution",
    body: "Vimi should feel capable of moving your decisions into action, not just storing them.",
  },
  {
    title: "Atmosphere",
    body: "Soft galaxy gradients, subtle stars, and minimal motion so the page stays smooth.",
  },
];

const NAV_PAGES: Section[] = ["chat", "tasks", "reminders", "payments", "budgets", "events"];

function mapAssistantMessageToSection(parsedType?: string): Section | null {
  if (!parsedType) return null;
  if (parsedType === "internal.createTask") return "tasks";
  if (parsedType === "internal.createReminder" || parsedType === "reminder.delivery") return "reminders";
  if (
    parsedType === "internal.createEvent" ||
    parsedType === "calendar.createEvent" ||
    parsedType === "calendar.updateEvent" ||
    parsedType === "calendar.listEvents"
  ) {
    return "events";
  }
  return null;
}

function playReminderChime() {
  if (typeof window === "undefined") return;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

  const notes = [880, 1174.66, 1567.98];
  notes.forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, now + index * 0.14);
    osc.connect(gain);
    osc.start(now + index * 0.14);
    osc.stop(now + index * 0.14 + 0.28);
  });

  window.setTimeout(() => {
    void ctx.close();
  }, 1400);
}

export default function App() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <Authenticated>
        <Dashboard />
      </Authenticated>
      <Unauthenticated>
        <AuthPage />
      </Unauthenticated>
      <Toaster richColors />
    </div>
  );
}

function AuthPage() {
  return (
    <div className="soft-galaxy relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <BackgroundEffects />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel-surface fade-rise p-8 sm:p-10 lg:p-12">
          <span className="status-chip">Vimi / life assistant</span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Your life, decided by you. Executed by Vimi.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Vimi should feel like an intelligent companion with agency: warm, clear, and ready to
            turn intent into motion.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {COMPANION_PILLARS.map((pillar) => (
              <article key={pillar.title} className="panel-soft p-4">
                <p className="text-sm font-semibold text-white">{pillar.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel-soft fade-rise delay-1 p-7 sm:p-8">
          <div className="mb-8 flex items-center gap-4">
            <div className="floating-orb relative h-20 w-20">
              <div className="glow-pulse absolute inset-0 rounded-full galaxy-orb-idle" />
              <div className="absolute inset-[22%] rounded-full border border-white/20 bg-white/8" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Welcome to Vimi</p>
              <h2 className="mt-1 text-3xl font-semibold text-white">Step into your orbit</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">
                A calmer, more immersive entry point built around Vimi instead of around a dashboard.
              </p>
            </div>
          </div>
          <SignInForm />
        </section>
      </div>
    </div>
  );
}

function Dashboard() {
  const [activePage, setActivePage] = useState<Section>("chat");
  const user = useQuery(api.auth.loggedInUser);
  const chatMessages = useQuery(api.chat.listMessages) ?? [];
  const integrations = useQuery(api.integrations.listStatuses) ?? [];
  const pendingApprovals = useQuery(api.approvals.listPending) ?? [];
  const getGoogleConnectUrl = useAction(api.integrations.getGoogleConnectUrl);
  const disconnectGoogle = useAction(api.integrations.disconnectGoogle);
  const approvePendingApproval = useAction(api.approvals.approvePendingApproval);
  const rejectPendingApproval = useAction(api.approvals.rejectPendingApproval);
  const userName = user?.email?.split("@")[0] ?? "you";
  const voice = useVoiceChat();
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const activeDetail = SECTION_DETAILS[activePage];
  const googleIntegration = integrations.find((integration) => integration.provider === "google");
  const lastReminderToastId = useRef<string | null>(null);
  const lastHandledAssistantActionId = useRef<string | null>(null);
  const orbStyle: CSSProperties = {
    background:
      "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92), rgba(185,153,255,0.95) 26%, rgba(137,92,255,0.9) 52%, rgba(58,25,124,0.95) 100%)",
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.12), 0 32px 120px rgba(125,92,255,0.34), 0 0 120px rgba(226,104,255,0.14)",
  };

  const launchVimi = () => {
    if (activePage !== "chat") {
      setActivePage("chat");
      return;
    }
    if (voice.activeMode === "idle") {
      voice.startListening();
      return;
    }
    voice.stopAll();
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const googleStatus = url.searchParams.get("google");
    if (!googleStatus) return;

    if (googleStatus === "connected") {
      toast.success("Google connected");
    } else {
      toast.error(url.searchParams.get("detail") ?? "Google connection failed");
    }

    url.searchParams.delete("google");
    url.searchParams.delete("reason");
    url.searchParams.delete("detail");
    window.history.replaceState({}, "", url.toString());
  }, []);

  useEffect(() => {
    const latestReminder = [...chatMessages]
      .reverse()
      .find((message) => message.role === "assistant" && message.parsedType === "reminder.delivery");

    if (!latestReminder || latestReminder._id === lastReminderToastId.current) return;

    lastReminderToastId.current = latestReminder._id;
    playReminderChime();
    toast(latestReminder.text, {
      description: "Vimi reminder",
    });
  }, [chatMessages]);

  useEffect(() => {
    const latestAssistantAction = [...chatMessages]
      .reverse()
      .find((message) => message.role === "assistant" && !!message.parsedType);

    if (!latestAssistantAction || latestAssistantAction._id === lastHandledAssistantActionId.current) return;

    lastHandledAssistantActionId.current = latestAssistantAction._id;
    const targetSection = mapAssistantMessageToSection(latestAssistantAction.parsedType);
    if (!targetSection) return;
    setActivePage(targetSection);
  }, [chatMessages]);

  const handleConnectGoogle = async () => {
    const url = await getGoogleConnectUrl({ returnTo: window.location.href });
    window.location.href = url;
  };

  const handleDisconnectGoogle = async () => {
    await disconnectGoogle({});
    toast.success("Google disconnected");
  };

  const handleApprove = async (approvalId: string) => {
    const result = await approvePendingApproval({ approvalId: approvalId as never });
    toast.success(result.assistantText ?? "Approved");
  };

  const handleReject = async (approvalId: string) => {
    const result = await rejectPendingApproval({ approvalId: approvalId as never });
    toast.success(result.assistantText ?? "Rejected");
  };

  return (
    <div className="soft-galaxy relative min-h-screen overflow-hidden">
      <BackgroundEffects />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-24 pt-5 sm:px-6 lg:px-8">
        <header className="fade-rise">
          <div className="panel-surface overflow-x-auto px-3 py-3 sm:px-4">
            <nav className="mx-auto flex w-max min-w-full justify-start gap-2 md:min-w-0 md:justify-center">
              {NAV_PAGES.map((page) => {
                const detail = SECTION_DETAILS[page];
                const Icon = detail.icon as ComponentType<SVGProps<SVGSVGElement>>;
                const isActive = activePage === page;

                return (
                  <button
                    key={page}
                    onClick={() => setActivePage(page)}
                    className={cn(
                      "group flex items-center gap-3 rounded-full px-4 py-3 text-left transition-all duration-300",
                      isActive
                        ? "bg-white/12 text-white ring-1 ring-white/16"
                        : "text-slate-300 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-all",
                        isActive ? "bg-white/14" : "bg-white/6",
                      )}
                      style={{
                        boxShadow: `inset 0 0 0 1px ${isActive ? "rgba(255,255,255,0.14)" : detail.aura}`,
                      }}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-300")} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold leading-none">{detail.label}</p>
                      <p className={cn("mt-1 text-[11px]", isActive ? "text-slate-300" : "text-slate-500")}>
                        {detail.eyebrow}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="grid flex-1 gap-6 pt-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            {activePage === "chat" ? (
              <VimiPage voice={voice} orbStyle={orbStyle} />
            ) : (
              <FeaturePage section={activePage} />
            )}
          </div>

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
          />
        </main>

        <MiniOrbLauncher mode={voice.activeMode} onClick={launchVimi} />
      </div>
    </div>
  );
}

function VimiPage({
  voice,
  orbStyle,
}: {
  voice: ReturnType<typeof useVoiceChat>;
  orbStyle: CSSProperties;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-col items-center gap-7 pt-4 text-center">
        <div className="fade-rise delay-1">
          <CentralOrb
            mode={voice.activeMode}
            level={voice.micLevel}
            orbStyle={orbStyle}
            onClick={voice.activeMode === "idle" ? voice.startListening : voice.stopAll}
          />
        </div>

        <div className="fade-rise delay-2 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Vimi</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Your life, decided by you. Executed by Vimi.
          </h1>
          <p className="mt-5 text-sm leading-7 text-slate-400 sm:text-base">
            {voice.activeMode === "idle" && "Tap the orb to talk with Vimi"}
            {voice.activeMode === "listening" && "Listening... speak naturally"}
            {voice.activeMode === "thinking" && "Vimi is thinking..."}
            {voice.activeMode === "speaking" && "Vimi is speaking. Tap or talk to interrupt."}
          </p>
        </div>

        {(voice.activeMode === "speaking" || voice.activeMode === "thinking") && (
          <button type="button" onClick={voice.stopAll} className="secondary-button !px-5 !py-2 text-sm">
            Stop
          </button>
        )}
      </div>

      <div className="mx-auto mt-10 w-full max-w-4xl fade-rise delay-2">
        <div className="panel-soft overflow-hidden" style={{ height: "clamp(230px, 34vh, 390px)" }}>
          <ChatTranscript liveAssistant={voice.liveAssistant} activeMode={voice.activeMode} />
        </div>
        <TextInput onSend={voice.interruptAndSend} disabled={voice.activeMode === "thinking"} />
      </div>
    </div>
  );
}

function FeaturePage({ section }: { section: Exclude<Section, "chat"> }) {
  const detail = SECTION_DETAILS[section];
  const Icon = detail.icon as ComponentType<SVGProps<SVGSVGElement>>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="panel-surface fade-rise p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{detail.eyebrow}</p>
            <h2 className="mt-3 text-4xl font-semibold text-white">{detail.label}</h2>
            <p className="mt-4 text-base leading-8 text-slate-300">{detail.description}</p>
          </div>

          <div className="panel-soft flex items-center gap-4 self-start px-5 py-4">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-[20px]"
              style={{
                background: `linear-gradient(135deg, ${detail.aura}, ${detail.accent})`,
                boxShadow: `0 18px 40px ${detail.shadow}`,
              }}
            >
              <Icon className="h-6 w-6 text-white" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{detail.label}</p>
              <p className="mt-1 text-sm text-slate-400">Dedicated page, more room, less compression.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-surface fade-rise delay-1 p-5 sm:p-6 lg:p-7">{renderUtility(section)}</section>
    </div>
  );
}

function SideInfoPanel({
  activeDetail,
  activeMode,
  autoListen,
  onToggleAutoListen,
  today,
  userName,
  googleIntegration,
  pendingApprovals,
  onConnectGoogle,
  onDisconnectGoogle,
  onApprove,
  onReject,
}: {
  activeDetail: (typeof SECTION_DETAILS)[Section];
  activeMode: VoiceMode;
  autoListen: boolean;
  onToggleAutoListen: () => void;
  today: string;
  userName: string;
  googleIntegration?: {
    accountLabel?: string;
    status: string;
    lastSyncAt?: number;
  };
  pendingApprovals: Array<{
    _id: string;
    humanSummary: string;
    toolName: string;
  }>;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}) {
  return (
    <aside className="fade-rise delay-1 xl:pt-2">
      <div className="grid gap-4 xl:sticky xl:top-5">
        <div className="panel-soft p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Today</p>
          <p className="mt-3 text-sm leading-7 text-slate-200">{today}</p>
        </div>

        <div className="panel-soft p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Current mode</p>
          <div className="mt-4 flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: activeDetail.accent, boxShadow: `0 0 20px ${activeDetail.shadow}` }}
            />
            <div>
              <p className="text-sm font-semibold text-white">{activeDetail.label}</p>
              <p className="mt-1 text-sm text-slate-400">{activeMode}</p>
            </div>
          </div>
        </div>

        <div className="panel-soft p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Connected</p>
          <p className="mt-3 text-sm font-semibold text-white">{userName}</p>
          <button
            type="button"
            onClick={onToggleAutoListen}
            className={cn(
              "status-chip mt-4 cursor-pointer transition-colors",
              autoListen && "!border-cyan-300/40 !bg-cyan-400/10 !text-cyan-200",
            )}
          >
            {autoListen ? "auto-listen on" : "auto-listen off"}
          </button>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>

        <div className="panel-soft p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Google</p>
          <p className="mt-3 text-sm font-semibold text-white">
            {googleIntegration?.status === "connected"
              ? googleIntegration.accountLabel ?? "Connected"
              : "Not connected"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {googleIntegration?.status === "connected"
              ? "Gmail and Calendar are available for Vimi."
              : "Connect Google so Vimi can read Gmail and manage Calendar."}
          </p>
          <button
            type="button"
            onClick={googleIntegration?.status === "connected" ? onDisconnectGoogle : onConnectGoogle}
            className="secondary-button mt-4 w-full justify-center text-sm"
          >
            {googleIntegration?.status === "connected" ? "Disconnect Google" : "Connect Google"}
          </button>
        </div>

        <div className="panel-soft p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pending approvals</p>
            <span className="status-chip">{pendingApprovals.length}</span>
          </div>

          {pendingApprovals.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-slate-400">
              When Vimi needs approval for something high-risk, it will appear here.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {pendingApprovals.slice(0, 4).map((approval) => (
                <div key={approval._id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-sm font-medium text-white">{approval.humanSummary}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    {approval.toolName}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onApprove(approval._id)}
                      className="primary-button flex-1 justify-center !px-3 !py-2 text-xs"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(approval._id)}
                      className="secondary-button flex-1 justify-center !px-3 !py-2 text-xs"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function BackgroundEffects() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="starfield starfield-near absolute inset-0" />
      <div className="starfield starfield-far absolute inset-0" />
      <div className="absolute left-[-10rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[#6f35ff]/20 blur-[130px]" />
      <div className="absolute right-[-8rem] top-[8%] h-[24rem] w-[24rem] rounded-full bg-[#ef6cff]/14 blur-[120px]" />
      <div className="absolute bottom-[-12rem] left-[14%] h-[30rem] w-[30rem] rounded-full bg-[#2fc4ff]/12 blur-[150px]" />
      <div className="absolute bottom-[10%] right-[10%] h-[20rem] w-[20rem] rounded-full bg-[#7a5cff]/16 blur-[110px]" />
    </div>
  );
}

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
    <button
      type="button"
      onClick={onClick}
      aria-label={mode === "idle" ? "Talk to Vimi" : "Stop"}
      className={cn(
        "voice-orb relative h-56 w-56 cursor-pointer border-none outline-none transition-transform duration-300 active:scale-95 sm:h-64 sm:w-64",
        mode === "idle" && "is-idle floating-orb",
        mode === "listening" && "is-listening",
        mode === "thinking" && "is-thinking",
        mode === "speaking" && "is-speaking",
      )}
      style={mode === "idle" ? orbStyle : undefined}
    >
      <div className="absolute inset-[-10%] rounded-full border border-white/10 bg-white/[0.02] blur-md" />
      <div className="absolute inset-[13%] rounded-full border border-white/18 bg-white/[0.05] backdrop-blur-sm" />
      <div className="absolute inset-[28%] rounded-full border border-white/16 bg-white/[0.04]" />

      <div className="absolute inset-0 flex items-center justify-center">
        {mode === "idle" && (
          <svg viewBox="0 0 24 24" fill="none" className="h-14 w-14 text-white" strokeWidth="1.8" stroke="currentColor">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
          </svg>
        )}
        {mode === "listening" && <OrbAudioBars level={level} />}
        {mode === "thinking" && (
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
            mode === "listening" && "animate-ping opacity-20 ring-4 ring-fuchsia-300/70",
            mode === "speaking" && "animate-ping opacity-15 ring-4 ring-cyan-300/60",
            mode === "thinking" && "animate-pulse opacity-20 ring-4 ring-violet-300/60",
          )}
          style={{ animationDuration: mode === "thinking" ? "1.4s" : "1.2s" }}
        />
      )}
    </button>
  );
}

function MiniOrbLauncher({
  mode,
  onClick,
}: {
  mode: VoiceMode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full border border-white/14 text-white shadow-[0_18px_60px_rgba(39,20,90,0.45)] transition-all duration-300 hover:scale-105",
        mode === "idle" ? "galaxy-orb-idle" : "voice-orb is-thinking",
      )}
      aria-label="Open Vimi"
      title="Open Vimi"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white" strokeWidth="1.8" stroke="currentColor">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function OrbAudioBars({ level }: { level: number }) {
  const base = Math.max(0.18, level);
  const heights = [0.45, 0.7, 1, 0.8, 0.55, 0.75, 0.4].map((factor) =>
    Math.min(56, base * 60 * factor + 6),
  );
  return (
    <span className="flex items-center gap-[3px]">
      {heights.map((height, index) => (
        <span key={index} className="voice-bar !w-[4px]" style={{ height: `${height}px` }} />
      ))}
    </span>
  );
}

function OrbSpeakingWave() {
  return (
    <span className="flex items-center gap-[3px]">
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <span
          key={index}
          className="voice-bar !w-[4px]"
          style={{ animation: `speakBar 0.9s ease-in-out ${index * 0.08}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes speakBar {
          0%, 100% { height: 8px; }
          50% { height: 44px; }
        }
      `}</style>
    </span>
  );
}

function TextInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
      <input
        className="surface-input flex-1 text-sm"
        placeholder="Or type a message..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={disabled}
      />
      <button type="submit" disabled={!input.trim() || disabled} className="primary-button shrink-0 px-6">
        Send
      </button>
    </form>
  );
}

function renderUtility(section: Exclude<Section, "chat">) {
  if (section === "tasks") return <TasksSection />;
  if (section === "reminders") return <RemindersSection />;
  if (section === "payments") return <PaymentsSection />;
  if (section === "budgets") return <BudgetsSection />;
  if (section === "events") return <EventsSection />;

  return null;
}
