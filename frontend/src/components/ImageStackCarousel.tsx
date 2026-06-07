import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PointerEvent, useRef, useState } from "react";
import MediaPreview from "./MediaPreview";

type ImageStackCarouselProps = {
  images: string[];
  onOpen: (index: number) => void;
};

const spring = { type: "spring", stiffness: 260, damping: 28, mass: 0.8 } as const;

export default function ImageStackCarousel({ images, onOpen }: ImageStackCarouselProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const startX = useRef(0);
  const hasImages = images.length > 0;

  const orderedImages = images.length
    ? Array.from({ length: Math.min(3, images.length) }, (_, layer) => images[(index + layer) % images.length])
    : [];
  const dotItems = images.length <= 7
    ? images.map((_, dotIndex) => dotIndex)
    : Array.from({ length: 7 }, (_, dotIndex) => (index - 3 + dotIndex + images.length) % images.length);

  const move = (nextDirection: 1 | -1) => {
    if (images.length <= 1) return;
    setDirection(nextDirection);
    setIndex((current) => (current + nextDirection + images.length) % images.length);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const delta = event.clientX - startX.current;
    if (Math.abs(delta) > 32) move(delta < 0 ? 1 : -1);
  };

  return (
    <div className="image-stack-carousel" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <button className="stack-main" type="button" onClick={() => hasImages && onOpen(index)}>
        {hasImages ? (
          <AnimatePresence initial={false} mode="popLayout">
            {orderedImages.map((url, layer) => {
              const isMain = layer === 0;
              return (
                <motion.span
                  key={`${url}-${layer}-${index}`}
                  className="stack-media"
                  initial={isMain ? { opacity: 0, x: direction * 42, scale: 0.96 } : { opacity: 0, scale: 0.92 }}
                  animate={{
                    opacity: 1,
                    x: layer * 9,
                    y: layer * -6,
                    scale: 1 - layer * 0.045,
                    rotate: layer === 0 ? 0 : layer % 2 ? -5 : 5,
                    zIndex: 5 - layer
                  }}
                  exit={isMain ? { opacity: 0, x: direction * -42, scale: 0.96 } : { opacity: 0, scale: 0.9 }}
                  transition={spring}
                >
                  <MediaPreview src={url} alt="打卡照片" />
                </motion.span>
              );
            })}
          </AnimatePresence>
        ) : (
          <span className="stack-empty">还没有照片</span>
        )}
      </button>
      {images.length > 1 && (
        <>
          <button className="stack-arrow left" type="button" onClick={() => move(-1)} aria-label="上一张"><ChevronLeft size={18} /></button>
          <button className="stack-arrow right" type="button" onClick={() => move(1)} aria-label="下一张"><ChevronRight size={18} /></button>
          <div className="stack-dots compact">{dotItems.map((dotIndex) => <i className={dotIndex === index ? "active" : ""} key={`${dotIndex}-${index}`} />)}</div>
        </>
      )}
    </div>
  );
}
