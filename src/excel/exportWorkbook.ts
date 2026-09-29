import ExcelJS from "exceljs";
import {
  FITNESS_BRANCH_LABELS,
  MEAL_SERVE_METHOD_LABELS,
  MEAL_TYPE_LABELS,
  Reservation,
  SERVICE_LABELS,
  ServiceEntry,
  SPORTS_SCIENCE_BRANCH_LABELS,
  TEAM_LABELS,
  THERAPY_BRANCH_LABELS,
  TransportFields,
  TRANSPORT_LOCATION_LABELS,
} from "@/types";

const TITLE = "2026名古屋亞帕運中繼站預約清單";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEA580C" } }; // brand-600 橘色
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14, color: { argb: "FFC2410C" } }; // brand-700
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCCCCCC" } },
  left: { style: "thin", color: { argb: "FFCCCCCC" } },
  bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
  right: { style: "thin", color: { argb: "FFCCCCCC" } },
};

function teamName(r: Reservation): string {
  return r.team === "other" ? r.team_other_text || "其他" : TEAM_LABELS[r.team];
}

function branchName(entry: ServiceEntry): string {
  if (entry.service === "therapy" && entry.therapy) return THERAPY_BRANCH_LABELS[entry.therapy.therapy_branch];
  if (entry.service === "fitness" && entry.fitness) return FITNESS_BRANCH_LABELS[entry.fitness.fitness_branch];
  if (entry.service === "sports_science" && entry.sportsScience) return SPORTS_SCIENCE_BRANCH_LABELS[entry.sportsScience.sports_science_branch];
  return "";
}

function requirementContent(entry: ServiceEntry): string {
  if (entry.service === "meal" && entry.meal) return entry.meal.meal_content;
  if (entry.service === "transport" && entry.transport) return entry.transport.passenger_note;
  if (entry.service === "therapy" && entry.therapy) return entry.therapy.requirement_note;
  if (entry.service === "fitness" && entry.fitness) return entry.fitness.training_requirement;
  if (entry.service === "sports_science" && entry.sportsScience) return entry.sportsScience.requirement_note;
  return "";
}

function entryLocation(entry: ServiceEntry): string {
  if (entry.service === "meal" && entry.meal) return entry.meal.serve_location;
  if (entry.service === "transport" && entry.transport) {
    return `${locationLabel(entry.transport.outbound_pickup, entry.transport.outbound_pickup_other)} → ${locationLabel(
      entry.transport.outbound_dropoff,
      entry.transport.outbound_dropoff_other
    )}`;
  }
  return "";
}

/** 「每日預約總表」備註欄：合併該服務項目自己的需求內容與整張預約單共用的備註，避免遺漏資訊 */
function combinedNote(r: Reservation, entry: ServiceEntry): string {
  const parts = [requirementContent(entry), r.notes].map((s) => (s ?? "").trim()).filter(Boolean);
  return parts.join("；");
}

function locationLabel(code: string, other: string): string {
  if (!code) return "";
  if (code === "other") return other || "其他";
  return TRANSPORT_LOCATION_LABELS[code as keyof typeof TRANSPORT_LOCATION_LABELS] ?? code;
}

/** 每張預約單攤平成「一個服務項目一列」，並附上所屬預約單資訊，供各工作表共用 */
interface FlatRow {
  reservation: Reservation;
  entry: ServiceEntry;
}

function flattenRows(reservations: Reservation[]): FlatRow[] {
  const flat: FlatRow[] = [];
  for (const r of reservations) {
    for (const entry of r.services) {
      flat.push({ reservation: r, entry });
    }
  }
  return flat;
}

// ---------- 日期／時間欄位：寫成 Excel 可辨識的真正日期/時間值，而不是純文字 ----------
// 空白的結束時間（例如餐食/交通接駁不需要結束時間）必須保持空白儲存格，不能被誤轉成某個日期/時間。

const DATE_NUM_FMT = "yyyy-mm-dd";
const TIME_NUM_FMT = "hh:mm";

interface DateCellSpec {
  kind: "date";
  raw: string; // YYYY-MM-DD，空字串代表留白
}
interface TimeCellSpec {
  kind: "time";
  raw: string; // HH:mm，空字串代表留白
}
type CellSpec = string | number | DateCellSpec | TimeCellSpec;

function dateCell(raw: string): DateCellSpec {
  return { kind: "date", raw };
}
function timeCell(raw: string): TimeCellSpec {
  return { kind: "time", raw };
}

