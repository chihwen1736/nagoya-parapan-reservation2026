// 本檔案只定義「資料的形狀」（型別）與固定選項，不含任何真實的預約資料。
// 所有正式資料只會存在使用者瀏覽器的 localStorage 與使用者自行匯出的備份/Excel 檔案裡。

export const EVENT_START_DATE = "2026-10-12";
export const EVENT_END_DATE = "2026-10-25";

// ---------- 代表隊 ----------

export type TeamCode =
  | "archery"
  | "athletics"
  | "badminton"
  | "boccia"
  | "judo"
  | "powerlifting"
  | "shooting"
  | "swimming"
  | "table_tennis"
  | "taekwondo"
  | "wheelchair_fencing"
  | "wheelchair_tennis"
  | "staff"
  | "other";

export const TEAM_OPTIONS: TeamCode[] = [
  "archery",
  "athletics",
  "badminton",
  "boccia",
  "judo",
  "powerlifting",
  "shooting",
  "swimming",
  "table_tennis",
  "taekwondo",
  "wheelchair_fencing",
  "wheelchair_tennis",
  "staff",
  "other",
];

export const TEAM_LABELS: Record<TeamCode, string> = {
  archery: "射箭",
  athletics: "田徑",
  badminton: "羽球",
  boccia: "地板滾球",
  judo: "柔道",
  powerlifting: "健力",
  shooting: "射擊",
  swimming: "游泳",
  table_tennis: "桌球",
  taekwondo: "跆拳道",
  wheelchair_fencing: "輪椅擊劍",
  wheelchair_tennis: "輪椅網球",
  staff: "中繼站工作人員",
  other: "其他",
};

// ---------- 服務項目 ----------

export type ServiceCode = "meal" | "transport" | "therapy" | "fitness" | "sports_science";

export const SERVICE_OPTIONS: ServiceCode[] = ["meal", "transport", "therapy", "fitness", "sports_science"];

export const SERVICE_LABELS: Record<ServiceCode, string> = {
  meal: "餐食",
  transport: "交通接駁",
  therapy: "防護治療",
  fitness: "體能訓練",
  sports_science: "運科支援",
};

// 服務卡片配色（淡色系，用於總覽列表快速辨識）
export const SERVICE_COLORS: Record<ServiceCode, string> = {
  meal: "bg-amber-50",
  transport: "bg-sky-50",
  therapy: "bg-rose-50",
  fitness: "bg-emerald-50",
  sports_science: "bg-violet-50",
};

// ---------- 防護治療分支 ----------

export type TherapyBranch = "protective_treatment" | "massage_bed" | "doctor";
export const THERAPY_BRANCH_OPTIONS: TherapyBranch[] = ["protective_treatment", "massage_bed", "doctor"];
export const THERAPY_BRANCH_LABELS: Record<TherapyBranch, string> = {
  protective_treatment: "防護處置與物理治療",
  massage_bed: "按摩床使用空間",
  doctor: "醫師治療",
};
/** null 代表沒有容量上限（僅醫師治療） */
export const THERAPY_BRANCH_CAPACITY: Record<TherapyBranch, number | null> = {
  protective_treatment: 3,
  massage_bed: 2,
  doctor: null,
};

// ---------- 體能訓練分支 ----------

export type FitnessBranch = "strength_training";
export const FITNESS_BRANCH_OPTIONS: FitnessBranch[] = ["strength_training"];
export const FITNESS_BRANCH_LABELS: Record<FitnessBranch, string> = {
  strength_training: "肌力體能訓練",
};
export const FITNESS_BRANCH_CAPACITY: Record<FitnessBranch, number> = {
  strength_training: 10,
};

// ---------- 運科支援分支 ----------

export type SportsScienceBranch =
  | "physio_test"
  | "air_massage"
  | "compression_chamber"
  | "individual_consult"
  | "nutrition_consult";
export const SPORTS_SCIENCE_BRANCH_OPTIONS: SportsScienceBranch[] = [
  "physio_test",
  "air_massage",
  "compression_chamber",
  "individual_consult",
  "nutrition_consult",
];
export const SPORTS_SCIENCE_BRANCH_LABELS: Record<SportsScienceBranch, string> = {
  physio_test: "生理生化檢測",
  air_massage: "氣壓式按摩機",
  compression_chamber: "加壓艙",
  individual_consult: "個別會談",
  nutrition_consult: "營養諮詢",
};
export const SPORTS_SCIENCE_BRANCH_CAPACITY: Record<SportsScienceBranch, number> = {
  physio_test: 5,
  air_massage: 12,
  compression_chamber: 5,
  individual_consult: 2,
  nutrition_consult: 2,
};

// ---------- 餐食欄位 ----------

export type MealType = "lunch" | "dinner";
export const MEAL_TYPE_LABELS: Record<MealType, string> = { lunch: "午餐", dinner: "晚餐" };

