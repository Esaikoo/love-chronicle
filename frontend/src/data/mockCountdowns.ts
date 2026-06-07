import dayjs from "dayjs";
import type { CountdownItem } from "../types";

export const mockCountdowns: CountdownItem[] = [
  {
    id: "countdown-1",
    title: "下一次旅行",
    targetDate: dayjs().add(60, "day").format("YYYY-MM-DD"),
    description: "去一个有风、有花、也有晚霞的地方。",
    emoji: "✈️",
    status: "pending",
    createdAt: dayjs().toISOString()
  }
];