/** "YYYY-MM-DD" → 當天 UTC 午夜的 Date 物件，讓 ExcelJS 寫成真正的日期值（numFmt 另外設定） */
function parseDateOnly(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
}

/**
 * "HH:mm" → Excel 時間值（Date 物件，日期部分固定為 Excel 1900 日期系統的起始日 1899-12-30），
 * 搭配 numFmt "hh:mm" 只顯示時間、呈現 24 小時制，但底層仍是 Excel 可辨識、可排序的真正日期/時間數值。
 */
function parseTimeAsDate(raw: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  const [, h, mi] = m;
  const hours = Number(h);
  const minutes = Number(mi);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return new Date(Date.UTC(1899, 11, 30, hours, minutes, 0));
}

interface SheetSetupOptions {
  columnWidths: number[];
}

function setupSheetPage(ws: ExcelJS.Worksheet, title: string, exportDate: string, headers: string[], opts: SheetSetupOptions) {
  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = TITLE;
  titleCell.font = TITLE_FONT;
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, headers.length);
  const metaCell = ws.getCell(2, 1);
  metaCell.value = `日期：${exportDate}　匯出時間：${new Date().toLocaleString("zh-TW", { hour12: false })}　工作表：${title}`;
  metaCell.font = { size: 10, color: { argb: "FF6B7280" } };
  ws.getRow(2).height = 18;

  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 22;

  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = opts.columnWidths[i] ?? 14;
  });

  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws.pageSetup.printArea = undefined; // 讓 Excel 依實際資料範圍自動列印，稍後在寫完資料後設定
}

function isDateSpec(v: CellSpec): v is DateCellSpec {
  return typeof v === "object" && v !== null && v.kind === "date";
}
function isTimeSpec(v: CellSpec): v is TimeCellSpec {
  return typeof v === "object" && v !== null && v.kind === "time";
}

function writeDataRow(ws: ExcelJS.Worksheet, rowIndex: number, values: CellSpec[]) {
  const row = ws.getRow(rowIndex);
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    if (isDateSpec(v)) {
      // 空白結束時間／日期：留白儲存格，不寫入任何值，避免被誤轉成錯誤的日期
      const parsed = v.raw ? parseDateOnly(v.raw) : null;
      if (parsed) {
        cell.value = parsed;
        cell.numFmt = DATE_NUM_FMT;
      } else {
        cell.value = null;
      }
    } else if (isTimeSpec(v)) {
      const parsed = v.raw ? parseTimeAsDate(v.raw) : null;
      if (parsed) {
        cell.value = parsed;
        cell.numFmt = TIME_NUM_FMT;
      } else {
        cell.value = null;
      }
    } else {
      cell.value = v;
    }
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = THIN_BORDER;
  });
}

function writeEmptyNotice(ws: ExcelJS.Worksheet, colCount: number, rowIndex: number) {
  ws.mergeCells(rowIndex, 1, rowIndex, colCount);
  const cell = ws.getCell(rowIndex, 1);
  cell.value = "本日無預約資料";
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.font = { italic: true, color: { argb: "FF9CA3AF" } };
  cell.border = THIN_BORDER;
  ws.getRow(rowIndex).height = 22;
}

function finalizePrintArea(ws: ExcelJS.Worksheet, lastRow: number, colCount: number) {
  const endCol = ws.getColumn(colCount).letter;
  ws.pageSetup.printArea = `A1:${endCol}${lastRow}`;
}

// ---------- 一、每日預約總表：一個服務項目占一列，同一張預約單的多個服務用相同預約單編號分列呈現 ----------

function buildDailySummarySheet(wb: ExcelJS.Workbook, date: string, rows: Reservation[]) {
  const headers = ["日期", "預約單編號", "代表隊", "服務類別", "分支項目", "開始時間", "結束時間", "人數或份數", "地點", "聯絡人", "聯絡電話", "備註"];
  const ws = wb.addWorksheet("每日預約總表");
  setupSheetPage(ws, "每日預約總表", date, headers, { columnWidths: [12, 14, 12, 10, 16, 10, 10, 10, 22, 10, 14, 26] });

  const flat = flattenRows(rows).sort((a, b) => a.entry.start_time.localeCompare(b.entry.start_time) || a.reservation.reservation_no.localeCompare(b.reservation.reservation_no));
  let r = 5;
  if (flat.length === 0) {
    writeEmptyNotice(ws, headers.length, r);
    r += 1;
  } else {
    flat.forEach(({ reservation: res, entry }) => {
      writeDataRow(ws, r, [
        dateCell(res.reservation_date),
        res.reservation_no,
        teamName(res),
        SERVICE_LABELS[entry.service],
        branchName(entry),
        timeCell(entry.start_time),
        timeCell(entry.end_time || ""),
        entry.service === "meal" && entry.meal ? entry.meal.meal_count : entry.headcount,
        entryLocation(entry),
        res.contact_person,
        res.contact_method,
        combinedNote(res, entry),
      ]);
      r += 1;
    });
  }
  finalizePrintArea(ws, r - 1, headers.length);
}