export type MealServeMethod = "onsite" | "delivery" | "self_pickup";
export const MEAL_SERVE_METHOD_LABELS: Record<MealServeMethod, string> = {
  onsite: "中繼站用餐",
  delivery: "送至比賽地點",
  self_pickup: "自取",
};

export interface MealFields {
  meal_type: MealType;
  meal_count: number;
  serve_method: MealServeMethod;
  serve_location: string;
  meal_content: string;
  vegetarian_count: number;
}

// ---------- 交通接駁欄位 ----------

export type TransportType = "one_way" | "round_trip";
export const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = { one_way: "單程", round_trip: "來回" };

export type TransportLocationCode = "venue" | "village_hotel" | "relay_station" | "other";
export const TRANSPORT_LOCATION_LABELS: Record<TransportLocationCode, string> = {
  venue: "比賽地點",
  village_hotel: "選手村（飯店）",
  relay_station: "名古屋中繼站",
  other: "其他",
};
export const TRANSPORT_LOCATION_OPTIONS: TransportLocationCode[] = ["venue", "village_hotel", "relay_station", "other"];

export interface TransportFields {
  transport_type: TransportType;
  outbound_pickup: TransportLocationCode;
  outbound_pickup_other: string;
  outbound_dropoff: TransportLocationCode;
  outbound_dropoff_other: string;
  passenger_count: number;
  needs_accessible_vehicle: boolean;
  wheelchair_count: number;
  passenger_note: string;
  // 來回時才使用
  return_time: string;
  return_pickup: TransportLocationCode | "";
  return_pickup_other: string;
  return_dropoff: TransportLocationCode | "";
  return_dropoff_other: string;
  return_count: number;
}

// ---------- 防護治療 / 體能訓練 / 運科支援欄位 ----------

export interface TherapyFields {
  therapy_branch: TherapyBranch;
  requirement_note: string;
}

export interface FitnessFields {
  fitness_branch: FitnessBranch;
  training_requirement: string;
}

export interface SportsScienceFields {
  sports_science_branch: SportsScienceBranch;
  requirement_note: string;
}

// ---------- 預約主體 ----------

export interface BaseReservation {
  id: string; // 內部識別碼（crypto.randomUUID），不對外顯示
  reservation_no: string; // RYYMMDD-XXX，系統自動產生
  reservation_date: string; // YYYY-MM-DD
  team: TeamCode;
  team_other_text: string; // team === "other" 時使用
  service: ServiceCode;
  headcount: number;
  start_time: string; // HH:mm，共用欄位；各服務對應方式見下方型別註解
  end_time: string; // HH:mm，視服務類型決定是否於畫面上要求輸入
  contact_person: string;
  contact_method: string;
  notes: string;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface Reservation extends BaseReservation {
  meal?: MealFields;
  transport?: TransportFields;
  therapy?: TherapyFields;
  fitness?: FitnessFields;
  sportsScience?: SportsScienceFields;
}

// 新增/編輯表單使用的暫存資料形狀（尚未產生 id/reservation_no/時間戳記）
export type ReservationDraft = Omit<BaseReservation, "id" | "reservation_no" | "created_at" | "updated_at"> & {
  meal?: MealFields;
  transport?: TransportFields;
  therapy?: TherapyFields;
  fitness?: FitnessFields;
  sportsScience?: SportsScienceFields;
};

export function emptyMealFields(): MealFields {
  return { meal_type: "lunch", meal_count: 1, serve_method: "onsite", serve_location: "", meal_content: "", vegetarian_count: 0 };
}

export function emptyTransportFields(): TransportFields {
  return {
    transport_type: "one_way",
    outbound_pickup: "village_hotel",
    outbound_pickup_other: "",
    outbound_dropoff: "venue",
    outbound_dropoff_other: "",
    passenger_count: 1,
    needs_accessible_vehicle: false,
    wheelchair_count: 0,
    passenger_note: "",
    return_time: "",
    return_pickup: "",
    return_pickup_other: "",
    return_dropoff: "",
    return_dropoff_other: "",
    return_count: 0,
  };
}

export function emptyTherapyFields(): TherapyFields {
  return { therapy_branch: "protective_treatment", requirement_note: "" };
}

export function emptyFitnessFields(): FitnessFields {
  return { fitness_branch: "strength_training", training_requirement: "" };
}

export function emptySportsScienceFields(): SportsScienceFields {
  return { sports_science_branch: "physio_test", requirement_note: "" };
}

export function emptyDraft(defaultDate: string): ReservationDraft {
  return {
    reservation_date: defaultDate,
    team: "athletics",
    team_other_text: "",
    service: "meal",
    headcount: 1,
    start_time: "09:00",
    end_time: "",
    contact_person: "",
    contact_method: "",
    notes: "",
    meal: emptyMealFields(),
  };
}
