import { motion } from "framer-motion";
import { ImagePlus, RefreshCw, Settings2, Trash2, UploadCloud } from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { absoluteUrl, api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { heartPhotos as mockHeartPhotos } from "../data/mockPhotos";
import { useConfirm } from "../hooks/useConfirm";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useResponsive } from "../hooks/useResponsive";
import { deleteBlob, getBlob } from "../storage/indexedDb";
import type { HeartPhotoAsset } from "../types";
import { getHeartPoint } from "../utils/heartPath";
import { isMotionMedia, prepareVisualMedia } from "../utils/media";
import { STORAGE_KEYS } from "../utils/storageKeys";
import Modal from "./Modal";
import MediaPreview from "./MediaPreview";

type HeartPhotoWallProps = {
  photos?: HeartPhotoAsset[];
};

type DisplayPhoto = HeartPhotoAsset & {
  displaySrc?: string;
};

type PendingPhoto = {
  file: File;
  previewUrl: string;
  title: string;
  description: string;
};

const placeholderEmojis = ["💗", "💕", "🌸", "💖", "✨", "💞", "🌷", "♡"];

function hashText(text: string) {
  return Array.from(text).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}

function pickRandomPhotos<T extends { id: string }>(photos: T[], maxCount: number) {
  const seed = `${new Date().toDateString()}-${photos.length}`;
  return [...photos]
    .sort((a, b) => hashText(`${seed}-${a.id}`) - hashText(`${seed}-${b.id}`))
    .slice(0, maxCount);
}

function getClassicHeartPoints(count: number, scale: number) {
  return Array.from({ length: count }, (_, index) => {
    const t = (index / count) * Math.PI * 2;
    return getHeartPoint(t, scale);
  });
}