// ---------- 二、派車需求明細：交通接駁服務時段的完整明細（一個交通服務時段占一列） ----------

function buildTransportDetailSheet(wb: ExcelJS.Workbook, date: string, rows: Reservation[]) {
  const headers = [
    "預約單編號",
    "代表隊",
    "去程上車時間",
    "去程上車地點",
    "去程下車地點",
    "去程人數",
    "回程上車時間",
    "回程上車地點",
    "回程下車地點",
    "回程人數",
    "是否需要福祉車",
    "輪椅使用人數",
    "乘車人員或隊伍說明",
    "聯絡人",
    "聯絡電話",
    "備註",
  ];
  const ws = wb.addWorksheet("派車需求明細");
  setupSheetPage(ws, "派車需求明細", date, headers, {
    columnWidths: [14, 12, 10, 12, 12, 8, 10, 12, 12, 8, 10, 10, 20, 10, 14, 16],
  });

  const trans = flattenRows(rows)
    .filter((f) => f.entry.service === "transport" && f.entry.transport)
    .sort((a, b) => a.entry.start_time.localeCompare(b.entry.start_time));
  let r = 5;
  if (trans.length === 0) {
    writeEmptyNotice(ws, headers.length, r);
    r += 1;
  } else {
    trans.forEach(({ reservation: res, entry }) => {
      const t = entry.transport!;
      writeDataRow(ws, r, [
        res.reservation_no,
        teamName(res),
        timeCell(entry.start_time),
        locationLabel(t.outbound_pickup, t.outbound_pickup_other),
        locationLabel(t.outbound_dropoff, t.outbound_dropoff_other),
        t.passenger_count,
        timeCell(t.transport_type === "round_trip" ? t.return_time : ""),
        t.transport_type === "round_trip" ? locationLabel(t.return_pickup, t.return_pickup_other) : "",
        t.transport_type === "round_trip" ? locationLabel(t.return_dropoff, t.return_dropoff_other) : "",
        t.transport_type === "round_trip" ? t.return_count : "",
        t.needs_accessible_vehicle ? "是" : "否",
        t.wheelchair_count,
        t.passenger_note,
        res.contact_person,
        res.contact_method,
        res.notes,
      ]);
      r += 1;
    });
  }
  finalizePrintArea(ws, r - 1, headers.length);
}

// ---------- 三、每日派車表：比照「YYYY-MM-DD 派車」版型的時間×車輛表格 ----------

const VEHICLE_COLUMNS = ["未指定車輛", "車輛1", "車輛2", "車輛3", "車輛4", "福祉車"];
/** 目前系統設定的每日服務時間範圍（預設 08:00～20:00，每小時一列）；如果當天實際行程超出這個範圍，會自動往外延伸，確保所有行程都能被列出 */
const DEFAULT_DISPATCH_START_HOUR = 8;
const DEFAULT_DISPATCH_END_HOUR = 20;

interface DispatchTrip {
  hour: number;
  startTime: string;
  lines: string[];
}

function transportLocation(t: TransportFields, leg: "outbound" | "return"): string {
  if (leg === "outbound") {
    return `${locationLabel(t.outbound_pickup, t.outbound_pickup_other)} → ${locationLabel(t.outbound_dropoff, t.outbound_dropoff_other)}`;
  }
  return `${locationLabel(t.return_pickup || "", t.return_pickup_other)} → ${locationLabel(t.return_dropoff || "", t.return_dropoff_other)}`;
}

