import { AnimatePresence, motion } from "framer-motion";
import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { lockPageForModal, unlockPageForModal } from "../utils/modalLock";

type ModalProps = {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  panelClassName?: string;
};

export default function Modal({ open, title, children, onClose, panelClassName }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    lockPageForModal();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      unlockPageForModal();
    };
  }, [open, onClose]);

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            className={["modal-panel", panelClassName].filter(Boolean).join(" ")}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <div className="modal-header">
              {title && <h3>{title}</h3>}
              <button className="icon-button" type="button" onClick={onClose} aria-label="关闭弹窗">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
