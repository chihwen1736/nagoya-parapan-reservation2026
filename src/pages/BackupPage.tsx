import React, { useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { BackupFile, ParsedBackupSummary, buildBackupFile, parseBackupJson, summarizeBackup } from "@/lib/storage";

function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BackupPage() {
  const { exportSnapshot, replaceAll, mergeAll, clearAll, reservations } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [incoming, setIncoming] = useState<BackupFile | null>(null);
  const [incomingSummary, setIncomingSummary] = useState<ParsedBackupSummary | null>(null);
  const [parseError, setParseError] = useState("");
  const [resultMsg, setResultMsg] = useState("");
  const [clearConfirmText, setClearConfirmText] = useState("");

  function handleBackupNow() {
    const snapshot = exportSnapshot();
    const backup = buildBackupFile(snapshot);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(backup, `亞帕運中繼站預約系統備份_${stamp}.json`);
  }

  async function handleFile(file: File) {
    setParseError("");
    setResultMsg("");
    try {
      const text = await file.text();
      const backup = parseBackupJson(text);
      setIncoming(backup);
      setIncomingSummary(summarizeBackup(backup.reservations));
    } catch (e) {
      setIncoming(null);
      setIncomingSummary(null);
      setParseError(e instanceof Error ? e.message : "檔案讀取失敗");
    }
  }

  function resetImport() {
    setIncoming(null);
    setIncomingSummary(null);
    setParseError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function doMerge() {
    if (!incoming) return;
    const result = mergeAll(incoming);
    setResultMsg(`合併完成：新增 ${result.addedCount} 筆，因預約單編號重複而略過 ${result.skippedDuplicateCount} 筆。`);
    resetImport();
  }

  function doReplace() {
    if (!incoming) return;
    replaceAll(incoming);
    setResultMsg(`已用備份檔取代目前資料，共 ${incoming.reservations.length} 筆預約。`);
    resetImport();
  }

  function doClear() {
    if (clearConfirmText !== "確認清除") return;
    clearAll();
    setClearConfirmText("");
    setResultMsg("已清除本機所有資料。");
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">資料備份</h2>

      {resultMsg && <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">{resultMsg}</div>}

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold">備份全部資料</h3>
        <p className="text-sm text-gray-600">
          目前瀏覽器裡共有 {reservations.length} 筆預約資料。資料只存在這台電腦、這個瀏覽器裡，換一台電腦或清除瀏覽器資料就會遺失，
          請定期下載備份檔妥善保存。備份格式為 JSON，內含所有預約資料及編號流水號紀錄。
        </p>
        <button onClick={handleBackupNow} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm">
          下載備份（JSON）
        </button>
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold">從備份還原</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="text-sm"
        />
        {parseError && <p className="text-sm text-red-600">{parseError}</p>}
        {incoming && incomingSummary && (
          <div className="border rounded-lg p-3 bg-brand-50 space-y-3 text-sm">
            <p>
              這份備份檔共有 <b>{incomingSummary.count}</b> 筆預約，
              {incomingSummary.minDate && incomingSummary.maxDate ? (
                <>
                  日期範圍 <b>{incomingSummary.minDate}</b> ～ <b>{incomingSummary.maxDate}</b>。
                </>
              ) : (
                "沒有任何預約資料。"
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border rounded-lg p-3 bg-white">
                <p className="font-medium mb-1">合併匯入</p>
                <p className="text-xs text-gray-500 mb-3">保留目前資料，加入備份檔裡沒出現過的預約單編號；相同編號的預約不會重複匯入。</p>
                <button onClick={doMerge} className="bg-brand-600 text-white rounded-lg px-3 py-1.5 text-sm w-full">
                  開始合併
                </button>
              </div>
              <div className="border rounded-lg p-3 bg-white">
                <p className="font-medium mb-1">取代現有資料</p>
                <p className="text-xs text-gray-500 mb-3">完全用這份備份檔覆蓋目前瀏覽器裡的所有資料，請先確認目前資料已經備份。</p>
                <button onClick={doReplace} className="border border-red-400 text-red-600 rounded-lg px-3 py-1.5 text-sm w-full">
                  確定取代
                </button>
              </div>
            </div>
            <button onClick={resetImport} className="text-xs text-gray-500 underline">
              取消這次還原
            </button>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold text-red-600">清除本機資料</h3>
        <p className="text-sm text-gray-600">會清空目前瀏覽器裡的所有預約資料，且無法復原。請務必先下載備份。</p>
        <div className="flex items-center gap-3">
          <input
            value={clearConfirmText}
            onChange={(e) => setClearConfirmText(e.target.value)}
            placeholder="請輸入「確認清除」"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={doClear}
            disabled={clearConfirmText !== "確認清除"}
            className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            清除全部資料
          </button>
        </div>
      </section>
    </div>
  );
}