/** 交通接駁：單程只產生去程一筆行程；來回則去程、回程各自獨立列入派車表（保留相同預約單編號） */
function buildTransportTrips(res: Reservation, entry: ServiceEntry): DispatchTrip[] {
  const t = entry.transport!;
  const trips: DispatchTrip[] = [];
  const outboundTime = entry.start_time;
  trips.push({
    hour: Math.floor(timeToMinutesLocal(outboundTime) / 60),
    startTime: outboundTime,
    lines: [
      `${outboundTime}${t.transport_type === "round_trip" ? "（去程）" : ""}`,
      transportLocation(t, "outbound"),
      teamName(res),
      `${t.passenger_count}人${t.needs_accessible_vehicle ? "（含福祉車需求）" : ""}`,
      res.reservation_no,
      [t.passenger_note, res.notes].filter(Boolean).join("；"),
    ].filter((l) => l !== ""),
  });
  if (t.transport_type === "round_trip" && t.return_time) {
    trips.push({
      hour: Math.floor(timeToMinutesLocal(t.return_time) / 60),
      startTime: t.return_time,
      lines: [
        `${t.return_time}（回程）`,
        transportLocation(t, "return"),
        teamName(res),
        `${t.return_count}人`,
        res.reservation_no,
        [t.passenger_note, res.notes].filter(Boolean).join("；"),
      ].filter((l) => l !== ""),
    });
  }
  return trips;
}

/** 餐食外送才列入派車表（現場用餐／自取都不需要車輛，不列入） */
function buildMealDeliveryTrip(res: Reservation, entry: ServiceEntry): DispatchTrip | null {
  const m = entry.meal!;
  if (m.serve_method !== "delivery") return null;
  return {
    hour: Math.floor(timeToMinutesLocal(entry.start_time) / 60),
    startTime: entry.start_time,
    lines: [
      `${entry.start_time} [送餐]`,
      `${MEAL_TYPE_LABELS[m.meal_type]}｜${m.meal_content || "（未填寫品項）"}｜共 ${m.meal_count} 份`,
      teamName(res),
      m.serve_location,
      res.reservation_no,
      res.notes,
    ].filter((l) => l !== ""),
  };
}

