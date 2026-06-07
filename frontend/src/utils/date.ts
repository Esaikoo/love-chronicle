import dayjs from "dayjs";

export function formatDate(date: string | Date) {
  return dayjs(date).format("YYYY-MM-DD");
}

export function daysBetweenInclusive(from: string, to = dayjs()) {
  // +1 表示把相识当天也算作第 1 天。
  return to.diff(dayjs(from), "day") + 1;
}

export function daysUntil(date: string) {
  return dayjs(date).startOf("day").diff(dayjs().startOf("day"), "day");
}

export function nextAnniversaryDays(startDate: string) {
  const today = dayjs().startOf("day");
  const start = dayjs(startDate);
  let next = start.year(today.year()).startOf("day");
  if (next.isBefore(today)) {
    next = next.add(1, "year");
  }
  return next.diff(today, "day");
}

export function isSpecialLoveDay(days: number, date: string) {
  const specialNumbers = [100, 365, 520, 999, 1000];
  const today = dayjs();
  const anniversary = dayjs(date);
  return specialNumbers.includes(days) || (today.month() === anniversary.month() && today.date() === anniversary.date());
}
