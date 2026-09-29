import React, { useState } from "react";
import { useData } from "@/context/DataContext";
import { buildDailyExportWorkbook, workbookToBlob } from "@/excel/exportWorkbook";
import { EVENT_END_DATE, EVENT_START_DATE } from "@/types";
import { todayInEventRangeOrStart } from "@/lib/time";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExportPage() {
  const { reservations } = useData();
  const [date, setDate] = useState(todayInEventRangeOrStart(new Date().toISOString().slice(0, 10)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const dayCount = reservations.filter((r) => r.reservation_date === date).length;

  async function handleExport() {
    setBusy(true);
    setMsg("");
    try {
      const wb = await buildDailyExportWorkbook(date, reservations);
      const blob = await workbookToBlob(wb);
      triggerBlobDownload(blob, `${date}_亞帕運中繼站預約及派車表.xlsx`);
      setMsg(`已匯出 ${date} 的預約及派車表（共 ${dayCount} 張預約單）。`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Excel 匯出</h2>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <p className="text-sm text-gray-600">
          選擇日期後，把當天全部預約單彙整在同一個 Excel 檔案（不會每筆預約各自產生一個檔案），內含「每日預約總表」「派車需求明細」「每日派車表」「餐食」「防護治療」「體能訓練」「運科支援」七張工作表，
          即使當天某項服務沒有預約，工作表仍會保留並顯示「本日無預約資料」（「每日派車表」是固定的時間×車輛表格，即使沒有接駁/送餐需求也會保留完整時間列）。
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm mb-1 text-gray-500">日期</label>
            <input
              type="date"
              value={date}
              min={EVENT_START_DATE}
              max={EVENT_END_DATE}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded-lg px-3 py-2"
            />
          </div>
          <button onClick={handleExport} disabled={busy} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            {busy ? "匯出中…" : "匯出當日預約"}
          </button>
          <span className="text-sm text-gray-500">當天目前共有 {dayCount} 筆預約</span>
        </div>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
      </section>
    </div>
  );
}
