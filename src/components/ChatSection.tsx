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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2">
        <div className="flex min-h-full flex-col gap-3 py-3">
          {!hasConversation && (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-medium text-slate-300">Your conversation will appear here.</p>
              <p className="mt-1 text-xs text-slate-500">Tap the orb to start talking.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg._id}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-[20px] px-3.5 py-2.5 text-sm shadow-sm",
                  msg.role === "user"
                    ? "rounded-br-sm bg-white/12 text-white ring-1 ring-white/12"
                    : "rounded-bl-sm border border-white/10 bg-[#120c26]/80 text-slate-200",
                )}
              >
                <p className="leading-6">
                  {msg.text.replace(/\{[\s\S]*"action"[\s\S]*\}/, "").trim() || msg.text}
                </p>
                {msg.parsedType && (
                  <p
                    className={cn(
                      "mt-1.5 text-[10px] uppercase tracking-[0.2em]",
                      msg.role === "user" ? "text-white/50" : "text-slate-500",
                    )}
                  >
                    {msg.parsedType.replace("create_", "created - ")}
                  </p>
                )}
              </div>
            </div>
          ))}

          {liveAssistant && activeMode !== "idle" && (
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-[20px] rounded-bl-sm border border-white/10 bg-[#120c26]/80 px-3.5 py-2.5 text-sm text-slate-200 shadow-sm">
                <p className="leading-6">
                  {liveAssistant.replace(/\{[\s\S]*/, "").trim()}
                  <span className="ml-1 inline-block h-3.5 w-[2px] animate-pulse bg-slate-400 align-middle" />
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
