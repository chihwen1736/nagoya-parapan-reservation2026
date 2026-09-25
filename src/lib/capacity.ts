import {
  FITNESS_BRANCH_CAPACITY,
  Reservation,
  ReservationDraft,
  SPORTS_SCIENCE_BRANCH_CAPACITY,
  THERAPY_BRANCH_CAPACITY,
  TherapyBranch,
} from "@/types";
import { minutesToTime, timeRangesOverlap, timeToMinutes } from "./time";

/** 取得某服務／分支的「同一時段總容量」，null 代表沒有上限（僅醫師治療） */
export function getBranchCapacity(draft: ReservationDraft | Reservation): number | null {
  if (draft.service === "therapy" && draft.therapy) {
    return THERAPY_BRANCH_CAPACITY[draft.therapy.therapy_branch];
  }
  if (draft.service === "fitness" && draft.fitness) {
    return FITNESS_BRANCH_CAPACITY[draft.fitness.fitness_branch];
  }
  if (draft.service === "sports_science" && draft.sportsScience) {
    return SPORTS_SCIENCE_BRANCH_CAPACITY[draft.sportsScience.sports_science_branch];
  }
  return null;
}

function sameBranch(a: ReservationDraft | Reservation, b: Reservation): boolean {
  if (a.service !== b.service) return false;
  if (a.service === "therapy") return a.therapy?.therapy_branch === b.therapy?.therapy_branch;
  if (a.service === "fitness") return a.fitness?.fitness_branch === b.fitness?.fitness_branch;
  if (a.service === "sports_science") return a.sportsScience?.sports_science_branch === b.sportsScience?.sports_science_branch;
  return false;
}

export interface CapacitySegment {
  start: string; // HH:mm，區段開始（含）
  end: string; // HH:mm，區段結束（不含）
  totalHeadcount: number;
  /** 造成這個區段超量的既有預約（不含正在新增/編輯的這一筆） */
  contributing: Reservation[];
}

export interface CapacityCheckResult {
  /** 這個服務/分支是否有容量限制檢查（僅防護治療/體能訓練/運科支援三種服務適用，醫師治療除外） */
  isCapacityLimited: boolean;
  capacity: number | null;
  /** 同一天、同分支、時間有交集的既有預約（排除自己，例如編輯時），用於畫面列出與提醒 */
  overlapping: Reservation[];
  /** 新預約時間範圍內，任一時刻的最高同時使用人數（以分段掃描計算，不是把所有重疊預約人數直接相加） */
  maxConcurrentHeadcount: number;
  /** 真正超過容量的時間區段清單，每個區段附上該區段當下的總人數與造成超量的既有預約 */
  violatingSegments: CapacitySegment[];
  exceeded: boolean;
}

const CAPACITY_LIMITED_SERVICES = new Set(["therapy", "fitness", "sports_science"]);

interface Interval {
  id: string; // "__new__" 代表正在新增/編輯的這一筆
  start: number;
  end: number;
  headcount: number;
  reservation?: Reservation;
}

/**
 * 以時間事件（分段掃描）方式計算「新預約時間範圍內」每一段時間的同時使用人數，
 * 找出真正超過容量的區段，而不是把所有「與新預約重疊」的既有預約人數整個加總。
 *
 * 規則：開始時間計入、結束時間不計入（區間為 [start, end)），
 * 因此 09:00-10:00 與 10:00-11:00 視為不重疊、不會互相影響同時人數。
 */
