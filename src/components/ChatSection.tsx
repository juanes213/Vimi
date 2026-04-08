import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "../lib/utils";

export function ChatSection() {
  const messages = useQuery(api.chat.listMessages) ?? [];
  const sendMessage = useMutation(api.chat.sendMessage);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage({ text: input.trim() });
      setInput("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">Habla con Vimi</h2>
          <p className="text-sm leading-6 text-stone-500">
            Habla con Vimi para ordenar ideas, decidir mejor y activar lo que sigue.
          </p>
        </div>
        <span className="status-chip">presencia activa</span>
      </div>

      <div
        className="panel-soft flex flex-1 flex-col overflow-hidden"
        style={{ minHeight: 0, height: "calc(100vh - 320px)" }}
      >
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="flex min-h-full flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-1 flex-col justify-center rounded-[24px] border border-dashed border-stone-200/80 bg-white/45 px-6 py-10 text-center">
                <p className="text-lg font-semibold text-stone-800">
                  Aqui empieza tu relacion con Vimi.
                </p>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-stone-500">
                  Puedes pedir ayuda para planear, descargar una idea a medias o convertir una
                  decision en accion concreta.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <span className="status-chip">organiza mi tarde</span>
                  <span className="status-chip">recuerdame llamar a mama</span>
                  <span className="status-chip">ayudame a bajar la ansiedad</span>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg._id}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-[24px] px-4 py-3 text-sm shadow-sm",
                    msg.role === "user"
                      ? "rounded-br-md bg-stone-900 text-white"
                      : "rounded-bl-md border border-white/80 bg-white/78 text-stone-700",
                  )}
                >
                  <p className="whitespace-pre-wrap leading-7">{msg.text}</p>
                  {msg.parsedType && (
                    <p
                      className={cn(
                        "mt-2 text-[11px] uppercase tracking-[0.22em]",
                        msg.role === "user" ? "text-white/60" : "text-stone-400",
                      )}
                    >
                      {msg.parsedType.replace("create_", "created ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <form onSubmit={handleSend} className="border-t border-white/70 p-3 sm:p-4">
          <div className="flex gap-2">
            <input
              className="surface-input flex-1"
              placeholder="Escribe lo que tienes en mente..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="primary-button shrink-0 px-5"
            >
              {sending ? "..." : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
