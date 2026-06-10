import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Edit3, ImagePlus, Trash2 } from "lucide-react";
import { ChangeEvent, ClipboardEvent, useEffect, useMemo, useState } from "react";
import { absoluteUrl, api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { siteConfig } from "../data/siteConfig";
import { useBlobObjectUrls } from "../hooks/useBlobObjectUrls";
import { useConfirm } from "../hooks/useConfirm";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useLoveSettings } from "../hooks/useLoveSettings";
import { deleteBlob } from "../storage/indexedDb";
import type { CalendarNote, CheckinItem, CountdownItem } from "../types";
import { prepareVisualMedia } from "../utils/media";
import { profileOf } from "../utils/profiles";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "../utils/storageKeys";
import EmojiTextArea from "./EmojiTextArea";
import MediaPreview from "./MediaPreview";
import Modal from "./Modal";

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
const emptyDraft = { emoji: "💗", ratingMe: 5, ratingHer: 5, text: "", tags: "", imageIds: [] as string[] };

type DateEvent = { label: string; emoji: string; kind: "anniversary" | "promise" | "checkin" | "note" };

function emojiFromText(text: string, fallback = "💗") {
  return text.match(/\p{Extended_Pictographic}/u)?.[0] ?? fallback;
}

function isRemoteMedia(id: string) {
  return /^https?:\/\//.test(id) || id.startsWith("/uploads/");
}

function fromRemoteNote(note: CalendarNote & { imageUrls?: string[] }): CalendarNote {
  return { ...note, imageIds: note.imageIds ?? note.imageUrls ?? [] };
}

function relativeDay(date: string) {
  const diff = dayjs(date).startOf("day").diff(dayjs().startOf("day"), "day");
  if (diff === 0) return "今天";
  return diff < 0 ? `${Math.abs(diff)} 天前` : `${diff} 天后`;
}

function AuthorLine({ role, time, action, showTime }: { role?: "me" | "her"; time?: string; action: string; showTime: boolean }) {
  const profile = profileOf(role);
  if (!profile) return null;
  return (
    <span className="author-line">
      <i>{profile.avatar}</i>
      {profile.nickname} {action}
      {showTime && time && <small>{dayjs(time).format("YYYY-MM-DD HH:mm")}</small>}
    </span>
  );
}

