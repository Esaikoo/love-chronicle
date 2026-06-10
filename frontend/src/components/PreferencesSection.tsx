import { DndContext, DragCancelEvent, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { mockPreferences } from "../data/mockPreferences";
import { useConfirm } from "../hooks/useConfirm";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useAuth } from "../context/AuthContext";
import type { PreferenceItem, PreferenceOwner } from "../types";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "../utils/storageKeys";
import EmojiPicker from "./EmojiPicker";
import Modal from "./Modal";

const groups: Array<{ owner: PreferenceOwner; title: string; subtitle: string }> = [
  { owner: "her", title: "她喜欢的", subtitle: "认真记下每一点可爱" },
  { owner: "me", title: "我喜欢的", subtitle: "也把自己放进故事里" },
  { owner: "both", title: "共同喜欢的", subtitle: "悄悄重叠的可爱部分" }
];

function PreferenceTag({ item, onView }: { item: PreferenceItem; onView: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  return (
    <span
      ref={setNodeRef}
      className={isDragging ? "preference-tag dragging" : "preference-tag"}
      style={{ transform: !isDragging && transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      {...listeners}
      {...attributes}
      title={item.note || item.category}
      onClick={onView}
    >
      <b>{item.emoji}</b>
      {item.content}
      {item.note && <small className="preference-note">{item.note}</small>}
    </span>
  );
}

function PreferenceColumn({ group, children }: { group: (typeof groups)[number]; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: group.owner });
  return (
    <article ref={setNodeRef} className={isOver ? "love-card preference-column over" : "love-card preference-column"}>
      <h3>{group.title}</h3>
      <p>{group.subtitle}</p>
      <div className="preference-tags">{children}</div>
    </article>
  );
}

export default function PreferencesSection() {
  const [items, setItems] = useLocalStorage<PreferenceItem[]>(STORAGE_KEYS.PREFERENCES, mockPreferences, LEGACY_STORAGE_KEYS.PREFERENCES);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<PreferenceItem | null>(null);
  const [dragItem, setDragItem] = useState<PreferenceItem | null>(null);
  const [moveChoice, setMoveChoice] = useState<{ item: PreferenceItem; owner: PreferenceOwner } | null>(null);
  const [draft, setDraft] = useState({ owner: "her" as PreferenceOwner, category: "生活", content: "", emoji: "💗", note: "" });
  const { confirm, dialog } = useConfirm();
  const { canEdit } = useAuth();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    api.preferences.list()
      .then((remoteItems) => setItems(remoteItems))
      .catch(() => undefined);
  }, [setItems]);

  const save = async () => {
    if (!draft.content.trim()) return;
    if (editingId) {
      const saved = await api.preferences.update(editingId, { ...draft, content: draft.content.trim() });
      setItems((current) => current.map((item) => item.id === editingId ? saved : item));
    } else {
      const saved = await api.preferences.create({ ...draft, content: draft.content.trim(), emoji: draft.emoji || "💗" });
      setItems((current) => [saved, ...current]);
    }
    setEditingId(null);
    setDraft({ owner: "her", category: "生活", content: "", emoji: "💗", note: "" });
    setOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft({ owner: "her", category: "生活", content: "", emoji: "💗", note: "" });
    setOpen(true);
  };

  const openEdit = (item: PreferenceItem) => {
    setEditingId(item.id);
    setDraft({ owner: item.owner, category: item.category || "生活", content: item.content, emoji: item.emoji, note: item.note ?? "" });
    setOpen(true);
  };

  const removeItem = async (item: PreferenceItem) => {
    const ok = await confirm({
      title: "确定删除这个小喜好吗？",
      description: "删除后，这条记录会从服务器移除。",
      confirmText: "确定删除",
      tone: "danger"
    });
    if (!ok) return;
    await api.preferences.delete(item.id);
    setItems((current) => current.filter((target) => target.id !== item.id));
  };

  const onDragStart = (event: DragStartEvent) => {
    setDragItem(items.find((item) => item.id === event.active.id) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const item = items.find((target) => target.id === event.active.id);
    const owner = event.over?.id as PreferenceOwner | undefined;
    setDragItem(null);
    if (!canEdit || !item || !owner || owner === item.owner) return;
    setMoveChoice({ item, owner });
  };

  const onDragCancel = (_event: DragCancelEvent) => {
    setDragItem(null);
  };

  const applyMoveChoice = async (action: "move" | "copy") => {
    if (!moveChoice) return;
    if (action === "move") {
      const saved = await api.preferences.update(moveChoice.item.id, { ...moveChoice.item, owner: moveChoice.owner });
      setItems((current) => current.map((item) => item.id === moveChoice.item.id ? saved : item));
    } else {
      const saved = await api.preferences.create({ ...moveChoice.item, owner: moveChoice.owner });
      setItems((current) => [saved, ...current]);
    }
    setMoveChoice(null);
  };

  return (
    <div className="section-inner">
      <div className="section-heading row-heading">
        <div>
          <p className="eyebrow">Preferences</p>
          <h2>慢慢记住你的喜欢，是我认真爱你的方式。</h2>
        </div>
        {canEdit && <button className="primary-button" type="button" onClick={openCreate}>
          <Plus size={17} />
          新增喜好
        </button>}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className="preference-grid">
          {groups.map((group) => (
            <PreferenceColumn group={group} key={group.owner}>
              {items.filter((item) => item.owner === group.owner).map((item) => (
                <PreferenceTag item={item} key={item.id} onView={() => setDetailItem(item)} />
              ))}
            </PreferenceColumn>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{dragItem && <span className="preference-tag overlay"><b>{dragItem.emoji}</b>{dragItem.content}</span>}</DragOverlay>
      </DndContext>

      <Modal open={open} title={editingId ? "编辑喜好" : "新增喜好"} onClose={() => setOpen(false)}>
        <div className="form-grid">
          <label>
            归属
            <select value={draft.owner} onChange={(event) => setDraft((value) => ({ ...value, owner: event.target.value as PreferenceOwner }))}>
              <option value="her">她</option>
              <option value="me">我</option>
              <option value="both">共同</option>
            </select>
          </label>
          <label>
            表情
            <EmojiPicker value={draft.emoji} onChange={(emoji) => setDraft((value) => ({ ...value, emoji }))} />
          </label>
          <label>
            内容
            <input value={draft.content} onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))} placeholder="草莓蛋糕" />
          </label>
          <label className="full">
            备注
            <textarea value={draft.note} onChange={(event) => setDraft((value) => ({ ...value, note: event.target.value }))} rows={3} placeholder="保存后，电脑端悬浮或手机端直接查看" />
          </label>
        </div>
        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={() => void save()}>
            保存这一刻
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(detailItem)} title="喜好详情" onClose={() => setDetailItem(null)}>
        {detailItem && <div className="preference-detail">
          <strong>{detailItem.emoji} {detailItem.content}</strong>
          <p>{detailItem.note || "还没有备注，留一点空间给以后的发现。"}</p>
          {canEdit && <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => { setDetailItem(null); openEdit(detailItem); }}><Edit3 size={15} />编辑</button>
            <button className="ghost-button danger" type="button" onClick={() => { setDetailItem(null); void removeItem(detailItem); }}><Trash2 size={15} />删除</button>
          </div>}
        </div>}
      </Modal>

      <Modal open={Boolean(moveChoice)} title="要怎么放到这里？" onClose={() => setMoveChoice(null)}>
        <p className="local-tip">可以把「{moveChoice?.item.content}」移动到新栏目，也可以复制一份。</p>
        <div className="choice-actions">
          <button className="ghost-button" type="button" onClick={() => setMoveChoice(null)}>取消</button>
          <button className="ghost-button" type="button" onClick={() => void applyMoveChoice("copy")}>复制到这里</button>
          <button className="primary-button" type="button" onClick={() => void applyMoveChoice("move")}>移动到这里</button>
        </div>
      </Modal>
      {dialog}
    </div>
  );
}
