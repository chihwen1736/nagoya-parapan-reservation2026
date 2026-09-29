// 產生測試用的範例預約資料（JSON 備份格式），供「資料備份」頁面的「從備份還原」功能測試使用。
// 執行方式：npm run generate:sample-data
import fs from "node:fs";
import { Reservation, ServiceEntry } from "../src/types";

const now = new Date().toISOString();

function entry(overrides: Partial<ServiceEntry> & Pick<ServiceEntry, "service">): ServiceEntry {
  return {
    entry_id: overrides.entry_id ?? crypto.randomUUID(),
    headcount: overrides.headcount ?? 1,
    start_time: overrides.start_time ?? "09:00",
    end_time: overrides.end_time ?? "",
    ...overrides,
  };
}

function base(overrides: Partial<Reservation> & Pick<Reservation, "reservation_no" | "services">): Reservation {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    reservation_date: overrides.reservation_date ?? "2026-10-12",
    team: overrides.team ?? "athletics",
    team_other_text: overrides.team_other_text ?? "",
    contact_person: overrides.contact_person ?? "王小明",
    contact_method: overrides.contact_method ?? "0900-000-001",
    notes: overrides.notes ?? "",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

const reservations: Reservation[] = [
  // 單一服務：餐食（現場用餐，不進派車表）
  base({
    reservation_no: "R261012-001",
    reservation_date: "2026-10-12",
    team: "athletics",
    services: [
      entry({
        service: "meal",
        headcount: 4,
        start_time: "12:00",
        meal: { meal_type: "lunch", meal_count: 4, serve_method: "onsite", serve_location: "中繼站餐廳", meal_content: "", vegetarian_count: 1 },
      }),
    ],
  }),
  // 多服務預約單：交通接駁（來回）＋防護治療，示範一張預約單同時包含多個服務
  base({
    reservation_no: "R261012-002",
    reservation_date: "2026-10-12",
    team: "swimming",
    services: [
      entry({
        service: "transport",
        headcount: 6,
        start_time: "08:30",
        transport: {
          transport_type: "round_trip",
          outbound_pickup: "village_hotel",
          outbound_pickup_other: "",
          outbound_dropoff: "venue",
          outbound_dropoff_other: "",
          passenger_count: 6,
          needs_accessible_vehicle: false,
          wheelchair_count: 0,
          passenger_note: "游泳隊上午場次",
          return_time: "13:00",
          return_pickup: "venue",
          return_pickup_other: "",
          return_dropoff: "village_hotel",
          return_dropoff_other: "",
          return_count: 6,
        },
      }),
      entry({
        service: "therapy",
        headcount: 2,
        start_time: "09:00",
        end_time: "10:00",
        therapy: { therapy_branch: "protective_treatment", requirement_note: "賽前熱身防護" },
      }),
    ],
  }),
  // 餐食外送，會出現在每日派車表（標示 [送餐]）
  base({
    reservation_no: "R261012-003",
    reservation_date: "2026-10-12",
    team: "judo",
    services: [
      entry({
        service: "meal",
        headcount: 3,
        start_time: "12:30",
        meal: { meal_type: "lunch", meal_count: 3, serve_method: "delivery", serve_location: "柔道比賽場館休息室", meal_content: "便當×3", vegetarian_count: 0 },
      }),
    ],
  }),
  base({
    reservation_no: "R261012-004",
    reservation_date: "2026-10-12",
    team: "powerlifting",
    services: [
      entry({
        service: "fitness",
        headcount: 3,
        start_time: "09:30",
        end_time: "10:30",
        fitness: { fitness_branch: "strength_training", training_requirement: "下肢肌力訓練" },
      }),
    ],
  }),
  base({
    reservation_no: "R261012-005",
    reservation_date: "2026-10-12",
    team: "wheelchair_fencing",
    services: [
      entry({
        service: "sports_science",
        headcount: 1,
        start_time: "11:00",
        end_time: "11:30",
        sportsScience: { sports_science_branch: "individual_consult", requirement_note: "賽前心理諮詢" },
      }),
    ],
  }),
];

const maxSeqUsed: Record<string, number> = { "2026-10-12": 5 };

const backup = {
  app: "nagoya-parapan-reservation2026",
  formatVersion: 1,
  exportedAt: now,
  reservations,
  maxSeqUsed,
};

const filename = "亞帕運中繼站預約系統_範例資料.json";
fs.writeFileSync(filename, JSON.stringify(backup, null, 2), "utf-8");
console.log("已產生範例資料：", filename, "共", reservations.length, "張預約單");
