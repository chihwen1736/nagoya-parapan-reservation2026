import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { ReservationSummary } from "@/components/ReservationSummary";
import { todayInEventRangeOrStart } from "@/lib/time";
import {
  EVENT_END_DATE,
  EVENT_START_DATE,
  Reservation,
  SERVICE_COLORS,
  SERVICE_LABELS,
  SERVICE_OPTIONS,
  ServiceCode,
  TEAM_LABELS,
  TEAM_OPTIONS,
  TeamCode,
} from "@/types";

function teamDisplayName(r: Reservation): string {
  return r.team === "other" ? r.team_other_text || "其他" : TEAM_LABELS[r.team];
}

/** 交通接駁顯示去程人數；來回且去程/回程人數不同時顯示「去程X人／回程Y人」，其餘服務顯示共用預約人數 */
function headcountDisplay(r: Reservation): string {
  if (r.service === "transport" && r.transport) {
    const { passenger_count, return_count, transport_type } = r.transport;
    if (transport_type === "round_trip" && return_count !== passenger_count) {
      return `去程${passenger_count}人／回程${return_count}人`;
    }
    return `${passenger_count}人`;
  }
  return `${r.headcount}`;
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

  const dayReservations = useMemo(() => reservations.filter((r) => r.reservation_date === date), [reservations, date]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return dayReservations
      .filter((r) => !teamFilter || r.team === teamFilter)
      .filter((r) => !serviceFilter || r.service === serviceFilter)
      .filter((r) => {
        if (!kw) return true;
        const haystack = [r.reservation_no, teamDisplayName(r), r.contact_person, r.contact_method, r.notes].join(" ").toLowerCase();
        return haystack.includes(kw);
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [dayReservations, teamFilter, serviceFilter, keyword]);

  const stats = useMemo(() => {
    const mealTotal = dayReservations.filter((r) => r.service === "meal").reduce((sum, r) => sum + (r.meal?.meal_count ?? 0), 0);
    const transportTotal = dayReservations
      .filter((r) => r.service === "transport")
      .reduce((sum, r) => sum + (r.transport?.passenger_count ?? 0) + (r.transport?.return_count ?? 0), 0);
    const therapyTotal = dayReservations.filter((r) => r.service === "therapy").reduce((sum, r) => sum + r.headcount, 0);
    const fitnessTotal = dayReservations.filter((r) => r.service === "fitness").reduce((sum, r) => sum + r.headcount, 0);
    const sportsScienceTotal = dayReservations.filter((r) => r.service === "sports_science").reduce((sum, r) => sum + r.headcount, 0);
    return { count: dayReservations.length, mealTotal, transportTotal, therapyTotal, fitnessTotal, sportsScienceTotal };
  }, [dayReservations]);

  function handleCopy(r: Reservation) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, reservation_no, created_at, updated_at, ...draft } = r;
    setDraftReservation(draft);
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
        <StatCard label="全部預約筆數" value={stats.count} />
        <StatCard label="餐食總份數" value={stats.mealTotal} />
        <StatCard label="交通接駁人次" value={stats.transportTotal} />
        <StatCard label="防護治療總人數" value={stats.therapyTotal} />
        <StatCard label="體能訓練總人數" value={stats.fitnessTotal} />
        <StatCard label="運科支援總人數" value={stats.sportsScienceTotal} />
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">預約單編號</th>
              <th className="text-left px-3 py-2">時間</th>
              <th className="text-left px-3 py-2">代表隊</th>
              <th className="text-left px-3 py-2">服務項目</th>
              <th className="text-left px-3 py-2">人數</th>
              <th className="text-left px-3 py-2">聯絡人</th>
              <th className="text-left px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-t ${SERVICE_COLORS[r.service]}`}>
                <td className="px-3 py-2 font-mono whitespace-nowrap">{r.reservation_no}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.start_time}{r.end_time && r.end_time !== r.start_time ? `-${r.end_time}` : ""}</td>
                <td className="px-3 py-2 whitespace-nowrap">{teamDisplayName(r)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{SERVICE_LABELS[r.service]}</td>
                <td className="px-3 py-2 whitespace-nowrap">{headcountDisplay(r)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.contact_person}</td>
                <td className="px-3 py-2 whitespace-nowrap space-x-2">
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
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  這天沒有符合篩選條件的預約資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
            {teamDisplayName(deleteTarget)}／{SERVICE_LABELS[deleteTarget.service]}）嗎？此動作無法復原，且這個編號往後不會再被使用。
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