function timeToMinutesLocal(t: string): number {
  const parts = t.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function buildDispatchSheet(wb: ExcelJS.Workbook, date: string, rows: Reservation[]) {
  const flat = flattenRows(rows);
  const trips: DispatchTrip[] = [];
  for (const { reservation, entry } of flat) {
    if (entry.service === "transport" && entry.transport) {
      trips.push(...buildTransportTrips(reservation, entry));
    } else if (entry.service === "meal" && entry.meal) {
      const trip = buildMealDeliveryTrip(reservation, entry);
      if (trip) trips.push(trip);
    }
  }
  trips.sort((a, b) => a.startTime.localeCompare(b.startTime));

  let startHour = DEFAULT_DISPATCH_START_HOUR;
  let endHour = DEFAULT_DISPATCH_END_HOUR;
  for (const trip of trips) {
    if (trip.hour < startHour) startHour = trip.hour;
    if (trip.hour > endHour) endHour = trip.hour;
  }

  const sheetTitle = `${date} 派車`;
  // Excel 工作表名稱不可包含 \ / ? * [ ]，且長度上限 31 字元；日期格式的標題本來就不含這些符號，長度也遠低於上限
  const ws = wb.addWorksheet(sheetTitle);
  const headers = ["時間", ...VEHICLE_COLUMNS];
  setupSheetPage(ws, sheetTitle, date, headers, { columnWidths: [10, 34, 22, 22, 22, 22, 22] });

  let r = 5;
  for (let hour = startHour; hour <= endHour; hour++) {
    const label = `${String(hour).padStart(2, "0")}:00`;
    const tripsInHour = trips.filter((t) => t.hour === hour);
    const unassignedCellText = tripsInHour.map((t) => t.lines.join("\n")).join("\n\n");
    const row = ws.getRow(r);
    row.getCell(1).value = label;
    row.getCell(1).alignment = { vertical: "top", horizontal: "center" };
    row.getCell(1).border = THIN_BORDER;
    row.getCell(1).font = { bold: true };
    // 所有接駁／送餐需求目前一律預設放入「未指定車輛」欄，其餘車輛欄留空，供下載後人工剪貼排車
    for (let col = 2; col <= headers.length; col++) {
      const cell = row.getCell(col);
      cell.value = col === 2 ? unassignedCellText || "" : "";
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      cell.border = THIN_BORDER;
    }
    const lineCount = tripsInHour.reduce((sum, t) => sum + t.lines.length + 1, 0) || 1;
    row.height = Math.max(20, lineCount * 14);
    r += 1;
  }
  if (trips.length === 0) {
    // 沒有任何接駁/送餐需求時，仍保留整張時間表格（不是顯示「本日無預約資料」，因為時間列本身就是固定格式）
  }
  ws.views = [{ state: "frozen", ySplit: 4 }];
  finalizePrintArea(ws, r - 1, headers.length);
}

// ---------- 四、餐食 ----------

function buildMealSheet(wb: ExcelJS.Workbook, date: string, rows: Reservation[]) {
  const headers = ["預約單編號", "代表隊", "餐別", "時間", "供應方式", "地點", "餐食份數", "素食份數", "餐食內容或特殊需求", "聯絡人", "備註"];
  const ws = wb.addWorksheet("餐食");
  setupSheetPage(ws, "餐食", date, headers, { columnWidths: [14, 12, 8, 8, 12, 14, 10, 10, 26, 10, 18] });

  const meals = flattenRows(rows)
    .filter((f) => f.entry.service === "meal" && f.entry.meal)
    .sort((a, b) => a.entry.start_time.localeCompare(b.entry.start_time));
  let r = 5;
  if (meals.length === 0) {
    writeEmptyNotice(ws, headers.length, r);
    r += 1;
  } else {
    let lunch = 0;
    let dinner = 0;
    let veg = 0;
    meals.forEach(({ reservation: res, entry }) => {
      const m = entry.meal!;
      writeDataRow(ws, r, [
        res.reservation_no,
        teamName(res),
        MEAL_TYPE_LABELS[m.meal_type],
        timeCell(entry.start_time),
        MEAL_SERVE_METHOD_LABELS[m.serve_method],
        m.serve_location,
        m.meal_count,
        m.vegetarian_count,
        m.meal_content,
        res.contact_person,
        res.notes,
      ]);
      if (m.meal_type === "lunch") lunch += m.meal_count;
      else dinner += m.meal_count;
      veg += m.vegetarian_count;
      r += 1;
    });
    r += 1;
    const footerLabelCell = ws.getCell(r, 1);
    ws.mergeCells(r, 1, r, 3);
    footerLabelCell.value = "合計";
    footerLabelCell.font = { bold: true };
    footerLabelCell.alignment = { vertical: "middle", horizontal: "right" };
    ws.mergeCells(r, 4, r, 7);
    const summaryCell = ws.getCell(r, 4);
    summaryCell.value = `午餐總份數 ${lunch}　晚餐總份數 ${dinner}　素食總份數 ${veg}　全日總份數 ${lunch + dinner}`;
    summaryCell.font = { bold: true };
    summaryCell.alignment = { vertical: "middle", horizontal: "left" };
  }
  finalizePrintArea(ws, r, headers.length);
}

// ---------- 五、防護治療 / 六、體能訓練 / 七、運科支援（共用格式） ----------

function buildBranchServiceSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  date: string,
  rows: Reservation[],
  service: "therapy" | "fitness" | "sports_science"
) {
  const headers = ["預約單編號", "開始時間", "結束時間", "代表隊", "分支項目", "預約人數", "需求說明", "聯絡人", "聯絡方式", "備註"];
  const ws = wb.addWorksheet(sheetName);
  setupSheetPage(ws, sheetName, date, headers, { columnWidths: [14, 10, 10, 12, 18, 8, 26, 10, 14, 18] });

  const filtered = flattenRows(rows)
    .filter((f) => f.entry.service === service)
    .sort((a, b) => a.entry.start_time.localeCompare(b.entry.start_time));
  let r = 5;
  if (filtered.length === 0) {
    writeEmptyNotice(ws, headers.length, r);
    r += 1;
  } else {
    filtered.forEach(({ reservation: res, entry }) => {
      writeDataRow(ws, r, [
        res.reservation_no,
        timeCell(entry.start_time),
        timeCell(entry.end_time || ""),
        teamName(res),
        branchName(entry),
        entry.headcount,
        requirementContent(entry),
        res.contact_person,
        res.contact_method,
        res.notes,
      ]);
      r += 1;
    });
  }
  finalizePrintArea(ws, r - 1, headers.length);
}

export async function buildDailyExportWorkbook(date: string, allReservations: Reservation[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "2026名古屋亞帕運中繼站簡易預約系統";
  wb.created = new Date();

  // 已刪除的預約本來就不會留在陣列裡；本系統沒有「取消」狀態欄位，因此不需要另外過濾取消/刪除
  const rows = allReservations.filter((r) => r.reservation_date === date);

  buildDailySummarySheet(wb, date, rows);
  buildTransportDetailSheet(wb, date, rows);
  buildDispatchSheet(wb, date, rows);
  buildMealSheet(wb, date, rows);
  buildBranchServiceSheet(wb, "防護治療", date, rows, "therapy");
  buildBranchServiceSheet(wb, "體能訓練", date, rows, "fitness");
  buildBranchServiceSheet(wb, "運科支援", date, rows, "sports_science");

  return wb;
}

export async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
