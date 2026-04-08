import { useState, type CSSProperties } from "react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { SECTION_DETAILS, Sidebar, type Section } from "./components/Sidebar";
import { TasksSection } from "./components/TasksSection";
import { RemindersSection } from "./components/RemindersSection";
import { PaymentsSection } from "./components/PaymentsSection";
import { BudgetsSection } from "./components/BudgetsSection";
import { EventsSection } from "./components/EventsSection";
import { ChatSection } from "./components/ChatSection";

const SECTION_RITUALS: Record<Section, { title: string; body: string }[]> = {
  chat: [
    {
      title: "Habla sin protocolo",
      body: "Este espacio puede recibir ideas incompletas, emociones mezcladas o decisiones que aun no cierran.",
    },
    {
      title: "Convierte decision en ejecucion",
      body: "Desde aqui Vimi deberia transformar ideas y decisiones en acciones concretas.",
    },
    {
      title: "Siempre listo para actuar",
      body: "La experiencia necesita sentirse disponible, cercana y capaz de mover tu vida hacia delante.",
    },
  ],
  tasks: [
    {
      title: "Prioridad calmada",
      body: "La lista no debe presionar; debe ayudarte a distinguir lo esencial de lo accesorio.",
    },
    {
      title: "Ritmo sostenible",
      body: "Tus tareas viven mejor en bloques suaves y visibles, no en paneles agresivos.",
    },
    {
      title: "Progreso sensible",
      body: "Cada accion completada tiene que sentirse como alivio, no como burocracia.",
    },
  ],
  reminders: [
    {
      title: "Memoria con movimiento",
      body: "Los recordatorios deben convertirse en acciones, seguimiento y decisiones oportunas.",
    },
    {
      title: "Tiempo respirable",
      body: "Las fechas y horas importan, pero el tono con que se presentan cambia todo.",
    },
    {
      title: "Pequenos anclajes",
      body: "Esta seccion sostiene habitos y compromisos sin transformar tu dia en una lista militar.",
    },
  ],
  payments: [
    {
      title: "Flujo visible",
      body: "Los pagos recurrentes necesitan orden, pero tambien una lectura amable que no agobie.",
    },
    {
      title: "Confianza cotidiana",
      body: "La interfaz debe transmitir claridad financiera sin convertirse en una app bancaria.",
    },
    {
      title: "Menos alerta, mas control",
      body: "El objetivo es darte contexto y calma antes que urgencia y color rojo.",
    },
  ],
  budgets: [
    {
      title: "Dinero con contexto",
      body: "Tu presupuesto no es solo una cifra: es energia, decisiones y margen de tranquilidad.",
    },
    {
      title: "Lectura digestiva",
      body: "Visualiza el balance con superficies suaves, progreso delicado y sin ruido innecesario.",
    },
    {
      title: "Balance humano",
      body: "Esta parte debe sentirse cercana a una reflexion personal, no a un tablero ejecutivo.",
    },
  ],
  events: [
    {
      title: "Tiempo habitable",
      body: "Los eventos deben sentirse como escenas proximas de tu vida, no como filas de agenda.",
    },
    {
      title: "Anticipacion suave",
      body: "La proximidad importa, pero sin la ansiedad tipica de un calendario tradicional.",
    },
    {
      title: "Momentos con tono",
      body: "Cada fecha deberia verse como algo que te acompana y te prepara emocionalmente.",
    },
  ],
};

const SECTION_SIGNALS: Record<Section, string[]> = {
  chat: ["vimi", "ejecucion", "presencia"],
  tasks: ["prioridad", "avance", "ligereza"],
  reminders: ["cuidado", "timing", "accion"],
  payments: ["flujo", "orden", "ejecucion"],
  budgets: ["balance", "margen", "decision"],
  events: ["ritmo", "encuentros", "anticipacion"],
};

const COMPANION_PILLARS = [
  {
    title: "Mascota",
    body: "Detalles suaves, una presencia visual viva y pequena dosis de carisma.",
  },
  {
    title: "Consultor",
    body: "Orden, claridad y lectura practica sin contaminar la interfaz con rigidez corporativa.",
  },
  {
    title: "Amigo cercano",
    body: "Lenguaje calido, silencios visuales y una sensacion de acompanamiento persistente.",
  },
];

