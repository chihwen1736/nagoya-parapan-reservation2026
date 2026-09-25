import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Reservation, ReservationDraft } from "@/types";
import { newInternalId, nextReservationNo, parseReservationNo } from "@/lib/id";
import {
  BackupFile,
  StoredData,
  clearData,
  deriveMaxSeqUsed,
  emptyStoredData,
  loadData,
  mergeBackup,
  MergeResult,
  replaceWithBackup,
  saveData,
} from "@/lib/storage";

interface DataContextValue {
  reservations: Reservation[];
  ready: boolean;
  saveError: string;
  /** 供「複製」功能使用：把要複製的草稿暫存起來，導到新增頁後讀取一次即清除 */
  draftReservation: ReservationDraft | null;
  setDraftReservation: (draft: ReservationDraft | null) => void;
  addReservation: (draft: ReservationDraft) => Reservation;
  updateReservation: (id: string, draft: ReservationDraft) => Reservation | null;
  deleteReservation: (id: string) => void;
  getReservation: (id: string) => Reservation | undefined;
  previewNextReservationNo: (dateStr: string) => string;
  replaceAll: (incoming: BackupFile) => void;
  mergeAll: (incoming: BackupFile) => MergeResult;
  clearAll: () => void;
  exportSnapshot: () => StoredData;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoredData>(emptyStoredData());
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [draftReservation, setDraftReservation] = useState<ReservationDraft | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    setStore(loadData());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      saveData(store);
      setSaveError("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "儲存失敗");
    }
  }, [store, ready]);

  const previewNextReservationNo = useCallback(
    (dateStr: string) => {
      const existingNos = store.reservations.filter((r) => r.reservation_date === dateStr).map((r) => r.reservation_no);
      return nextReservationNo(dateStr, existingNos, store.maxSeqUsed);
    },
    [store]
  );

  const addReservation = useCallback((draft: ReservationDraft): Reservation => {
    let created: Reservation;
    setStore((prev) => {
      const existingNos = prev.reservations.filter((r) => r.reservation_date === draft.reservation_date).map((r) => r.reservation_no);
      const reservation_no = nextReservationNo(draft.reservation_date, existingNos, prev.maxSeqUsed);
      const now = new Date().toISOString();
      created = { ...draft, id: newInternalId(), reservation_no, created_at: now, updated_at: now };
      const parsed = parseReservationNo(reservation_no)!;
      return {
        ...prev,
        reservations: [...prev.reservations, created],
        maxSeqUsed: { ...prev.maxSeqUsed, [parsed.dateStr]: Math.max(prev.maxSeqUsed[parsed.dateStr] ?? 0, parsed.seq) },
      };
    });
    return created!;
  }, []);

  const updateReservation = useCallback(
    (id: string, draft: ReservationDraft): Reservation | null => {
      let updated: Reservation | null = null;
      setStore((prev) => {
        const idx = prev.reservations.findIndex((r) => r.id === id);
        if (idx === -1) return prev;
        const existing = prev.reservations[idx]!;
        updated = { ...draft, id: existing.id, reservation_no: existing.reservation_no, created_at: existing.created_at, updated_at: new Date().toISOString() };
        const next = [...prev.reservations];
        next[idx] = updated;
        return { ...prev, reservations: next };
      });
      return updated;
    },
    []
  );

  const deleteReservation = useCallback((id: string) => {
    // 注意：刪除只移除這筆預約，不會動到 maxSeqUsed，確保這個編號往後不會被重新產生。
    setStore((prev) => ({ ...prev, reservations: prev.reservations.filter((r) => r.id !== id) }));
  }, []);

  const getReservation = useCallback((id: string) => store.reservations.find((r) => r.id === id), [store.reservations]);

  const replaceAll = useCallback((incoming: BackupFile) => {
    setStore(replaceWithBackup(incoming));
  }, []);

  const mergeAll = useCallback(
    (incoming: BackupFile): MergeResult => {
      const result = mergeBackup(store, incoming);
      setStore({ version: 1, reservations: result.merged, maxSeqUsed: result.maxSeqUsed });
      return result;
    },
    [store]
  );

  const clearAll = useCallback(() => {
    skipNextSave.current = true;
    setStore(emptyStoredData());
    clearData();
  }, []);

  const exportSnapshot = useCallback((): StoredData => store, [store]);

  const value: DataContextValue = {
    reservations: store.reservations,
    ready,
    saveError,
    draftReservation,
    setDraftReservation,
    addReservation,
    updateReservation,
    deleteReservation,
    getReservation,
    previewNextReservationNo,
    replaceAll,
    mergeAll,
    clearAll,
    exportSnapshot,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData 必須在 DataProvider 裡面使用");
  return ctx;
}

// deriveMaxSeqUsed 目前僅供 storage.ts 內部與備份還原使用，這裡重新匯出方便其他模組沿用同一份邏輯
export { deriveMaxSeqUsed };
