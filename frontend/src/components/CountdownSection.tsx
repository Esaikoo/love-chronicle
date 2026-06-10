import dayjs from "dayjs";
import { Check, Edit3, ImagePlus, MapPinned, Plane, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { absoluteUrl, api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { mockCountdowns } from "../data/mockCountdowns";
import { useBlobObjectUrls } from "../hooks/useBlobObjectUrls";
import { useConfirm } from "../hooks/useConfirm";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { deleteBlob } from "../storage/indexedDb";
import type { CountdownItem, CountdownType } from "../types";
import { daysUntil } from "../utils/date";
import { prepareVisualMedia } from "../utils/media";
import { profileOf } from "../utils/profiles";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "../utils/storageKeys";
import EmojiTextArea from "./EmojiTextArea";
import MediaPreview from "./MediaPreview";
import Modal from "./Modal";
import TravelPlanWorkspace from "./TravelPlanWorkspace";

const emptyDraft = { title: "", targetDate: dayjs().add(30, "day").format("YYYY-MM-DD"), description: "", emoji: "✨", coverImageId: "", type: "normal" as CountdownType };

function fromRemote(item: CountdownItem & { coverUrl?: string }): CountdownItem {
  return { ...item, coverImageId: item.coverImageId || item.coverUrl || undefined };
}

function toRemote(item: CountdownItem) {
  return {
    title: item.title,
    targetDate: item.targetDate,
    description: item.description,
    emoji: item.emoji,
    coverUrl: item.coverImageId || "",
    type: item.type || "normal",
    status: item.status
  };
}

function emojiFromText(text: string, fallback = "✨") {
  return text.match(/\p{Extended_Pictographic}/u)?.[0] ?? fallback;
}

function isRemoteMedia(id?: string) {
  return Boolean(id && (/^https?:\/\//.test(id) || id.startsWith("/uploads/")));
}

function AuthorMini({ item }: { item: CountdownItem }) {
  const created = profileOf(item.createdBy);
  const updated = profileOf(item.updatedBy);
  if (!created && !updated) return null;
  return (
    <div className="author-mini">
      {created && <span><i>{created.avatar}</i>{created.nickname}创建</span>}
      {updated && <span><i>{updated.avatar}</i>{updated.nickname}编辑过</span>}
    </div>
  );
}

export default function CountdownSection() {
  const { user, canEdit } = useAuth();
  const [items, setItems] = useLocalStorage<CountdownItem[]>(STORAGE_KEYS.COUNTDOWNS, mockCountdowns, LEGACY_STORAGE_KEYS.COUNTDOWNS);
  const [editing, setEditing] = useState<CountdownItem | null>(null);
  const [travelFor, setTravelFor] = useState<CountdownItem | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const { confirm, dialog } = useConfirm();
  const coverIds = [...items.map((item) => item.coverImageId).filter(Boolean), draft.coverImageId].filter((id) => !isRemoteMedia(id)) as string[];
  const coverUrls = useBlobObjectUrls("countdownCovers", coverIds);
  const coverUrlOf = (id?: string) => isRemoteMedia(id) ? absoluteUrl(id) : id ? coverUrls[id] : "";

  useEffect(() => {
    api.countdowns.list()
      .then((remoteItems) => setItems(remoteItems.map(fromRemote)))
      .catch(() => undefined);
  }, [setItems]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditing({ id: "", status: "pending", createdAt: dayjs().toISOString(), ...emptyDraft });
  };

  const openEdit = (item: CountdownItem) => {
    setDraft({ title: item.title, targetDate: item.targetDate, description: item.description, emoji: item.emoji, coverImageId: item.coverImageId ?? "", type: item.type ?? "normal" });
    setEditing(item);
  };

  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (draft.coverImageId) {
      const ok = await confirm({ title: "要替换这张封面吗？", description: "保存后会使用新的服务器封面。", confirmText: "替换封面" });
      if (!ok) return;
      if (!isRemoteMedia(draft.coverImageId)) await deleteBlob("countdownCovers", draft.coverImageId);
    }
    const blob = await prepareVisualMedia(file, 1400, 0.78);
    const preparedFile = new File([blob], file.name, { type: blob.type || file.type });
    const uploaded = await api.upload("covers", preparedFile);
    setDraft((value) => ({ ...value, coverImageId: uploaded.url }));
  };

  const removeCover = async () => {
    if (!draft.coverImageId) return;
    const ok = await confirm({ title: "确定删除这张封面吗？", description: "删除后会回到渐变卡片样式。", confirmText: "删除封面", tone: "danger" });
    if (!ok) return;
    if (!isRemoteMedia(draft.coverImageId)) await deleteBlob("countdownCovers", draft.coverImageId);
    setDraft((value) => ({ ...value, coverImageId: "" }));
  };

  const save = async () => {
    if (!editing || !draft.title.trim() || user.role === "guest") return;
    const now = dayjs().toISOString();
    const writerRole = user.role;
    const next: CountdownItem = {
      ...editing,
      id: editing.id || crypto.randomUUID(),
      title: draft.title.trim(),
      targetDate: draft.targetDate,
      description: draft.description,
      emoji: emojiFromText(draft.description, draft.emoji || "✨"),
      coverImageId: draft.coverImageId || undefined,
      type: draft.type,
      createdAt: editing.createdAt || now,
      createdBy: editing.createdBy ?? writerRole,
      updatedBy: editing.id ? writerRole : undefined,
      updatedAt: editing.id ? now : undefined
    };
    const saved = editing.id
      ? await api.countdowns.update(editing.id, toRemote(next))
      : await api.countdowns.create(toRemote(next));
    const finalItem = fromRemote(saved);
    setItems((current) => [finalItem, ...current.filter((item) => item.id !== finalItem.id)]);
    setEditing(null);
  };

  const removeItem = async (item: CountdownItem) => {
    const ok = await confirm({ title: "确定要删除这个约定吗？", description: "删除后，这条记录会从服务器移除。", confirmText: "确定删除", tone: "danger" });
    if (!ok) return;
    if (item.coverImageId && !isRemoteMedia(item.coverImageId)) await deleteBlob("countdownCovers", item.coverImageId);
    await api.countdowns.delete(item.id);
    setItems((current) => current.filter((target) => target.id !== item.id));
  };

  const toggleComplete = async (item: CountdownItem) => {
    if (user.role === "guest") return;
    const writerRole = user.role;
    const completing = item.status !== "completed";
    const ok = await confirm({
      title: completing ? "要把这个约定标记完成吗？" : "要把这个约定恢复为未完成吗？",
      description: completing ? "完成后的卡片会变得更柔和。" : "恢复后会重新出现在最近约定里。",
      confirmText: completing ? "标记完成" : "恢复约定"
    });
    if (!ok) return;
    const now = dayjs().toISOString();
    const nextItem: CountdownItem = {
      ...item,
      status: completing ? "completed" : "pending",
      completedAt: completing ? now : undefined,
      updatedBy: writerRole,
      updatedAt: now
    };
    const saved = await api.countdowns.update(item.id, toRemote(nextItem));
    setItems((current) => current.map((target) => target.id === item.id ? fromRemote(saved) : target));
  };

  return (
    <div className="section-inner">
      <div className="section-heading row-heading">
        <div>
          <p className="eyebrow">Promises</p>
          <h2>把想实现的小愿望，先轻轻放在这里。</h2>
        </div>
        {canEdit && <button className="primary-button" type="button" onClick={openCreate}><Plus size={17} />新增约定</button>}
      </div>

      <div className="countdown-grid">
        {items.map((item) => {
          const left = daysUntil(item.targetDate);
          const completed = item.status === "completed";
          const coverUrl = coverUrlOf(item.coverImageId);
          return (
            <article className={["love-card countdown-card", completed ? "completed" : "", left === 0 ? "today" : ""].join(" ")} key={item.id}>
              <div className="countdown-cover">{coverUrl ? <MediaPreview src={coverUrl} alt={item.title} /> : <div className="default-countdown-cover" aria-label="默认封面" />}</div>
              <div className="card-topline">
                <span className="date-pill">{item.targetDate}</span>
                {canEdit && (
                  <div className="item-actions">
                    <button className="icon-button" type="button" onClick={() => openEdit(item)} aria-label="编辑"><Edit3 size={16} /></button>
                    <button className="icon-button" type="button" onClick={() => removeItem(item)} aria-label="删除"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
              <h3>{item.title}</h3>
              {item.type === "travel" && <span className="travel-type-pill"><Plane size={14} />旅行约定</span>}
              <p>{item.description || "等那一天到来，再把这个小小约定兑现。"}</p>
              <AuthorMini item={item} />
              <strong className="days-left">{completed ? "已完成" : left > 0 ? `${left} 天后` : left === 0 ? "就是今天" : `已过 ${Math.abs(left)} 天`}</strong>
              {item.type === "travel" && (
                <div className="travel-card-actions">
                  <button className="ghost-button" type="button" onClick={() => setTravelFor(item)}><MapPinned size={16} />{canEdit ? "创建 / 编辑旅行攻略" : "查看攻略地图"}</button>
                  {canEdit && <button className="ghost-button" type="button" onClick={() => setTravelFor(item)}><Upload size={16} />导入攻略数据</button>}
                </div>
              )}
              {canEdit && <button className="ghost-button" type="button" onClick={() => toggleComplete(item)}>{completed ? <RotateCcw size={16} /> : <Check size={16} />}{completed ? "恢复约定" : "标记完成"}</button>}
            </article>
          );
        })}
      </div>

      <Modal open={Boolean(editing)} title={editing?.id ? "编辑约定" : "新增约定"} onClose={() => setEditing(null)}>
        <div className="form-grid">
          <label>目标日期<input type="date" value={draft.targetDate} onChange={(event) => setDraft((value) => ({ ...value, targetDate: event.target.value }))} /></label>
          <label>约定类型<select value={draft.type} onChange={(event) => setDraft((value) => ({ ...value, type: event.target.value as CountdownType }))}>
            <option value="normal">普通</option>
            <option value="travel">旅行</option>
            <option value="anniversary">纪念日</option>
            <option value="event">活动</option>
            <option value="other">其他</option>
          </select></label>
          <label className="full">标题<input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="去看一次海" /></label>
          <label className="full">描述<EmojiTextArea value={draft.description} onChange={(description) => setDraft((value) => ({ ...value, description }))} rows={4} placeholder="写下这个约定，也可以插入表情" /></label>
          <label className="upload-box full"><ImagePlus size={20} />上传封面或 Live 素材<input type="file" accept="image/*,video/*,.mov,.mp4,.m4v" onChange={uploadCover} /></label>
          {draft.coverImageId && coverUrlOf(draft.coverImageId) && <MediaPreview className="upload-preview full" src={coverUrlOf(draft.coverImageId)} alt="约定封面预览" />}
          {draft.coverImageId && <button className="ghost-button danger full" type="button" onClick={removeCover}><Trash2 size={16} />删除封面</button>}
        </div>
        <div className="modal-actions"><button className="primary-button" type="button" onClick={() => void save()}>保存这一刻</button></div>
      </Modal>
      {travelFor && <TravelPlanWorkspace countdown={travelFor} onClose={() => setTravelFor(null)} />}
      {dialog}
    </div>
  );
}