export default function App() {
  return (
    <div className="min-h-screen bg-transparent text-stone-900">
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
    <div className="soft-mesh relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6rem] top-10 h-72 w-72 rounded-full bg-[#f4c7a0]/30 blur-3xl" />
        <div className="absolute bottom-[-4rem] right-[-4rem] h-80 w-80 rounded-full bg-[#b6d2c4]/30 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel-surface fade-rise p-8 sm:p-10 lg:p-12">
          <span className="status-chip">Vimi / asistente de vida</span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-stone-900 sm:text-5xl">
            Tu vida, decidida por ti. Ejecutada por Vimi.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
            Vimi no esta aqui solo para recordar o tomar nota. Debe sentirse como una presencia
            amable que entiende contexto, propone claridad y ejecuta lo que tu decides.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {COMPANION_PILLARS.map((pillar) => (
              <article key={pillar.title} className="panel-soft p-4">
                <p className="text-sm font-semibold text-stone-900">{pillar.title}</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel-soft fade-rise delay-1 p-7 sm:p-8">
          <div className="mb-8 flex items-center gap-4">
            <div className="floating-orb relative h-20 w-20">
              <div
                className="glow-pulse absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.92), #f4c7a0 45%, #d97757 100%)",
                  boxShadow: "0 18px 50px rgba(217, 119, 87, 0.28)",
                }}
              />
              <div className="absolute inset-[22%] rounded-full border border-white/50 bg-white/18" />
            </div>

            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-stone-400">Bienvenido a Vimi</p>
              <h2 className="mt-1 text-3xl font-semibold text-stone-900">Entra a tu espacio con Vimi</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-stone-600">
                Una entrada limpia y serena para iniciar el dia con foco, conversacion y ejecucion.
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
  const [section, setSection] = useState<Section>("chat");
  const user = useQuery(api.auth.loggedInUser);
  const detail = SECTION_DETAILS[section];
  const Icon = detail.icon;
  const today = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const userName = user?.email?.split("@")[0] ?? "tu espacio";

  const orbStyle = {
    background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.94), ${detail.aura} 42%, ${detail.accent} 100%)`,
    boxShadow: `0 24px 70px ${detail.shadow}`,
  } satisfies CSSProperties;

  return (
    <div className="soft-mesh relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6rem] top-14 h-72 w-72 rounded-full bg-[#f4cfa3]/30 blur-3xl" />
        <div className="absolute bottom-[-5rem] right-[-4rem] h-80 w-80 rounded-full bg-[#c8d1eb]/26 blur-3xl" />
        <div className="absolute right-[22%] top-[14%] h-40 w-40 rounded-full bg-[#b6d2c4]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-32 pt-5 sm:px-6 lg:px-8">
        <header className="fade-rise flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="status-chip">Hoy / {today}</span>
            <span className="status-chip">Presencia suave</span>
            <span className="status-chip">Modo / {detail.label}</span>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto">
            <div className="panel-soft flex items-center gap-3 px-4 py-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold text-white"
                style={{ backgroundColor: detail.accent }}
              >
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Conectado con Vimi</p>
                <p className="text-sm font-semibold text-stone-900">{userName}</p>
              </div>
            </div>
            <SignOutButton />
          </div>
        </header>

        <div className="mt-6 grid flex-1 gap-6 xl:grid-cols-[0.95fr_1.35fr]">
          <section className="panel-surface fade-rise delay-1 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-stone-400">{detail.eyebrow}</p>
                <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight text-stone-900">
                  Vimi convierte decisiones en movimiento.
                </h1>
              </div>

              <div className="floating-orb relative hidden h-24 w-24 shrink-0 sm:block">
                <div className="glow-pulse absolute inset-0 rounded-full" style={orbStyle} />
                <div className="absolute inset-[20%] flex items-center justify-center rounded-full border border-white/60 bg-white/16">
                  <Icon className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/70 bg-white/52 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
              <p className="text-sm uppercase tracking-[0.24em] text-stone-400">Nota de Vimi</p>
              <p className="mt-3 text-lg leading-8 text-stone-700">
                "{detail.description}"
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {SECTION_RITUALS[section].map((ritual, index) => (
                <article
                  key={ritual.title}
                  className={`panel-soft p-4 fade-rise ${index === 1 ? "delay-1" : index === 2 ? "delay-2" : ""}`}
                >
                  <p className="text-sm font-semibold text-stone-900">{ritual.title}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{ritual.body}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {COMPANION_PILLARS.map((pillar) => (
                <article key={pillar.title} className="panel-soft p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-400">{pillar.title}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{pillar.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel-surface fade-rise delay-2 p-5 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-stone-400">Espacio actual</p>
                  <h2 className="mt-2 text-3xl font-semibold text-stone-900">{detail.label}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">{detail.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {SECTION_SIGNALS[section].map((signal) => (
                    <span key={signal} className="status-chip">
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              <div className="panel-soft min-h-[32rem] overflow-hidden p-4 sm:p-5">{renderSection(section)}</div>
            </div>
          </section>
        </div>

        <Sidebar active={section} onChange={setSection} />
      </div>
    </div>
  );
}

function renderSection(section: Section) {
  if (section === "tasks") return <TasksSection />;
  if (section === "reminders") return <RemindersSection />;
  if (section === "payments") return <PaymentsSection />;
  if (section === "budgets") return <BudgetsSection />;
  if (section === "events") return <EventsSection />;

  return <ChatSection />;
}
