import { Reservation, normalizeReservation } from "@/types";
import { parseReservationNo } from "./id";

const STORAGE_KEY = "nagoya-parapan-reservation2026:data:v1";
const STORAGE_FORMAT_VERSION = 1;

export interface StoredData {
  version: number;
  reservations: Reservation[];
  /** 每個日期歷史上已經使用過的最大流水號，只會增加不會減少，確保刪除後不重複使用編號 */
  maxSeqUsed: Record<string, number>;
}

export function emptyStoredData(): StoredData {
  return { version: STORAGE_FORMAT_VERSION, reservations: [], maxSeqUsed: {} };
}

export function loadData(): StoredData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStoredData();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.reservations)) return emptyStoredData();
    return {
      version: STORAGE_FORMAT_VERSION,
      // 讀取時一律正規化，讓舊版（單一服務）資料自動轉換成新版的多服務資料結構
      reservations: (parsed.reservations as unknown[]).map(normalizeReservation),
      maxSeqUsed: parsed.maxSeqUsed && typeof parsed.maxSeqUsed === "object" ? parsed.maxSeqUsed : {},
    };
  } catch {
    // localStorage 損毀或無法解析時，不要讓整個系統掛掉，回傳空資料讓使用者知道要重新匯入備份
    return emptyStoredData();
  }
}

export function saveData(data: StoredData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // 常見原因：瀏覽器儲存空間已滿，或無痕模式限制。這裡不吃掉錯誤，讓呼叫端可以提醒使用者。
    throw new Error("無法寫入瀏覽器儲存空間（localStorage），請確認瀏覽器儲存空間未滿，或未使用無痕模式。");
  }
}

export function clearData(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** 依現有資料重新計算 maxSeqUsed 的下限（用於還原備份、確保還原後不會產生重複編號） */
export function deriveMaxSeqUsed(reservations: Reservation[], base: Record<string, number> = {}): Record<string, number> {
  const result: Record<string, number> = { ...base };
  for (const r of reservations) {
    const parsed = parseReservationNo(r.reservation_no);
    if (!parsed) continue;
    const current = result[parsed.dateStr] ?? 0;
    if (current < parsed.seq) {
      result[parsed.dateStr] = parsed.seq;
    }
  }
  return result;
}

// ---------- JSON 備份格式 ----------

export interface BackupFile {
  app: "nagoya-parapan-reservation2026";
  formatVersion: number;
  exportedAt: string;
  reservations: Reservation[];
  maxSeqUsed: Record<string, number>;
}

export function buildBackupFile(data: StoredData): BackupFile {
  return {
    app: "nagoya-parapan-reservation2026",
    formatVersion: STORAGE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    reservations: data.reservations,
    maxSeqUsed: data.maxSeqUsed,
  };
}

export interface ParsedBackupSummary {
  count: number;
  minDate: string | null;
  maxDate: string | null;
}

export function summarizeBackup(reservations: Reservation[]): ParsedBackupSummary {
  if (reservations.length === 0) return { count: 0, minDate: null, maxDate: null };
  let minDate = reservations[0]!.reservation_date;
  let maxDate = reservations[0]!.reservation_date;
  for (const r of reservations) {
    if (r.reservation_date < minDate) minDate = r.reservation_date;
    if (r.reservation_date > maxDate) maxDate = r.reservation_date;
  }
  return { count: reservations.length, minDate, maxDate };
}

export function parseBackupJson(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("這不是有效的 JSON 檔案，請確認選擇的是本系統匯出的備份檔。");
  }
  const obj = parsed as Partial<BackupFile>;
  if (!obj || obj.app !== "nagoya-parapan-reservation2026" || !Array.isArray(obj.reservations)) {
    throw new Error("這份 JSON 檔案的格式不是本系統的備份檔，請確認檔案來源。");
  }
  return {
    app: "nagoya-parapan-reservation2026",
    formatVersion: obj.formatVersion ?? STORAGE_FORMAT_VERSION,
    exportedAt: obj.exportedAt ?? "",
    // 匯入的備份檔也可能是舊版（單一服務）格式，一律正規化成目前的多服務資料結構
    reservations: (obj.reservations as unknown[]).map(normalizeReservation),
    maxSeqUsed: obj.maxSeqUsed && typeof obj.maxSeqUsed === "object" ? obj.maxSeqUsed : {},
  };
}

export interface MergeResult {
  merged: Reservation[];
  maxSeqUsed: Record<string, number>;
  addedCount: number;
  skippedDuplicateCount: number;
}

/** 合併匯入：相同預約單編號不得重複匯入，重複的直接略過並回報略過筆數 */
export function mergeBackup(current: StoredData, incoming: BackupFile): MergeResult {
  const existingNos = new Set(current.reservations.map((r) => r.reservation_no));
  const merged = [...current.reservations];
  let addedCount = 0;
  let skippedDuplicateCount = 0;
  for (const r of incoming.reservations) {
    if (existingNos.has(r.reservation_no)) {
      skippedDuplicateCount += 1;
      continue;
    }
    existingNos.add(r.reservation_no);
    merged.push(r);
    addedCount += 1;
  }
  const maxSeqUsed = deriveMaxSeqUsed(merged, deriveMaxSeqUsed(incoming.reservations, current.maxSeqUsed));
  return { merged, maxSeqUsed, addedCount, skippedDuplicateCount };
}

export function replaceWithBackup(incoming: BackupFile): StoredData {
  return {
    version: STORAGE_FORMAT_VERSION,
    reservations: incoming.reservations,
    maxSeqUsed: deriveMaxSeqUsed(incoming.reservations, incoming.maxSeqUsed),
  };
}
