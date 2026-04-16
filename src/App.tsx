import { useEffect, useRef, useState, type CSSProperties, type ComponentType, type SVGProps } from "react";
import { Authenticated, Unauthenticated, useAction, useQuery } from "convex/react";
import { Toaster, toast } from "sonner";
import { api } from "../convex/_generated/api";
import { BudgetsSection } from "./components/BudgetsSection";
import { ChatTranscript } from "./components/ChatSection";
import { EventsSection } from "./components/EventsSection";
import { PaymentsSection } from "./components/PaymentsSection";
import { RemindersSection } from "./components/RemindersSection";
import { Sidebar, SECTION_DETAILS, type Section } from "./components/Sidebar";
import { TasksSection } from "./components/TasksSection";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { useVoiceChat, type VoiceMode } from "./hooks/useVoiceChat";
import { useElectronBridge } from "./hooks/useElectronBridge";
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
          <h1 className="mt-6 max-w-3xl text-4xl font-light leading-tight text-white sm:text-5xl">
            Your life, decided by you.{" "}
            <em className="italic text-[rgba(200,180,255,0.8)]">Executed by Vimi.</em>
          </h1>
          <p className="mt-5 max-w-2xl font-['DM_Sans'] text-base font-light leading-7 text-[rgba(100,85,160,0.7)] sm:text-lg">
            Vimi should feel like an intelligent companion with agency: warm, clear, and ready to
            turn intent into motion.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {COMPANION_PILLARS.map((pillar) => (
              <article key={pillar.title} className="panel-soft p-4">
                <p className="font-['Outfit'] text-sm font-medium tracking-wide text-white">{pillar.title}</p>
                <p className="mt-2 font-['DM_Sans'] text-sm font-light leading-6 text-[rgba(100,85,160,0.7)]">{pillar.body}</p>
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
              <p className="font-['Outfit'] text-[10px] uppercase tracking-[0.26em] text-[rgba(0,255,180,0.55)]">Welcome to Vimi</p>
              <h2 className="mt-1 text-3xl font-light text-white">Step into your orbit</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[rgba(180,160,230,0.65)]">
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
  const electron = useElectronBridge();
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
      "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92), rgba(255,255,255,0.16) 18%, transparent 36%), radial-gradient(circle at 50% 60%, rgba(32,227,194,0.28), rgba(102,116,255,0.18) 54%, rgba(255,255,255,0.04) 100%)",
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.12), 0 32px 120px rgba(32,227,194,0.18), 0 0 80px rgba(102,116,255,0.10)",
  };

  const launchVimi = () => {
    if (voice.activeMode === "idle") {
      voice.startListening();
    } else {
      voice.stopAll();
    }
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
    if (electron.isElectron) {
      void electron.openExternal(url);
    } else {
      window.location.href = url;
    }
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
    <div className="space-glass-bg relative flex h-screen overflow-hidden">
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
}

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
        <h1 className="mt-3 font-['Cormorant_Garamond'] text-4xl leading-tight text-white sm:text-5xl">
          Your life,{" "}
          <em className="italic text-[rgba(200,180,255,0.85)]">your orbit.</em>
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
            <h2 className="mt-3 font-['Cormorant_Garamond'] text-4xl text-white">{detail.label}</h2>
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
  isElectron,
  getAutoStart,
  setAutoStart,
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
  isElectron: boolean;
  getAutoStart: () => Promise<boolean>;
  setAutoStart: (enabled: boolean) => Promise<void>;
}) {
  return (
    <aside className="fade-rise delay-1 flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-[rgba(255,255,255,0.07)] px-3.5 py-4" style={{ background: "rgba(7,13,16,0.82)", backdropFilter: "blur(20px) saturate(1.2)" }}>
      <div className="flex flex-col gap-3">
        <div className="panel-soft p-4">
          <p className="hud-label">Today</p>
          <p className="mt-3 text-sm leading-7 text-[rgba(216,235,232,0.8)]">{today}</p>
        </div>

        <div className="panel-soft p-4">
          <p className="hud-label">Current mode</p>
          <div className="mt-4 flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: activeDetail.accent, boxShadow: `0 0 20px ${activeDetail.shadow}` }}
            />
            <div>
              <p className="text-sm font-semibold text-white">{activeDetail.label}</p>
              <p className="mt-1 text-sm text-[rgba(180,204,201,0.5)]">{activeMode}</p>
            </div>
          </div>
        </div>

        <div className="panel-soft p-4">
          <p className="hud-label">Connected</p>
          <p className="mt-3 text-sm font-semibold text-white">{userName}</p>
          <button
            type="button"
            onClick={onToggleAutoListen}
            className={cn(
              "status-chip mt-4 cursor-pointer transition-colors",
              autoListen && "!border-[rgba(32,227,194,0.4)] !bg-[rgba(32,227,194,0.08)] !text-[rgba(32,227,194,0.85)]",
            )}
          >
            {autoListen ? "auto-listen on" : "auto-listen off"}
          </button>
          {isElectron && (
            <AutoStartToggle getAutoStart={getAutoStart} setAutoStart={setAutoStart} />
          )}
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>

        <div className="panel-soft p-4">
          <p className="hud-label">Google</p>
          <p className="mt-3 text-sm font-semibold text-white">
            {googleIntegration?.status === "connected"
              ? googleIntegration.accountLabel ?? "Connected"
              : "Not connected"}
          </p>
          <p className="mt-1 text-sm text-[rgba(180,204,201,0.5)]">
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

        <div className="panel-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="hud-label">Pending approvals</p>
            <span className="status-chip">{pendingApprovals.length}</span>
          </div>

          {pendingApprovals.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-[rgba(180,204,201,0.5)]">
              When Vimi needs approval for something high-risk, it will appear here.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {pendingApprovals.slice(0, 4).map((approval) => (
                <div key={approval._id} className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-3">
                  <p className="text-sm font-medium text-white">{approval.humanSummary}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[rgba(180,204,201,0.38)]">
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
      <div className="absolute left-[-10rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[rgba(32,227,194,0.07)] blur-[130px]" />
      <div className="absolute right-[-8rem] top-[8%] h-[24rem] w-[24rem] rounded-full bg-[rgba(102,116,255,0.07)] blur-[120px]" />
      <div className="absolute bottom-[-12rem] left-[14%] h-[30rem] w-[30rem] rounded-full bg-[rgba(32,227,194,0.05)] blur-[150px]" />
      <div className="absolute bottom-[10%] right-[10%] h-[20rem] w-[20rem] rounded-full bg-[rgba(102,116,255,0.06)] blur-[110px]" />
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
    <div className="relative inline-flex items-center justify-center p-8">
      {/* outer ring */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full border border-[rgba(255,255,255,0.06)]"
        style={{ animation: "orbThink 12s linear infinite" }}
      />
      {/* mid dashed ring */}
      <span
        className="pointer-events-none absolute inset-4 rounded-full border border-dashed border-[rgba(32,227,194,0.1)]"
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
              mode === "listening" && "animate-ping opacity-10 ring-4 ring-[rgba(32,227,194,0.5)]",
              mode === "speaking"  && "animate-ping opacity-[0.12] ring-4 ring-[rgba(32,227,194,0.5)]",
              mode === "thinking"  && "animate-pulse opacity-10 ring-4 ring-[rgba(102,116,255,0.4)]",
            )}
            style={{ animationDuration: mode === "thinking" ? "1.4s" : "1.2s" }}
          />
        )}
      </button>
    </div>
  );
}

function MiniOrbLauncher({ mode, onClick }: { mode: VoiceMode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-10 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border text-white transition-all duration-300 hover:scale-105",
        mode === "idle" ? "galaxy-orb-idle border-[rgba(255,255,255,0.1)]" : "voice-orb is-thinking",
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
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[rgba(5,7,8,0.72)] px-5" style={{ backdropFilter: "blur(16px)" }}>
      <div className="flex items-center gap-2">
        <span className="font-['Outfit'] text-[10px] uppercase tracking-[0.2em] text-[rgba(180,204,201,0.38)]">
          Vimi
        </span>
        <span className="text-[10px] text-[rgba(32,227,194,0.25)]">›</span>
        <span className="font-['Outfit'] text-[10px] uppercase tracking-[0.2em] text-[rgba(32,227,194,0.65)]">
          {detail.eyebrow}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="status-chip">{activeMode}</span>
        <span className="font-['Outfit'] text-[10px] text-[rgba(180,204,201,0.38)]">{today}</span>
      </div>
    </div>
  );
}

function StatusStrip() {
  return (
    <div className="flex h-7 shrink-0 items-center gap-5 border-t border-[rgba(255,255,255,0.05)] bg-[rgba(5,7,8,0.88)] px-5">
      {[
        { color: "var(--teal)",   label: "Vimi online" },
        { color: "var(--violet)", label: "Convex connected" },
        { color: "var(--teal)",   label: "TTS ready" },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 4px ${color}` }}
          />
          <span className="font-['Outfit'] text-[9px] uppercase tracking-[0.1em] text-[rgba(180,204,201,0.32)]">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function AutoStartToggle({
  getAutoStart,
  setAutoStart,
}: {
  getAutoStart: () => Promise<boolean>;
  setAutoStart: (enabled: boolean) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void getAutoStart().then(setEnabled);
  }, [getAutoStart]);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    await setAutoStart(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "status-chip mt-2 cursor-pointer transition-colors",
        enabled && "!border-[rgba(102,116,255,0.4)] !bg-[rgba(102,116,255,0.1)] !text-[rgba(180,190,255,0.9)]",
      )}
    >
      {enabled ? "start with Windows on" : "start with Windows off"}
    </button>
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
