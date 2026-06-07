import { AnimatePresence, motion } from "framer-motion";
import type { EmojiClickData, Theme } from "emoji-picker-react";
import type { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import { SmilePlus } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const Picker = lazy(() => import("emoji-picker-react"));

type EmojiPickerProps = {
  value: string;
  onChange: (emoji: string) => void;
  label?: string;
};

type PanelPosition = {
  left: number;
  top: number;
};

export default function EmojiPicker({ value, onChange, label = "选择表情" }: EmojiPickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [emojiData, setEmojiData] = useState<EmojiData>();
  const [position, setPosition] = useState<PanelPosition>({ left: 12, top: 12 });

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(276, window.innerWidth - 24);
    const panelHeight = 356;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - panelWidth - 12);
    const fitsBelow = rect.bottom + 6 + panelHeight <= window.innerHeight - 12;
    const top = fitsBelow ? rect.bottom + 6 : Math.max(12, rect.top - panelHeight - 6);
    setPosition({ left, top });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionPanel();
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open, positionPanel]);

  useEffect(() => {
    if (!open || emojiData) return;
    void import("emoji-picker-react/dist/data/emojis-zh").then((module) => setEmojiData(module.default));
  }, [emojiData, open]);

  const selectEmoji = (emoji: EmojiClickData) => {
    onChange(emoji.emoji);
    setOpen(false);
  };

  return (
    <div className="emoji-picker">
      <button ref={triggerRef} className="emoji-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-label={label}>
        <span>{value || "💗"}</span>
        <small>选择表情</small>
        <SmilePlus size={16} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              className="emoji-panel emoji-library-panel anchored"
              style={position}
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 280, damping: 30, mass: 0.78 }}
            >
              <Suspense fallback={<div className="emoji-loading">正在准备表情库...</div>}>
                {emojiData ? (
                  <Picker
                    onEmojiClick={selectEmoji}
                    theme={"light" as Theme}
                    emojiData={emojiData}
                    lazyLoadEmojis
                    searchPlaceHolder="搜索表情（支持中文）"
                    previewConfig={{ showPreview: false }}
                    skinTonesDisabled
                    width="100%"
                    height={318}
                  />
                ) : (
                  <div className="emoji-loading">正在准备表情库...</div>
                )}
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
