import { EVENT_END_DATE, EVENT_START_DATE } from "@/types";

export function isDateInEventRange(dateStr: string): boolean {
  return dateStr >= EVENT_START_DATE && dateStr <= EVENT_END_DATE;
}

export function timeToMinutes(t: string): number {
  const parts = t.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60).toString().padStart(2, "0");
  const m = Math.floor(wrapped % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** 嚴格重疊判斷：09:00-10:00 與 10:00-11:00 不算重疊（相鄰不算重疊）。 */
export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && bs < ae;
}

export function todayInEventRangeOrStart(today: string): string {
  return isDateInEventRange(today) ? today : EVENT_START_DATE;
}
