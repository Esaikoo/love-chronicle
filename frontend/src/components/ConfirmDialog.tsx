import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { lockPageForModal, unlockPageForModal } from "../utils/modalLock";

export type ConfirmDialogState = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "primary";
};

type ConfirmDialogProps = ConfirmDialogState & {
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确定",
  cancelText = "再想想",
  tone = "primary",
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    lockPageForModal();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      unlockPageForModal();
    };
  }, [onCancel, open]);

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div className="confirm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onCancel}>
          <motion.div
            className="confirm-panel"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.8 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            <div className="confirm-actions">
              <button className="ghost-button" type="button" onClick={onCancel}>
                {cancelText}
              </button>
              <button className={tone === "danger" ? "primary-button danger" : "primary-button"} type="button" onClick={onConfirm}>
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
