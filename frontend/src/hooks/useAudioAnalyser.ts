import { RefObject, useCallback, useEffect, useRef } from "react";

export type AudioEnergy = {
  average: number;
  bass: number;
  frequencies: number[];
};

export function useAudioAnalyser(
  audioRef: RefObject<HTMLAudioElement>,
  onEnergy?: (energy: AudioEnergy) => void
) {
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frameRef = useRef<number>();

  const ensureAnalyser = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    if (!contextRef.current) {
      contextRef.current = new AudioContext();
    }

    if (!analyserRef.current) {
      const analyser = contextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      analyserRef.current = analyser;

      sourceRef.current = contextRef.current.createMediaElementSource(audio);
      sourceRef.current.connect(analyser);
      analyser.connect(contextRef.current.destination);
    }

    if (contextRef.current.state === "suspended") {
      await contextRef.current.resume();
    }

    return analyserRef.current;
  }, [audioRef]);

  const start = useCallback(async () => {
    const analyser = await ensureAnalyser();
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const frequencies = Array.from(data.slice(0, 48)).map((value) => value / 255);
      const average = frequencies.reduce((sum, value) => sum + value, 0) / frequencies.length;
      const bass = frequencies.slice(0, 10).reduce((sum, value) => sum + value, 0) / 10;
      onEnergy?.({ average, bass, frequencies });
      frameRef.current = window.requestAnimationFrame(tick);
    };

    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    tick();
  }, [ensureAnalyser, onEnergy]);

  const stop = useCallback(() => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
    onEnergy?.({ average: 0, bass: 0, frequencies: [] });
  }, [onEnergy]);

  useEffect(() => stop, [stop]);

  return { start, stop };
}