export default function HeartPhotoWall({ photos = mockHeartPhotos }: HeartPhotoWallProps) {
  const { width, isMobile, isTablet } = useResponsive();
  const { canEdit } = useAuth();
  const { confirm, dialog } = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPhotos, setLocalPhotos] = useLocalStorage<HeartPhotoAsset[]>(STORAGE_KEYS.HEART_PHOTOS, []);
  const [serverPhotos, setServerPhotos] = useState<HeartPhotoAsset[]>([]);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<DisplayPhoto | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [shuffleTick, setShuffleTick] = useState(0);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);

  const maxCount = isMobile ? 32 : isTablet ? 32 : 36;
  const photoSize = isMobile ? (width < 360 ? 42 : 48) : isTablet ? 72 : 86;
  const scale = isMobile ? Math.min(9.6, Math.max(8.1, (width - photoSize - 12) / 32)) : isTablet ? 13.0 : 15.6;
  const allPhotos = useMemo(() => [...photos, ...serverPhotos, ...localPhotos], [photos, serverPhotos, localPhotos]);

  useEffect(() => {
    api.photos.list()
      .then((items) => setServerPhotos(items.map((item) => ({ ...item, src: absoluteUrl(item.src), source: "uploaded" }))))
      .catch(() => setServerPhotos([]));
  }, []);

  useEffect(() => {
    let alive = true;
    const urls: Record<string, string> = {};
    Promise.all(localPhotos.map(async (photo) => {
      if (!photo.fileId) return;
      const blob = await getBlob("heartPhotos", photo.fileId);
      if (blob && alive) urls[photo.id] = `${URL.createObjectURL(blob)}${photo.mediaType === "video" ? "#motion" : ""}`;
    })).then(() => alive && setObjectUrls(urls));

    return () => {
      alive = false;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url.replace("#motion", "")));
    };
  }, [localPhotos]);

  const visiblePhotos = useMemo(() => {
    const chosen = allPhotos.length > 0 ? pickRandomPhotos(allPhotos, Math.min(maxCount, allPhotos.length)) : [];
    return chosen.map((photo) => ({
      ...photo,
      displaySrc: serverPhotos.some((item) => item.id === photo.id) ? photo.src : photo.fileId ? objectUrls[photo.id] : photo.src
    }));
  }, [allPhotos, maxCount, objectUrls, serverPhotos, shuffleTick]);

  const displayItems: DisplayPhoto[] = visiblePhotos.length > 0
    ? visiblePhotos
    : Array.from({ length: 30 }, (_, index) => ({
        id: `placeholder-${index}`,
        title: "待添加照片",
        description: "这里会放下下一段温柔回忆。",
        source: "mock",
        createdAt: new Date().toISOString()
      }));

  const points = useMemo(() => getClassicHeartPoints(displayItems.length, scale), [displayItems.length, scale]);

  const saveFiles = async () => {
    if (pendingPhotos.length === 0) return;
    const serverItems: HeartPhotoAsset[] = [];
    for (const pending of pendingPhotos) {
      const { file, title, description } = pending;
      const blob = await prepareVisualMedia(file, 1600, 0.78);
      const preparedFile = new File([blob], file.name, { type: blob.type || file.type });
      const uploaded = await api.photos.upload(preparedFile, title, description);
      serverItems.push({ ...uploaded, src: absoluteUrl(uploaded.src), source: "uploaded" });
    }
    if (serverItems.length) setServerPhotos((current) => [...serverItems, ...current]);
    pendingPhotos.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPendingPhotos([]);
    setShuffleTick((value) => value + 1);
  };

  const stageFiles = (files: FileList | File[]) => {
    const next = Array.from(files)
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .map((file) => ({
        file,
        previewUrl: `${URL.createObjectURL(file)}${isMotionMedia(file) ? "#motion" : ""}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        description: ""
      }));
    setPendingPhotos((current) => [...current, ...next]);
  };

  const closePending = () => {
    pendingPhotos.forEach((item) => URL.revokeObjectURL(item.previewUrl.replace("#motion", "")));
    setPendingPhotos([]);
  };

  const deletePhoto = async (photo: HeartPhotoAsset) => {
    const ok = await confirm({
      title: "确定要删除这张回忆照片吗？",
      description: "删除后，这张照片会从本地或服务器记录中移除。",
      confirmText: "确定删除",
      tone: "danger"
    });
    if (!ok) return;

    if (serverPhotos.some((item) => item.id === photo.id)) {
      await api.photos.delete(photo.id);
      setServerPhotos((current) => current.filter((item) => item.id !== photo.id));
      return;
    }
    if (photo.fileId) await deleteBlob("heartPhotos", photo.fileId);
    setLocalPhotos((current) => current.filter((item) => item.id !== photo.id));
  };

  const updatePhoto = async (photo: HeartPhotoAsset) => {
    if (serverPhotos.some((item) => item.id === photo.id)) {
      const updated = await api.photos.update(photo.id, { title: photo.title, description: photo.description });
      setServerPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, ...updated, src: absoluteUrl(updated.src), source: "uploaded" } : item));
      return;
    }
    setLocalPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, title: photo.title, description: photo.description } : item));
  };

  const editPhotoDraft = (photo: HeartPhotoAsset, field: "title" | "description", value: string) => {
    const update = (items: HeartPhotoAsset[]) => items.map((item) => item.id === photo.id ? { ...item, [field]: value } : item);
    if (serverPhotos.some((item) => item.id === photo.id)) setServerPhotos(update);
    else setLocalPhotos(update);
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (canEdit) stageFiles(event.dataTransfer.files);
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) stageFiles(event.target.files);
    event.target.value = "";
  };

  return (
    <>
      <div
        className={dragging ? "heart-stage dragging" : "heart-stage"}
        onDragOver={(event) => {
          event.preventDefault();
          if (canEdit) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {canEdit && (
          <div className="heart-tools">
            <button className="soft-action" type="button" onClick={() => inputRef.current?.click()}>
              <ImagePlus size={17} />
              添加照片
            </button>
            <button className="round-action" type="button" onClick={() => setShuffleTick((value) => value + 1)} aria-label="重新随机展示">
              <RefreshCw size={17} />
            </button>
            <button className="round-action" type="button" onClick={() => setManagerOpen(true)} aria-label="管理照片">
              <Settings2 size={17} />
            </button>
            <input ref={inputRef} type="file" accept="image/*,video/*,.mov,.mp4,.m4v" multiple hidden onChange={onFileChange} />
          </div>
        )}

        <motion.div className="heart-wall" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 24, mass: 0.9 }}>
          {displayItems.map((photo, index) => {
            const point = points[index] ?? { x: 0, y: 0 };
            const usePlaceholder = !photo.displaySrc || failedImages[photo.id];
            const rotation = ((hashText(photo.id) % 18) - 9) * 0.85;
            return (
              <motion.button
                className="heart-photo-card"
                key={`${photo.id}-${shuffleTick}`}
                type="button"
                style={{
                  width: photoSize,
                  height: photoSize,
                  left: `calc(50% + ${point.x}px)`,
                  top: `calc(50% + ${point.y}px)`,
                  rotate: `${rotation}deg`
                }}
                initial={{ opacity: 0, x: "-50%", y: "-50%", scale: 0.12 }}
                animate={{ opacity: 1, x: "-50%", y: "-50%", scale: 1 }}
                whileHover={{ scale: 1.2, rotate: 0, zIndex: 30 }}
                transition={{ delay: index * 0.022, type: "spring", stiffness: 260, damping: 28, mass: 0.8 }}
                onClick={() => setSelectedPhoto(photo)}
                title={photo.title ?? "回忆照片"}
              >
                {usePlaceholder ? (
                  <span className="photo-placeholder">{placeholderEmojis[index % placeholderEmojis.length]}</span>
                ) : (
                  <MediaPreview src={photo.displaySrc!} alt={photo.title ?? "回忆照片"} onError={() => setFailedImages((current) => ({ ...current, [photo.id]: true }))} />
                )}
                <span className="photo-caption">{photo.title ?? "回忆照片"}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {dragging && (
          <div className="drop-hint">
            <UploadCloud size={26} />
            松开后，把照片放进这颗爱心里
          </div>
        )}
      </div>

      <Modal open={Boolean(selectedPhoto)} title={selectedPhoto?.title ?? "回忆照片"} onClose={() => setSelectedPhoto(null)}>
        {selectedPhoto && (
          <div className="photo-preview">
            {selectedPhoto.displaySrc && !failedImages[selectedPhoto.id] ? <MediaPreview src={selectedPhoto.displaySrc} alt={selectedPhoto.title ?? "回忆照片"} expanded /> : <span className="large-placeholder">💗</span>}
            <p>{selectedPhoto.description ?? "这一刻，值得被温柔保存。"}</p>
          </div>
        )}
      </Modal>

      <Modal open={pendingPhotos.length > 0} title="添加照片" onClose={closePending}>
        <p className="local-tip">添加前先留下一点标题和内容，之后回看时会更有温度。</p>
        <div className="pending-photo-list">
          {pendingPhotos.map((item, index) => (
            <article className="pending-photo-item" key={item.previewUrl}>
              <MediaPreview src={item.previewUrl} alt="待添加照片" />
              <label>标题<input value={item.title} onChange={(event) => setPendingPhotos((current) => current.map((photo, photoIndex) => photoIndex === index ? { ...photo, title: event.target.value } : photo))} /></label>
              <label>内容<textarea rows={3} value={item.description} onChange={(event) => setPendingPhotos((current) => current.map((photo, photoIndex) => photoIndex === index ? { ...photo, description: event.target.value } : photo))} placeholder="那一天发生了什么？" /></label>
            </article>
          ))}
        </div>
        <div className="modal-actions"><button className="primary-button" type="button" onClick={() => void saveFiles()}>确认添加</button></div>
      </Modal>

      <Modal open={managerOpen} title="管理爱心照片" onClose={() => setManagerOpen(false)}>
        <div className="asset-grid">
          {[...serverPhotos, ...localPhotos].length === 0 && <p className="local-tip">还没有上传照片，可以先把本地照片拖进首页爱心区域。</p>}
          {[...serverPhotos, ...localPhotos].map((photo) => (
            <article className="asset-item" key={photo.id}>
              {photo.src || objectUrls[photo.id] ? <MediaPreview src={photo.src || objectUrls[photo.id]} alt={photo.title ?? "照片"} /> : <span>💗</span>}
              <input value={photo.title ?? ""} onChange={(event) => editPhotoDraft(photo, "title", event.target.value)} aria-label="照片标题" placeholder="照片标题" />
              <textarea value={photo.description ?? ""} onChange={(event) => editPhotoDraft(photo, "description", event.target.value)} aria-label="照片内容" placeholder="写下一点照片内容" rows={3} />
              <button className="ghost-button" type="button" onClick={() => void updatePhoto(photo)}>保存内容</button>
              <button className="ghost-button danger" type="button" onClick={() => deletePhoto(photo)}>
                <Trash2 size={15} />
                删除
              </button>
            </article>
          ))}
        </div>
      </Modal>
      {dialog}
    </>
  );
}
