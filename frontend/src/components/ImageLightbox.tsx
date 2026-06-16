import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import MediaPreview from "./MediaPreview";

type ImageLightboxProps = {
  open: boolean;
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export default function ImageLightbox({ open, images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const move = (direction: 1 | -1) => {
    onIndexChange((index + direction + images.length) % images.length);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (images.length > 1 && event.key === "ArrowLeft") move(-1);
      if (images.length > 1 && event.key === "ArrowRight") move(1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, images.length, index, onClose]);

  const content = (
    <AnimatePresence>
      {open && images.length > 0 && (
        <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <button className="icon-button lightbox-close" type="button" onClick={(event) => { event.stopPropagation(); onClose(); }} aria-label="关闭相册">
            <X size={20} />
          </button>
          {images.length > 1 && (
            <button className="icon-button lightbox-prev" type="button" onClick={(event) => { event.stopPropagation(); move(-1); }} aria-label="上一张">
              <ChevronLeft size={22} />
            </button>
          )}
          <motion.div className="lightbox-media" key={images[index]} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} onClick={(event) => event.stopPropagation()}>
            <MediaPreview src={images[index]} alt="相册图片" expanded />
          </motion.div>
          {images.length > 1 && (
            <button className="icon-button lightbox-next" type="button" onClick={(event) => { event.stopPropagation(); move(1); }} aria-label="下一张">
              <ChevronRight size={22} />
            </button>
          )}
          <span className="lightbox-count">{index + 1} / {images.length}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