function sweepConcurrentHeadcount(
  intervals: Interval[],
  rangeStart: number,
  rangeEnd: number,
  capacity: number | null
): { maxConcurrentHeadcount: number; violatingSegments: CapacitySegment[]; overlappingIds: Set<string> } {
  const breakpoints = new Set<number>();
  breakpoints.add(rangeStart);
  breakpoints.add(rangeEnd);
  for (const iv of intervals) {
    if (iv.start > rangeStart && iv.start < rangeEnd) breakpoints.add(iv.start);
    if (iv.end > rangeStart && iv.end < rangeEnd) breakpoints.add(iv.end);
  }
  const sortedPoints = [...breakpoints].sort((a, b) => a - b);

  let maxConcurrentHeadcount = 0;
  const violatingSegments: CapacitySegment[] = [];
  const overlappingIds = new Set<string>();

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segStart = sortedPoints[i]!;
    const segEnd = sortedPoints[i + 1]!;
    if (segStart >= segEnd) continue;

    // 區間為 [start, end)：在 segStart 這個時刻仍在進行中的既有/新預約才算「使用中」
    const active = intervals.filter((iv) => iv.start <= segStart && iv.end > segStart);
    const total = active.reduce((sum, iv) => sum + iv.headcount, 0);
    if (total > maxConcurrentHeadcount) maxConcurrentHeadcount = total;

    const existingActive = active.filter((iv) => iv.id !== "__new__");
    existingActive.forEach((iv) => overlappingIds.add(iv.id));

    if (capacity !== null && total > capacity) {
      violatingSegments.push({
        start: minutesToTime(segStart),
        end: minutesToTime(segEnd),
        totalHeadcount: total,
        contributing: existingActive.map((iv) => iv.reservation!).filter(Boolean),
      });
    }
  }

  return { maxConcurrentHeadcount, violatingSegments, overlappingIds };
}

export function checkCapacity(
  draft: ReservationDraft,
  allReservations: Reservation[],
  excludeId?: string
): CapacityCheckResult {
  const isTherapyDoctor = draft.service === "therapy" && draft.therapy?.therapy_branch === ("doctor" as TherapyBranch);
  const isCapacityLimited = CAPACITY_LIMITED_SERVICES.has(draft.service) && !isTherapyDoctor;

  if (!CAPACITY_LIMITED_SERVICES.has(draft.service)) {
    return { isCapacityLimited: false, capacity: null, overlapping: [], maxConcurrentHeadcount: 0, violatingSegments: [], exceeded: false };
  }

  if (!draft.start_time || !draft.end_time) {
    return { isCapacityLimited, capacity: getBranchCapacity(draft), overlapping: [], maxConcurrentHeadcount: draft.headcount || 0, violatingSegments: [], exceeded: false };
  }

  const sameDayBranch = allReservations.filter((r) => {
    if (r.id === excludeId) return false;
    if (r.reservation_date !== draft.reservation_date) return false;
    if (!sameBranch(draft, r)) return false;
    return true;
  });

  const capacity = getBranchCapacity(draft);
  const newStart = timeToMinutes(draft.start_time);
  const newEnd = timeToMinutes(draft.end_time);

  // 醫師治療（isCapacityLimited === false 但 service === therapy）：不做容量阻擋，
  // 但仍要找出時間有重疊的既有預約供畫面提醒，這裡用單純的區間重疊判斷即可，不需要分段掃描。
  if (!isCapacityLimited) {
    const overlapping = sameDayBranch.filter((r) => timeRangesOverlap(draft.start_time, draft.end_time, r.start_time, r.end_time));
    return { isCapacityLimited: false, capacity, overlapping, maxConcurrentHeadcount: 0, violatingSegments: [], exceeded: false };
  }

  const intervals: Interval[] = [
    ...sameDayBranch.map((r) => ({ id: r.id, start: timeToMinutes(r.start_time), end: timeToMinutes(r.end_time), headcount: r.headcount, reservation: r })),
    { id: "__new__", start: newStart, end: newEnd, headcount: draft.headcount || 0 },
  ];

  const { maxConcurrentHeadcount, violatingSegments, overlappingIds } = sweepConcurrentHeadcount(intervals, newStart, newEnd, capacity);
  const overlapping = sameDayBranch.filter((r) => overlappingIds.has(r.id));
  const exceeded = violatingSegments.length > 0;

  return { isCapacityLimited, capacity, overlapping, maxConcurrentHeadcount, violatingSegments, exceeded };
}
