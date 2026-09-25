// 端對端驗證腳本（非專案正式測試套件），對照需求書「二十四、測試要求」逐項檢查。
// 執行方式：
//   npx playwright install chromium   （第一次執行前，下載 Playwright 自行管理的 Chromium）
//   npm install -D playwright   （此腳本用，正式專案不需要此套件，故未列在 package.json）
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

  // ---------- 1) 日期只能選 2026/10/12 至 2026/10/25 ----------
  const dateInput = page.locator('input[type="date"]').first();
  const minAttr = await dateInput.getAttribute("min");
  const maxAttr = await dateInput.getAttribute("max");
  check("新增預約頁日期欄位限制在 2026-10-12 ～ 2026-10-25", minAttr === "2026-10-12" && maxAttr === "2026-10-25");

  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  const overviewDateInput = page.locator('input[type="date"]').first();
  check(
    "每日預約總覽頁日期欄位也限制在活動日期範圍內",
    (await overviewDateInput.getAttribute("min")) === "2026-10-12" && (await overviewDateInput.getAttribute("max")) === "2026-10-25"
  );

  // ---------- 2) 每日預約編號正確遞增 + 4) 新增可正常使用 + 5) 各服務分支正確顯示 ----------
  async function fillCommon(date, teamButtonMaybe) {
    await page.fill('input[type="date"]', date);
  }

  async function clickService(label) {
    await page.getByRole("button", { name: label, exact: true }).click();
  }

  // 第一筆：餐食
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await fillCommon("2026-10-12");
  await clickService("餐食");
  check("選擇「餐食」後顯示餐食專屬欄位", await page.locator("text=用餐／送餐時間").count() > 0);
  await page.fill('input[type="number"]', "1"); // 預約人數
  await page.locator('input[type="time"]').first().fill("12:00");
  const mealCountInput = page.locator("text=餐食份數").locator("xpath=following::input[@type='number'][1]");
  await mealCountInput.fill("4");
  await page.locator("text=地點").locator("xpath=following::input[1]").fill("中繼站餐廳");
  await page.getByRole("button", { name: "下一步：確認" }).click();
  await page.waitForTimeout(200);
  let genNo = await page.locator("span.font-mono").first().textContent();
  check("第一筆預約編號為 R261012-001", genNo === "R261012-001");
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);

  // 第二筆：交通接駁（同一天）
  await page.getByRole("button", { name: "繼續新增" }).click();
  await clickService("交通接駁");
  check("選擇「交通接駁」後顯示交通接駁專屬欄位", await page.locator("text=去程上車地點").count() > 0);
  check("交通接駁不顯示共用「預約人數」欄位（以去程乘車人數為主要人數）", (await page.locator("label:has-text('預約人數')").count()) === 0);
  await page.locator('input[type="time"]').first().fill("08:30");
  const passengerCountInput = page.locator("text=乘車人數（去程）").locator("xpath=following::input[@type='number'][1]");
  await passengerCountInput.fill("6");
  await page.getByRole("button", { name: "下一步：確認" }).click();
  await page.waitForTimeout(200);
  genNo = await page.locator("span.font-mono").first().textContent();
  check("同一天第二筆預約編號正確遞增為 R261012-002", genNo === "R261012-002");
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);

  // ---------- 6/7/8/9) 容量檢查 ----------
  async function addTherapyReservation(date, start, end, headcount, branchValue) {
    await page.goto(`${BASE}/new`);
    await page.waitForSelector("text=新增預約");
    await page.fill('input[type="date"]', date);
    await clickService("防護治療");
    const branchSelect = page.locator("label:has-text('分支項目')").locator("xpath=following-sibling::select[1]");
    await branchSelect.selectOption(branchValue);
    const headcountInput = page.locator("label:has-text('預約人數')").locator("xpath=following-sibling::input[1]");
    await headcountInput.fill(String(headcount));
    const timeInputs = page.locator('input[type="time"]');
    await timeInputs.nth(0).fill(start);
    await timeInputs.nth(1).fill(end);
    await page.getByRole("button", { name: "下一步：確認" }).click();
    await page.waitForTimeout(200);
  }

  // 防護處置與物理治療容量 3 人。09:00-10:00 先放 2 人，應該可以確認新增。
  await addTherapyReservation("2026-10-13", "09:00", "10:00", 2, "protective_treatment");
  let confirmBtn = page.getByRole("button", { name: "確認新增" });
  check("不重疊/未超量時段：容量內的預約可以確認新增", await confirmBtn.isEnabled());
  await confirmBtn.click();
  await page.waitForTimeout(300);

  // 再新增一筆 09:30-10:30（部分重疊）1 人 → 累計 3 人，剛好等於容量，應可confirm
  await page.getByRole("button", { name: "繼續新增" }).click();
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await addTherapyReservation("2026-10-13", "09:30", "10:30", 1, "protective_treatment");
  confirmBtn = page.getByRole("button", { name: "確認新增" });
  check("跨越部分時段、剛好等於容量上限時仍可確認新增（不誤判超量）", await confirmBtn.isEnabled());
  await confirmBtn.click();
  await page.waitForTimeout(300);

  // 再新增一筆 09:45-10:15（部分重疊）1 人 → 累計超過 3 人，應該擋下
  await page.getByRole("button", { name: "繼續新增" }).click();
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await addTherapyReservation("2026-10-13", "09:45", "10:15", 1, "protective_treatment");
  const bodyTextCapacity = await page.textContent("body");
  check("重疊時段合計超過容量時顯示超量警示", bodyTextCapacity.includes("超過容量"));
  confirmBtn = page.getByRole("button", { name: "確認新增" });
  check("重疊時段合計超過容量時無法確認新增（按鈕停用）", await confirmBtn.isDisabled());

  // 不重疊時段（11:00-12:00）不應該被誤判為衝突
  await page.getByRole("button", { name: "返回修改" }).click();
  await page.fill('input[type="date"]', "2026-10-13");
  const timeInputsNoOverlap = page.locator('input[type="time"]');
  await timeInputsNoOverlap.nth(0).fill("11:00");
  await timeInputsNoOverlap.nth(1).fill("12:00");
  await page.getByRole("button", { name: "下一步：確認" }).click();
  await page.waitForTimeout(200);
  confirmBtn = page.getByRole("button", { name: "確認新增" });
  check("不重疊時段不會被誤判為超量，可正常確認新增", await confirmBtn.isEnabled());
  await confirmBtn.click();
  await page.waitForTimeout(300);

  // ---------- 分段掃描容量演算法：需求書明確指定的 4 個測試案例 ----------
  // 案例一：容量3人。A=09:00-10:00(2人)、B=11:00-12:00(2人)、新預約=09:00-12:00(1人)。
  // A、B彼此不重疊，實際最高同時人數只有3人（A+新 或 B+新），不應阻擋（舊演算法會誤算成5人並阻擋）。
  await addTherapyReservation("2026-10-14", "09:00", "10:00", 2, "protective_treatment");
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "繼續新增" }).click();
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await addTherapyReservation("2026-10-14", "11:00", "12:00", 2, "protective_treatment");
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "繼續新增" }).click();
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await addTherapyReservation("2026-10-14", "09:00", "12:00", 1, "protective_treatment");
  const bodyCaseA = await page.textContent("body");
  check("分段掃描案例一：A(09-10,2人)、B(11-12,2人)彼此不重疊，新預約(09-12,1人)實際最高同時3人不阻擋，不顯示超量警示", !bodyCaseA.includes("超過容量"));
  let confirmBtnCaseA = page.getByRole("button", { name: "確認新增" });
  check("分段掃描案例一：可以正常確認新增", await confirmBtnCaseA.isEnabled());
  await confirmBtnCaseA.click();
  await page.waitForTimeout(300);

  // 案例二：容量3人。A=09:00-11:00(2人)、B=10:00-12:00(1人)、新預約=09:30-11:30(1人)。
  // 10:00-11:00 這個時段同時有 A+B+新 共4人，超過容量3人，應該阻擋，且警示須顯示真正超量的時間區段。
  await page.getByRole("button", { name: "繼續新增" }).click();
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await addTherapyReservation("2026-10-15", "09:00", "11:00", 2, "protective_treatment");
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "繼續新增" }).click();
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await addTherapyReservation("2026-10-15", "10:00", "12:00", 1, "protective_treatment");
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "繼續新增" }).click();
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await addTherapyReservation("2026-10-15", "09:30", "11:30", 1, "protective_treatment");
  const bodyCaseB = await page.textContent("body");
  check("分段掃描案例二：10:00-11:00時段實際同時4人超過容量3人，正確顯示該超量時間區段", bodyCaseB.includes("10:00") && bodyCaseB.includes("11:00") && bodyCaseB.includes("超過容量"));
  check("分段掃描案例二：正確顯示該超量時段的人數為4人", bodyCaseB.includes("4 人"));
  const confirmBtnCaseB = page.getByRole("button", { name: "確認新增" });
  check("分段掃描案例二：實際超量時無法確認新增（按鈕停用）", await confirmBtnCaseB.isDisabled());
  await page.getByRole("button", { name: "返回修改" }).click();

  // ---------- 3) 重新整理後資料仍存在 ----------
  await page.reload();
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(300);
  let rowCount = await page.locator("table tbody tr").count();
  check("重新整理（reload）後，localStorage 資料仍然存在", rowCount >= 2);

  // ---------- 10) 每日統計數字正確 ----------
  const bodyOverview = await page.textContent("body");
  check("每日統計卡片顯示全部預約筆數", bodyOverview.includes("全部預約筆數"));
  const mealStatCard = page.locator("text=餐食總份數").locator("xpath=following-sibling::p[1]");
  check("餐食總份數統計正確（應為 4）", (await mealStatCard.textContent()) === "4");
  const transportStatCard = page.locator("text=交通接駁人次").locator("xpath=following-sibling::p[1]");
  check("交通接駁人次統計正確（應為 6，單程無回程人數）", (await transportStatCard.textContent()) === "6");

  // ---------- 4) 修改、複製、刪除 ----------
  const firstRow = page.locator("table tbody tr").first();
  await firstRow.getByRole("button", { name: "修改" }).click();
  await page.waitForSelector("text=修改預約");
  const notesArea = page.locator("textarea").first();
  await notesArea.fill("已透過自動化測試修改備註");
  await page.getByRole("button", { name: "下一步：確認" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "確認儲存" }).click();
  await page.waitForTimeout(300);
  // 備註不會顯示在總覽列表欄位中，因此透過「查看」開啟詳細內容視窗，實際確認修改後內容是否存在
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  await page.locator("table tbody tr").first().getByRole("button", { name: "查看" }).click();
  await page.waitForTimeout(200);
  const modalText = await page.textContent("body");
  check("查看預約內容可以看到修改後的備註", modalText.includes("已透過自動化測試修改備註"));
  await page.getByRole("button", { name: "關閉" }).click();

  const rowCountBeforeCopy = await page.locator("table tbody tr").count();
  await page.locator("table tbody tr").first().getByRole("button", { name: "複製" }).click();
  await page.waitForSelector("text=新增預約");
  await page.getByRole("button", { name: "下一步：確認" }).click();
  await page.waitForTimeout(200);
  const copiedNo = await page.locator("span.font-mono").first().textContent();
  check("複製功能會產生全新的預約單編號（不是 R261012-001）", copiedNo !== "R261012-001" && /^R261012-\d{3}$/.test(copiedNo ?? ""));
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  const rowCountAfterCopy = await page.locator("table tbody tr").count();
  check("複製後總筆數增加 1 筆", rowCountAfterCopy === rowCountBeforeCopy + 1);

  // 明確刪除「剛剛複製產生」的那一筆（以其預約單編號鎖定該列），避免誤刪其他既有預約（例如用 last() 依時間排序可能剛好刪到餐食資料）
  const rowToDelete = page.locator("table tbody tr", { hasText: copiedNo ?? "" });
  await rowToDelete.getByRole("button", { name: "刪除" }).click();
  await page.waitForSelector("text=確定要刪除預約單編號");
  const deleteConfirmBtn = page.getByRole("button", { name: "確定刪除" });
  check("刪除確認按鈕預設是停用的（需要勾選才能刪除）", await deleteConfirmBtn.isDisabled());
  await page.locator('input[type="checkbox"]').first().check();
  await deleteConfirmBtn.click();
  await page.waitForTimeout(300);
  const rowCountAfterDelete = await page.locator("table tbody tr").count();
  check("刪除功能可以正常運作，筆數減少 1 筆", rowCountAfterDelete === rowCountAfterCopy - 1);

  // ---------- 14) JSON 備份及還原正常 ----------
  await page.goto(`${BASE}/backup`);
  await page.waitForSelector("text=資料備份");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "下載備份（JSON）" }).click()]);
  const backupPath = path.join(DOWNLOAD_DIR, "backup.json");
  await download.saveAs(backupPath);
  check("備份 JSON 檔案成功下載", fs.existsSync(backupPath));
  const backupContent = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  check("備份檔案格式正確（app 標記與 reservations 陣列）", backupContent.app === "nagoya-parapan-reservation2026" && Array.isArray(backupContent.reservations));

  const clearInput = page.locator('input[placeholder="請輸入「確認清除」"]');
  await clearInput.fill("確認清除");
  await page.getByRole("button", { name: "清除全部資料" }).click();
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  const overviewAfterClearText = await page.textContent("body");
  check("清除全部資料後，總覽頁顯示沒有資料", overviewAfterClearText.includes("這天沒有符合篩選條件的預約資料"));

  await page.goto(`${BASE}/backup`);
  await page.waitForSelector("text=資料備份");
  await page.setInputFiles('input[type="file"]', backupPath);
  await page.waitForTimeout(300);
  const summaryText = await page.textContent("body");
  check("匯入備份前會顯示資料筆數及日期範圍", /共有\s*\d+\s*筆預約/.test(summaryText) && /日期範圍/.test(summaryText));
  await page.getByRole("button", { name: "確定取代" }).click();
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-12");
  await page.waitForTimeout(200);
  const rowCountAfterRestore = await page.locator("table tbody tr").count();
  check("還原備份後資料正確回復", rowCountAfterRestore > 0);

  // ---------- 15) HashRouter：重新整理不會出現 404 ----------
  await page.goto(`${BASE}/export`);
  await page.waitForSelector("text=Excel 匯出");
  await page.reload();
  await page.waitForTimeout(300);
  const exportBodyAfterReload = await page.textContent("body");
  check("直接重新整理深層路徑（/export）不會出現 404，正常顯示頁面", exportBodyAfterReload.includes("Excel 匯出"));

  // ---------- 11/12/13) Excel 匯出 ----------
  await page.fill('input[type="date"]', "2026-10-12");
  const [xlsxDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "匯出當日預約" }).click()]);
  const xlsxPath = path.join(DOWNLOAD_DIR, "export.xlsx");
  await xlsxDownload.saveAs(xlsxPath);
  check("Excel 匯出檔案成功下載", fs.existsSync(xlsxPath));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const expectedSheets = ["每日預約總表", "餐食", "交通接駁", "防護治療", "體能訓練", "運科支援"];
  check("Excel 內含全部 6 張工作表", expectedSheets.every((name) => wb.getWorksheet(name) != null));

  const mealSheet = wb.getWorksheet("餐食");
  check("餐食工作表標題列存在（第 4 列為欄位標題）", mealSheet.getCell(4, 1).value === "序號");
  check("餐食工作表可以看到餐食資料（非「本日無預約資料」的留白提示）", mealSheet.getCell(5, 3).value !== "本日無預約資料" && mealSheet.getCell(5, 8).value != null);

  const fitnessSheet = wb.getWorksheet("體能訓練");
  // 2026-10-12 沒有體能訓練預約，應顯示「本日無預約資料」
  let fitnessHasEmptyNotice = false;
  fitnessSheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value === "本日無預約資料") fitnessHasEmptyNotice = true;
    });
  });
  check("無預約資料的服務工作表仍存在，並顯示「本日無預約資料」", fitnessHasEmptyNotice);

  const summarySheet = wb.getWorksheet("每日預約總表");
  check("每日預約總表標題列文字正確", String(summarySheet.getCell(1, 1).value).includes("2026名古屋亞帕運中繼站預約清單"));
  check("每日預約總表凍結窗格已設定", summarySheet.views?.[0]?.state === "frozen");
  check("每日預約總表設定為橫向列印", summarySheet.pageSetup.orientation === "landscape");
  check("每日預約總表設定為縮放至一頁寬", summarySheet.pageSetup.fitToWidth === 1);

  // ---------- Excel 日期／時間欄位：須為 Excel 可辨識的真正日期/時間值（型別與 number format），不只是顯示文字 ----------
  const dateCellInSummary = summarySheet.getCell(5, 3); // 日期欄
  check("每日預約總表「日期」欄為 Excel 日期型別（非純文字）", dateCellInSummary.type === ExcelJS.ValueType.Date);
  check("每日預約總表「日期」欄 number format 為 yyyy-mm-dd", dateCellInSummary.numFmt === "yyyy-mm-dd");

  const startTimeCellInSummary = summarySheet.getCell(5, 4); // 開始時間欄（第一筆為餐食 12:00）
  check("每日預約總表「開始時間」欄為 Excel 日期/時間型別（非純文字）", startTimeCellInSummary.type === ExcelJS.ValueType.Date);
  check("每日預約總表「開始時間」欄 number format 為 hh:mm", startTimeCellInSummary.numFmt === "hh:mm");

  const endTimeCellInSummary = summarySheet.getCell(5, 5); // 結束時間欄（餐食沒有結束時間，應留白）
  check(
    "每日預約總表：餐食服務沒有結束時間，儲存格保持留白，不得被誤轉成錯誤的日期/時間值",
    endTimeCellInSummary.value === null || endTimeCellInSummary.value === undefined
  );

  const mealSheetForType = wb.getWorksheet("餐食");
  const mealTimeCell = mealSheetForType.getCell(5, 5); // 「時間」欄
  check("餐食工作表「時間」欄為 Excel 日期/時間型別", mealTimeCell.type === ExcelJS.ValueType.Date);
  check("餐食工作表「時間」欄 number format 為 hh:mm（畫面顯示仍為24小時制）", mealTimeCell.numFmt === "hh:mm");

  const transportSheetForType = wb.getWorksheet("交通接駁");
  const transportStartCell = transportSheetForType.getCell(5, 4); // 去程上車時間
  check("交通接駁工作表「去程上車時間」欄為 Excel 日期/時間型別", transportStartCell.type === ExcelJS.ValueType.Date);
  check("交通接駁工作表「去程上車時間」欄 number format 為 hh:mm", transportStartCell.numFmt === "hh:mm");
  const transportReturnCell = transportSheetForType.getCell(5, 8); // 回程上車時間（此筆為單程，應留白）
  check(
    "交通接駁工作表：單程預約沒有回程時間，儲存格保持留白，不得被誤轉成錯誤的日期/時間值",
    transportReturnCell.value === null || transportReturnCell.value === undefined
  );

  // Excel 可依日期及時間正確排序：驗證日期/時間欄位底層儲存的是可比較的數字（日期序號／時間分率），而非字串
  check("每日預約總表「日期」欄底層為可供 Excel 排序比較的日期數值", dateCellInSummary.value instanceof Date);
  check("每日預約總表「開始時間」欄底層為可供 Excel 排序比較的時間數值", startTimeCellInSummary.value instanceof Date);

  // ---------- 16) 手機版可操作（縮小視窗檢查版面） ----------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  const navVisible = await page.locator("nav").isVisible();
  check("手機版寬度下導覽列仍然可見可操作", navVisible);
  const dateInputMobile = page.locator('input[type="date"]').first();
  check("手機版寬度下日期欄位仍然可見", await dateInputMobile.isVisible());

  // ---------- 刪除舊預約後，不得重新使用已經使用過的編號 ----------
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await page.fill('input[type="date"]', "2026-10-20");
  await clickService("餐食");
  const headcountInputReuse = page.locator("label:has-text('預約人數')").locator("xpath=following-sibling::input[1]");
  await headcountInputReuse.fill("1");
  await page.locator('input[type="time"]').first().fill("12:00");
  await page.locator("text=餐食份數").locator("xpath=following::input[@type='number'][1]").fill("1");
  await page.locator("text=地點").locator("xpath=following::input[1]").fill("中繼站餐廳");
  await page.getByRole("button", { name: "下一步：確認" }).click();
  await page.waitForTimeout(200);
  const firstNoReuse = await page.locator("span.font-mono").first().textContent();
  check("編號重用測試：第一筆為 R261020-001", firstNoReuse === "R261020-001");
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/overview`);
  await page.waitForSelector("text=每日預約總覽");
  await page.fill('input[type="date"]', "2026-10-20");
  await page.waitForTimeout(200);
  await page.locator("table tbody tr").first().getByRole("button", { name: "刪除" }).click();
  await page.waitForSelector("text=確定要刪除預約單編號");
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: "確定刪除" }).click();
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/new`);
  await page.waitForSelector("text=新增預約");
  await page.fill('input[type="date"]', "2026-10-20");
  await clickService("餐食");
  await headcountInputReuse.fill("1");
  await page.locator('input[type="time"]').first().fill("13:00");
  await page.locator("text=餐食份數").locator("xpath=following::input[@type='number'][1]").fill("1");
  await page.locator("text=地點").locator("xpath=following::input[1]").fill("中繼站餐廳");
  await page.getByRole("button", { name: "下一步：確認" }).click();
  await page.waitForTimeout(200);
  const secondNoReuse = await page.locator("span.font-mono").first().textContent();
  check("刪除唯一一筆 R261020-001 後，下一號是 R261020-002（不重複使用已刪除的編號）", secondNoReuse === "R261020-002");
  await page.getByRole("button", { name: "返回修改" }).click();

  // ---------- 醫師治療：不做容量阻擋，但提醒同時段已有其他醫師治療預約 ----------
  await page.fill('input[type="date"]', "2026-10-21");
  await clickService("防護治療");
  const doctorBranchSelect = page.locator("label:has-text('分支項目')").locator("xpath=following-sibling::select[1]");
  await doctorBranchSelect.selectOption("doctor");
  const timeInputsDoctor1 = page.locator('input[type="time"]');
  await timeInputsDoctor1.nth(0).fill("15:00");
  await timeInputsDoctor1.nth(1).fill("15:30");
  await page.getByRole("button", { name: "下一步：確認" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "確認新增" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "繼續新增" }).click();
  await page.fill('input[type="date"]', "2026-10-21");
  await clickService("防護治療");
  const doctorBranchSelect2 = page.locator("label:has-text('分支項目')").locator("xpath=following-sibling::select[1]");
  await doctorBranchSelect2.selectOption("doctor");
  const timeInputsDoctor2 = page.locator('input[type="time"]');
  await timeInputsDoctor2.nth(0).fill("15:15");
  await timeInputsDoctor2.nth(1).fill("15:45");
  await page.getByRole("button", { name: "下一步：確認" }).click();
  await page.waitForTimeout(200);
  const doctorConfirmText = await page.textContent("body");
  check("醫師治療同時段重疊只顯示提醒文字（不阻擋）", doctorConfirmText.includes("已有其他醫師治療預約"));
  const doctorConfirmBtn = page.getByRole("button", { name: "確認新增" });
  check("醫師治療沒有容量上限，重疊時仍可確認新增", await doctorConfirmBtn.isEnabled());
  await doctorConfirmBtn.click();
  await page.waitForTimeout(300);

  await browser.close();

  console.log(`\n合計：${pass} 項通過、${fail} 項失敗`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
