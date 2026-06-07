import dayjs from "dayjs";
import { motion } from "framer-motion";
import { Stamp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { LetterItem } from "../types";

type EnvelopeCardProps = {
  letter: LetterItem;
  onOpen: () => void;
};

export default function EnvelopeCard({ letter, onOpen }: EnvelopeCardProps) {
  const { user } = useAuth();
  const showTime = user.username?.toLowerCase() === "lxq";
  const preview = letter.content.replace(/\s+/g, " ").trim().slice(0, 168);
  return (
    <motion.button
      className={`envelope-card envelope-${letter.envelopeStyle || "sakura"}`}
      type="button"
      onClick={onOpen}
      whileHover={{ y: -8, rotate: -0.6 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <span className="envelope-flap" />
      <span className="envelope-fold left" />
      <span className="envelope-fold right" />
      <span className="envelope-paper-peek">{preview || "这封信还没写下预览。"}</span>
      <span className="envelope-stamp"><Stamp size={17} />{letter.emoji || "💌"}</span>
      <span className="envelope-sticker">♡</span>
      <span className="envelope-address">
        <small>To</small>
        <strong>{letter.toUser || "她"}</strong>
      </span>
      <span className="envelope-meta">
        <b>{letter.title}</b>
        <i>{letter.fromUser || "我"}{showTime ? ` · ${dayjs(letter.createdAt).format("YYYY.MM.DD")}` : ""}</i>
      </span>
      {letter.isPublic && <span className="public-letter-pill">公开</span>}
    </motion.button>
  );
}
