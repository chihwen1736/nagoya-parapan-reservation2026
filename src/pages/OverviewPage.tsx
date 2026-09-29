import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { ReservationSummary } from "@/components/ReservationSummary";
import { todayInEventRangeOrStart } from "@/lib/time";
import { buildDailyExportWorkbook, workbookToBlob } from "@/excel/exportWorkbook";
import {
  EVENT_END_DATE,
  EVENT_START_DATE,
  Reservation,
  SERVICE_COLORS,
  SERVICE_LABELS,
  SERVICE_OPTIONS,
  ServiceEntry,
  ServiceCode,
  TEAM_LABELS,
  TEAM_OPTIONS,
  TeamCode,
} from "@/types";

function teamDisplayName(r: Reservation): string {
  return r.team === "other" ? r.team_other_text || "其他" : TEAM_LABELS[r.team];
}

/** 交通接駁顯示去程人數；來回且去程/回程人數不同時顯示「去程X人／回程Y人」，其餘服務顯示共用預約人數 */
function headcountDisplay(entry: ServiceEntry): string {
  if (entry.service === "transport" && entry.transport) {
    const { passenger_count, return_count, transport_type } = entry.transport;
    if (transport_type === "round_trip" && return_count !== passenger_count) {
      return `去程${passenger_count}人／回程${return_count}人`;
    }
    return `${passenger_count}人`;
  }
  return `${entry.headcount}人`;
}

function reservationEarliestStart(r: Reservation): string {
  if (r.services.length === 0) return "";
  return r.services.reduce((min, s) => (s.start_time < min ? s.start_time : min), r.services[0]!.start_time);
}

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

