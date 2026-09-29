import {
  FITNESS_BRANCH_CAPACITY,
  Reservation,
  ServiceEntry,
  SPORTS_SCIENCE_BRANCH_CAPACITY,
  THERAPY_BRANCH_CAPACITY,
  TherapyBranch,
} from "@/types";
import { minutesToTime, timeRangesOverlap, timeToMinutes } from "./time";

/** 取得某個服務時段的「同一時段總容量」，null 代表沒有上限（僅醫師治療） */
export function getBranchCapacity(entry: ServiceEntry): number | null {
  if (entry.service === "therapy" && entry.therapy) {
    return THERAPY_BRANCH_CAPACITY[entry.therapy.therapy_branch];
  }
  if (entry.service === "fitness" && entry.fitness) {
    return FITNESS_BRANCH_CAPACITY[entry.fitness.fitness_branch];
  }
  if (entry.service === "sports_science" && entry.sportsScience) {
    return SPORTS_SCIENCE_BRANCH_CAPACITY[entry.sportsScience.sports_science_branch];
  }
  return null;
}

function sameBranch(a: ServiceEntry, b: ServiceEntry): boolean {
  if (a.service !== b.service) return false;
  if (a.service === "therapy") return a.therapy?.therapy_branch === b.therapy?.therapy_branch;
  if (a.service === "fitness") return a.fitness?.fitness_branch === b.fitness?.fitness_branch;
  if (a.service === "sports_science") return a.sportsScience?.sports_science_branch === b.sportsScience?.sports_science_branch;
  return false;
}

/** 既有服務時段（附上所屬預約單資訊），用於容量檢查的重疊/超量清單顯示 */
export interface FlatServiceEntryRef {
  reservationId: string;
  reservationNo: string;
  entry: ServiceEntry;
}

export interface CapacitySegment {
  start: string; // HH:mm，區段開始（含）
  end: string; // HH:mm，區段結束（不含）
  totalHeadcount: number;
  /** 造成這個區段超量的既有服務時段（不含正在新增/編輯的這一筆） */
  contributing: FlatServiceEntryRef[];
}

export interface CapacityCheckResult {
  /** 這個服務/分支是否有容量限制檢查（僅防護治療/體能訓練/運科支援三種服務適用，醫師治療除外） */
  isCapacityLimited: boolean;
  capacity: number | null;
  /** 同一天、同分支、時間有交集的既有服務時段（排除自己，例如編輯時），用於畫面列出與提醒 */
  overlapping: FlatServiceEntryRef[];
  /** 新服務時段範圍內，任一時刻的最高同時使用人數（以分段掃描計算，不是把所有重疊時段人數直接相加） */
  maxConcurrentHeadcount: number;
  /** 真正超過容量的時間區段清單，每個區段附上該區段當下的總人數與造成超量的既有服務時段 */
  violatingSegments: CapacitySegment[];
  exceeded: boolean;
}

const CAPACITY_LIMITED_SERVICES = new Set(["therapy", "fitness", "sports_science"]);

interface Interval {
  id: string; // "__new__" 代表正在新增/編輯的這一筆
  start: number;
  end: number;
  headcount: number;
  ref?: FlatServiceEntryRef;
}

/** 把所有預約單攤平成「服務時段＋所屬預約單資訊」的清單，方便逐一比對容量 */
export function flattenServiceEntries(allReservations: Reservation[]): FlatServiceEntryRef[] {
  const flat: FlatServiceEntryRef[] = [];
  for (const r of allReservations) {
    for (const entry of r.services) {
      flat.push({ reservationId: r.id, reservationNo: r.reservation_no, entry });
    }
  }
  return flat;
}

/**
 * 以時間事件（分段掃描）方式計算「新服務時段範圍內」每一段時間的同時使用人數，
 * 找出真正超過容量的區段，而不是把所有「與新時段重疊」的既有服務時段人數整個加總。
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

    // 區間為 [start, end)：在 segStart 這個時刻仍在進行中的既有/新時段才算「使用中」
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
        contributing: existingActive.map((iv) => iv.ref!).filter(Boolean),
      });
    }
  }

  return { maxConcurrentHeadcount, violatingSegments, overlappingIds };
}

/**
 * 檢查「單一服務時段」的容量。因為一張預約單現在可以包含多個服務時段，
 * 容量檢查一律以「服務時段」為單位（而不是整張預約單），並用 entry_id 排除自己。
 *
 * @param entry 正在新增/編輯的服務時段
 * @param dateStr 這筆服務時段所屬的預約日期
 * @param allReservations 目前所有預約單（用來找出同一天、同分支的既有服務時段）
 * @param excludeEntryId 編輯時排除自己這一筆服務時段（同一張預約單裡的其他服務時段不受影響）
 */
export function checkCapacity(
  entry: ServiceEntry,
  dateStr: string,
  allReservations: Reservation[],
  excludeEntryId?: string
): CapacityCheckResult {
  const isTherapyDoctor = entry.service === "therapy" && entry.therapy?.therapy_branch === ("doctor" as TherapyBranch);
  const isCapacityLimited = CAPACITY_LIMITED_SERVICES.has(entry.service) && !isTherapyDoctor;

  if (!CAPACITY_LIMITED_SERVICES.has(entry.service)) {
    return { isCapacityLimited: false, capacity: null, overlapping: [], maxConcurrentHeadcount: 0, violatingSegments: [], exceeded: false };
  }

  if (!entry.start_time || !entry.end_time) {
    return {
      isCapacityLimited,
      capacity: getBranchCapacity(entry),
      overlapping: [],
      maxConcurrentHeadcount: entry.headcount || 0,
      violatingSegments: [],
      exceeded: false,
    };
  }

  const sameDayBranch = flattenServiceEntries(allReservations).filter((ref) => {
    if (ref.entry.entry_id === excludeEntryId) return false;
    const r = allReservations.find((rr) => rr.id === ref.reservationId)!;
    if (r.reservation_date !== dateStr) return false;
    if (!sameBranch(entry, ref.entry)) return false;
    return true;
  });

  const capacity = getBranchCapacity(entry);
  const newStart = timeToMinutes(entry.start_time);
  const newEnd = timeToMinutes(entry.end_time);

  // 醫師治療（isCapacityLimited === false 但 service === therapy）：不做容量阻擋，
  // 但仍要找出時間有重疊的既有服務時段供畫面提醒，這裡用單純的區間重疊判斷即可，不需要分段掃描。
  if (!isCapacityLimited) {
    const overlapping = sameDayBranch.filter((ref) => timeRangesOverlap(entry.start_time, entry.end_time, ref.entry.start_time, ref.entry.end_time));
    return { isCapacityLimited: false, capacity, overlapping, maxConcurrentHeadcount: 0, violatingSegments: [], exceeded: false };
  }

  const intervals: Interval[] = [
    ...sameDayBranch.map((ref) => ({
      id: ref.entry.entry_id,
      start: timeToMinutes(ref.entry.start_time),
      end: timeToMinutes(ref.entry.end_time),
      headcount: ref.entry.headcount,
      ref,
    })),
    { id: "__new__", start: newStart, end: newEnd, headcount: entry.headcount || 0 },
  ];

  const { maxConcurrentHeadcount, violatingSegments, overlappingIds } = sweepConcurrentHeadcount(intervals, newStart, newEnd, capacity);
  const overlapping = sameDayBranch.filter((ref) => overlappingIds.has(ref.entry.entry_id));
  const exceeded = violatingSegments.length > 0;

  return { isCapacityLimited, capacity, overlapping, maxConcurrentHeadcount, violatingSegments, exceeded };
}
