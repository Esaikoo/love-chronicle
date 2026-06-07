import { useEffect, useState } from "react";
import { isMotionMedia } from "../utils/media";

type MediaPreviewProps = {
  src: string;
  alt: string;
  className?: string;
  expanded?: boolean;
  onError?: () => void;
};

export default function MediaPreview({ src, alt, className, expanded = false, onError }: MediaPreviewProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const handleError = () => {
    setFailed(true);
    onError?.();
  };

  if (!src || failed) {
    return <span className={["media-fallback", className].filter(Boolean).join(" ")}>{alt || "照片暂时无法显示"}</span>;
  }

  if (isMotionMedia(src)) {
    return <video className={className} src={src} aria-label={alt} autoPlay muted={!expanded} loop playsInline controls={expanded} onError={handleError} />;
  }
  return <img className={className} src={src} alt={alt} onError={handleError} />;
}
