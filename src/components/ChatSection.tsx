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
              <p className="font-['Cormorant_Garamond'] text-lg font-light text-[rgba(160,145,210,0.6)]">
                Your conversation will appear here.
              </p>
              <p className="mt-1 font-['Outfit'] text-[10px] uppercase tracking-[0.2em] text-[rgba(100,85,160,0.45)]">
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
                      ? "rounded-br-sm bg-[rgba(0,255,180,0.07)] text-[rgba(220,255,245,0.9)] ring-1 ring-[rgba(0,255,180,0.15)]"
                      : "rounded-bl-sm bg-[rgba(120,80,255,0.07)] text-[rgba(170,150,230,0.85)] ring-1 ring-[rgba(120,80,255,0.16)]",
                  )}
                >
                  <p>{msg.text.replace(/\{[\s\S]*"action"[\s\S]*\}/, "").trim() || msg.text}</p>
                </div>
                <p
                  className={cn(
                    "font-['Outfit'] text-[9px] uppercase tracking-[0.14em]",
                    msg.role === "user"
                      ? "text-right text-[rgba(0,255,180,0.35)]"
                      : "text-[rgba(120,80,255,0.45)]",
                  )}
                >
                  {msg.role === "user" ? "You" : "Vimi"}
                  {msg.parsedType && (
                    <span className="ml-2 text-[rgba(100,85,160,0.5)]">
                      · {msg.parsedType.replace("create_", "created — ")}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}

          {showLiveAssistant && (
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-[rgba(120,80,255,0.07)] px-4 py-2.5 text-sm font-light leading-relaxed text-[rgba(170,150,230,0.85)] ring-1 ring-[rgba(120,80,255,0.16)]">
                <p>
                  {liveText}
                  <span className="ml-1 inline-block h-3.5 w-px animate-pulse bg-[rgba(0,255,180,0.7)] align-middle" />
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
