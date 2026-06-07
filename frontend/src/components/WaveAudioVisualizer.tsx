import { useEffect, useRef } from "react";
import type { AudioEnergy } from "../hooks/useAudioAnalyser";

type WaveAudioVisualizerProps = {
  energy: AudioEnergy;
  isPlaying: boolean;
};

export default function WaveAudioVisualizer({ energy, isPlaying }: WaveAudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const energyRef = useRef(energy);
  const playingRef = useRef(isPlaying);

  useEffect(() => {
    energyRef.current = energy;
    playingRef.current = isPlaying;
  }, [energy, isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let raf = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const { average, bass, frequencies } = energyRef.current;
      const active = playingRef.current;
      frame += 0.018 + (active ? average * 0.035 : 0.008);
      context.clearRect(0, 0, width, height);

      const gradients = [
        ["rgba(255, 126, 179, 0.42)", 0.36],
        ["rgba(179, 136, 255, 0.32)", 0.5],
        ["rgba(255, 214, 232, 0.46)", 0.64]
      ] as const;

      gradients.forEach(([color, yRatio], layer) => {
        context.beginPath();
        const baseY = height * yRatio;
        const amp = (active ? 18 + bass * 72 : 15) + layer * 8;
        for (let x = 0; x <= width; x += 8) {
          const bin = frequencies.length ? frequencies[Math.floor((x / width) * frequencies.length)] ?? 0 : 0.18;
          const y = baseY
            + Math.sin(x * 0.018 + frame * (1.4 + layer * 0.28)) * amp * (0.45 + bin)
            + Math.sin(x * 0.006 - frame * 1.8) * amp * 0.22;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.lineWidth = layer === 0 ? 4 : 3;
        context.strokeStyle = color;
        context.shadowColor = color;
        context.shadowBlur = 18;
        context.stroke();
      });

      const glow = context.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, Math.min(width, height) * 0.45);
      glow.addColorStop(0, `rgba(255,255,255,${active ? 0.34 + average * 0.28 : 0.26})`);
      glow.addColorStop(0.5, "rgba(255,126,179,0.14)");
      glow.addColorStop(1, "rgba(255,126,179,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas className="wave-audio-visualizer" ref={canvasRef} aria-hidden="true" />;
}
