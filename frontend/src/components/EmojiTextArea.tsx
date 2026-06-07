import { ClipboardEvent, useRef } from "react";
import EmojiPicker from "./EmojiPicker";

type EmojiTextAreaProps = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
};

export default function EmojiTextArea({ value, onChange, rows = 4, placeholder, onPaste }: EmojiTextAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const nextValue = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  return (
    <div className="emoji-textarea">
      <textarea ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} onPaste={onPaste} rows={rows} placeholder={placeholder} />
      <div className="emoji-textarea-action">
        <EmojiPicker value="😊" label="在文字中插入表情" onChange={insertEmoji} />
      </div>
    </div>
  );
}
