import dayjs from "dayjs";
import { Edit3, ImagePlus, LocateFixed, MapPin, Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { ChangeEvent, ClipboardEvent, useEffect, useMemo, useState } from "react";
import { absoluteUrl, api, uploadWithProgress } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { mockCheckins } from "../data/mockCheckins";
import { useBlobObjectUrls } from "../hooks/useBlobObjectUrls";
import { useConfirm } from "../hooks/useConfirm";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useLoveSettings } from "../hooks/useLoveSettings";
import { deleteBlob } from "../storage/indexedDb";
import type { CheckinIndexStatus, CheckinItem, CheckinPhotoSearchResult } from "../types";
import { prepareVisualMedia } from "../utils/media";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "../utils/storageKeys";
import EmojiTextArea from "./EmojiTextArea";
import ImageLightbox from "./ImageLightbox";
import ImageStackCarousel from "./ImageStackCarousel";
import MediaPreview from "./MediaPreview";
import Modal from "./Modal";

const emptyDraft = {
  title: "",
  location: "",
  date: dayjs().format("YYYY-MM-DD"),
  emoji: "📍",
  text: "",
  imageIds: [] as string[]
};

const searchSuggestions = ["裙子", "夜景", "商场", "餐厅", "小熊", "长发", "自拍", "笑容"];

type PendingUpload = {
  id: string;
  name: string;
  previewUrl: string;
  progress: number;
  status: "preparing" | "uploading" | "done" | "failed";
};

function isRemoteMedia(id: string) {
  return /^https?:\/\//.test(id) || id.startsWith("/uploads/");
}

function emojiFromText(text: string, fallback = "📍") {
  return text.match(/\p{Extended_Pictographic}/u)?.[0] ?? fallback;
}

function statusText(status?: string) {
  if (status === "ready") return "已整理";
  if (status === "failed") return "整理失败";
  return "整理中";
}

function AuthorMini({ item, settings, showTime }: { item: CheckinItem; settings: ReturnType<typeof useLoveSettings>[0]; showTime: boolean }) {
  const person = (role?: "me" | "her") => {
    if (!role) return null;
    const nickname = role === "me" ? settings.nicknameMe : settings.nicknameHer;
    const avatar = role === "me" ? settings.avatarMe : settings.avatarHer;
    return { nickname, avatar, fallback: nickname.slice(0, 1).toUpperCase() };
  };
  const created = person(item.createdBy);
  const updated = person(item.updatedBy);
  if (!created && !updated) return null;
  return (
    <div className="author-mini rich-author">
      {created && (
        <span>
          <i>{created.avatar ? <img src={created.avatar} alt="" /> : created.fallback}</i>
          {created.nickname} {showTime && item.createdAt ? `· ${dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")} ` : ""}创建
        </span>
      )}
      {updated && item.updatedAt && (
        <span>
          <i>{updated.avatar ? <img src={updated.avatar} alt="" /> : updated.fallback}</i>
          {updated.nickname} {showTime ? `· ${dayjs(item.updatedAt).format("YYYY-MM-DD HH:mm")} ` : ""}修改
        </span>
      )}
    </div>
  );
}

