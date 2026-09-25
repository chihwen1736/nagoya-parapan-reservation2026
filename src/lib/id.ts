export function newInternalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // 後備方案（極舊瀏覽器），一般 Windows 版 Chrome/Edge 都支援 crypto.randomUUID
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** 依日期產生 RYYMMDD- 前綴，例如 2026-10-12 → "R261012-" */
export function reservationNoPrefix(dateStr: string): string {
  const yy = dateStr.slice(2, 4);
  const mm = dateStr.slice(5, 7);
  const dd = dateStr.slice(8, 10);
  return `R${yy}${mm}${dd}-`;
}

/**
 * 產生下一個預約單編號。
 * - 每個日期各自從 001 開始。
 * - 依「目前現有預約」與「歷史已使用過的最大流水號（即使該筆已被刪除）」兩者取最大值往下一號，
 *   確保刪除舊預約後不會重新使用已經使用過的編號。
 */
export function nextReservationNo(
  dateStr: string,
  existingReservationNos: string[],
  maxSeqUsed: Record<string, number>
): string {
  const prefix = reservationNoPrefix(dateStr);
  let maxSeq = maxSeqUsed[dateStr] ?? 0;
  for (const no of existingReservationNos) {
    if (!no.startsWith(prefix)) continue;
    const n = Number(no.slice(prefix.length));
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

/** 從預約單編號解析出日期與流水號，供更新 maxSeqUsed 使用 */
export function parseReservationNo(no: string): { dateStr: string; seq: number } | null {
  const m = /^R(\d{2})(\d{2})(\d{2})-(\d{3})$/.exec(no);
  if (!m) return null;
  const [, yy, mm, dd, seqStr] = m;
  return { dateStr: `20${yy}-${mm}-${dd}`, seq: Number(seqStr) };
}
