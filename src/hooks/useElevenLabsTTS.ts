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
  const receivedAudioRef = useRef(false);
  const flushPendingRef = useRef(false);

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx({ sampleRate: 44100 });
      nextStartTimeRef.current = 0;
    }
    return audioCtxRef.current;
  }, []);

  const resumeAudioContext = useCallback(async () => {
    const ctx = ensureAudioContext();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (error) {
        console.warn("[TTS] AudioContext resume failed", error);
      }
    }
    return ctx;
  }, [ensureAudioContext]);

  const scheduleAudio = useCallback(
    async (base64Audio: string) => {
      const ctx = await resumeAudioContext();
      if (ctx.state !== "running") {
        console.warn("[TTS] AudioContext not running, skipping chunk. State:", ctx.state);
        setStatus("error");
        return;
      }

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
        setStatus("speaking");
      } catch (error) {
        console.error("[TTS] decodeAudioData failed", error);
        setStatus("error");
      }
    },
    [resumeAudioContext],
  );

  const start = useCallback(() => {
    pendingChunksRef.current = [];
    receivedAudioRef.current = false;
    flushPendingRef.current = false;

    if (!API_KEY || API_KEY.startsWith("sk_placeholder")) {
      console.error("[TTS] Missing VITE_ELEVENLABS_API_KEY");
      setStatus("error");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const ctx = ensureAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    setStatus("connecting");

    const url =
      `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input` +
      `?model_id=${MODEL}&output_format=mp3_44100_128`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      socketOpenRef.current = true;
      ws.send(
        JSON.stringify({
          text: " ",
          xi_api_key: API_KEY,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.0,
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 220, 280],
          },
        }),
      );

      for (const chunk of pendingChunksRef.current) {
        ws.send(JSON.stringify({ text: chunk }));
      }
      pendingChunksRef.current = [];

      if (flushPendingRef.current) {
        ws.send(JSON.stringify({ text: "" }));
        flushPendingRef.current = false;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          audio?: string;
          isFinal?: boolean;
          message?: string;
        };
        if (data.message) {
          console.warn("[TTS] ElevenLabs message:", data.message);
        }
        if (data.audio) {
          void scheduleAudio(data.audio);
        }
        if (data.isFinal) {
          socketOpenRef.current = false;
        }
      } catch (error) {
        console.error("[TTS] parse message", error);
        setStatus("error");
      }
    };

    ws.onerror = (error) => {
      console.error("[TTS] websocket error", error);
      setStatus("error");
    };

    ws.onclose = (event) => {
      console.log("[TTS] websocket closed", event.code, event.reason);
      socketOpenRef.current = false;
      wsRef.current = null;
      if (!receivedAudioRef.current) {
        setStatus("error");
        return;
      }
      if (activeSourcesRef.current.size === 0) {
        setStatus("idle");
      }
    };
  }, [ensureAudioContext, scheduleAudio]);

  const sendText = useCallback((text: string) => {
    if (!text) return;

    const payload = text.endsWith(" ") ? text : `${text} `;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: payload }));
    } else {
      pendingChunksRef.current.push(payload);
    }
  }, []);

  const flush = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: "" }));
    } else {
      flushPendingRef.current = true;
    }
  }, []);

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
    receivedAudioRef.current = false;
    flushPendingRef.current = false;

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
