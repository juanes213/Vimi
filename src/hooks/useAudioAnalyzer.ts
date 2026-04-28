import { useCallback, useEffect, useRef, useState } from "react";

type AudioAnalyzerAttachment = {
  source: AudioNode;
  analyser: AnalyserNode;
};

export function useAudioAnalyzer() {
  const [level, setLevel] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const attachmentRef = useRef<AudioAnalyzerAttachment | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedLevelRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const detach = useCallback(() => {
    stopLoop();
    const attachment = attachmentRef.current;
    if (attachment) {
      try {
        attachment.source.disconnect(attachment.analyser);
      } catch {
        /* noop */
      }
      try {
        attachment.analyser.disconnect();
      } catch {
        /* noop */
      }
    }
    attachmentRef.current = null;
    smoothedLevelRef.current = 0;
    setLevel(0);
    setIsPlaying(false);
  }, [stopLoop]);

  const startLoop = useCallback((analyser: AnalyserNode) => {
    const buffer = new Float32Array(analyser.fftSize);

    const tick = () => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
      }

      const rms = Math.sqrt(sum / buffer.length);
      const normalized = Math.min(1, Math.max(0, rms * 7.5));
      smoothedLevelRef.current += (normalized - smoothedLevelRef.current) * 0.18;

      setLevel((current) => {
        const next = smoothedLevelRef.current;
        return Math.abs(current - next) > 0.01 ? next : current;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    stopLoop();
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  const attachSource = useCallback(
    (context: AudioContext, source: AudioNode, destination: AudioNode = context.destination) => {
      detach();

      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.78;

      source.connect(analyser);
      analyser.connect(destination);
      attachmentRef.current = { source, analyser };
      setIsPlaying(true);
      startLoop(analyser);

      return analyser;
    },
    [detach, startLoop],
  );

  const attachElement = useCallback(
    (context: AudioContext, element: HTMLAudioElement, destination: AudioNode = context.destination) => {
      const source = context.createMediaElementSource(element);
      return attachSource(context, source, destination);
    },
    [attachSource],
  );

  useEffect(() => detach, [detach]);

  return {
    level,
    isPlaying,
    attachElement,
    attachSource,
    detach,
  };
}
