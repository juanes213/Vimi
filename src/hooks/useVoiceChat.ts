import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useElevenLabsTTS } from "./useElevenLabsTTS";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { useVAD } from "./useVAD";

export type VoiceMode = "idle" | "listening" | "thinking" | "speaking";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
const CONVEX_HTTP_URL = CONVEX_URL?.replace(".convex.cloud", ".convex.site");

function createChunker(onChunk: (chunk: string) => void) {
  let buffer = "";
  const MIN_CHUNK = 18;
  return {
    push(delta: string) {
      buffer += delta;
      while (buffer.length >= MIN_CHUNK) {
        let splitAt = -1;
        for (let i = MIN_CHUNK; i < buffer.length; i++) {
          const ch = buffer[i];
          if (ch === "." || ch === "," || ch === "?" || ch === "!" || ch === ";" || ch === ":") {
            splitAt = i + 1;
            break;
          }
          if (ch === " " && i >= MIN_CHUNK + 6) {
            splitAt = i + 1;
            break;
          }
        }
        if (splitAt === -1) break;
        const piece = buffer.slice(0, splitAt);
        buffer = buffer.slice(splitAt);
        if (piece.trim()) onChunk(piece);
      }
    },
    flush() {
      if (buffer.trim()) onChunk(buffer);
      buffer = "";
    },
  };
}

function stripJsonFromDelta(delta: string, buffer: string) {
  const openIndex = buffer.lastIndexOf("{");
  if (openIndex !== -1 && !buffer.slice(openIndex).includes("}")) return "";
  if (delta.includes("{")) return delta.slice(0, delta.indexOf("{"));
  return delta;
}

export function useVoiceChat() {
  const [mode, setMode] = useState<VoiceMode>("idle");
  const [liveAssistant, setLiveAssistant] = useState("");
  const [autoListen, setAutoListen] = useState(true);
  const authToken = useAuthToken();

  const abortRef = useRef<AbortController | null>(null);
  const clearLiveAssistantOnIdleRef = useRef(false);

  const tts = useElevenLabsTTS();
  const recorder = useVoiceRecorder();
  const vad = useVAD();

  const streamAssistant = useCallback(
    async (userText: string) => {
      setMode("thinking");
      setLiveAssistant("");

      tts.start();
      const chunker = createChunker((piece) => tts.sendText(piece));
      let flushed = false;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (!CONVEX_HTTP_URL) {
          throw new Error("Missing VITE_CONVEX_URL. Set it in Vercel and redeploy.");
        }
        const res = await fetch(`${CONVEX_HTTP_URL}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ text: userText }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        let jsonBuffer = "";
        let firstDelta = true;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });

          let sepIdx: number;
          while ((sepIdx = sseBuffer.indexOf("\n\n")) !== -1) {
            const raw = sseBuffer.slice(0, sepIdx);
            sseBuffer = sseBuffer.slice(sepIdx + 2);

            let event = "message";
            let dataStr = "";
            for (const line of raw.split("\n")) {
              if (line.startsWith("event: ")) event = line.slice(7);
              else if (line.startsWith("data: ")) dataStr += line.slice(6);
            }
            if (!dataStr) continue;
            let data: { text?: string; parsedType?: string; message?: string };
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (event === "delta" && data.text) {
              if (firstDelta) {
                setMode("speaking");
                firstDelta = false;
              }
              setLiveAssistant((prev) => prev + data.text);
              const spokenDelta = stripJsonFromDelta(data.text, jsonBuffer);
              jsonBuffer += data.text;
              if (spokenDelta) chunker.push(spokenDelta);
            } else if (event === "done") {
              chunker.flush();
              void tts.flush();
              flushed = true;
              setLiveAssistant("");
              clearLiveAssistantOnIdleRef.current = true;
            } else if (event === "error") {
              console.error("[stream] server error", data.message);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[stream] failed", err);
        }
      } finally {
        // Ensure ElevenLabs receives EOS even if the stream ended without a done event
        if (!flushed) {
          chunker.flush();
          void tts.flush();
          setLiveAssistant("");
          clearLiveAssistantOnIdleRef.current = true;
        }
        abortRef.current = null;
      }
    },
    [authToken, tts],
  );

  const interruptAndSend = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      abortRef.current?.abort();
      tts.stop();
      vad.stopListening();
      void streamAssistant(text.trim());
    },
    [tts, vad, streamAssistant],
  );

  const handleTranscript = useCallback(
    (text: string) => {
      if (!text.trim()) { setMode("idle"); return; }
      interruptAndSend(text);
    },
    [interruptAndSend],
  );

  const startListening = useCallback(() => {
    if (recorder.isRecording) return;
    tts.stop();
    setMode("listening");
    void recorder.start(handleTranscript);
  }, [recorder, tts, handleTranscript]);

  const stopAll = useCallback(() => {
    abortRef.current?.abort();
    tts.stop();
    vad.stopListening();
    recorder.stop();
    setMode("idle");
  }, [tts, vad, recorder]);

  // Sync mode with TTS status
  useEffect(() => {
    if (tts.status === "speaking") {
      setMode("speaking");
      void vad.startListening(() => {
        tts.stop();
        setMode("listening");
        void recorder.start(handleTranscript);
      });
    } else if (tts.status === "idle") {
      vad.stopListening();
      if (clearLiveAssistantOnIdleRef.current) {
        clearLiveAssistantOnIdleRef.current = false;
        setLiveAssistant("");
      }
      setMode((prev) => {
        if (prev === "speaking") {
          if (autoListen) {
            setTimeout(() => void recorder.start(handleTranscript), 150);
            return "listening";
          }
          return "idle";
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts.status]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      tts.stop();
      vad.stopListening();
      recorder.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeMode: VoiceMode = useMemo(() => {
    if (recorder.isRecording) return "listening";
    if (recorder.isTranscribing || mode === "thinking") return "thinking";
    if (tts.status === "speaking" || mode === "speaking") return "speaking";
    return "idle";
  }, [recorder.isRecording, recorder.isTranscribing, tts.status, mode]);

  return {
    activeMode,
    liveAssistant,
    autoListen,
    setAutoListen,
    micLevel: recorder.level,
    speechLevel: tts.level,
    ttsIsPlaying: tts.isPlaying,
    startListening,
    stopAll,
    interruptAndSend,
  };
}
