import React from "react";
import {
  FITNESS_BRANCH_LABELS,
  MEAL_SERVE_METHOD_LABELS,
  MEAL_TYPE_LABELS,
  Reservation,
  ReservationDraft,
  SERVICE_LABELS,
  ServiceEntry,
  SPORTS_SCIENCE_BRANCH_LABELS,
  TEAM_LABELS,
  THERAPY_BRANCH_LABELS,
  TRANSPORT_LOCATION_LABELS,
  TRANSPORT_TYPE_LABELS,
} from "@/types";

function locationLabel(code: string, other: string): string {
  if (code === "other") return other || "其他（未填說明）";
  return TRANSPORT_LOCATION_LABELS[code as keyof typeof TRANSPORT_LOCATION_LABELS] ?? code;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === "" || value === null || value === undefined) return null;
  return (
    <div className="flex gap-2 py-1 border-b border-gray-100 last:border-0">
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      <span className="flex-1 text-gray-800">{value}</span>
    </div>
  );
}

/** 單一服務時段的內容區塊（依服務類別分區顯示） */
function ServiceEntrySection({ entry }: { entry: ServiceEntry }) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <p className="text-sm font-semibold text-brand-700 mb-1">{SERVICE_LABELS[entry.service]}</p>
      {entry.service !== "transport" && <Row label="預約人數" value={`${entry.headcount} 人`} />}

      {entry.service === "meal" && entry.meal && (
        <>
          <Row label="餐別" value={MEAL_TYPE_LABELS[entry.meal.meal_type]} />
          <Row label="用餐／送餐時間" value={entry.start_time} />
          <Row label="餐食份數" value={`${entry.meal.meal_count} 份`} />
          <Row label="供應方式" value={MEAL_SERVE_METHOD_LABELS[entry.meal.serve_method]} />
          <Row label="地點" value={entry.meal.serve_location} />
          <Row label="餐食內容／特殊需求" value={entry.meal.meal_content} />
          <Row label="素食份數" value={entry.meal.vegetarian_count > 0 ? `${entry.meal.vegetarian_count} 份` : ""} />
        </>
      )}

      {entry.service === "transport" && entry.transport && (
        <>
          <Row label="接駁類型" value={TRANSPORT_TYPE_LABELS[entry.transport.transport_type]} />
          <Row label="去程上車時間" value={entry.start_time} />
          <Row label="去程上車地點" value={locationLabel(entry.transport.outbound_pickup, entry.transport.outbound_pickup_other)} />
          <Row label="去程下車地點" value={locationLabel(entry.transport.outbound_dropoff, entry.transport.outbound_dropoff_other)} />
          <Row label="乘車人數" value={`${entry.transport.passenger_count} 人`} />
          <Row label="是否需要福祉車" value={entry.transport.needs_accessible_vehicle ? "是" : "否"} />
          <Row label="輪椅使用人數" value={entry.transport.wheelchair_count > 0 ? `${entry.transport.wheelchair_count} 人` : ""} />
          <Row label="乘車人員／隊伍說明" value={entry.transport.passenger_note} />
          {entry.transport.transport_type === "round_trip" && (
            <>
              <Row label="回程上車時間" value={entry.transport.return_time} />
              <Row
                label="回程上車地點"
                value={entry.transport.return_pickup ? locationLabel(entry.transport.return_pickup, entry.transport.return_pickup_other) : ""}
              />
              <Row
                label="回程下車地點"
                value={entry.transport.return_dropoff ? locationLabel(entry.transport.return_dropoff, entry.transport.return_dropoff_other) : ""}
              />
              <Row label="回程人數" value={entry.transport.return_count > 0 ? `${entry.transport.return_count} 人` : ""} />
            </>
          )}
        </>
      )}

      {entry.service === "therapy" && entry.therapy && (
        <>
          <Row label="分支項目" value={THERAPY_BRANCH_LABELS[entry.therapy.therapy_branch]} />
          <Row label="開始時間" value={entry.start_time} />
          <Row label="結束時間" value={entry.end_time} />
          <Row label="需求說明" value={entry.therapy.requirement_note} />
        </>
      )}

      {entry.service === "fitness" && entry.fitness && (
        <>
          <Row label="分支項目" value={FITNESS_BRANCH_LABELS[entry.fitness.fitness_branch]} />
          <Row label="開始時間" value={entry.start_time} />
          <Row label="結束時間" value={entry.end_time} />
          <Row label="訓練需求" value={entry.fitness.training_requirement} />
        </>
      )}

      {entry.service === "sports_science" && entry.sportsScience && (
        <>
          <Row label="分支項目" value={SPORTS_SCIENCE_BRANCH_LABELS[entry.sportsScience.sports_science_branch]} />
          <Row label="開始時間" value={entry.start_time} />
          <Row label="結束時間" value={entry.end_time} />
          <Row label="需求說明" value={entry.sportsScience.requirement_note} />
        </>
      )}
    </div>
  );
}

export function ReservationSummary({ data, reservationNo }: { data: ReservationDraft | Reservation; reservationNo?: string }) {
  const teamLabel = data.team === "other" ? data.team_other_text || "其他（未填說明）" : TEAM_LABELS[data.team];

  return (
    <div className="text-sm space-y-3">
      <div>
        {reservationNo && <Row label="預約單編號" value={<span className="font-mono font-semibold">{reservationNo}</span>} />}
        <Row label="預約日期" value={data.reservation_date} />
        <Row label="代表隊" value={teamLabel} />
        <Row label="聯絡人" value={data.contact_person} />
        <Row label="聯絡方式" value={data.contact_method} />
        <Row label="備註" value={data.notes} />
      </div>

      {data.services.length === 0 ? (
        <p className="text-gray-400 text-sm">尚未勾選任何服務項目。</p>
      ) : (
        <div className="space-y-2">
          {data.services.map((entry) => (
            <ServiceEntrySection key={entry.entry_id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