export default function OverviewPage() {
  const { reservations, deleteReservation, setDraftReservation } = useData();
  const navigate = useNavigate();

  const [date, setDate] = useState(todayInEventRangeOrStart(new Date().toISOString().slice(0, 10)));
  const [teamFilter, setTeamFilter] = useState<TeamCode | "">("");
  const [serviceFilter, setServiceFilter] = useState<ServiceCode | "">("");
  const [keyword, setKeyword] = useState("");
  const [viewing, setViewing] = useState<Reservation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const dayReservations = useMemo(() => reservations.filter((r) => r.reservation_date === date), [reservations, date]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return dayReservations
      .filter((r) => !teamFilter || r.team === teamFilter)
      .filter((r) => !serviceFilter || r.services.some((s) => s.service === serviceFilter))
      .filter((r) => {
        if (!kw) return true;
        const haystack = [r.reservation_no, teamDisplayName(r), r.contact_person, r.contact_method, r.notes].join(" ").toLowerCase();
        return haystack.includes(kw);
      })
      .sort((a, b) => reservationEarliestStart(a).localeCompare(reservationEarliestStart(b)));
  }, [dayReservations, teamFilter, serviceFilter, keyword]);

  const stats = useMemo(() => {
    const allEntries = dayReservations.flatMap((r) => r.services);
    const mealTotal = allEntries.filter((s) => s.service === "meal").reduce((sum, s) => sum + (s.meal?.meal_count ?? 0), 0);
    const transportTotal = allEntries
      .filter((s) => s.service === "transport")
      .reduce((sum, s) => sum + (s.transport?.passenger_count ?? 0) + (s.transport?.return_count ?? 0), 0);
    const therapyTotal = allEntries.filter((s) => s.service === "therapy").reduce((sum, s) => sum + s.headcount, 0);
    const fitnessTotal = allEntries.filter((s) => s.service === "fitness").reduce((sum, s) => sum + s.headcount, 0);
    const sportsScienceTotal = allEntries.filter((s) => s.service === "sports_science").reduce((sum, s) => sum + s.headcount, 0);
    return { count: dayReservations.length, mealTotal, transportTotal, therapyTotal, fitnessTotal, sportsScienceTotal };
  }, [dayReservations]);

  function handleCopy(r: Reservation) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, reservation_no, created_at, updated_at, ...draft } = r;
    // 複製的每個服務時段也要換成全新的 entry_id，避免與原本的服務時段共用同一個識別碼
    const copiedServices = draft.services.map((s) => ({ ...s, entry_id: `${s.entry_id}-copy-${Math.random().toString(16).slice(2)}` }));
    setDraftReservation({ ...draft, services: copiedServices });
    navigate("/new");
  }

  function openDeleteConfirm(r: Reservation) {
    setDeleteTarget(r);
    setDeleteConfirmChecked(false);
  }

  function doDelete() {
    if (!deleteTarget || !deleteConfirmChecked) return;
    deleteReservation(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function handleExportToday() {
    setExportBusy(true);
    setExportMsg("");
    try {
      const wb = await buildDailyExportWorkbook(date, reservations);
      const blob = await workbookToBlob(wb);
      triggerBlobDownload(blob, `${date}_亞帕運中繼站預約及派車表.xlsx`);
      setExportMsg(`已匯出 ${date} 的預約及派車表（共 ${dayReservations.length} 張預約單）。`);
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">每日預約總覽</h2>

      <div className="bg-white rounded-xl shadow p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <label className="block mb-1 text-gray-500">日期</label>
          <input
            type="date"
            value={date}
            min={EVENT_START_DATE}
            max={EVENT_END_DATE}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block mb-1 text-gray-500">代表隊</label>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value as TeamCode | "")} className="w-full border rounded-lg px-2 py-1.5">
            <option value="">全部</option>
            {TEAM_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {TEAM_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 text-gray-500">服務項目</label>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value as ServiceCode | "")} className="w-full border rounded-lg px-2 py-1.5">
            <option value="">全部</option>
            {SERVICE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 text-gray-500">關鍵字搜尋</label>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="編號／代表隊／聯絡人…" className="w-full border rounded-lg px-2 py-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-sm">
        <StatCard label="全部預約單數" value={stats.count} />
        <StatCard label="餐食總份數" value={stats.mealTotal} />
        <StatCard label="交通接駁人次" value={stats.transportTotal} />
        <StatCard label="防護治療總人數" value={stats.therapyTotal} />
        <StatCard label="體能訓練總人數" value={stats.fitnessTotal} />
        <StatCard label="運科支援總人數" value={stats.sportsScienceTotal} />
      </div>

      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-center gap-3">
        <button onClick={handleExportToday} disabled={exportBusy} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
          {exportBusy ? "匯出中…" : "匯出本日 Excel"}
        </button>
        <span className="text-xs text-gray-400">會把 {date} 當天全部預約單彙整在同一個 Excel 檔案（含每日派車表）</span>
        {exportMsg && <span className="text-sm text-green-700">{exportMsg}</span>}
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="font-mono font-semibold text-brand-700">{r.reservation_no}</span>
                <span className="ml-2 text-sm text-gray-600">{teamDisplayName(r)}</span>
                <span className="ml-2 text-xs text-gray-400">聯絡人：{r.contact_person || "—"}</span>
              </div>
              <div className="space-x-2">
                <button onClick={() => setViewing(r)} className="text-brand-600 text-xs underline">
                  查看
                </button>
                <button onClick={() => navigate(`/edit/${r.id}`)} className="text-brand-600 text-xs underline">
                  修改
                </button>
                <button onClick={() => handleCopy(r)} className="text-gray-600 text-xs underline">
                  複製
                </button>
                <button onClick={() => openDeleteConfirm(r)} className="text-red-600 text-xs underline">
                  刪除
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.services.map((s) => (
                <span key={s.entry_id} className={`text-xs rounded-lg px-2 py-1 ${SERVICE_COLORS[s.service]}`}>
                  {SERVICE_LABELS[s.service]}｜{s.start_time}
                  {s.end_time && s.end_time !== s.start_time ? `-${s.end_time}` : ""}｜{headcountDisplay(s)}
                </span>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="bg-white rounded-xl shadow p-6 text-center text-gray-400">這天沒有符合篩選條件的預約資料</div>}
      </div>

      {viewing && (
        <Modal onClose={() => setViewing(null)} title="預約內容">
          <ReservationSummary data={viewing} reservationNo={viewing.reservation_no} />
          <div className="flex justify-end mt-4">
            <button onClick={() => setViewing(null)} className="border rounded-lg px-4 py-2 text-sm">
              關閉
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} title="刪除預約">
          <p className="text-sm text-gray-700">
            確定要刪除預約單編號 <span className="font-mono font-semibold">{deleteTarget.reservation_no}</span>（
            {teamDisplayName(deleteTarget)}，包含 {deleteTarget.services.map((s) => SERVICE_LABELS[s.service]).join("、")}）嗎？
            此動作無法復原，且這個編號往後不會再被使用。
          </p>
          <label className="flex items-center gap-2 text-sm mt-3">
            <input type="checkbox" checked={deleteConfirmChecked} onChange={(e) => setDeleteConfirmChecked(e.target.checked)} />
            我確定要刪除這筆預約
          </label>
          <div className="flex gap-3 justify-end mt-4">
            <button onClick={() => setDeleteTarget(null)} className="border rounded-lg px-4 py-2 text-sm">
              取消
            </button>
            <button
              onClick={doDelete}
              disabled={!deleteConfirmChecked}
              className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              確定刪除
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-brand-50 rounded-lg p-2 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold text-brand-700">{value}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg p-4 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}
