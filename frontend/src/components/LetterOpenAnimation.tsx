import { AnimatePresence, motion } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LetterItem } from "../types";
import { lockPageForModal, unlockPageForModal } from "../utils/modalLock";

type LetterOpenAnimationProps = {
  open: boolean;
  letter: LetterItem | null;
  children: ReactNode;
};

export default function LetterOpenAnimation({ open, letter, children }: LetterOpenAnimationProps) {
  useEffect(() => {
    if (!open) return;
    lockPageForModal();
    return () => unlockPageForModal();
  }, [open]);

  const content = (
    <AnimatePresence mode="wait">
      {open && letter && (
        <motion.div className={`letter-open-stage envelope-${letter.envelopeStyle || "sakura"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>
          <motion.div className="opening-envelope" initial={{ y: 28, scale: 0.92 }} animate={{ y: 0, scale: 1 }} exit={{ y: 22, scale: 0.94 }}>
            <motion.span className="opening-flap" initial={{ rotateX: 0 }} animate={{ rotateX: -132 }} exit={{ rotateX: 0 }} transition={{ delay: 0.12, duration: 0.58, ease: [0.22, 1, 0.36, 1] }} />
            <motion.span className="opening-paper" initial={{ y: 48, opacity: 0 }} animate={{ y: -72, opacity: 1 }} exit={{ y: 48, opacity: 0 }} transition={{ delay: 0.48, duration: 0.62, ease: [0.22, 1, 0.36, 1] }} />
          </motion.div>
          <motion.div className="letter-reader-shell" initial={{ opacity: 0, y: 34, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} transition={{ delay: 0.82, duration: 0.46 }}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return createPortal(content, document.body);
}
