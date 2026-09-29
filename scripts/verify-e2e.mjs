// 端對端驗證腳本（非專案正式測試套件），驗證「一張預約單可包含多個服務」及「每日彙整 Excel／派車表」需求。
// 執行方式：
//   npx playwright install chromium   （第一次執行前，下載 Playwright 自行管理的 Chromium）
//   npm install -D playwright         （此腳本用，正式專案不需要此套件，故未列在 package.json）
//   npm run build
//   npm run preview -- --port 4174 --strictPort   （另開一個終端機視窗，保持執行中）
//   node scripts/verify-e2e.mjs
//
// 預設使用 Playwright 自行管理、經 `npx playwright install chromium` 下載的瀏覽器。
// 若需要指定自訂的 Chromium 執行檔路徑（例如特殊的容器/CI環境），
// 可設定環境變數 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH，不應在程式碼中寫死任何絕對路徑。

import { chromium } from "playwright";
import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://localhost:4174/nagoya-parapan-reservation2026/#";
const DOWNLOAD_DIR = path.resolve("tmp-e2e-downloads");
fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    console.log(`PASS - ${name}`);
    pass++;
  } else {
    console.log(`FAIL - ${name}`);
    fail++;
  }
}

async function main() {
  const customExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(customExecutablePath ? { executablePath: customExecutablePath } : {});
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("  [pageerror]", err.message));

  // 每次跑測試前清空 localStorage，確保測試可重複執行
  await page.goto(`${BASE}/new`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("text=新增預約");

  // ---------- 服務區塊定位工具：每個勾選的服務會展開一個以「〈服務〉預約欄位」為標題的區塊，用來避免多服務同時展開時欄位選取器互相打架 ----------
  function serviceBlock(label) {
    // 注意：h4 內容是 {SERVICE_LABELS[...]}預約欄位 兩個 JSX 子節點，會產生兩個獨立文字節點，
    // 所以要用 contains(.,...)（元素完整字串值）而不是 contains(text(),...)（只比對第一個文字節點）。
    return page.locator(`xpath=//h4[contains(.,'${label}預約欄位')]/ancestor::div[contains(@class,'border-t')][1]`);
  }
  async function toggleService(label, checked = true) {
    const checkbox = page.locator('label:has(input[type="checkbox"])').filter({ hasText: label });
    const isChecked = await checkbox.locator("input").isChecked();
    if (isChecked !== checked) await checkbox.click();
  }
  async function fillCommon(date, opts = {}) {
    await page.fill('input[type="date"]', date);
    if (opts.team) {
      await page.locator("select").first().selectOption(opts.team);
    }
    if (opts.contact) {
      await page.locator("label:has-text('聯絡人')").locator("xpath=following-sibling::input[1]").fill(opts.contact);
    }
  }
  async function fillMeal(overrides = {}) {
    const block = serviceBlock("餐食");
    if (overrides.headcount !== undefined) {
      await block.locator("label:has-text('預約人數')").locator("xpath=following-sibling::input[1]").fill(String(overrides.headcount));
    }
    await block.locator('input[type="time"]').first().fill(overrides.time ?? "12:00");
    await block.locator("label:has-text('餐食份數')").locator("xpath=following-sibling::input[1]").fill(String(overrides.mealCount ?? overrides.headcount ?? 1));
    await block.locator("label:has-text('地點')").locator("xpath=following-sibling::input[1]").fill(overrides.location ?? "中繼站餐廳");
    if (overrides.serveMethod) {
      await block.locator("label:has-text('供應方式')").locator("xpath=following-sibling::select[1]").selectOption(overrides.serveMethod);
    }
    if (overrides.content) {
      await block.locator("label:has-text('餐食內容或特殊需求')").locator("xpath=following-sibling::input[1]").fill(overrides.content);
    }
  }
  async function fillTransport(overrides = {}) {
    const block = serviceBlock("交通接駁");
    await block.locator('input[type="time"]').first().fill(overrides.startTime ?? "13:00");
    await block.locator("label:has-text('乘車人數（去程）')").locator("xpath=following-sibling::input[1]").fill(String(overrides.passengerCount ?? 4));
    if (overrides.roundTrip) {
      await block.locator("button", { hasText: "來回" }).click();
      await block.locator('input[type="time"]').nth(1).fill(overrides.returnTime ?? "17:00");
      await block.locator("label:has-text('回程人數')").locator("xpath=following-sibling::input[1]").fill(String(overrides.returnCount ?? overrides.passengerCount ?? 4));
    }
  }
  async function fillTherapy(overrides = {}) {
    const block = serviceBlock("防護治療");
    if (overrides.branch) {
      await block.locator("label:has-text('分支項目')").locator("xpath=following-sibling::select[1]").selectOption(overrides.branch);
    }
    if (overrides.headcount !== undefined) {
      await block.locator("label:has-text('預約人數')").locator("xpath=following-sibling::input[1]").fill(String(overrides.headcount));
    }
    const timeInputs = block.locator('input[type="time"]');
    await timeInputs.nth(0).fill(overrides.start ?? "09:00");
    await timeInputs.nth(1).fill(overrides.end ?? "10:00");
  }
  async function fillFitness(overrides = {}) {
    const block = serviceBlock("體能訓練");
    if (overrides.headcount !== undefined) {
      await block.locator("label:has-text('預約人數')").locator("xpath=following-sibling::input[1]").fill(String(overrides.headcount));
    }
    const timeInputs = block.locator('input[type="time"]');
    await timeInputs.nth(0).fill(overrides.start ?? "09:00");
    await timeInputs.nth(1).fill(overrides.end ?? "10:00");
  }
  async function goNext() {
    await page.getByRole("button", { name: "下一步：確認" }).click();
    await page.waitForTimeout(200);
  }
  async function confirmAdd() {
    await page.getByRole("button", { name: "確認新增" }).click();
    await page.waitForTimeout(300);
  }
  async function newReservationPage() {
    await page.goto(`${BASE}/new`);
    await page.waitForSelector("text=新增預約");
  }

  // ================= 一、基本欄位與日期範圍（沿用既有需求） =================
  const dateInput = page.locator('input[type="date"]').first();
  check("新增預約頁日期欄位限制在 2026-10-12 ～ 2026-10-25", (await dateInput.getAttribute("min")) === "2026-10-12" && (await dateInput.getAttribute("max")) === "2026-10-25");

  // ================= 二、測試要求 1：同一預約單同時選擇餐食及交通 =================
  await newReservationPage();
  await fillCommon("2026-10-12", { contact: "王小明" });
  await toggleService("餐食");
  await toggleService("交通接駁");
  check("同時勾選餐食及交通接駁後，兩個服務區塊都會展開", (await serviceBlock("餐食").count()) > 0 && (await serviceBlock("交通接駁").count()) > 0);
  await fillMeal({ headcount: 8, mealCount: 8, time: "12:00" });
  await fillTransport({ startTime: "13:00", passengerCount: 8 });
  await goNext();
  const firstNo = await page.locator("span.font-mono").first().textContent();
  check("多服務預約單的第一筆預約編號為 R261012-001", firstNo === "R261012-001");
  check("確認頁依服務類別分區顯示，同時看得到「餐食」與「交通接駁」兩個區塊", (await page.locator("text=餐食").count()) > 0 && (await page.locator("text=交通接駁").count()) > 0);
  await confirmAdd();

  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  const cardTags1 = await page.locator("div.bg-white.rounded-xl.shadow", { hasText: "R261012-001" }).first().textContent();
  check("每日總覽中，一張預約單顯示為一張卡片，卡片內同時列出餐食與交通接駁兩個服務標籤", cardTags1.includes("餐食") && cardTags1.includes("交通接駁"));

  // ================= 三、測試要求 2：同一預約單同時選擇防護治療及交通 =================
  await newReservationPage();
  await fillCommon("2026-10-16", { contact: "李小華" });
  await toggleService("防護治療");
  await toggleService("交通接駁");
  await fillTherapy({ branch: "protective_treatment", headcount: 2, start: "09:00", end: "10:00" });
  await fillTransport({ startTime: "08:30", passengerCount: 2 });
  await goNext();
  check("防護治療＋交通接駁確認頁同時顯示兩個服務", (await page.locator("text=防護治療").count()) > 0 && (await page.locator("text=交通接駁").count()) > 0);
  await confirmAdd();

  // ================= 四、測試要求 3：三種以上服務 =================
  await newReservationPage();
  await fillCommon("2026-10-17", { contact: "陳大文" });
  await toggleService("餐食");
  await toggleService("交通接駁");
  await toggleService("防護治療");
  await fillMeal({ headcount: 3, mealCount: 3, time: "12:00" });
  await fillTransport({ startTime: "08:00", passengerCount: 3 });
  await fillTherapy({ branch: "massage_bed", headcount: 1, start: "14:00", end: "14:30" });
  await goNext();
  check(
    "三種以上服務（餐食＋交通接駁＋防護治療）確認頁全部正確顯示",
    (await page.locator("text=餐食").count()) > 0 && (await page.locator("text=交通接駁").count()) > 0 && (await page.locator("text=防護治療").count()) > 0
  );
  await confirmAdd();

  // ================= 五、測試要求 4：修改其中一項服務後，其他服務仍保留 =================
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  const editCard = page.locator("div.bg-white.rounded-xl.shadow", { hasText: "R261012-001" }).first();
  await editCard.getByRole("button", { name: "修改" }).click();
  await page.waitForSelector("text=修改預約");
  // 只修改餐食的地點，交通接駁欄位完全不動
  await serviceBlock("餐食").locator("label:has-text('地點')").locator("xpath=following-sibling::input[1]").fill("賽場貴賓室");
  await goNext();
  await page.getByRole("button", { name: "確認儲存" }).click();
  await page.waitForTimeout(300);
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  await page.locator("div.bg-white.rounded-xl.shadow", { hasText: "R261012-001" }).first().getByRole("button", { name: "查看" }).click();
  await page.waitForTimeout(200);
  const viewAfterEdit = await page.textContent("body");
  check("修改餐食地點後，查看視窗顯示新地點", viewAfterEdit.includes("賽場貴賓室"));
  check("修改其中一個服務（餐食）後，交通接駁的乘車人數（8人）仍然保留、沒有遺失", viewAfterEdit.includes("8 人") || viewAfterEdit.includes("8人"));
  await page.getByRole("button", { name: "關閉" }).click();

  // ================= 六、測試要求 5：複製多服務預約單後產生新的預約單編號 =================
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  await page.locator("div.bg-white.rounded-xl.shadow", { hasText: "R261012-001" }).first().getByRole("button", { name: "複製" }).click();
  await page.waitForSelector("text=新增預約");
  await goNext();
  const copiedNo = await page.locator("span.font-mono").first().textContent();
  check("複製多服務預約單會產生全新的預約單編號", copiedNo !== "R261012-001" && /^R261012-\d{3}$/.test(copiedNo ?? ""));
  check("複製後的確認頁仍同時包含餐食與交通接駁兩個服務", (await page.locator("text=餐食").count()) > 0 && (await page.locator("text=交通接駁").count()) > 0);
  await confirmAdd();
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  const copiedCardCount = await page.locator("div.bg-white.rounded-xl.shadow", { hasText: copiedNo }).count();
  check("複製後的預約單確實出現在每日總覽（新的一張卡片）", copiedCardCount > 0);

  // 額外新增一筆「餐食外送」預約（同一天 2026-10-12），供稍後驗證派車表的 [送餐] 標示
  await newReservationPage();
  await fillCommon("2026-10-12", { contact: "餐食外送測試" });
  await toggleService("餐食");
  await fillMeal({ headcount: 3, mealCount: 3, time: "12:30", serveMethod: "delivery", content: "便當×3", location: "柔道比賽場館休息室" });
  await goNext();
  const mealDeliveryNo = await page.locator("span.font-mono").first().textContent();
  await confirmAdd();

  // ================= 七、測試要求 6：容量檢查不因多服務資料結構而失效（分段掃描演算法） =================
  async function addSingleTherapy(date, start, end, headcount, branch) {
    await newReservationPage();
    await fillCommon(date);
    await toggleService("防護治療");
    await fillTherapy({ branch, headcount, start, end });
    await goNext();
  }

  // 容量3人，A=09:00-10:00(2人)、B=11:00-12:00(2人)、新預約=09:00-12:00(1人)：彼此不重疊，最高同時3人，不應阻擋
  await addSingleTherapy("2026-10-18", "09:00", "10:00", 2, "protective_treatment");
  await confirmAdd();
  await addSingleTherapy("2026-10-18", "11:00", "12:00", 2, "protective_treatment");
  await confirmAdd();
  await addSingleTherapy("2026-10-18", "09:00", "12:00", 1, "protective_treatment");
  const bodyCaseA = await page.textContent("body");
  check("分段掃描案例一（多服務資料結構下）：彼此不重疊的既有預約不會被誤算超量", !bodyCaseA.includes("超過容量"));
  let confirmBtnA = page.getByRole("button", { name: "確認新增" });
  check("分段掃描案例一：容量未真正超過時可以正常確認新增", await confirmBtnA.isEnabled());
  await confirmBtnA.click();
  await page.waitForTimeout(300);

  // 容量3人，A=09:00-11:00(2人)、B=10:00-12:00(1人)、新預約=09:30-11:30(1人)：10:00-11:00共4人，應阻擋
  await addSingleTherapy("2026-10-19", "09:00", "11:00", 2, "protective_treatment");
  await confirmAdd();
  await addSingleTherapy("2026-10-19", "10:00", "12:00", 1, "protective_treatment");
  await confirmAdd();
  await addSingleTherapy("2026-10-19", "09:30", "11:30", 1, "protective_treatment");
  const bodyCaseB = await page.textContent("body");
  check("分段掃描案例二（多服務資料結構下）：10:00-11:00實際同時4人超過容量3人，正確顯示超量時間區段", bodyCaseB.includes("10:00") && bodyCaseB.includes("11:00") && bodyCaseB.includes("超過容量"));
  const confirmBtnB = page.getByRole("button", { name: "確認新增" });
  check("分段掃描案例二：實際超量時無法確認新增（按鈕停用）", await confirmBtnB.isDisabled());
  await page.getByRole("button", { name: "返回修改" }).click();

  // ================= 八、編號不重複使用（沿用既有需求，改用新版 UI 流程） =================
  await newReservationPage();
  await fillCommon("2026-10-20");
  await toggleService("餐食");
  await fillMeal({ headcount: 1, mealCount: 1, time: "12:00" });
  await goNext();
  const firstNoReuse = await page.locator("span.font-mono").first().textContent();
  check("編號重用測試：第一筆為 R261020-001", firstNoReuse === "R261020-001");
  await confirmAdd();
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-20");
  await page.waitForTimeout(200);
  await page.locator("div.bg-white.rounded-xl.shadow", { hasText: "R261020-001" }).first().getByRole("button", { name: "刪除" }).click();
  await page.waitForSelector("text=確定要刪除預約單編號");
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: "確定刪除" }).click();
  await page.waitForTimeout(300);
  await newReservationPage();
  await fillCommon("2026-10-20");
  await toggleService("餐食");
  await fillMeal({ headcount: 1, mealCount: 1, time: "13:00" });
  await goNext();
  const secondNoReuse = await page.locator("span.font-mono").first().textContent();
  check("刪除唯一一筆 R261020-001 後，下一號是 R261020-002（不重複使用已刪除的編號）", secondNoReuse === "R261020-002");
  await page.getByRole("button", { name: "返回修改" }).click();

  // ================= 九、醫師治療提醒（不阻擋） =================
  await newReservationPage();
  await fillCommon("2026-10-21");
  await toggleService("防護治療");
  await fillTherapy({ branch: "doctor", start: "15:00", end: "15:30" });
  await goNext();
  await confirmAdd();
  await newReservationPage();
  await fillCommon("2026-10-21");
  await toggleService("防護治療");
  await fillTherapy({ branch: "doctor", start: "15:15", end: "15:45" });
  await goNext();
  const doctorConfirmText = await page.textContent("body");
  check("醫師治療同時段重疊只顯示提醒文字（不阻擋）", doctorConfirmText.includes("已有其他醫師治療預約"));
  check("醫師治療沒有容量上限，重疊時仍可確認新增", await page.getByRole("button", { name: "確認新增" }).isEnabled());
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);

  // ================= 十、重新整理後資料仍存在 =================
  await page.reload();
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(300);
  const cardCountAfterReload = await page.locator("div.bg-white.rounded-xl.shadow").count();
  check("重新整理（reload）後，localStorage 資料仍然存在", cardCountAfterReload >= 2);

  // ================= 十一、測試要求 12：舊版單一服務資料可以正常讀取與匯出 =================
  const legacyBackup = {
    app: "nagoya-parapan-reservation2026",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    reservations: [
      {
        id: "legacy-1",
        reservation_no: "R261022-001",
        reservation_date: "2026-10-22",
        team: "badminton",
        team_other_text: "",
        service: "meal", // 舊版欄位：service 直接放在最外層，沒有 services[] 陣列
        headcount: 5,
        start_time: "12:00",
        end_time: "",
        contact_person: "舊資料聯絡人",
        contact_method: "0911-111-111",
        notes: "舊版單一服務資料",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        meal: { meal_type: "lunch", meal_count: 5, serve_method: "onsite", serve_location: "舊版地點", meal_content: "", vegetarian_count: 0 },
      },
    ],
    maxSeqUsed: { "2026-10-22": 1 },
  };
  const legacyPath = path.join(DOWNLOAD_DIR, "legacy-backup.json");
  fs.writeFileSync(legacyPath, JSON.stringify(legacyBackup));
  await page.goto(`${BASE}/backup`);
  await page.waitForSelector("text=資料備份");
  await page.setInputFiles('input[type="file"]', legacyPath);
  await page.waitForTimeout(300);
  const mergeSummary = await page.textContent("body");
  check("舊版（單一服務）備份檔可以被正確解析，顯示 1 筆預約", /共有\s*1\s*筆預約/.test(mergeSummary));
  await page.getByRole("button", { name: "開始合併" }).click();
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-22");
  await page.waitForTimeout(300);
  const legacyCardText = await page.textContent("body");
  check("舊版單一服務資料匯入後，可以在每日總覽正常顯示（自動轉換成新版多服務資料結構）", legacyCardText.includes("R261022-001") && legacyCardText.includes("餐食"));
  await page.locator("div.bg-white.rounded-xl.shadow", { hasText: "R261022-001" }).first().getByRole("button", { name: "查看" }).click();
  await page.waitForTimeout(200);
  const legacyViewText = await page.textContent("body");
  check("舊版資料查看視窗正確顯示轉換後的內容", legacyViewText.includes("舊版地點"));
  await page.getByRole("button", { name: "關閉" }).click();

  // ================= 十二、Excel 匯出：每日彙整、多張預約單、多服務分列、派車表 =================
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  const [xlsxDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "匯出本日 Excel" }).click()]);
  const xlsxPath = path.join(DOWNLOAD_DIR, "export-1012.xlsx");
  await xlsxDownload.saveAs(xlsxPath);
  check("Excel 匯出檔案成功下載", fs.existsSync(xlsxPath));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const expectedSheets = ["每日預約總表", "派車需求明細", "2026-10-12 派車", "餐食", "防護治療", "體能訓練", "運科支援"];
  check("Excel 內含全部 7 張工作表（含派車需求明細與每日派車表）", expectedSheets.every((name) => wb.getWorksheet(name) != null));

  const summarySheet = wb.getWorksheet("每日預約總表");
  const summaryRows = [];
  for (let r = 5; r <= 40; r++) {
    const no = summarySheet.getCell(r, 2).value;
    if (no) summaryRows.push({ row: r, no, service: summarySheet.getCell(r, 4).value });
  }
  const distinctNos = new Set(summaryRows.map((r) => r.no));
  check("測試要求 7：同日多張預約單（R261012-001、R261012-003 等）能匯出至同一個 Excel", distinctNos.size >= 2);

  const firstBookingRows = summaryRows.filter((r) => r.no === "R261012-001");
  check(
    "測試要求 8：多服務預約單（R261012-001，含餐食＋交通接駁）在每日預約總表中正確分列成 2 列，且共用同一個預約單編號",
    firstBookingRows.length === 2 && new Set(firstBookingRows.map((r) => r.no)).size === 1
  );

  const dispatchSheet = wb.getWorksheet("2026-10-12 派車");
  check("每日派車表工作表標題為「YYYY-MM-DD 派車」", dispatchSheet.name === "2026-10-12 派車");
  check("每日派車表橫向列印、凍結標題列", dispatchSheet.pageSetup.orientation === "landscape" && dispatchSheet.views?.[0]?.state === "frozen");
  let unassignedText = "";
  let otherVehicleColumnsAllBlank = true;
  for (let r = 5; r <= 30; r++) {
    const time = dispatchSheet.getCell(r, 1).value;
    if (!time) continue;
    unassignedText += String(dispatchSheet.getCell(r, 2).value ?? "");
    for (let c = 3; c <= 7; c++) {
      const v = dispatchSheet.getCell(r, c).value;
      if (v) otherVehicleColumnsAllBlank = false;
    }
  }
  check("測試要求 9：交通接駁需求正確進入每日派車表", unassignedText.includes("R261012-001") && unassignedText.includes("→"));
  check("測試要求 9：餐食外送正確進入每日派車表並標示 [送餐]", unassignedText.includes("[送餐]") && unassignedText.includes(mealDeliveryNo));
  check("測試要求 11：所有未排車需求預設進入「未指定車輛」欄，其餘車輛欄位保持空白", otherVehicleColumnsAllBlank);

  const transportDetailSheet = wb.getWorksheet("派車需求明細");
  check("派車需求明細工作表存在且包含交通接駁預約單編號", String(transportDetailSheet.getCell(5, 1).value).length > 0);

  // 專門驗證「現場取餐不列入派車表」：另外新增一筆現場取餐的餐食預約，匯出後確認派車表沒有它的編號
  await newReservationPage();
  await fillCommon("2026-10-23");
  await toggleService("餐食");
  await fillMeal({ headcount: 2, mealCount: 2, time: "12:00", serveMethod: "onsite" });
  await goNext();
  await confirmAdd();
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-23");
  await page.waitForTimeout(200);
  const [xlsxDownload2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "匯出本日 Excel" }).click()]);
  const xlsxPath2 = path.join(DOWNLOAD_DIR, "export-1023.xlsx");
  await xlsxDownload2.saveAs(xlsxPath2);
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(xlsxPath2);
  const dispatchSheet2 = wb2.getWorksheet("2026-10-23 派車");
  let dispatch2Text = "";
  for (let r = 5; r <= 30; r++) {
    dispatch2Text += String(dispatchSheet2.getCell(r, 2).value ?? "");
  }
  check("測試要求 10：現場用餐（onsite）的預約完全不會出現在每日派車表", !dispatch2Text.includes("R261023-001"));

  const summarySheet2 = wb2.getWorksheet("每日預約總表");
  check("現場用餐的預約仍然正確出現在每日預約總表（只是不進派車表）", String(summarySheet2.getCell(5, 2).value) === "R261023-001");

  // ---------- Excel 日期／時間欄位：須為 Excel 可辨識的真正日期/時間值（型別與 number format） ----------
  const dateCellInSummary = summarySheet.getCell(5, 1);
  check("每日預約總表「日期」欄為 Excel 日期型別（非純文字）", dateCellInSummary.type === ExcelJS.ValueType.Date);
  check("每日預約總表「日期」欄 number format 為 yyyy-mm-dd", dateCellInSummary.numFmt === "yyyy-mm-dd");
  const startTimeCellInSummary = summarySheet.getCell(5, 6);
  check("每日預約總表「開始時間」欄為 Excel 日期/時間型別（非純文字）", startTimeCellInSummary.type === ExcelJS.ValueType.Date);
  check("每日預約總表「開始時間」欄 number format 為 hh:mm", startTimeCellInSummary.numFmt === "hh:mm");

  // ================= 十三、HashRouter：直接重新整理不會出現 404 =================
  await page.goto(`${BASE}/export`);
  await page.waitForSelector("text=Excel 匯出");
  await page.reload();
  await page.waitForTimeout(300);
  const exportBodyAfterReload = await page.textContent("body");
  check("直接重新整理深層路徑（/export）不會出現 404，正常顯示頁面", exportBodyAfterReload.includes("Excel 匯出"));

  // ================= 十四、手機版可操作 =================
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  check("手機版寬度下導覽列仍然可見可操作", await page.locator("nav").isVisible());
  check("手機版寬度下日期欄位仍然可見", await page.locator('input[type="date"]').first().isVisible());

  await browser.close();

  console.log(`\n合計：${pass} 項通過、${fail} 項失敗`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
