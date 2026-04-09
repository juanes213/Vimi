import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Grabador de voz con detección de silencio y transcripción vía ElevenLabs STT.
 *
 * Exporta:
 *  - `isRecording` / `isTranscribing`
 *  - `level` 0..1 (RMS para animar ondas en UI)
 *  - `start(onTranscript)` → arranca grabación; al detectar silencio, transcribe y llama callback
 *  - `stop()` → aborta sin transcribir
 *  - `stopAndTranscribe()` → fuerza el fin ahora mismo y transcribe
 */

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;

// Umbrales para detección de silencio
const SILENCE_THRESHOLD = 0.012; // RMS por debajo → silencio
const SILENCE_DURATION_MS = 1500; // hay que estar en silencio este tiempo
const MIN_SPEECH_MS = 400; // ignora clicks/ruidos muy cortos

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [level, setLevel] = useState(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const hadSpeechRef = useRef(false);
  const onTranscriptRef = useRef<((text: string) => void) | null>(null);
  const abortRef = useRef(false);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    silenceStartRef.current = null;
    speechStartRef.current = null;
    hadSpeechRef.current = false;
    setLevel(0);
  }, []);

  const transcribe = useCallback(async (audioBlob: Blob): Promise<string> => {
    if (!API_KEY || API_KEY.startsWith("sk_placeholder")) {
      console.warn("[STT] VITE_ELEVENLABS_API_KEY no configurada");
      return "";
    }
    const form = new FormData();
    form.append("file", audioBlob, "audio.webm");
    form.append("model_id", "scribe_v1");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": API_KEY },
      body: form,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[STT] error", res.status, txt);
      return "";
    }
    const data = (await res.json()) as { text?: string };
    return data.text?.trim() ?? "";
  }, []);

  const finalize = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    // Esperar a que el recorder suelte el último chunk
    const stopPromise = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    if (recorder.state !== "inactive") recorder.stop();
    await stopPromise;

    const chunks = chunksRef.current;
    const hadSpeech = hadSpeechRef.current;
    const aborted = abortRef.current;
    const callback = onTranscriptRef.current;

    cleanup();
    setIsRecording(false);

    if (aborted || !hadSpeech || chunks.length === 0) return;

    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    setIsTranscribing(true);
    try {
      const text = await transcribe(blob);
      if (text && callback) callback(text);
    } finally {
      setIsTranscribing(false);
    }
  }, [cleanup, transcribe]);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    const rms = Math.sqrt(sum / buffer.length);
    setLevel(Math.min(1, rms * 6));

    const now = performance.now();
    if (rms > SILENCE_THRESHOLD) {
      // Hay voz
      if (speechStartRef.current === null) speechStartRef.current = now;
      if (now - speechStartRef.current >= MIN_SPEECH_MS) {
        hadSpeechRef.current = true;
      }
      silenceStartRef.current = null;
    } else if (hadSpeechRef.current) {
      // Silencio después de haber hablado
      if (silenceStartRef.current === null) silenceStartRef.current = now;
      else if (now - silenceStartRef.current >= SILENCE_DURATION_MS) {
        void finalize();
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [finalize]);

  const start = useCallback(
    async (onTranscript: (text: string) => void) => {
      if (isRecording) return;
      onTranscriptRef.current = onTranscript;
      abortRef.current = false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        mediaStreamRef.current = stream;

        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        analyserRef.current = analyser;

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(100);
        setIsRecording(true);

        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error("[STT] getUserMedia failed", err);
        cleanup();
        setIsRecording(false);
      }
    },
    [isRecording, tick, cleanup],
  );

  const stop = useCallback(() => {
    abortRef.current = true;
    void finalize();
  }, [finalize]);

  const stopAndTranscribe = useCallback(() => {
    abortRef.current = false;
    hadSpeechRef.current = hadSpeechRef.current || chunksRef.current.length > 0;
    void finalize();
  }, [finalize]);

  useEffect(() => cleanup, [cleanup]);

  return { isRecording, isTranscribing, level, start, stop, stopAndTranscribe };
}
