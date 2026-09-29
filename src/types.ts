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

// ---------- 服務時段（一張預約單可以包含多筆服務時段） ----------

export interface ServiceEntry {
  entry_id: string; // 內部識別碼，同一張預約單內唯一，供編輯/容量檢查排除自己使用
  service: ServiceCode;
  headcount: number;
  start_time: string; // HH:mm
  end_time: string; // HH:mm，視服務類型決定是否於畫面上要求輸入
  location?: string; // 部分服務（例如餐食）用得到的簡易地點欄位，其餘服務地點資訊放在對應 details 裡
  note?: string; // 該服務項目自己的備註（區別於整張預約單共用的備註）
  meal?: MealFields;
  transport?: TransportFields;
  therapy?: TherapyFields;
  fitness?: FitnessFields;
  sportsScience?: SportsScienceFields;
}

// ---------- 預約主體 ----------

export interface BaseReservation {
  id: string; // 內部識別碼（crypto.randomUUID），不對外顯示
  reservation_no: string; // RYYMMDD-XXX，系統自動產生；同一張預約單內所有服務共用同一個編號
  reservation_date: string; // YYYY-MM-DD
  team: TeamCode;
  team_other_text: string; // team === "other" 時使用
  contact_person: string;
  contact_method: string;
  notes: string; // 整張預約單共用備註
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface Reservation extends BaseReservation {
  services: ServiceEntry[];
}

// 新增/編輯表單使用的暫存資料形狀（尚未產生 id/reservation_no/時間戳記）
export type ReservationDraft = Omit<BaseReservation, "id" | "reservation_no" | "created_at" | "updated_at"> & {
  services: ServiceEntry[];
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

/** 服務項目是否需要使用者填寫「結束時間」（防護治療／體能訓練／運科支援皆採時段預約，需要結束時間） */
export function serviceRequiresEndTime(service: ServiceCode): boolean {
  return service === "therapy" || service === "fitness" || service === "sports_science";
}

function newEntryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** 建立某個服務項目的空白服務時段（預設欄位值），entry_id 一律重新產生 */
export function emptyServiceEntry(service: ServiceCode): ServiceEntry {
  const base = { entry_id: newEntryId(), service, headcount: 1, start_time: "09:00", end_time: "" };
  if (service === "meal") return { ...base, meal: emptyMealFields() };
  if (service === "transport") {
    const t = emptyTransportFields();
    return { ...base, headcount: t.passenger_count, transport: t };
  }
  if (service === "therapy") return { ...base, therapy: emptyTherapyFields() };
  if (service === "fitness") return { ...base, fitness: emptyFitnessFields() };
  return { ...base, sportsScience: emptySportsScienceFields() };
}

export function emptyDraft(defaultDate: string): ReservationDraft {
  return {
    reservation_date: defaultDate,
    team: "athletics",
    team_other_text: "",
    contact_person: "",
    contact_method: "",
    notes: "",
    services: [],
  };
}

// ---------- 舊版（單一服務）資料格式相容 ----------
// 2026-09 版之前，一張預約單只能有一個服務項目，欄位（service/headcount/start_time/end_time/meal/transport/...）
// 直接放在預約單最外層。改為「一張預約單可包含多個服務」後，這些欄位收進 services[] 陣列裡。
// 讀取舊資料（localStorage 或匯入的 JSON 備份）時，一律透過 normalizeReservation() 自動轉換成新格式，
// 確保舊版已儲存的資料仍能正常顯示、修改及匯出。

interface LegacySingleServiceReservation {
  id: string;
  reservation_no: string;
  reservation_date: string;
  team: TeamCode;
  team_other_text: string;
  service: ServiceCode;
  headcount: number;
  start_time: string;
  end_time: string;
  contact_person: string;
  contact_method: string;
  notes: string;
  created_at: string;
  updated_at: string;
  meal?: MealFields;
  transport?: TransportFields;
  therapy?: TherapyFields;
  fitness?: FitnessFields;
  sportsScience?: SportsScienceFields;
}

function isLegacySingleServiceShape(raw: unknown): raw is LegacySingleServiceReservation {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  return typeof obj.service === "string" && !Array.isArray(obj.services);
}

/** 確保每個服務時段都有 entry_id（極舊備份或手動編輯過的 JSON 可能缺少） */
function ensureEntryIds(services: ServiceEntry[]): ServiceEntry[] {
  return services.map((s) => (s.entry_id ? s : { ...s, entry_id: newEntryId() }));
}

/** 把任何形狀（新版 / 舊版單一服務）的預約單資料，正規化成目前的多服務資料結構 */
export function normalizeReservation(raw: unknown): Reservation {
  if (isLegacySingleServiceShape(raw)) {
    const {
      id,
      reservation_no,
      reservation_date,
      team,
      team_other_text,
      service,
      headcount,
      start_time,
      end_time,
      contact_person,
      contact_method,
      notes,
      created_at,
      updated_at,
      meal,
      transport,
      therapy,
      fitness,
      sportsScience,
    } = raw;
    const entry: ServiceEntry = { entry_id: newEntryId(), service, headcount, start_time, end_time, meal, transport, therapy, fitness, sportsScience };
    return {
      id,
      reservation_no,
      reservation_date,
      team,
      team_other_text,
      contact_person,
      contact_method,
      notes,
      created_at,
      updated_at,
      services: [entry],
    };
  }
  const obj = raw as Reservation;
  return { ...obj, services: ensureEntryIds(Array.isArray(obj.services) ? obj.services : []) };
}
