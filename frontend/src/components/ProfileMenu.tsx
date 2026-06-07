import { AnimatePresence, motion } from "framer-motion";
import { Edit3, LogOut, Repeat2, Settings, Upload, UserRound } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLoveSettings } from "../hooks/useLoveSettings";
import { compressImageFile } from "../utils/media";
import Modal from "./Modal";

type ProfileMenuProps = {
  onSwitchAccount: () => void;
};

const effects = [
  { value: "mixed", label: "浪漫混合", description: "爱心、花瓣和星光轻轻飘落" },
  { value: "meteors", label: "流星雨", description: "柔和流星划过页面背景" },
  { value: "hearts", label: "漂浮爱心", description: "只保留轻盈的爱心粒子" },
  { value: "petals", label: "花瓣雨", description: "粉色花瓣缓慢落下" },
  { value: "starlight", label: "星光", description: "更安静克制的微光效果" },
  { value: "none", label: "关闭动画", description: "保持最简洁的背景" }
] as const;

async function fileToDataUrl(file: File) {
  const blob = await compressImageFile(file, 320, 0.82);
  return await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(blob);
  });
}

export default function ProfileMenu({ onSwitchAccount }: ProfileMenuProps) {
  const { user, logout, updateProfile } = useAuth();
  const [settings, setSettings] = useLoveSettings();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("");
  const role = user.role;
  const editable = role === "me" || role === "her";
  const fallbackName = role === "me" ? settings.nicknameMe : role === "her" ? settings.nicknameHer : "游客";
  const displayName = user.display_name || fallbackName;
  const avatarUrl = role === "me" ? settings.avatarMe : role === "her" ? settings.avatarHer : "";

  const switchAccount = () => {
    logout();
    setOpen(false);
    onSwitchAccount();
  };

  const openProfile = () => {
    setNickname(displayName);
    setAvatar(avatarUrl);
    setOpen(false);
    setProfileOpen(true);
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setAvatar(await fileToDataUrl(file));
  };

  const saveProfile = async () => {
    if (!editable) return;
    const nextName = nickname.trim() || (role === "me" ? "LXQ" : "WLY");
    setSettings((current) => ({
      ...current,
      [role === "me" ? "nicknameMe" : "nicknameHer"]: nextName,
      [role === "me" ? "avatarMe" : "avatarHer"]: avatar
    }));
    await updateProfile(nextName).catch(() => undefined);
    setProfileOpen(false);
  };

  return (
    <>
      <div className="profile-menu">
        <button className="profile-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-label="个人中心">
          {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
          <b>{displayName}</b>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div className="profile-popover" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}>
              <strong>{editable ? `${displayName}，欢迎回来` : "游客模式"}</strong>
              <small>{editable ? "这里可以调整你的资料和页面效果。" : "当前为只读浏览。"}</small>
              {editable && <button type="button" onClick={openProfile}><Edit3 size={16} />修改个人信息</button>}
              <button type="button" onClick={() => { setOpen(false); setSettingsOpen(true); }}><Settings size={16} />视觉设置</button>
              <button type="button" onClick={switchAccount}><Repeat2 size={16} />切换账号</button>
              <button className="danger" type="button" onClick={switchAccount}><LogOut size={16} />退出并返回封面</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal open={profileOpen} title="修改个人信息" onClose={() => setProfileOpen(false)}>
        <div className="profile-editor">
          <div className="profile-avatar-preview">{avatar ? <img src={avatar} alt="头像预览" /> : <UserRound size={34} />}</div>
          <label className="upload-box"><Upload size={18} />选择头像<input type="file" accept="image/*" onChange={uploadAvatar} /></label>
        </div>
        <div className="form-grid"><label className="full">昵称<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="给自己一个温柔的称呼" /></label></div>
        <div className="modal-actions"><button className="primary-button" type="button" onClick={() => void saveProfile()}>保存资料</button></div>
      </Modal>

      <Modal open={settingsOpen} title="视觉设置" onClose={() => setSettingsOpen(false)}>
        <div className="effect-options">
          {effects.map((effect) => (
            <button className={settings.visualEffect === effect.value ? "active" : ""} type="button" key={effect.value} onClick={() => setSettings((current) => ({ ...current, visualEffect: effect.value }))}>
              <b>{effect.label}</b>
              <small>{effect.description}</small>
            </button>
          ))}
        </div>
      </Modal>

    </>
  );
}