export default function CheckinSection() {
  const { user, canEdit } = useAuth();
  const showAdminTime = user.username?.toLowerCase() === "lxq";
  const [settings] = useLoveSettings();
  const [items, setItems] = useLocalStorage<CheckinItem[]>(STORAGE_KEYS.CHECKINS, mockCheckins, LEGACY_STORAGE_KEYS.CHECKINS);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CheckinPhotoSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [indexStatus, setIndexStatus] = useState<CheckinIndexStatus>({ running: false, total: 0, done: 0, failed: 0, message: "照片查找正在准备", modelReady: false });
  const { confirm, dialog } = useConfirm();
  const sortedItems = useMemo(() => [...items].sort((a, b) => {
    const newestOf = (item: CheckinItem) => dayjs(item.updatedAt ?? item.createdAt ?? item.date).valueOf();
    return newestOf(b) - newestOf(a);
  }), [items]);
  const previewIds = [...items.flatMap((item) => item.imageIds ?? []), ...(open ? draft.imageIds : [])].filter((id) => !isRemoteMedia(id));
  const imageUrls = useBlobObjectUrls("checkinImages", previewIds);
  const mediaUrlOf = (id: string) => isRemoteMedia(id) ? absoluteUrl(id) : imageUrls[id];
  const totalPhotos = sortedItems.reduce((sum, item) => sum + (item.imageIds?.length ?? 0), 0);
  const searchLightboxImages = searchResults.map((result) => absoluteUrl(result.imageUrl));

  const loadRemoteCheckins = () => {
    api.checkins.list()
      .then((remoteItems) => setItems(remoteItems))
      .catch(() => undefined);
  };

  useEffect(loadRemoteCheckins, [setItems]);

  useEffect(() => {
    let disposed = false;
    const loadStatus = () => {
      api.checkins.indexStatus()
        .then((status) => {
          if (!disposed) {
            setIndexStatus(status);
            if (!status.running && status.total > 0) loadRemoteCheckins();
          }
        })
        .catch(() => undefined);
    };
    loadStatus();
    const timer = window.setInterval(loadStatus, indexStatus.running ? 1000 : 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [indexStatus.running]);

  useEffect(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
  }, [user.username]);

  const addImages = async (files: FileList | File[]) => {
    if (indexStatus.running) return;
    for (const file of Array.from(files).filter((item) => item.type.startsWith("image/") || item.type.startsWith("video/"))) {
      const pendingId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setPendingUploads((current) => [...current, { id: pendingId, name: file.name, previewUrl, progress: 4, status: "preparing" }]);

      try {
        const blob = await prepareVisualMedia(file, 1400, 0.78);
        setPendingUploads((current) => current.map((item) => item.id === pendingId ? { ...item, progress: 12, status: "uploading" } : item));
        if (!canEdit || user.role === "guest") return;
        const preparedFile = new File([blob], file.name, { type: blob.type || file.type });
        const uploaded = await uploadWithProgress("checkins", preparedFile, (progress) => {
          setPendingUploads((current) => current.map((item) => item.id === pendingId ? { ...item, progress, status: "uploading" } : item));
        });
        setDraft((value) => ({ ...value, imageIds: [...value.imageIds, uploaded.url] }));
        setPendingUploads((current) => current.map((item) => item.id === pendingId ? { ...item, progress: 100, status: "done" } : item));
        window.setTimeout(() => {
          URL.revokeObjectURL(previewUrl);
          setPendingUploads((current) => current.filter((item) => item.id !== pendingId));
        }, 450);
      } catch {
        setPendingUploads((current) => current.map((item) => item.id === pendingId ? { ...item, progress: 100, status: "failed" } : item));
      }
    }
  };

  const onPaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) {
      event.preventDefault();
      await addImages(files);
    }
  };

  const removeDraftImage = async (id: string) => {
    const ok = await confirm({
      title: "确定删除这张照片吗？",
      description: "删除后，这张照片不会出现在这条打卡里。",
      confirmText: "确定删除",
      tone: "danger"
    });
    if (!ok) return;
    if (!isRemoteMedia(id)) await deleteBlob("checkinImages", id);
    setDraft((value) => ({ ...value, imageIds: value.imageIds.filter((imageId) => imageId !== id) }));
  };

  const save = async () => {
    if (!draft.title.trim() || user.role === "guest" || pendingUploads.some((item) => item.status === "uploading" || item.status === "preparing")) return;
    const writerRole = user.role;
    const now = dayjs().toISOString();
    const baseItem: CheckinItem = {
      id: editingId || crypto.randomUUID(),
      title: draft.title.trim(),
      location: draft.location,
      date: draft.date,
      emoji: emojiFromText(draft.text, draft.emoji || "📍"),
      text: draft.text,
      imageIds: draft.imageIds,
      createdAt: now,
      createdBy: writerRole
    };

    if (editingId) {
      const existing = items.find((item) => item.id === editingId);
      const nextItem: CheckinItem = {
        ...(existing ?? baseItem),
        ...baseItem,
        createdAt: existing?.createdAt ?? now,
        createdBy: existing?.createdBy ?? writerRole,
        updatedBy: writerRole,
        updatedAt: now
      };
      try {
        const saved = await api.checkins.update(editingId, nextItem);
        setItems((current) => current.map((item) => item.id === editingId ? saved : item));
      } catch { return; }
      setEditingId(null);
    } else {
      try {
        const saved = await api.checkins.create(baseItem);
        setItems((current) => [saved, ...current]);
      } catch { return; }
    }
    setDraft(emptyDraft);
    setOpen(false);
    window.setTimeout(loadRemoteCheckins, 1200);
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setPendingUploads([]);
    setOpen(true);
  };

  const openEdit = (item: CheckinItem) => {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      location: item.location,
      date: item.date,
      emoji: item.emoji,
      text: item.text,
      imageIds: item.imageIds ?? []
    });
    setPendingUploads([]);
    setOpen(true);
  };

  const removeCheckin = async (item: CheckinItem) => {
    const ok = await confirm({
      title: "确定要删除这条打卡回忆吗？",
      description: "删除后，文字和照片记录都会从服务器移除。",
      confirmText: "确定删除",
      tone: "danger"
    });
    if (!ok) return;
    await api.checkins.delete(item.id);
    await Promise.all((item.imageIds ?? []).filter((id) => !isRemoteMedia(id)).map((id) => deleteBlob("checkinImages", id)));
    setItems((current) => current.filter((target) => target.id !== item.id));
  };

  const runSearch = async (query = searchQuery) => {
    const nextQuery = query.trim();
    if (!nextQuery) return;
    setSearchQuery(nextQuery);
    setSearchLoading(true);
    setSearchError("");
    try {
      setSearchResults(await api.checkins.searchPhotos(nextQuery, 12));
    } catch {
      setSearchResults([]);
      setSearchError("照片查找助手还在准备，或当前还没有整理好的打卡照片。");
    } finally {
      setSearchLoading(false);
    }
  };

  const reindexPhotos = async () => {
    if (indexStatus.running) return;
    setSearchError("");
    try {
      await api.checkins.reindexPhotos();
      setIndexStatus((current) => ({ ...current, running: true, message: "正在重新整理照片" }));
    } catch {
      setSearchError("只有登录后的 WLY / LXQ 可以重新整理照片。");
    }
  };

  const progressPercent = indexStatus.total > 0 ? Math.round((indexStatus.done / indexStatus.total) * 100) : 0;

  return (
    <div className="section-inner">
      <div className="section-heading row-heading">
        <div>
          <p className="eyebrow">Check-ins</p>
          <h2>每一次出发，都值得被好好收进回忆里。</h2>
        </div>
        {canEdit && <button className="primary-button" type="button" onClick={openCreate} disabled={indexStatus.running}><Plus size={17} />新增打卡</button>}
      </div>

      <div className="love-card semantic-photo-search google-search-card">
        <div className="semantic-search-title">
          <Sparkles size={18} />
          <strong>照片回忆查找</strong>
          <span>已收录 {totalPhotos} 张打卡照片，搜索结果展示最像你描述的 12 张。</span>
        </div>
        <div className="semantic-search-row google-search-row">
          <Search size={19} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }}
            placeholder="输入想找的照片关键词，例如：笑容、夜景、裙子"
          />
          <button className="primary-button" type="button" onClick={() => void runSearch()} disabled={searchLoading}>{searchLoading ? "搜索中" : "搜索"}</button>
        </div>
        <div className="semantic-suggestions">
          {searchSuggestions.map((keyword) => (
            <button type="button" key={keyword} onClick={() => void runSearch(keyword)}>{keyword}</button>
          ))}
        </div>
        <div className="semantic-index-state">
          <span>{indexStatus.modelReady ? "照片查找已准备好" : "照片查找正在准备"}</span>
          <span>{indexStatus.message}</span>
        </div>
        {searchError && <p className="semantic-search-note">{searchError}</p>}
        {canEdit && (
          <details className="index-admin-panel">
            <summary>照片整理</summary>
            <div className="index-progress">
              <div><span style={{ width: `${progressPercent}%` }} /></div>
              <small>{indexStatus.running ? `正在整理 ${indexStatus.done}/${indexStatus.total}` : `已整理 ${indexStatus.done}/${indexStatus.total}，失败 ${indexStatus.failed}`}</small>
            </div>
            <button className="ghost-button" type="button" onClick={() => void reindexPhotos()} disabled={indexStatus.running}>
              <RefreshCw size={15} />{indexStatus.running ? "整理中" : "重新整理全部照片"}
            </button>
          </details>
        )}
        {searchResults.length > 0 && (
          <div className="semantic-result-grid">
            {searchResults.map((result, resultIndex) => {
              const src = absoluteUrl(result.imageUrl);
              return (
                <article key={result.imageId} className="semantic-result-card">
                  <button type="button" className="semantic-thumb" onClick={() => setLightbox({ images: searchLightboxImages, index: resultIndex })}>
                    <MediaPreview src={src} alt={result.title} />
                  </button>
                  <div>
                    <strong>{result.title}</strong>
                    <span>{result.location || "未填写地点"} · {result.date}</span>
                    <small>匹配度 {(result.score * 100).toFixed(1)}%</small>
                  </div>
                  <button className="ghost-button semantic-locate" type="button" onClick={() => document.getElementById(`checkin-${result.checkinId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                    <LocateFixed size={14} />定位
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {sortedItems.length === 0 ? (
        <div className="love-card empty-state">还没有打卡记录，下一次约会就从这里开始吧。</div>
      ) : (
        <div className="checkin-grid">
          {sortedItems.map((item) => {
            const urls = (item.imageIds ?? []).map((id) => mediaUrlOf(id)).filter(Boolean);
            const readyCount = (item.imageIds ?? []).filter((id) => item.imageStatuses?.[id] === "ready" || !isRemoteMedia(id)).length;
            return (
              <article id={`checkin-${item.id}`} className="love-card checkin-card" key={item.id}>
                <ImageStackCarousel images={urls} onOpen={(imageIndex) => setLightbox({ images: urls, index: imageIndex })} />
                <div className="checkin-content">
                  <div className="card-topline">
                    <span className="date-pill">{item.date}</span>
                    {canEdit && (
                      <div className="item-actions">
                        <button className="icon-button" type="button" onClick={() => openEdit(item)} aria-label="编辑打卡"><Edit3 size={16} /></button>
                        <button className="icon-button" type="button" onClick={() => void removeCheckin(item)} aria-label="删除打卡"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                  <h3>{item.title}</h3>
                  <p className="checkin-location"><MapPin size={15} />{item.location || "一个被喜欢的地方"}</p>
                  <p className="checkin-text">{item.text}</p>
                  <div className="checkin-photo-meta">
                    <span>{urls.length} 张照片</span>
                    <span>整理 {readyCount}/{urls.length}</span>
                  </div>
                  <AuthorMini item={item} settings={settings} showTime={showAdminTime} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={open} title={editingId ? "编辑打卡" : "新增打卡"} onClose={() => setOpen(false)}>
        <p className="local-tip">{indexStatus.running ? "照片正在重新整理中，暂时不能继续上传新照片。" : "照片会先显示上传进度，保存后在后台整理成可以查找的回忆。"}</p>
        <div className="form-grid">
          <label>日期<input type="date" value={draft.date} onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value }))} /></label>
          <label>标题<input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="第一次看山" /></label>
          <label>地点<input value={draft.location} onChange={(event) => setDraft((value) => ({ ...value, location: event.target.value }))} placeholder="城市 / 店名 / 公园" /></label>
          <label className="full">文字<EmojiTextArea value={draft.text} onPaste={onPaste} onChange={(textValue) => setDraft((value) => ({ ...value, text: textValue }))} rows={4} placeholder="写下这次出发，也可以插入表情或粘贴图片" /></label>
          <label className={indexStatus.running ? "upload-box full disabled" : "upload-box full"}><ImagePlus size={20} />选择照片或 Live 素材<input disabled={indexStatus.running} type="file" accept="image/*,video/*,.mov,.mp4,.m4v" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && addImages(event.target.files)} /></label>
          {(pendingUploads.length > 0 || draft.imageIds.length > 0) && (
            <div className="draft-image-list full upload-progress-list">
              {pendingUploads.map((upload) => (
                <div className="upload-progress-card" key={upload.id}>
                  <MediaPreview src={upload.previewUrl} alt={upload.name} />
                  <div className="upload-progress-mask">
                    <span>{upload.status === "failed" ? "上传失败" : `${upload.progress}%`}</span>
                    <i><b style={{ width: `${upload.progress}%` }} /></i>
                  </div>
                </div>
              ))}
              {draft.imageIds.map((id) => (
                <button key={id} type="button" onClick={() => void removeDraftImage(id)}>
                  <span>{mediaUrlOf(id) ? <MediaPreview src={mediaUrlOf(id)} alt="待上传照片" /> : "图片"}</span>
                  <small>{isRemoteMedia(id) ? statusText("pending") : "本地照片"}</small>
                  <Trash2 size={15} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="modal-actions"><button className="primary-button" type="button" onClick={() => void save()} disabled={pendingUploads.some((item) => item.status === "uploading" || item.status === "preparing")}>保存这一刻</button></div>
      </Modal>

      <ImageLightbox open={Boolean(lightbox)} images={lightbox?.images ?? []} index={lightbox?.index ?? 0} onIndexChange={(nextIndex) => setLightbox((value) => value ? { ...value, index: nextIndex } : value)} onClose={() => setLightbox(null)} />
      {dialog}
    </div>
  );
}
