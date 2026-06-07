import type { LoveSettings } from "../hooks/useLoveSettings";

type FloatingHeartsProps = {
  effect: LoveSettings["visualEffect"];
};

const effectItems = {
  hearts: ["💗", "💕", "💖", "💞", "♡"],
  petals: ["🌸", "🌷", "❀", "✿"],
  starlight: ["✦", "✧", "⋆", "✨"],
  mixed: ["💗", "🌸", "✦", "💕", "✧", "🌷", "♡", "✨"]
} as const;

export default function FloatingHearts({ effect }: FloatingHeartsProps) {
  if (effect === "none") return null;

  if (effect === "meteors") {
    return (
      <div className="scene-effects meteor-shower" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${(index * 19) % 112 - 8}%`,
              animationDelay: `${(index % 7) * 1.15}s`,
              animationDuration: `${4.8 + (index % 4) * 0.8}s`
            }}
          />
        ))}
      </div>
    );
  }

  const items = effectItems[effect];
  return (
    <div className={`scene-effects floating-hearts ${effect}`} aria-hidden="true">
      {Array.from({ length: effect === "mixed" ? 24 : 18 }, (_, index) => (
        <span
          key={index}
          style={{
            left: `${(index * 17) % 100}%`,
            top: effect === "petals" ? `${-8 - (index % 4) * 7}%` : effect === "starlight" ? `${(index * 29) % 92}%` : undefined,
            animationDelay: `${(index % 9) * 0.7}s`,
            animationDuration: `${11 + (index % 7)}s`
          }}
        >
          {items[index % items.length]}
        </span>
      ))}
    </div>
  );
}
