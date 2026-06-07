import jsmediatags from "jsmediatags/dist/jsmediatags.min.js";

export async function compressImageFile(file: File | Blob, maxWidth = 1600, quality = 0.78): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });

    const ratio = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function isMotionMedia(file: File | Blob | string) {
  if (typeof file === "string") return /(?:\.(?:mov|mp4|m4v|webm)|#motion)(?:$|[?#])/i.test(file);
  return file.type.startsWith("video/");
}

export async function prepareVisualMedia(file: File, maxWidth = 1600, quality = 0.78) {
  return isMotionMedia(file) ? file : await compressImageFile(file, maxWidth, quality);
}

export function parseTrackFileName(fileName: string) {
  const base = fileName.replace(/\.[^/.]+$/, "").trim();
  const parts = base.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim() || "Local",
      title: parts.slice(1).join(" - ").trim() || base
    };
  }
  return { artist: "Local", title: base || "未命名音乐" };
}

export async function readTrackMetadata(file: File) {
  const fallback = parseTrackFileName(file.name);
  return await new Promise<{ title: string; artist: string; cover?: Blob }>((resolve) => {
    new jsmediatags.Reader(file).read({
      onSuccess: ({ tags }) => {
        const picture = tags.picture;
        resolve({
          title: tags.title?.trim() || fallback.title,
          artist: tags.artist?.trim() || fallback.artist,
          cover: picture ? new Blob([new Uint8Array(picture.data)], { type: picture.format || "image/jpeg" }) : undefined
        });
      },
      onError: () => resolve(fallback)
    });
  });
}

export async function readAudioDuration(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const audio = new Audio(objectUrl);
    return await new Promise<number | undefined>((resolve) => {
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : undefined);
      audio.onerror = () => resolve(undefined);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const minute = Math.floor(seconds / 60);
  const second = Math.floor(seconds % 60);
  return `${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;
}
