import dayjs from "dayjs";
import type { LetterItem, EnvelopeStyle } from "../types";
import EmojiTextArea from "./EmojiTextArea";

type LetterDraft = Omit<LetterItem, "id" | "createdBy" | "updatedAt">;

type LetterEditorProps = {
  draft: LetterDraft;
  setDraft: (draft: LetterDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  editing: boolean;
};

const styles: Array<{ value: EnvelopeStyle; label: string }> = [
  { value: "sakura", label: "樱花粉" },
  { value: "cream", label: "奶油白" },
  { value: "lavender", label: "浅紫梦" },
  { value: "rose", label: "玫瑰粉" }
];

export default function LetterEditor({ draft, setDraft, onSave, onCancel, editing }: LetterEditorProps) {
  return (
    <div className="letter-editor">
      <div className="form-grid">
        <label>标题<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="写给你的一封信" /></label>
        <label className="letter-time-field">写信时间
          <span>
            <input type="datetime-local" value={dayjs(draft.createdAt).format("YYYY-MM-DDTHH:mm")} onChange={(event) => setDraft({ ...draft, createdAt: dayjs(event.target.value).toISOString() })} />
            <button className="ghost-button" type="button" onClick={() => setDraft({ ...draft, createdAt: dayjs().toISOString() })}>设为现在</button>
          </span>
          <small>可以把这封信放回真正写下的那一刻。</small>
        </label>
        <label>写信人<input value={draft.fromUser} onChange={(event) => setDraft({ ...draft, fromUser: event.target.value })} placeholder="我 / 她 / 昵称" /></label>
        <label>收件人<input value={draft.toUser} onChange={(event) => setDraft({ ...draft, toUser: event.target.value })} placeholder="她 / 我 / 昵称" /></label>
        <label>心情 emoji<input value={draft.emoji} onChange={(event) => setDraft({ ...draft, emoji: event.target.value.slice(0, 4) })} placeholder="💌" /></label>
        <label>信封样式<select value={draft.envelopeStyle} onChange={(event) => setDraft({ ...draft, envelopeStyle: event.target.value })}>
          {styles.map((style) => <option value={style.value} key={style.value}>{style.label}</option>)}
        </select></label>
        <label className="full letter-public-toggle"><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })} />游客也可以看到这封公开信</label>
        <label className="full">正文<EmojiTextArea rows={10} value={draft.content} onChange={(content) => setDraft({ ...draft, content })} placeholder="把想说的话慢慢写在这里..." /></label>
      </div>
      <div className="modal-actions">
        <button className="ghost-button" type="button" onClick={onCancel}>再想想</button>
        <button className="primary-button" type="button" onClick={onSave}>{editing ? "保存修改" : "寄出这封信"}</button>
      </div>
    </div>
  );
}
