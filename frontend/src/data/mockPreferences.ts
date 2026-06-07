import dayjs from "dayjs";
import type { PreferenceItem } from "../types";

export const mockPreferences: PreferenceItem[] = [
  { id: "pref-her-1", owner: "her", category: "生活", content: "花", emoji: "🌸", createdAt: dayjs().toISOString() },
  { id: "pref-her-2", owner: "her", category: "食物", content: "草莓", emoji: "🍓", createdAt: dayjs().toISOString() },
  { id: "pref-her-3", owner: "her", category: "饮品", content: "奶茶", emoji: "🧋", createdAt: dayjs().toISOString() },
  { id: "pref-her-4", owner: "her", category: "颜色", content: "粉色", emoji: "🎀", createdAt: dayjs().toISOString() },
  { id: "pref-her-5", owner: "her", category: "可爱", content: "小猫", emoji: "🐱", createdAt: dayjs().toISOString() },
  { id: "pref-me-1", owner: "me", category: "娱乐", content: "游戏", emoji: "🎮", createdAt: dayjs().toISOString() },
  { id: "pref-me-2", owner: "me", category: "饮品", content: "咖啡", emoji: "☕", createdAt: dayjs().toISOString() },
  { id: "pref-me-3", owner: "me", category: "生活", content: "音乐", emoji: "🎧", createdAt: dayjs().toISOString() },
  { id: "pref-both-1", owner: "both", category: "食物", content: "火锅", emoji: "🍲", createdAt: dayjs().toISOString() },
  { id: "pref-both-2", owner: "both", category: "娱乐", content: "电影", emoji: "🎬", createdAt: dayjs().toISOString() },
  { id: "pref-both-3", owner: "both", category: "生活", content: "散步", emoji: "🌃", createdAt: dayjs().toISOString() },
  { id: "pref-both-4", owner: "both", category: "旅行", content: "旅行", emoji: "✈️", createdAt: dayjs().toISOString() }
];
