import { useCallback, useEffect, useRef, useState } from "react";

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
const VOICE_ID = (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) ?? "21m00Tcm4TlvDq8ikWAM";
const MODEL = (import.meta.env.VITE_ELEVENLABS_MODEL as string | undefined) ?? "eleven_flash_v2_5";

type TTSStatus = "idle" | "connecting" | "speaking" | "error";

export function useElevenLabsTTS() {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const textBufferRef = useRef("");

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx({ sampleRate: 44100 });
    }
    return audioCtxRef.current;
  }, []);

  const resumeAudioContext = useCallback(async () => {
    const ctx = ensureAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, [ensureAudioContext]);

  const stopActiveSource = useCallback(() => {
    if (!activeSourceRef.current) return;
    try {
      activeSourceRef.current.stop();
      activeSourceRef.current.disconnect();
    } catch {
      /* noop */
    }
    activeSourceRef.current = null;
  }, []);

  const start = useCallback(() => {
    textBufferRef.current = "";
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    stopActiveSource();

    if (!API_KEY || API_KEY.startsWith("sk_placeholder")) {
      console.error("[TTS] Missing VITE_ELEVENLABS_API_KEY");
      setStatus("error");
      return;
    }

    const ctx = ensureAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    setStatus("idle");
  }, [ensureAudioContext, stopActiveSource]);

  const sendText = useCallback((text: string) => {
    if (!text) return;
    textBufferRef.current += text;
  }, []);

  const flush = useCallback(async () => {
    const text = textBufferRef.current.replace(/\s+/g, " ").trim();
    textBufferRef.current = "";
    if (!text) {
      setStatus("idle");
      return;
    }

    if (!API_KEY || API_KEY.startsWith("sk_placeholder")) {
      console.error("[TTS] Missing VITE_ELEVENLABS_API_KEY");
      setStatus("error");
      return;
    }

    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;

    try {
      setStatus("connecting");
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_128&model_id=${encodeURIComponent(MODEL)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: MODEL,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              speed: 1.0,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`ElevenLabs TTS failed: ${response.status} ${errorText}`);
      }

      const audioBufferBytes = await response.arrayBuffer();
      const ctx = await resumeAudioContext();
      const decoded = await ctx.decodeAudioData(audioBufferBytes.slice(0));

      stopActiveSource();
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      activeSourceRef.current = source;
      source.onended = () => {
        if (activeSourceRef.current === source) {
          activeSourceRef.current = null;
        }
        setStatus("idle");
      };
      setStatus("speaking");
      source.start();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      console.error("[TTS] flush failed", error);
      setStatus("error");
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
      }
    }
  }, [resumeAudioContext, stopActiveSource]);

  const stop = useCallback(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    textBufferRef.current = "";
    stopActiveSource();
    setStatus("idle");
  }, [stopActiveSource]);

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
