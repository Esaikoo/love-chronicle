import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { siteConfig } from "../data/siteConfig";

type CoverGateProps = {
  onEnter: () => void;
};

export default function CoverGate({ onEnter }: CoverGateProps) {
  const { login } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const finishEnter = () => {
    setLeaving(true);
    onEnter();
  };

  const submitLogin = async () => {
    const shortName = username.trim().toLowerCase();
    const role = shortName === "wly" ? "her" : "me";
    try {
      await login(role, shortName, password);
      finishEnter();
    } catch {
      setError("账号或密码不对，再温柔地试一次。");
    }
  };

  return (
    <motion.div className="cover-gate" initial={{ opacity: 1 }} animate={{ opacity: leaving ? 0 : 1, scale: leaving ? 1.12 : 1, filter: leaving ? "blur(10px)" : "blur(0px)" }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
      <div className="cover-aura" />
      <div className="cover-stars" aria-hidden="true" />
      {leaving && <div className="cover-enter-burst" aria-hidden="true" />}
      <motion.div className="cover-content" initial={{ opacity: 0, y: 24 }} animate={{ opacity: leaving ? 0 : 1, y: leaving ? -28 : 0, scale: leaving ? 1.08 : 1 }} transition={{ duration: 0.8, ease: "easeOut" }}>
        <p className="cover-kicker">For Her</p>
        <h1>{siteConfig.coverTitle}</h1>
        <p>{siteConfig.coverSubtitle}</p>

        {!loginOpen ? (
          <div className="cover-entry-grid single-entry">
            <motion.button className="cover-button" type="button" whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => setLoginOpen(true)}>
              打开这本纪念册
            </motion.button>
          </div>
        ) : (
          <div className="cover-login-card">
            <strong>打开这本纪念册</strong>
            <label>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="账号为姓名拼音首字母缩写，例如张三 zs" autoCapitalize="off" />
            </label>
            <label>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="密码为你身份证上的生日，例如0229" onKeyDown={(event) => event.key === "Enter" && submitLogin()} />
            </label>
            {error && <span>{error}</span>}
            <button className="cover-button" type="button" onClick={submitLogin}>
              <Heart fill="currentColor" size={18} />
              登录进入
            </button>
            <button className="guest-button" type="button" onClick={() => setLoginOpen(false)}>
              返回
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
