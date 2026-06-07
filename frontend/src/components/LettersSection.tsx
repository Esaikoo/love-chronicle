import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../hooks/useConfirm";
import type { EnvelopeStyle, LetterItem } from "../types";
import EnvelopeCard from "./EnvelopeCard";
import LetterEditor from "./LetterEditor";
import LetterOpenAnimation from "./LetterOpenAnimation";
import LetterReader from "./LetterReader";
import Modal from "./Modal";

type LetterDraft = Omit<LetterItem, "id" | "createdBy" | "updatedAt">;

const emptyDraft = (): LetterDraft => ({
  title: "",
  content: "",
  fromUser: "",
  toUser: "",
  emoji: "💌",
  envelopeStyle: "sakura" as EnvelopeStyle,
  isPublic: false,
  createdAt: dayjs().toISOString()
});

export default function LettersSection() {
  const { user, canEdit } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [letters, setLetters] = useState<LetterItem[]>([]);
  const [query, setQuery] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [reader, setReader] = useState<LetterItem | null>(null);
  const [editing, setEditing] = useState<LetterItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<LetterDraft>(() => emptyDraft());

  const load = useCallback(async () => {
    const nextLetters = await api.letters.list({ q: query, from: fromFilter, to: toFilter }).catch(() => []);
    setLetters(nextLetters);
  }, [fromFilter, query, toFilter]);

  useEffect(() => {
    void load();
    const retryTimer = window.setTimeout(() => void load(), 450);
    return () => window.clearTimeout(retryTimer);
  }, [load, user.role, user.username]);

  const filtered = useMemo(() => letters, [letters]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...emptyDraft(), fromUser: user.display_name || (user.role === "me" ? "我" : "她"), toUser: user.role === "me" ? "她" : "我" });
    setEditorOpen(true);
  };

  const openEdit = (letter: LetterItem) => {
    setReader(null);
    setEditing(letter);
    setDraft({
      title: letter.title,
      content: letter.content,
      fromUser: letter.fromUser,
      toUser: letter.toUser,
      emoji: letter.emoji,
      envelopeStyle: letter.envelopeStyle,
      isPublic: letter.isPublic,
      createdAt: letter.createdAt
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
    setDraft(emptyDraft());
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.content.trim()) return;
    if (editing) {
      await api.letters.update(editing.id, draft);
    } else {
      await api.letters.create(draft);
    }
    closeEditor();
    await load();
  };

  const remove = async (letter: LetterItem) => {
    const ok = await confirm({ title: "确定要删除这封信吗？", description: "只有写信人本人可以删除。删除后这封信会从信箱里移除。", confirmText: "确定删除", tone: "danger" });
    if (!ok) return;
    await api.letters.delete(letter.id).catch(() => undefined);
    setReader(null);
    await load();
  };

  return (
    <div className="section-inner letters-section">
      <div className="section-heading row-heading">
        <div>
          <p className="eyebrow">Letters</p>
          <h2>把想说的话，认真装进一封信里。</h2>
        </div>
        {canEdit && <button className="primary-button" type="button" onClick={openCreate}><Plus size={17} />写一封信</button>}
      </div>

      <div className="letter-filters love-card">
        <div className="letter-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load()} placeholder="搜索标题或正文里的悄悄话" />
          <button className="primary-button" type="button" onClick={() => void load()}>查找</button>
        </div>
        <input value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} onBlur={() => void load()} placeholder="按写信人筛选" />
        <input value={toFilter} onChange={(event) => setToFilter(event.target.value)} onBlur={() => void load()} placeholder="按收件人筛选" />
      </div>

      <motion.div className="envelope-grid" layout>
        <AnimatePresence>
          {filtered.map((letter) => <EnvelopeCard key={letter.id} letter={letter} onOpen={() => setReader(letter)} />)}
        </AnimatePresence>
      </motion.div>
      {!filtered.length && <div className="soft-empty">信箱还空着，等一封温柔的信。</div>}

      <LetterOpenAnimation open={Boolean(reader)} letter={reader}>
        {reader && (
          <LetterReader
            letter={reader}
            canEdit={canEdit && reader.createdBy === user.role}
            canDelete={canEdit && reader.createdBy === user.role}
            onClose={() => setReader(null)}
            onEdit={() => openEdit(reader)}
            onDelete={() => void remove(reader)}
          />
        )}
      </LetterOpenAnimation>

      <Modal open={editorOpen} title={editing ? "编辑这封信" : "写一封信"} onClose={closeEditor} panelClassName="letter-editor-modal">
        <LetterEditor draft={draft} setDraft={setDraft} onSave={() => void save()} onCancel={closeEditor} editing={Boolean(editing)} />
      </Modal>
      {dialog}
    </div>
  );
}
