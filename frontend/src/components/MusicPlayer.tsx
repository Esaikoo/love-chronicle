import { AnimatePresence, motion } from "framer-motion";
import { ListMusic, ListOrdered, Pause, Play, Repeat1, Shuffle, SkipBack, SkipForward, SlidersHorizontal, Star, Trash2, Upload, Volume2, VolumeX } from "lucide-react";
import { ChangeEvent, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { absoluteUrl, api, uploadMusicWithProgress } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { musicTracks as mockTracks } from "../data/mockMusic";
import type { AudioEnergy } from "../hooks/useAudioAnalyser";
import { useAudioAnalyser } from "../hooks/useAudioAnalyser";
import { useConfirm } from "../hooks/useConfirm";
import { useBlobObjectUrls } from "../hooks/useBlobObjectUrls";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { deleteBlob, getBlob } from "../storage/indexedDb";
import type { MusicTrackAsset, PlayMode } from "../types";
import { formatTime, readAudioDuration, readTrackMetadata } from "../utils/media";
import { STORAGE_KEYS } from "../utils/storageKeys";

type MusicPlayerProps = {
  onEnergy?: (energy: AudioEnergy) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  autoPlayToken?: number;
  visible?: boolean;
};

export type MusicPlayerHandle = {
  play: () => void;
  pause: () => void;
};

const modeConfig: Record<PlayMode, { label: string; icon: typeof ListOrdered }> = {
  sequence: { label: "顺序播放", icon: ListOrdered },
  shuffle: { label: "随机播放", icon: Shuffle },
  single: { label: "单曲循环", icon: Repeat1 }
};

function getNextIndex(current: number, length: number, mode: PlayMode, direction: 1 | -1 = 1) {
  if (length <= 1) return current;
  if (mode === "shuffle") {
    let next = current;
    while (next === current) next = Math.floor(Math.random() * length);
    return next;
  }
  return (current + direction + length) % length;
}

const MusicPlayer = forwardRef<MusicPlayerHandle, MusicPlayerProps>(function MusicPlayer(
  { onEnergy, onPlayingChange, autoPlayToken = 0, visible = true },
  ref
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const shouldPlayRef = useRef(false);
  const loadRequestRef = useRef(0);
  const objectUrlRef = useRef("");
  const loadedTrackIdRef = useRef("");
  const { canEdit } = useAuth();
  const [localTracks, setLocalTracks] = useLocalStorage<MusicTrackAsset[]>(STORAGE_KEYS.MUSIC_TRACKS, []);
  const [serverTracks, setServerTracks] = useState<MusicTrackAsset[]>([]);
  const tracks = useMemo(() => [...mockTracks, ...serverTracks, ...localTracks], [serverTracks, localTracks]);
  const localCoverUrls = useBlobObjectUrls("musicCovers", tracks.map((track) => track.coverId).filter(Boolean) as string[]);
  const [index, setIndex] = useState(0);
  const [src, setSrc] = useState("");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.78);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<PlayMode>("sequence");
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [mobileExtrasOpen, setMobileExtrasOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [preferredTrackId, setPreferredTrackId] = useState("");
  const [preferredApplied, setPreferredApplied] = useState(false);
  const [musicSettingsLoaded, setMusicSettingsLoaded] = useState(false);
  const [musicUpload, setMusicUpload] = useState<{ name: string; progress: number; active: boolean; error?: string } | null>(null);
  const { confirm, dialog } = useConfirm();
  const { start: startAnalyser, stop: stopAnalyser } = useAudioAnalyser(audioRef, onEnergy);
  const activeTrack = tracks[index];

  useEffect(() => {
    api.music.list()
      .then((items) => setServerTracks(items.map((item) => ({ ...item, src: absoluteUrl(item.src), coverSrc: absoluteUrl(item.coverSrc), source: "uploaded" }))))
      .catch(() => setServerTracks([]));
    api.settings.music.get()
      .then((settings) => setPreferredTrackId(settings.preferredTrackId || ""))
      .catch(() => undefined)
      .finally(() => setMusicSettingsLoaded(true));
  }, []);

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [onPlayingChange, playing]);

  useEffect(() => {
    if (!playlistOpen && !mobileExtrasOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!playerRef.current?.contains(event.target as Node)) {
        setPlaylistOpen(false);
        setMobileExtrasOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [mobileExtrasOpen, playlistOpen]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.currentSrc) return false;
    try {
      await audio.play();
      setPlaying(true);
      setHint("");
      void startAnalyser().catch(() => undefined);
      return true;
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") shouldPlayRef.current = false;
      stopAnalyser();
      setPlaying(false);
      setHint("点击播放音乐");
      return false;
    }
  }, [startAnalyser, stopAnalyser]);

  const prepareTrack = useCallback(async (track: MusicTrackAsset | undefined, autoplay: boolean) => {
    shouldPlayRef.current = autoplay;
    if (!track) {
      loadedTrackIdRef.current = "";
      setHint("添加一首音乐，让这里响起来。");
      return false;
    }
    const currentAudio = audioRef.current;
    if (loadedTrackIdRef.current === track.id && currentAudio?.currentSrc) {
      return autoplay ? await startPlayback() : true;
    }
    const request = ++loadRequestRef.current;
    let nextSrc = track.src ?? "";
    let nextObjectUrl = "";
    if (!nextSrc && track.fileId) {
      const blob = await getBlob("musicTracks", track.fileId);
      if (!blob || request !== loadRequestRef.current) return false;
      nextObjectUrl = URL.createObjectURL(blob);
      nextSrc = nextObjectUrl;
    }
    if (!nextSrc || request !== loadRequestRef.current) {
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
      setHint("这首歌暂时无法播放，请检查文件。");
      return false;
    }

    if (objectUrlRef.current && objectUrlRef.current !== nextSrc) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = nextObjectUrl;
    setSrc(nextSrc);
    setCurrentTime(0);
    setDuration(track.duration ?? 0);
    setHint("");
    const audio = audioRef.current;
    if (!audio) return false;
    loadedTrackIdRef.current = track.id;
    audio.src = nextSrc;
    audio.load();
    if (autoplay) return await startPlayback();
    return true;
  }, [startPlayback]);

  useEffect(() => {
    if (activeTrack?.id !== loadedTrackIdRef.current) {
      void prepareTrack(activeTrack, shouldPlayRef.current);
    }
  }, [activeTrack?.id, prepareTrack]);

  useEffect(() => {
    if (!musicSettingsLoaded || preferredApplied || tracks.length === 0) return;
    const preferredIndex = preferredTrackId ? tracks.findIndex((track) => track.id === preferredTrackId) : -1;
    const nextIndex = preferredIndex >= 0 ? preferredIndex : 0;
    setIndex(nextIndex);
    setPreferredApplied(true);
    if (visible) {
      shouldPlayRef.current = true;
      void prepareTrack(tracks[nextIndex], true);
    }
  }, [musicSettingsLoaded, preferredApplied, preferredTrackId, prepareTrack, tracks, visible]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const attemptPlay = useCallback(async () => {
    shouldPlayRef.current = true;
    const audio = audioRef.current;
    if (audio?.currentSrc) return await startPlayback();
    setHint(tracks.length === 0 ? "添加一首音乐，让这里响起来。" : "正在准备音乐…");
    return await prepareTrack(activeTrack, true);
  }, [activeTrack, prepareTrack, startPlayback, tracks.length]);

  useEffect(() => {
    if (autoPlayToken > 0) void attemptPlay();
  }, [attemptPlay, autoPlayToken]);

  useEffect(() => {
    if (visible && tracks.length > 0 && autoPlayToken === 0) {
      const timer = window.setTimeout(() => void attemptPlay(), 320);
      return () => window.clearTimeout(timer);
    }
  }, [attemptPlay, autoPlayToken, tracks.length, visible]);

  const pause = useCallback(() => {
    shouldPlayRef.current = false;
    audioRef.current?.pause();
    stopAnalyser();
    setPlaying(false);
  }, [stopAnalyser]);

  useImperativeHandle(ref, () => ({
    play() {
      void attemptPlay();
    },
    pause
  }), [attemptPlay, pause]);

  const selectTrack = (trackIndex: number) => {
    const track = tracks[trackIndex];
    if (!track) return;
    shouldPlayRef.current = true;
    if (trackIndex === index) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      void attemptPlay();
      setPlaylistOpen(false);
      return;
    }
    setIndex(trackIndex);
    setPlaylistOpen(false);
  };

  const moveTrack = (direction: 1 | -1) => {
    if (tracks.length === 0) return;
    selectTrack(getNextIndex(index, tracks.length, direction === 1 ? mode : "sequence", direction));
  };

  const handleEnded = () => {
    if (mode === "single") {
      if (audioRef.current) audioRef.current.currentTime = 0;
      void attemptPlay();
      return;
    }
    selectTrack(getNextIndex(index, tracks.length, mode, 1));
  };

  const addMusic = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => /audio|mpeg|mp4|ogg|wav/.test(file.type) || /\.(mp3|wav|ogg|m4a)$/i.test(file.name));
    event.target.value = "";
    if (files.length === 0) return;

    const nextTracks: MusicTrackAsset[] = [];
    for (const file of files) {
      try {
        const { artist, title, cover } = await readTrackMetadata(file);
        const trackDuration = await readAudioDuration(file);
        setMusicUpload({ name: file.name, progress: 4, active: true });
        const uploaded = await uploadMusicWithProgress(file, { title, artist, duration: trackDuration, cover }, (progress) => {
          setMusicUpload({ name: file.name, progress, active: progress < 100 });
        });
        nextTracks.push({ ...uploaded, src: absoluteUrl(uploaded.src), coverSrc: absoluteUrl(uploaded.coverSrc), source: "uploaded" });
      } catch {
        setMusicUpload({ name: file.name, progress: 100, active: false, error: "音乐上传失败，请稍后再试" });
      }
    }

    if (nextTracks.length > 0) setServerTracks((current) => [...current, ...nextTracks]);
    window.setTimeout(() => setMusicUpload(null), 800);
    shouldPlayRef.current = true;
    setIndex(tracks.length);
    setPlaylistOpen(true);
  };

  const setPreferredTrack = async (track: MusicTrackAsset) => {
    if (!canEdit) return;
    const saved = await api.settings.music.update({ preferredTrackId: track.id });
    setPreferredTrackId(saved.preferredTrackId || track.id);
  };

  const deleteTrack = async (track: MusicTrackAsset) => {
    const ok = await confirm({
      title: "确定要删除这首歌吗？",
      description: "删除后，音乐文件也会一起移除。",
      confirmText: "确定删除",
      tone: "danger"
    });
    if (!ok) return;
    if (serverTracks.some((item) => item.id === track.id)) {
      await api.music.delete(track.id);
      setServerTracks((current) => current.filter((item) => item.id !== track.id));
    } else {
      if (track.fileId) await deleteBlob("musicTracks", track.fileId);
      if (track.coverId) await deleteBlob("musicCovers", track.coverId);
      setLocalTracks((current) => current.filter((item) => item.id !== track.id));
    }
    if (preferredTrackId === track.id) {
      await api.settings.music.update({ preferredTrackId: "" }).catch(() => undefined);
      setPreferredTrackId("");
      setPreferredApplied(false);
    }
    setIndex(0);
  };

  const seek = (value: string) => {
    const next = Number(value);
    if (audioRef.current) audioRef.current.currentTime = next;
    setCurrentTime(next);
    shouldPlayRef.current = true;
    void attemptPlay();
  };

  const ModeIcon = modeConfig[mode].icon;

  return (
    <motion.div
      ref={playerRef}
      className={[playlistOpen ? "music-player expanded" : "music-player", visible ? "" : "concealed"].join(" ")}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 28 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.8 }}
      aria-hidden={!visible}
    >
      <div className="player-inner">
        <audio
          ref={audioRef}
          src={src}
          crossOrigin="anonymous"
          preload="auto"
          onCanPlay={() => {
            if (shouldPlayRef.current && !playing) void startPlayback();
          }}
          onPlaying={() => {
            setPlaying(true);
            setHint("");
          }}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onEnded={handleEnded}
          onError={() => {
            shouldPlayRef.current = false;
            setPlaying(false);
            setHint("这首歌暂时无法播放，请检查文件。");
          }}
        />

        <div className="player-main-row">
          <button className="cover-button-mini" type="button" onClick={playing ? pause : () => void attemptPlay()} aria-label={playing ? "暂停" : "播放"}>
            {(activeTrack?.coverSrc || (activeTrack?.coverId && localCoverUrls[activeTrack.coverId])) && <img src={activeTrack.coverSrc || localCoverUrls[activeTrack.coverId!]} alt="" />}
            {playing ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
          </button>
          <div className="player-track">
            <AnimatePresence mode="wait">
              <motion.div key={activeTrack?.id ?? "empty"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <strong>{activeTrack?.title ?? "等待一首温柔的歌"}</strong>
                <span>{hint || activeTrack?.artist || "点击添加音乐"}</span>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="player-controls">
            <button className="icon-button" type="button" onClick={() => moveTrack(-1)} disabled={tracks.length === 0} aria-label="上一首"><SkipBack size={18} /></button>
            <button className="icon-button" type="button" onClick={() => moveTrack(1)} disabled={tracks.length === 0} aria-label="下一首"><SkipForward size={18} /></button>
            <button className="icon-button desktop-mode" type="button" onClick={() => setMode((current) => (current === "sequence" ? "shuffle" : current === "shuffle" ? "single" : "sequence"))} title={modeConfig[mode].label} aria-label={modeConfig[mode].label}><ModeIcon size={17} /></button>
            <button className="icon-button" type="button" onClick={() => { setMobileExtrasOpen(false); setPlaylistOpen((current) => !current); }} aria-label="播放列表"><ListMusic size={18} /></button>
            <button className="icon-button mobile-extras-toggle" type="button" onClick={() => { setPlaylistOpen(false); setMobileExtrasOpen((current) => !current); }} aria-label="播放设置"><SlidersHorizontal size={17} /></button>
          </div>
        </div>

        <div className="player-progress">
          <span>{formatTime(currentTime)}</span>
          <input type="range" min={0} max={duration || 0} step={1} value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(event.target.value)} disabled={!src} aria-label="播放进度" />
          <span>{formatTime(duration)}</span>
        </div>

        <div className="player-volume">
          <button className="icon-button" type="button" onClick={() => setMuted((current) => !current)} aria-label={muted ? "取消静音" : "静音"}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="音量" />
          {canEdit && <button className="soft-action" type="button" onClick={() => fileInputRef.current?.click()}><Upload size={16} />添加音乐</button>}
          <input ref={fileInputRef} className="hidden-file-input" type="file" accept="audio/*,.m4a" multiple hidden onChange={addMusic} />
        </div>

        {musicUpload && (
          <div className={musicUpload.error ? "music-upload-progress failed" : "music-upload-progress"}>
            <span>{musicUpload.error || `正在上传 ${musicUpload.name}`}</span>
            <i><b style={{ width: `${musicUpload.progress}%` }} /></i>
            <small>{musicUpload.progress}%</small>
          </div>
        )}

        <AnimatePresence>
          {mobileExtrasOpen && (
            <motion.div className="mobile-player-extras" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.96 }}>
              <button className="mobile-mode-action" type="button" onClick={() => setMode((current) => (current === "sequence" ? "shuffle" : current === "shuffle" ? "single" : "sequence"))}>
                <ModeIcon size={17} />
                <span>{modeConfig[mode].label}</span>
              </button>
              <div className="mobile-volume-control">
                <button className="icon-button" type="button" onClick={() => setMuted((current) => !current)} aria-label={muted ? "取消静音" : "静音"}>
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="音量" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {playlistOpen && (
            <motion.div className="playlist-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              {canEdit && (
                <div className="playlist-toolbar">
                  <strong>播放列表</strong>
                  <button className="soft-action" type="button" onClick={() => fileInputRef.current?.click()}><Upload size={15} />添加音乐</button>
                </div>
              )}
              {tracks.map((track, trackIndex) => (
                <button className={trackIndex === index ? "playlist-item active" : "playlist-item"} type="button" key={track.id} onClick={() => selectTrack(trackIndex)}>
                  <span>{track.title}</span>
                  <small>{track.artist}</small>
                  {canEdit && (
                    <i className={preferredTrackId === track.id ? "preferred-track active" : "preferred-track"} role="button" tabIndex={0} title={preferredTrackId === track.id ? "首播歌曲" : "设为进入时首播"} aria-label={preferredTrackId === track.id ? "首播歌曲" : "设为进入时首播"} onClick={(event) => { event.stopPropagation(); void setPreferredTrack(track); }} onKeyDown={(event) => { if (event.key === "Enter") void setPreferredTrack(track); }}>
                      <Star size={15} fill={preferredTrackId === track.id ? "currentColor" : "none"} />
                    </i>
                  )}
                  {canEdit && track.source === "uploaded" && (
                    <i className="delete-track" role="button" tabIndex={0} aria-label="删除音乐" onClick={(event) => { event.stopPropagation(); void deleteTrack(track); }} onKeyDown={(event) => { if (event.key === "Enter") void deleteTrack(track); }}>
                      <Trash2 size={15} />
                    </i>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {dialog}
      </div>
    </motion.div>
  );
});

export default MusicPlayer;
