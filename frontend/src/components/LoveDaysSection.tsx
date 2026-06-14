import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarHeart, HeartHandshake, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { mockCountdowns } from "../data/mockCountdowns";
import { romanticQuotes } from "../data/romanticQuotes";
import { siteConfig } from "../data/siteConfig";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useLoveSettings } from "../hooks/useLoveSettings";
import type { CountdownItem } from "../types";
import { daysBetweenInclusive, daysUntil, isSpecialLoveDay } from "../utils/date";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "../utils/storageKeys";
import Modal from "./Modal";

type EditableDate = "firstMeetDate" | "loveStartDate";

export default function LoveDaysSection() {
  const today = dayjs();
  const { canEdit } = useAuth();
  const [countdowns, setCountdowns] = useLocalStorage<CountdownItem[]>(STORAGE_KEYS.COUNTDOWNS, mockCountdowns, LEGACY_STORAGE_KEYS.COUNTDOWNS);
  const [settings, setSettings] = useLoveSettings();
  const [editingDate, setEditingDate] = useState<EditableDate | null>(null);
  const [dateDraft, setDateDraft] = useState("");
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState("");
  const [quoteIndex, setQuoteIndex] = useState(0);
  const firstMeetDate = settings.firstMeetDate ?? siteConfig.firstMeetDate;
  const loveStartDate = settings.loveStartDate ?? siteConfig.loveStartDate;
  const daysKnown = firstMeetDate ? daysBetweenInclusive(firstMeetDate, today) : undefined;
  const daysLoved = loveStartDate ? daysBetweenInclusive(loveStartDate, today) : undefined;
  const nearestCountdown = countdowns
    .filter((item) => item.status !== "completed" && !dayjs(item.targetDate).startOf("day").isBefore(today.startOf("day")))
    .sort((a, b) => dayjs(a.targetDate).valueOf() - dayjs(b.targetDate).valueOf())[0];
  const nearestDays = nearestCountdown ? daysUntil(nearestCountdown.targetDate) : undefined;
  const special = daysLoved !== undefined && isSpecialLoveDay(daysLoved, loveStartDate);
  const quote = special && quoteIndex === 0
    ? "今天是很特别的一天。谢谢你把普通日子变成闪闪发亮的纪念。"
    : romanticQuotes[quoteIndex % romanticQuotes.length];

  useEffect(() => {
    const timer = window.setInterval(() => setQuoteIndex((current) => (current + 1) % romanticQuotes.length), 6200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api.countdowns.list()
      .then((remoteItems) => setCountdowns(remoteItems))
      .catch(() => undefined);
  }, [setCountdowns]);

  const openDateEditor = (key: EditableDate) => {
    if (!canEdit) return;
    setDateDraft(key === "firstMeetDate" ? firstMeetDate : loveStartDate);
    setEditingDate(key);
  };

  const saveDate = async () => {
    if (!editingDate) return;
    setDateSaving(true);
    setDateError("");
    const nextSettings = {
      ...settings,
      firstMeetDate,
      loveStartDate,
      [editingDate]: dateDraft
    };
    try {
      const saved = await api.settings.love.update(nextSettings);
      setSettings(saved);
      setEditingDate(null);
    } catch {
      setDateError("日期暂时没有保存到服务器，请确认已登录后再试。");
    } finally {
      setDateSaving(false);
    }
  };

  const stats = [
    { key: "firstMeetDate" as const, label: "已相识", date: firstMeetDate, value: daysKnown, suffix: "天", emptyText: "-1", icon: CalendarHeart, editable: true },
    { key: "loveStartDate" as const, label: "已在一起", date: loveStartDate, value: daysLoved, suffix: "天", emptyText: "-1", icon: HeartHandshake, editable: true },
    { key: "nearestCountdown" as const, label: "最近约定", date: nearestCountdown?.targetDate ?? "", value: nearestDays, suffix: nearestDays === undefined || nearestDays === 0 ? "" : "天", emptyText: "暂无", icon: Sparkles, editable: false }
  ];

  return (
    <motion.div className="section-inner" initial={{ opacity: 0, y: 34 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}>
      <div className="section-heading">
        <p className="eyebrow">Love Days</p>
        <h2>从相遇的那一天开始，每一天都值得被记录。</h2>
        <span>{today.format("YYYY年MM月DD日")}</span>
      </div>

      <div className="days-grid">
        {stats.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon size={26} />
              <span>{item.label}{canEdit && item.editable ? <small className="stat-edit-hint">点击设置日期</small> : null}</span>
              <strong>
                {item.value === undefined ? item.emptyText : item.value === 0 ? "就是今天" : item.value}
                {item.value !== undefined && item.value !== 0 && <small>{item.suffix}</small>}
              </strong>
              {item.editable && <em>{item.date || "未设置日期"}</em>}
            </>
          );
          return item.editable && canEdit ? (
            <motion.button className="love-card stat-card configurable" key={item.key} type="button" whileHover={{ y: -6 }} onClick={() => openDateEditor(item.key as EditableDate)}>
              {content}
            </motion.button>
          ) : (
            <motion.article className="love-card stat-card" key={item.key} whileHover={{ y: -6 }}>
              {content}
            </motion.article>
          );
        })}
      </div>

      <div className={special ? "special-note glowing" : "special-note"}>
        <AnimatePresence mode="wait">
          <motion.span key={quote} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>
            {quote}
          </motion.span>
        </AnimatePresence>
      </div>

      <Modal open={Boolean(editingDate)} title={editingDate === "loveStartDate" ? "设置在一起的日期" : "设置相识日期"} onClose={() => setEditingDate(null)}>
        <p className="local-tip">暂时想不起来也没关系。留空后会显示 -1，表示日期还没有设定。</p>
        {dateError && <p className="form-error">{dateError}</p>}
        <div className="form-grid">
          <label className="full">{editingDate === "loveStartDate" ? "正式在一起的日期" : "第一次相遇的日期"}<input type="date" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} /></label>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={() => setDateDraft("")}><Trash2 size={16} />暂时设为 -1</button>
          <button className="primary-button" type="button" onClick={saveDate} disabled={dateSaving}>{dateSaving ? "正在保存" : "保存日期"}</button>
        </div>
      </Modal>
    </motion.div>
  );
}
