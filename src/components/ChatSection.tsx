import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { VoiceMode } from "../hooks/useVoiceChat";
import { cn } from "../lib/utils";

interface ChatTranscriptProps {
  liveAssistant: string;
  activeMode: VoiceMode;
}

export function ChatTranscript({ liveAssistant, activeMode }: ChatTranscriptProps) {
  const messages = useQuery(api.chat.listMessages) ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveText = liveAssistant.replace(/\{[\s\S]*/, "").trim();
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const showLiveAssistant =
    liveText.length > 0 &&
    activeMode === "thinking" &&
    liveText !== (lastAssistantMessage?.text.replace(/\{[\s\S]*"action"[\s\S]*\}/, "").trim() ?? "");

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior: messages.length > 0 || liveAssistant ? "smooth" : "auto",
    });
  }, [messages, liveAssistant]);

  const hasConversation = messages.length > 0 || liveAssistant.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3">
        <div className="flex min-h-full flex-col gap-3 py-3">
          {!hasConversation && (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <p className="font-['Geist'] text-lg font-light text-[rgba(180,204,201,0.45)]">
                Your conversation will appear here.
              </p>
              <p className="mt-1 font-['Geist'] text-[10px] uppercase tracking-[0.2em] text-[rgba(180,204,201,0.32)]">
                Tap the orb to begin
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg._id}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div className="flex max-w-[88%] flex-col gap-1">
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm font-light leading-relaxed",
                    msg.role === "user"
                      ? "rounded-br-sm bg-[rgba(32,227,194,0.08)] text-[rgba(216,235,232,0.9)] ring-1 ring-[rgba(32,227,194,0.18)]"
                      : "rounded-bl-sm bg-[rgba(255,255,255,0.05)] text-[rgba(216,235,232,0.82)] ring-1 ring-[rgba(255,255,255,0.08)]",
                  )}
                >
                  <p>{msg.text.replace(/\{[\s\S]*"action"[\s\S]*\}/, "").trim() || msg.text}</p>
                </div>
                <p
                  className={cn(
                    "font-['Geist'] text-[9px] uppercase tracking-[0.14em]",
                    msg.role === "user"
                      ? "text-right text-[rgba(32,227,194,0.35)]"
                      : "text-[rgba(180,204,201,0.35)]",
                  )}
                >
                  {msg.role === "user" ? "You" : "Vimi"}
                  {msg.parsedType && (
                    <span className="ml-2 text-[rgba(180,204,201,0.38)]">
                      · {msg.parsedType.replace("create_", "created — ")}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}

          {showLiveAssistant && (
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-[rgba(255,255,255,0.05)] px-4 py-2.5 text-sm font-light leading-relaxed text-[rgba(216,235,232,0.82)] ring-1 ring-[rgba(255,255,255,0.08)]">
                <p>
                  {liveText}
                  <span className="ml-1 inline-block h-3.5 w-px animate-pulse bg-[rgba(32,227,194,0.7)] align-middle" />
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