export default function LoveCalendar() {
  const { user, canEdit } = useAuth();
  const showAdminTime = user.username?.toLowerCase() === "lxq";
  const [month, setMonth] = useState(dayjs().startOf("month"));
  const [notes, setNotes] = useLocalStorage<CalendarNote[]>(STORAGE_KEYS.CALENDAR_NOTES, [], LEGACY_STORAGE_KEYS.CALENDAR_NOTES);
  const [countdowns, setCountdowns] = useLocalStorage<CountdownItem[]>(STORAGE_KEYS.COUNTDOWNS, [], LEGACY_STORAGE_KEYS.COUNTDOWNS);
  const [checkins, setCheckins] = useLocalStorage<CheckinItem[]>(STORAGE_KEYS.CHECKINS, [], LEGACY_STORAGE_KEYS.CHECKINS);
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [settings] = useLoveSettings();
  const { confirm, dialog } = useConfirm();

  const noteMap = useMemo(() => new Map(notes.map((note) => [note.date, { ...note, imageIds: note.imageIds ?? [] }])), [notes]);
  const eventsForDate = (dateKey: string) => {
    const events: DateEvent[] = [];
    const monthDay = dateKey.slice(5);
    if (settings.firstMeetDate && settings.firstMeetDate.slice(5) === monthDay) events.push({ label: "相识纪念日", emoji: "💗", kind: "anniversary" });
    if (settings.loveStartDate && settings.loveStartDate.slice(5) === monthDay) events.push({ label: "在一起纪念日", emoji: "💕", kind: "anniversary" });
    countdowns.filter((item) => item.targetDate === dateKey).forEach((item) => events.push({ label: `约定：${item.title}`, emoji: item.emoji || "✨", kind: "promise" }));
    checkins.filter((item) => item.date === dateKey).forEach((item) => events.push({ label: `打卡：${item.title}`, emoji: item.emoji || "📍", kind: "checkin" }));
    const note = noteMap.get(dateKey);
    if (note) events.push({ label: "有一篇相识日记", emoji: note.emoji || "💗", kind: "note" });
    return events;
  };
  const selectedNote = noteMap.get(selectedDate);
  const selectedEvents = eventsForDate(selectedDate);
  const previewIds = [...(selectedNote?.imageIds ?? []), ...(editing ? draft.imageIds : [])].filter((id) => !isRemoteMedia(id));
  const imageUrls = useBlobObjectUrls("calendarImages", previewIds);
  const mediaUrlOf = (id: string) => isRemoteMedia(id) ? absoluteUrl(id) : imageUrls[id];

  useEffect(() => {
    api.calendar.list()
      .then((remoteNotes) => setNotes(remoteNotes.map(fromRemoteNote)))
      .catch(() => undefined);
    api.countdowns.list()
      .then((remoteItems) => setCountdowns(remoteItems))
      .catch(() => undefined);
    api.checkins.list()
      .then((remoteItems) => setCheckins(remoteItems))
      .catch(() => undefined);
  }, [setCheckins, setCountdowns, setNotes]);

  const cells = useMemo(() => {
    const days = month.daysInMonth();
    const start = month.day();
    return Array.from({ length: start + days }, (_, index) => (index < start ? null : month.date(index - start + 1)));
  }, [month]);

  const openEditor = () => {
    setDraft({
      emoji: selectedNote?.emoji ?? "💗",
      ratingMe: selectedNote?.ratingMe ?? selectedNote?.rating ?? 5,
      ratingHer: selectedNote?.ratingHer ?? selectedNote?.rating ?? 5,
      text: selectedNote?.text ?? "",
      tags: selectedNote?.tags.join(", ") ?? "",
      imageIds: selectedNote?.imageIds ?? []
    });
    setEditing(true);
  };

  const addImages = async (files: FileList | File[]) => {
    const ids: string[] = [];
    for (const file of Array.from(files).filter((item) => item.type.startsWith("image/") || item.type.startsWith("video/"))) {
      const blob = await prepareVisualMedia(file, 1400, 0.78);
      const preparedFile = new File([blob], file.name, { type: blob.type || file.type });
      const uploaded = await api.upload("calendar", preparedFile);
      ids.push(uploaded.url);
    }
    setDraft((current) => ({ ...current, imageIds: [...current.imageIds, ...ids] }));
  };

  const onPaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) {
      event.preventDefault();
      await addImages(files);
    }
  };

  const save = async () => {
    if (user.role === "guest") return;
    const now = new Date().toISOString();
    const writerRole = user.role;
    const nextNote: CalendarNote = {
      date: selectedDate,
      emoji: emojiFromText(draft.text, draft.emoji || "💗"),
      rating: Math.round((draft.ratingMe + draft.ratingHer) / 2),
      ratingMe: draft.ratingMe,
      ratingHer: draft.ratingHer,
      text: draft.text,
      tags: draft.tags.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean),
      imageIds: draft.imageIds,
      createdBy: selectedNote?.createdBy ?? writerRole,
      updatedBy: selectedNote ? writerRole : undefined,
      createdAt: selectedNote?.createdAt ?? now,
      updatedAt: now
    };
    const saved = selectedNote
      ? await api.calendar.update(selectedDate, nextNote)
      : await api.calendar.create(nextNote);
    const finalNote = fromRemoteNote(saved);
    setNotes((current) => [...current.filter((note) => note.date !== selectedDate), finalNote]);
    setEditing(false);
  };

  const removeNote = async () => {
    if (!selectedNote) return;
    const ok = await confirm({
      title: "确定要删除这一天的记录吗？",
      description: "文字和照片记录都会从服务器移除。",
      confirmText: "确定删除",
      tone: "danger"
    });
    if (!ok) return;
    await api.calendar.delete(selectedDate);
    await Promise.all((selectedNote.imageIds ?? []).filter((id) => !isRemoteMedia(id)).map((id) => deleteBlob("calendarImages", id)));
    setNotes((current) => current.filter((note) => note.date !== selectedDate));
  };

  const removeDraftImage = async (id: string) => {
    const ok = await confirm({
      title: "确定删除这张评价照片吗？",
      description: "删除后，这张照片不会再显示在当天记录里。",
      confirmText: "确定删除",
      tone: "danger"
    });
    if (!ok) return;
    if (!isRemoteMedia(id)) await deleteBlob("calendarImages", id);
    setDraft((current) => ({ ...current, imageIds: current.imageIds.filter((imageId) => imageId !== id) }));
  };

  return (
    <div className="section-inner calendar-wrap">
      <div className="calendar-header">
        <div>
          <p className="eyebrow">Love Calendar</p>
          <h3>给今天留下一点心情吧。</h3>
        </div>
        <div className="calendar-actions">
          <button className="icon-button" type="button" onClick={() => setMonth((value) => value.subtract(1, "month"))} aria-label="上个月"><ChevronLeft size={18} /></button>
          <strong>{month.format("YYYY年MM月")}</strong>
          <button className="icon-button" type="button" onClick={() => setMonth((value) => value.add(1, "month"))} aria-label="下个月"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="calendar-layout">
        <div className="love-card calendar-card">
          {weekDays.map((day) => <span className="weekday" key={day}>{day}</span>)}
          {cells.map((date, index) => {
            if (!date) return <span className="calendar-cell empty" key={`empty-${index}`} />;
            const dateKey = date.format("YYYY-MM-DD");
            const note = noteMap.get(dateKey);
            const isToday = date.isSame(dayjs(), "day");
            const isSelected = dateKey === selectedDate;
            const firstMeetDate = settings.firstMeetDate ?? siteConfig.firstMeetDate;
            const loveStartDate = settings.loveStartDate ?? siteConfig.loveStartDate;
            const isAnniversary = dateKey === firstMeetDate || dateKey === loveStartDate;
            const events = eventsForDate(dateKey);
            return (
              <button className={["calendar-cell", isToday ? "today" : "", isSelected ? "selected" : "", isAnniversary ? "anniversary" : "", note ? "has-note" : "", events.length ? "has-events" : ""].join(" ")} key={dateKey} type="button" onClick={() => setSelectedDate(dateKey)} title={events.map((event) => event.label).join("\n")}>
                <span>{date.date()}</span>
                {note && <i>{note.emoji}</i>}
                {events.length > 0 && <b className="calendar-event-dots">{events.slice(0, 3).map((event, eventIndex) => <em className={event.kind} key={`${event.kind}-${eventIndex}`} />)}</b>}
                {events.length > 0 && <small className="calendar-event-tooltip">{events.map((event) => <span key={`${event.kind}-${event.label}`}>{event.emoji} {event.label}</span>)}</small>}
              </button>
            );
          })}
        </div>

        <aside className="love-card note-detail-card diary-detail-panel">
          <div className="diary-detail-body">
            <div className="diary-detail-top">
              <span className="relative-pill">{relativeDay(selectedDate)}</span>
              {selectedNote && (
                <div className="author-lines">
                  <AuthorLine role={selectedNote.createdBy} time={selectedNote.createdAt} action="记录" showTime={showAdminTime} />
                  <AuthorLine role={selectedNote.updatedBy} time={selectedNote.updatedAt} action="编辑" showTime={showAdminTime} />
                </div>
              )}
            </div>
            <h3>{dayjs(selectedDate).format("YYYY年MM月DD日")}</h3>
            {selectedEvents.length > 0 && <div className="calendar-selected-events">{selectedEvents.map((event) => <span key={`${event.kind}-${event.label}`}>{event.emoji} {event.label}</span>)}</div>}
            {selectedNote ? (
              <>
                <div className="note-rating">
                  <span>{selectedNote.emoji}</span>
                  <strong>她 {"♥".repeat(selectedNote.ratingHer ?? selectedNote.rating)}</strong>
                  <strong>我 {"♥".repeat(selectedNote.ratingMe ?? selectedNote.rating)}</strong>
                </div>
                <p>{selectedNote.text || "这一天还没有写下文字，但已经被好好记住了。"}</p>
                <div className="note-tags">{selectedNote.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                {selectedNote.imageIds.length > 0 && (
                  <div className="note-images">{selectedNote.imageIds.map((id) => mediaUrlOf(id) && <MediaPreview key={id} src={mediaUrlOf(id)} alt="评价照片" />)}</div>
                )}
              </>
            ) : (
              <p className="empty-copy">这里还空空的，等以后慢慢把它填满。</p>
            )}
          </div>
          {canEdit && (
            <div className="detail-actions diary-detail-actions">
              <button className="primary-button" type="button" onClick={openEditor}><Edit3 size={16} />编辑这一刻</button>
              {selectedNote && <button className="ghost-button danger" type="button" onClick={removeNote}><Trash2 size={16} />删除</button>}
            </div>
          )}
        </aside>
      </div>

      <Modal open={editing} title={`编辑 ${selectedDate}`} onClose={() => setEditing(false)}>
        <div className="form-grid">
          <label>
            她的评分
            <div className="heart-rating">
              {[1, 2, 3, 4, 5].map((score) => <button key={score} type="button" className={draft.ratingHer >= score ? "active" : ""} onClick={() => setDraft((value) => ({ ...value, ratingHer: score }))}>♥</button>)}
            </div>
          </label>
          <label>
            我的评分
            <div className="heart-rating">
              {[1, 2, 3, 4, 5].map((score) => <button key={score} type="button" className={draft.ratingMe >= score ? "active" : ""} onClick={() => setDraft((value) => ({ ...value, ratingMe: score }))}>♥</button>)}
            </div>
          </label>
          <label className="full">今天的心情<EmojiTextArea value={draft.text} onPaste={onPaste} onChange={(text) => setDraft((value) => ({ ...value, text }))} rows={4} placeholder="写下心情，也可以插入表情或直接粘贴图片" /></label>
          <label className="full">标签<input value={draft.tags} onChange={(event) => setDraft((value) => ({ ...value, tags: event.target.value }))} placeholder="约会, 晚霞, 想你" /></label>
          <label className="upload-box full"><ImagePlus size={20} />上传照片或 Live 素材<input type="file" accept="image/*,video/*,.mov,.mp4,.m4v" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && addImages(event.target.files)} /></label>
          {draft.imageIds.length > 0 && (
            <div className="draft-image-list full">
              {draft.imageIds.map((id) => (
                <button key={id} type="button" onClick={() => removeDraftImage(id)}>
                  <span>{mediaUrlOf(id) ? <MediaPreview src={mediaUrlOf(id)} alt="评价照片" /> : "🖼️"}</span>
                  <Trash2 size={15} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="modal-actions"><button className="primary-button" type="button" onClick={() => void save()}>保存这一刻</button></div>
      </Modal>
      {dialog}
    </div>
  );
}
