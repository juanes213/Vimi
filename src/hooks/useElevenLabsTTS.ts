import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Streaming Text-to-Speech con ElevenLabs WebSocket API.
 *
 * Flujo:
 *  1. `start()` abre un WebSocket a ElevenLabs
 *  2. `sendText(chunk)` envía texto a medida que llega del LLM
 *  3. ElevenLabs devuelve audio en base64 por el mismo WebSocket
 *  4. Cada chunk se decodifica y se pone en cola en un AudioContext
 *  5. `flush()` marca fin de entrada; `stop()` corta todo de inmediato
 *
 * La cola de audio usa `AudioBufferSourceNode` encadenados para que no haya
 * huecos entre chunks y se pueda interrumpir cortando el AudioContext.
 */

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
const VOICE_ID = (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) ?? "21m00Tcm4TlvDq8ikWAM";
const MODEL = (import.meta.env.VITE_ELEVENLABS_MODEL as string | undefined) ?? "eleven_flash_v2_5";

type TTSStatus = "idle" | "connecting" | "speaking" | "error";

export function useElevenLabsTTS() {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const pendingChunksRef = useRef<string[]>([]);
  const socketOpenRef = useRef(false);

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
        // Decodificar base64 → ArrayBuffer
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        // ElevenLabs devuelve MP3 por defecto → decodeAudioData lo entiende
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
        setStatus("speaking");
      } catch (err) {
        console.error("[TTS] decodeAudioData failed", err);
      }
    },
    [ensureAudioContext],
  );

  const start = useCallback(() => {
    if (!API_KEY || API_KEY.startsWith("sk_placeholder")) {
      console.warn("[TTS] VITE_ELEVENLABS_API_KEY no configurada — modo silencioso");
      setStatus("idle");
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    ensureAudioContext();
    setStatus("connecting");

    const url =
      `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input` +
      `?model_id=${MODEL}&output_format=mp3_44100_128&auto_mode=true`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      socketOpenRef.current = true;
      // Mensaje inicial: autenticación + config de voz
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
      // Drenar chunks que llegaron antes de que abriera
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
      setStatus("error");
    };

    ws.onclose = () => {
      socketOpenRef.current = false;
      wsRef.current = null;
      if (activeSourcesRef.current.size === 0) {
        setStatus("idle");
      }
    };
  }, [ensureAudioContext, scheduleAudio]);

  const sendText = useCallback((text: string) => {
    if (!text) return;
    // Añadir espacio al final ayuda a ElevenLabs a segmentar sin cortar palabras
    const payload = text.endsWith(" ") ? text : text + " ";
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
      // Enviar string vacío le indica a ElevenLabs que ya no viene más texto
      ws.send(JSON.stringify({ text: "" }));
    }
  }, []);

  const stop = useCallback(() => {
    // 1. Cerrar WebSocket para que no siga generando
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

    // 2. Cortar todo el audio que esté sonando o encolado
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* noop */
      }
    }
    activeSourcesRef.current.clear();

    // 3. Resetear reloj de scheduling
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
