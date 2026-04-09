import { useCallback, useEffect, useRef } from "react";

/**
 * Voice Activity Detection ligero: escucha el micrófono con un `AnalyserNode`
 * y dispara `onSpeechDetected` cuando el nivel supera un umbral durante el
 * tiempo mínimo configurado. Se usa para interrumpir a Vimi mientras habla.
 *
 * Nota: el MediaStream que recibimos aquí vive en paralelo con el grabador
 * principal. Lo mantenemos solo activo durante el TTS.
 */

const THRESHOLD = 0.035; // más estricto que el del grabador → evita falsos positivos del eco
const MIN_SUSTAIN_MS = 180;

export function useVAD() {
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeSinceRef = useRef<number | null>(null);
  const callbackRef = useRef<(() => void) | null>(null);

  const stopListening = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      void ctxRef.current.close();
    }
    ctxRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    activeSinceRef.current = null;
    callbackRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);

    const now = performance.now();
    if (rms > THRESHOLD) {
      if (activeSinceRef.current === null) activeSinceRef.current = now;
      else if (now - activeSinceRef.current >= MIN_SUSTAIN_MS) {
        const cb = callbackRef.current;
        stopListening();
        cb?.();
        return;
      }
    } else {
      activeSinceRef.current = null;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [stopListening]);

  const startListening = useCallback(
    async (onSpeechDetected: () => void) => {
      // Si ya hay una sesión activa, la reemplazamos
      stopListening();
      callbackRef.current = onSpeechDetected;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        streamRef.current = stream;
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.5;
        src.connect(analyser);
        analyserRef.current = analyser;
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error("[VAD] getUserMedia failed", err);
        stopListening();
      }
    },
    [tick, stopListening],
  );

  useEffect(() => stopListening, [stopListening]);

  return { startListening, stopListening };
}
