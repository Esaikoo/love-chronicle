import dayjs from "dayjs";
import { Edit3, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { LetterItem } from "../types";

type LetterReaderProps = {
  letter: LetterItem;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function LetterReader({ letter, canEdit, canDelete, onClose, onEdit, onDelete }: LetterReaderProps) {
  const { user } = useAuth();
  const showTime = user.username?.toLowerCase() === "lxq";
  return (
    <article className="letter-reader" onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>
      <button className="icon-button letter-reader-close" type="button" onClick={onClose} aria-label="关闭情书"><X size={19} /></button>
      <header>
        <span>{letter.emoji || "💌"}</span>
        <div>
          <h3>{letter.title}</h3>
          <p>To {letter.toUser || "她"} · From {letter.fromUser || "我"}{showTime ? ` · ${dayjs(letter.createdAt).format("YYYY年MM月DD日 HH:mm")}` : ""}</p>
        </div>
      </header>
      <div className="letter-paper">
        {letter.content.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line || "\u00A0"}</p>)}
      </div>
      {(canEdit || canDelete) && (
        <footer>
          {canEdit && <button className="ghost-button" type="button" onClick={onEdit}><Edit3 size={15} />编辑</button>}
          {canDelete && <button className="ghost-button danger" type="button" onClick={onDelete}><Trash2 size={15} />删除</button>}
        </footer>
      )}
    </article>
  );
}
