import ExcelJS from "exceljs";
import {
  FITNESS_BRANCH_LABELS,
  MEAL_SERVE_METHOD_LABELS,
  MEAL_TYPE_LABELS,
  Reservation,
  SERVICE_LABELS,
  SPORTS_SCIENCE_BRANCH_LABELS,
  TEAM_LABELS,
  THERAPY_BRANCH_LABELS,
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

function branchName(r: Reservation): string {
  if (r.service === "therapy" && r.therapy) return THERAPY_BRANCH_LABELS[r.therapy.therapy_branch];
  if (r.service === "fitness" && r.fitness) return FITNESS_BRANCH_LABELS[r.fitness.fitness_branch];
  if (r.service === "sports_science" && r.sportsScience) return SPORTS_SCIENCE_BRANCH_LABELS[r.sportsScience.sports_science_branch];
  return "";
}

function requirementContent(r: Reservation): string {
  if (r.service === "meal" && r.meal) return r.meal.meal_content;
  if (r.service === "transport" && r.transport) return r.transport.passenger_note;
  if (r.service === "therapy" && r.therapy) return r.therapy.requirement_note;
  if (r.service === "fitness" && r.fitness) return r.fitness.training_requirement;
  if (r.service === "sports_science" && r.sportsScience) return r.sportsScience.requirement_note;
  return "";
}

function locationLabel(code: string, other: string): string {
  if (!code) return "";
  if (code === "other") return other || "其他";
  return TRANSPORT_LOCATION_LABELS[code as keyof typeof TRANSPORT_LOCATION_LABELS] ?? code;
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

// ---------- 每日預約總表 ----------

function buildDailySummarySheet(wb: ExcelJS.Workbook, date: string, rows: Reservation[]) {
  const headers = ["序號", "預約單編號", "日期", "開始時間", "結束時間", "代表隊", "服務項目", "分支項目", "預約人數", "聯絡人", "聯絡方式", "需求內容", "備註"];
  const ws = wb.addWorksheet("每日預約總表");
  setupSheetPage(ws, "每日預約總表", date, headers, { columnWidths: [6, 14, 12, 10, 10, 12, 10, 16, 8, 10, 14, 26, 20] });

  const sorted = [...rows].sort((a, b) => a.start_time.localeCompare(b.start_time));
  let r = 5;
  if (sorted.length === 0) {
    writeEmptyNotice(ws, headers.length, r);
    r += 1;
  } else {
    sorted.forEach((res, idx) => {
      writeDataRow(ws, r, [
        idx + 1,
        res.reservation_no,
        dateCell(res.reservation_date),
        timeCell(res.start_time),
        timeCell(res.end_time || ""),
        teamName(res),
        SERVICE_LABELS[res.service],
        branchName(res),
        res.headcount,
        res.contact_person,
        res.contact_method,
        requirementContent(res),
        res.notes,
      ]);
      r += 1;
    });
  }
  finalizePrintArea(ws, r - 1, headers.length);
}

// ---------- 餐食 ----------

function buildMealSheet(wb: ExcelJS.Workbook, date: string, rows: Reservation[]) {
  const headers = ["序號", "預約單編號", "代表隊", "餐別", "時間", "供應方式", "地點", "餐食份數", "素食份數", "餐食內容或特殊需求", "聯絡人", "備註"];
  const ws = wb.addWorksheet("餐食");
  setupSheetPage(ws, "餐食", date, headers, { columnWidths: [6, 14, 12, 8, 8, 12, 14, 10, 10, 26, 10, 18] });

  const meals = rows.filter((r) => r.service === "meal" && r.meal).sort((a, b) => a.start_time.localeCompare(b.start_time));
  let r = 5;
  if (meals.length === 0) {
    writeEmptyNotice(ws, headers.length, r);
    r += 1;
  } else {
    let lunch = 0;
    let dinner = 0;
    let veg = 0;
    meals.forEach((res, idx) => {
      const m = res.meal!;
      writeDataRow(ws, r, [
        idx + 1,
        res.reservation_no,
        teamName(res),
        MEAL_TYPE_LABELS[m.meal_type],
        timeCell(res.start_time),
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
    ws.mergeCells(r, 1, r, 4);
    footerLabelCell.value = "合計";
    footerLabelCell.font = { bold: true };
    footerLabelCell.alignment = { vertical: "middle", horizontal: "right" };
    ws.mergeCells(r, 5, r, 8);
    const summaryCell = ws.getCell(r, 5);
    summaryCell.value = `午餐總份數 ${lunch}　晚餐總份數 ${dinner}　素食總份數 ${veg}　全日總份數 ${lunch + dinner}`;
    summaryCell.font = { bold: true };
    summaryCell.alignment = { vertical: "middle", horizontal: "left" };
  }
  finalizePrintArea(ws, r, headers.length);
}

// ---------- 交通接駁 ----------

function buildTransportSheet(wb: ExcelJS.Workbook, date: string, rows: Reservation[]) {
  const headers = [
    "序號",
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
    "備註",
    "車輛安排",
    "派車備註",
  ];
  const ws = wb.addWorksheet("交通接駁");
  setupSheetPage(ws, "交通接駁", date, headers, {
    columnWidths: [6, 14, 12, 10, 12, 12, 8, 10, 12, 12, 8, 10, 10, 20, 10, 16, 14, 16],
  });

  const trans = rows.filter((r) => r.service === "transport" && r.transport).sort((a, b) => a.start_time.localeCompare(b.start_time));
  let r = 5;
  if (trans.length === 0) {
    writeEmptyNotice(ws, headers.length, r);
    r += 1;
  } else {
    trans.forEach((res, idx) => {
      const t = res.transport!;
      writeDataRow(ws, r, [
        idx + 1,
        res.reservation_no,
        teamName(res),
        timeCell(res.start_time),
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
        res.notes,
        "",
        "",
      ]);
      r += 1;
    });
  }
  finalizePrintArea(ws, r - 1, headers.length);
}

// ---------- 防護治療 / 體能訓練 / 運科支援（共用格式） ----------

function buildBranchServiceSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  date: string,
  rows: Reservation[],
  service: "therapy" | "fitness" | "sports_science"
) {
  const headers = ["序號", "預約單編號", "開始時間", "結束時間", "代表隊", "分支項目", "預約人數", "需求說明", "聯絡人", "聯絡方式", "備註"];
  const ws = wb.addWorksheet(sheetName);
  setupSheetPage(ws, sheetName, date, headers, { columnWidths: [6, 14, 10, 10, 12, 18, 8, 26, 10, 14, 18] });

  const filtered = rows.filter((r) => r.service === service).sort((a, b) => a.start_time.localeCompare(b.start_time));
  let r = 5;
  if (filtered.length === 0) {
    writeEmptyNotice(ws, headers.length, r);
    r += 1;
  } else {
    filtered.forEach((res, idx) => {
      writeDataRow(ws, r, [
        idx + 1,
        res.reservation_no,
        timeCell(res.start_time),
        timeCell(res.end_time || ""),
        teamName(res),
        branchName(res),
        res.headcount,
        requirementContent(res),
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

  const rows = allReservations.filter((r) => r.reservation_date === date);

  buildDailySummarySheet(wb, date, rows);
  buildMealSheet(wb, date, rows);
  buildTransportSheet(wb, date, rows);
  buildBranchServiceSheet(wb, "防護治療", date, rows, "therapy");
  buildBranchServiceSheet(wb, "體能訓練", date, rows, "fitness");
  buildBranchServiceSheet(wb, "運科支援", date, rows, "sports_science");

  return wb;
}

export async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
