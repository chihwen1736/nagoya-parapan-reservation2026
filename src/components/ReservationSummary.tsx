import React from "react";
import {
  FITNESS_BRANCH_LABELS,
  MEAL_SERVE_METHOD_LABELS,
  MEAL_TYPE_LABELS,
  Reservation,
  ReservationDraft,
  SERVICE_LABELS,
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

export function ReservationSummary({ data, reservationNo }: { data: ReservationDraft | Reservation; reservationNo?: string }) {
  const teamLabel = data.team === "other" ? data.team_other_text || "其他（未填說明）" : TEAM_LABELS[data.team];

  return (
    <div className="text-sm">
      {reservationNo && <Row label="預約單編號" value={<span className="font-mono font-semibold">{reservationNo}</span>} />}
      <Row label="預約日期" value={data.reservation_date} />
      <Row label="代表隊" value={teamLabel} />
      <Row label="服務項目" value={SERVICE_LABELS[data.service]} />
      {data.service !== "transport" && <Row label="預約人數" value={`${data.headcount} 人`} />}

      {data.service === "meal" && data.meal && (
        <>
          <Row label="餐別" value={MEAL_TYPE_LABELS[data.meal.meal_type]} />
          <Row label="用餐／送餐時間" value={data.start_time} />
          <Row label="餐食份數" value={`${data.meal.meal_count} 份`} />
          <Row label="供應方式" value={MEAL_SERVE_METHOD_LABELS[data.meal.serve_method]} />
          <Row label="地點" value={data.meal.serve_location} />
          <Row label="餐食內容／特殊需求" value={data.meal.meal_content} />
          <Row label="素食份數" value={data.meal.vegetarian_count > 0 ? `${data.meal.vegetarian_count} 份` : ""} />
        </>
      )}

      {data.service === "transport" && data.transport && (
        <>
          <Row label="接駁類型" value={TRANSPORT_TYPE_LABELS[data.transport.transport_type]} />
          <Row label="去程上車時間" value={data.start_time} />
          <Row label="去程上車地點" value={locationLabel(data.transport.outbound_pickup, data.transport.outbound_pickup_other)} />
          <Row label="去程下車地點" value={locationLabel(data.transport.outbound_dropoff, data.transport.outbound_dropoff_other)} />
          <Row label="乘車人數" value={`${data.transport.passenger_count} 人`} />
          <Row label="是否需要福祉車" value={data.transport.needs_accessible_vehicle ? "是" : "否"} />
          <Row label="輪椅使用人數" value={data.transport.wheelchair_count > 0 ? `${data.transport.wheelchair_count} 人` : ""} />
          <Row label="乘車人員／隊伍說明" value={data.transport.passenger_note} />
          {data.transport.transport_type === "round_trip" && (
            <>
              <Row label="回程上車時間" value={data.transport.return_time} />
              <Row
                label="回程上車地點"
                value={data.transport.return_pickup ? locationLabel(data.transport.return_pickup, data.transport.return_pickup_other) : ""}
              />
              <Row
                label="回程下車地點"
                value={data.transport.return_dropoff ? locationLabel(data.transport.return_dropoff, data.transport.return_dropoff_other) : ""}
              />
              <Row label="回程人數" value={data.transport.return_count > 0 ? `${data.transport.return_count} 人` : ""} />
            </>
          )}
        </>
      )}

      {data.service === "therapy" && data.therapy && (
        <>
          <Row label="分支項目" value={THERAPY_BRANCH_LABELS[data.therapy.therapy_branch]} />
          <Row label="開始時間" value={data.start_time} />
          <Row label="結束時間" value={data.end_time} />
          <Row label="需求說明" value={data.therapy.requirement_note} />
        </>
      )}

      {data.service === "fitness" && data.fitness && (
        <>
          <Row label="分支項目" value={FITNESS_BRANCH_LABELS[data.fitness.fitness_branch]} />
          <Row label="開始時間" value={data.start_time} />
          <Row label="結束時間" value={data.end_time} />
          <Row label="訓練需求" value={data.fitness.training_requirement} />
        </>
      )}

      {data.service === "sports_science" && data.sportsScience && (
        <>
          <Row label="分支項目" value={SPORTS_SCIENCE_BRANCH_LABELS[data.sportsScience.sports_science_branch]} />
          <Row label="開始時間" value={data.start_time} />
          <Row label="結束時間" value={data.end_time} />
          <Row label="需求說明" value={data.sportsScience.requirement_note} />
        </>
      )}

      <Row label="聯絡人" value={data.contact_person} />
      <Row label="聯絡方式" value={data.contact_method} />
      <Row label="備註" value={data.notes} />
    </div>
  );
}
