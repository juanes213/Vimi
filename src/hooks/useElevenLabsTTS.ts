import { useCallback, useEffect, useRef, useState } from "react";

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
const VOICE_ID = (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) ?? "21m00Tcm4TlvDq8ikWAM";
const MODEL = (import.meta.env.VITE_ELEVENLABS_MODEL as string | undefined) ?? "eleven_flash_v2_5";

type TTSStatus = "idle" | "connecting" | "speaking" | "error";

export function useElevenLabsTTS() {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const pendingChunksRef = useRef<string[]>([]);
  const socketOpenRef = useRef(false);
  const fallbackBufferRef = useRef("");
  const useBrowserFallbackRef = useRef(false);
  const receivedAudioRef = useRef(false);

  const speakWithBrowser = useCallback((text: string) => {
    const content = text.replace(/\s+/g, " ").trim();
    if (!content || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("idle");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => setStatus("error");
    window.speechSynthesis.speak(utterance);
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx({ sampleRate: 44100 });
      nextStartTimeRef.current = 0;
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const scheduleAudio = useCallback(
    async (base64Audio: string) => {
      const ctx = ensureAudioContext();
      try {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }

        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        const startAt = Math.max(now, nextStartTimeRef.current);
        source.start(startAt);
        nextStartTimeRef.current = startAt + audioBuffer.duration;

        activeSourcesRef.current.add(source);
        source.onended = () => {
          activeSourcesRef.current.delete(source);
          if (activeSourcesRef.current.size === 0 && !socketOpenRef.current) {
            setStatus("idle");
          }
        };

        receivedAudioRef.current = true;
        fallbackBufferRef.current = "";
        setStatus("speaking");
      } catch (err) {
        console.error("[TTS] decodeAudioData failed", err);
      }
    },
    [ensureAudioContext],
  );

  const start = useCallback(() => {
    fallbackBufferRef.current = "";
    receivedAudioRef.current = false;
    useBrowserFallbackRef.current = !API_KEY || API_KEY.startsWith("sk_placeholder");
    if (useBrowserFallbackRef.current) {
      console.warn("[TTS] ElevenLabs key missing, using browser speech fallback");
      setStatus("idle");
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    ensureAudioContext();
    setStatus("connecting");

    const url =
      `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input` +
      `?model_id=${MODEL}&output_format=mp3_44100_128&auto_mode=true`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      socketOpenRef.current = true;
      ws.send(
        JSON.stringify({
          text: " ",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.0,
          },
          xi_api_key: API_KEY,
        }),
      );
      for (const chunk of pendingChunksRef.current) {
        ws.send(JSON.stringify({ text: chunk }));
      }
      pendingChunksRef.current = [];
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.audio) {
          void scheduleAudio(data.audio);
        }
        if (data.isFinal) {
          socketOpenRef.current = false;
        }
      } catch (err) {
        console.error("[TTS] parse message", err);
      }
    };

    ws.onerror = (err) => {
      console.error("[TTS] websocket error", err);
      if (!receivedAudioRef.current) {
        useBrowserFallbackRef.current = true;
      }
      setStatus("error");
    };

    ws.onclose = () => {
      socketOpenRef.current = false;
      wsRef.current = null;
      if (!receivedAudioRef.current && useBrowserFallbackRef.current && fallbackBufferRef.current.trim()) {
        speakWithBrowser(fallbackBufferRef.current);
        fallbackBufferRef.current = "";
        return;
      }
      if (activeSourcesRef.current.size === 0) {
        setStatus("idle");
      }
    };
  }, [ensureAudioContext, scheduleAudio, speakWithBrowser]);

  const sendText = useCallback((text: string) => {
    if (!text) {
      return;
    }

    const payload = text.endsWith(" ") ? text : `${text} `;
    fallbackBufferRef.current += payload;
    if (useBrowserFallbackRef.current) {
      return;
    }

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: payload }));
    } else {
      pendingChunksRef.current.push(payload);
    }
  }, []);

  const flush = useCallback(() => {
    if (useBrowserFallbackRef.current) {
      speakWithBrowser(fallbackBufferRef.current);
      fallbackBufferRef.current = "";
      return;
    }

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: "" }));
    }
  }, [speakWithBrowser]);

  const stop = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }
    socketOpenRef.current = false;
    pendingChunksRef.current = [];
    fallbackBufferRef.current = "";
    useBrowserFallbackRef.current = false;
    receivedAudioRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* noop */
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = audioCtxRef.current?.currentTime ?? 0;
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      stop();
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close();
      }
    };
  }, [stop]);

  return { status, start, sendText, flush, stop };
}
