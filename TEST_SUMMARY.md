# 測試結果摘要 — 2026名古屋亞帕運中繼站簡易預約系統

本文件為「驗收問題修正版」的測試結果，對應本次修正的 7 大項驗收問題（package-lock.json、容量演算法、E2E 測試可攜性、Excel 日期時間格式、人數欄位一致性、GitHub Pages 部署檔版本、重新驗證與交付）。

## 執行的檢查（依需求書「七、重新驗證及交付」逐項執行）

| 項目 | 結果 |
|---|---|
| `rm -rf node_modules package-lock.json && npm install` | 成功，產生 `package-lock.json`（146,628 bytes，本次已包含在交付 ZIP 內） |
| `rm -rf node_modules && npm ci`（不是只用 `npm install` 測試） | 成功，`added 239 packages` |
| `npx tsc --noEmit`（型別檢查） | 通過，無錯誤 |
| `npm run build`（正式建置） | 成功 |
| `npx playwright install chromium` | 在一般網路環境下可正常下載。本次沙盒環境因出站網路白名單限制，無法連上 `cdn.playwright.dev`（`403 request blocked`），因此改用環境變數 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指向沙盒既有的 Chromium 執行檔進行後續測試；腳本本身已改為預設使用 Playwright 自行管理的瀏覽器，一般使用者環境不受此沙盒限制影響 |
| `scripts/verify-e2e.mjs`（Playwright 自動化功能、容量分段演算法、Excel 型別測試） | **59 項檢查全部通過，0 項失敗，沒有任何一項使用 `\|\| true` 或其他強制通過方式** |
| `.github/workflows/deploy.yml` YAML 語法檢查（Python `yaml.safe_load` 解析） | 通過，`jobs: build, deploy` 結構正確，`actions/upload-pages-artifact@v5`、`actions/checkout@v4`、`actions/setup-node@v4`、`actions/deploy-pages@v4` 版本正確 |

## 本次 7 項驗收問題修正對照

### 一、補回 package-lock.json
- 涉及檔案：`package-lock.json`（新增）。
- 以目前 `package.json` 執行 `npm install` 產生，並用 `npm ci` 重新測試安裝成功；`npm ci` 後接續執行 `tsc --noEmit`、`npm run build` 皆成功。

### 二、修正同時段容量演算法
- 涉及檔案：`src/lib/capacity.ts`（改用時間事件分段掃描）、`src/lib/time.ts`（新增 `minutesToTime` 輔助函式）、`src/pages/ReservationFormPage.tsx`（更新警示畫面，顯示真正超量的時間區段與人數）。
- 新增自動化測試（`verify-e2e.mjs`）：
  - 案例一：容量3人，A(09:00-10:00,2人)、B(11:00-12:00,2人)彼此不重疊，新預約(09:00-12:00,1人)實際最高同時3人 → **允許確認新增**（PASS）。
  - 案例二：容量3人，A(09:00-11:00,2人)、B(10:00-12:00,1人)，新預約(09:30-11:30,1人) → 10:00-11:00 時段實際同時4人超過容量 → **阻擋，且正確顯示超量的時間區段與人數**（PASS）。
  - 既有測試已涵蓋：相鄰但不重疊時段不誤判、部分重疊時段正確計算最高同時人數。

### 三、修正 E2E 測試可攜性
- 涉及檔案：`scripts/verify-e2e.mjs`。
- 移除寫死的 `executablePath: "/opt/pw-browsers/chromium"`，改為預設使用 Playwright 自行管理的 Chromium，僅在設定環境變數 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 時才使用自訂路徑。
- 刪除「修改預約」測試中的 `overviewAfterEdit.includes(...) || true` 強制通過寫法，改為只保留原本就存在、透過「查看」實際開啟內容視窗確認修改後備註內容的真實檢查。
- `README.md` 已補充 `npx playwright install chromium` 安裝說明（見「4.1 執行端對端自動化測試」）。
- 額外修正：測試腳本原本以「表格最後一列」刪除剛複製的預約，但依開始時間排序後「最後一列」可能其實是原本的餐食預約而非剛複製的那一筆，導致誤刪；已改為依剛複製產生的預約單編號精準鎖定要刪除的那一列。

### 四、修正 Excel 日期及時間格式
- 涉及檔案：`src/excel/exportWorkbook.ts`（全部 6 張工作表的建立函式）。
- 日期欄位寫入真正的 Excel 日期值（JS `Date` 物件）並套用 number format `yyyy-mm-dd`；時間欄位寫入以 Excel 1900 日期系統起始日（1899-12-30）為基準的 `Date` 物件並套用 number format `hh:mm`，畫面只顯示時間、呈現 24 小時制，底層仍是可供 Excel 排序比較的真正日期/時間數值。
- 空白的結束時間／回程時間會保持完全留白（`cell.value = null`），不會被誤轉成錯誤的日期或時間。
- 新增自動化測試：直接讀回匯出的 `.xlsx`，用 ExcelJS 檢查 `cell.type`（是否為 `ExcelJS.ValueType.Date`）與 `cell.numFmt`（是否為 `yyyy-mm-dd`／`hh:mm`），而不只是比對顯示文字；並驗證空白時間欄位的底層值確實是 `null`。已檢查「每日預約總表」「餐食」「交通接駁」三張有實際資料的工作表（「防護治療」「體能訓練」「運科支援」在測試資料的匯出日期沒有資料，維持顯示「本日無預約資料」）。

### 五、處理人數欄位不一致
- 涉及檔案：`src/pages/ReservationFormPage.tsx`、`src/components/ReservationSummary.tsx`、`src/pages/OverviewPage.tsx`、`src/excel/exportWorkbook.ts`。
- 交通接駁不再顯示共用的「預約人數」欄位，改以「乘車人數（去程）」自動同步共用 `headcount` 欄位，從資料結構上消除兩個數字可能不一致的問題（而不是事後才加驗證提醒）。
- 餐食服務的餐食份數為主要數量，若與共用預約人數不同，確認頁仍會顯示提醒（不阻擋）。
- 每日總覽的交通列表人數顯示去程人數；來回且去程/回程人數不同時顯示「去程X人／回程Y人」。
- 統計卡片名稱由「交通接駁總人數」改為「交通接駁人次」，因為該數字是去程與回程相加。
- Excel「每日預約總表」的交通接駁人數與「交通接駁」分頁一致（兩者皆源自同一個已同步的 `headcount`/`passenger_count`）。
- 防護治療、體能訓練、運科支援仍使用共用「預約人數」欄位進行容量判斷，未受影響。
- 新增表單驗證：素食份數不得大於餐食總份數；輪椅使用人數不得大於去程乘車人數；所有人數/份數欄位（含餐食份數、素食份數、乘車人數、回程人數、輪椅使用人數、共用預約人數）皆須為整數，並在輸入時以 `Math.trunc` 防止輸入小數。

### 六、更新 GitHub Pages 部署檔
- 涉及檔案：`.github/workflows/deploy.yml`。
- `actions/upload-pages-artifact@v3` → `actions/upload-pages-artifact@v5`；`actions/checkout@v4`、`actions/setup-node@v4`、`actions/deploy-pages@v4` 維持不變。
- 已用 Python `yaml.safe_load` 驗證檔案語法正確、`jobs` 結構完整。

### 七、重新驗證及交付
- 詳見上方「執行的檢查」表格；59 項 E2E 檢查全部通過，無任何強制通過寫法。

## 自動化測試完整涵蓋範圍（對照需求書「二十四、測試要求」，共 59 項檢查）

1. 日期範圍限制：新增預約頁、每日預約總覽頁的日期欄位皆限制在 2026-10-12 ～ 2026-10-25。
2. 預約編號遞增：同一天連續新增多筆預約，編號依序為 R261012-001、R261012-002…。
3. 交通接駁不顯示共用「預約人數」欄位，改以「乘車人數（去程）」為主要人數。
4. 分段掃描容量演算法：容量內可正常確認新增；跨越部分時段但未超量不誤判；重疊時段真正超過容量時顯示超量時間區段警示且無法確認新增；既有預約彼此不重疊時不會被誤算的總和誤擋（需求書指定案例一）；多筆既有預約在某一時間區段內真正同時超量時正確阻擋並顯示正確人數（需求書指定案例二）。
5. 重新整理後資料保留：reload 頁面後，先前新增的預約資料仍然存在（驗證 localStorage 持久化）。
6. 每日統計數字：餐食總份數、交通接駁人次等統計卡片數字經比對正確。
7. CRUD 操作：新增、修改（保留原編號、更新內容，並透過「查看」實際開啟內容視窗確認修改後內容）、複製（產生全新編號）、刪除（需勾選確認，且精準刪除剛複製的那一筆）皆正常運作。
8. 服務分支正確顯示：切換「餐食」「交通接駁」「防護治療」等服務項目時，對應的專屬欄位會正確顯示/隱藏。
9. JSON 備份與還原：下載備份 → 清除資料 → 匯入備份（顯示筆數與日期範圍）→ 取代模式還原成功，資料正確復原。
10. GitHub Pages 相容性（HashRouter）：直接在深層路徑（例如 `/export`）重新整理，不會出現 404，頁面正常顯示。
11. Excel 全部工作表匯出：匯出的 .xlsx 檔案內含「每日預約總表」「餐食」「交通接駁」「防護治療」「體能訓練」「運科支援」六張工作表。
12. 無資料工作表仍保留：當天沒有體能訓練預約時，「體能訓練」工作表仍存在並顯示「本日無預約資料」。
13. Excel 版面正確：標題文字、凍結窗格（frozen panes）、橫向列印（landscape）、縮放至一頁寬（fitToWidth=1）皆已驗證設定正確。
14. **Excel 日期/時間型別正確**：日期欄位為 `Date` 型別、number format `yyyy-mm-dd`；時間欄位為 `Date` 型別、number format `hh:mm`；空白結束時間/回程時間保持留白（`null`），皆以讀回儲存格的 `cell.type` 與 `cell.numFmt` 驗證，而非只比對顯示文字。
15. 手機版可操作：將視窗縮小至 390×844（常見手機尺寸）後，導覽列與表單欄位仍可正常顯示與操作。
16. 編號不重複使用：刪除某日唯一一筆預約單編號（R261020-001）後，該日再新增一筆，系統產生的新編號是 R261020-002，而不是重新使用被刪除的 001。
17. 醫師治療不受容量阻擋：兩筆時段重疊的醫師治療預約，畫面僅顯示「同時段已有其他醫師治療預約」的提醒文字，「確認新增」按鈕仍可正常點擊（不會被停用）。

## 完整測試結果清單（59 項全數 PASS）

```
PASS - 新增預約頁日期欄位限制在 2026-10-12 ～ 2026-10-25
PASS - 每日預約總覽頁日期欄位也限制在活動日期範圍內
PASS - 選擇「餐食」後顯示餐食專屬欄位
PASS - 第一筆預約編號為 R261012-001
PASS - 選擇「交通接駁」後顯示交通接駁專屬欄位
PASS - 交通接駁不顯示共用「預約人數」欄位（以去程乘車人數為主要人數）
PASS - 同一天第二筆預約編號正確遞增為 R261012-002
PASS - 不重疊/未超量時段：容量內的預約可以確認新增
PASS - 跨越部分時段、剛好等於容量上限時仍可確認新增（不誤判超量）
PASS - 重疊時段合計超過容量時顯示超量警示
PASS - 重疊時段合計超過容量時無法確認新增（按鈕停用）
PASS - 不重疊時段不會被誤判為超量，可正常確認新增
PASS - 分段掃描案例一：A(09-10,2人)、B(11-12,2人)彼此不重疊，新預約(09-12,1人)實際最高同時3人不阻擋，不顯示超量警示
PASS - 分段掃描案例一：可以正常確認新增
PASS - 分段掃描案例二：10:00-11:00時段實際同時4人超過容量3人，正確顯示該超量時間區段
PASS - 分段掃描案例二：正確顯示該超量時段的人數為4人
PASS - 分段掃描案例二：實際超量時無法確認新增（按鈕停用）
PASS - 重新整理（reload）後，localStorage 資料仍然存在
PASS - 每日統計卡片顯示全部預約筆數
PASS - 餐食總份數統計正確（應為 4）
PASS - 交通接駁人次統計正確（應為 6，單程無回程人數）
PASS - 查看預約內容可以看到修改後的備註
PASS - 複製功能會產生全新的預約單編號（不是 R261012-001）
PASS - 複製後總筆數增加 1 筆
PASS - 刪除確認按鈕預設是停用的（需要勾選才能刪除）
PASS - 刪除功能可以正常運作，筆數減少 1 筆
PASS - 備份 JSON 檔案成功下載
PASS - 備份檔案格式正確（app 標記與 reservations 陣列）
PASS - 清除全部資料後，總覽頁顯示沒有資料
PASS - 匯入備份前會顯示資料筆數及日期範圍
PASS - 還原備份後資料正確回復
PASS - 直接重新整理深層路徑（/export）不會出現 404，正常顯示頁面
PASS - Excel 匯出檔案成功下載
PASS - Excel 內含全部 6 張工作表
PASS - 餐食工作表標題列存在（第 4 列為欄位標題）
PASS - 餐食工作表可以看到餐食資料（非「本日無預約資料」的留白提示）
PASS - 無預約資料的服務工作表仍存在，並顯示「本日無預約資料」
PASS - 每日預約總表標題列文字正確
PASS - 每日預約總表凍結窗格已設定
PASS - 每日預約總表設定為橫向列印
PASS - 每日預約總表設定為縮放至一頁寬
PASS - 每日預約總表「日期」欄為 Excel 日期型別（非純文字）
PASS - 每日預約總表「日期」欄 number format 為 yyyy-mm-dd
PASS - 每日預約總表「開始時間」欄為 Excel 日期/時間型別（非純文字）
PASS - 每日預約總表「開始時間」欄 number format 為 hh:mm
PASS - 每日預約總表：餐食服務沒有結束時間，儲存格保持留白，不得被誤轉成錯誤的日期/時間值
PASS - 餐食工作表「時間」欄為 Excel 日期/時間型別
PASS - 餐食工作表「時間」欄 number format 為 hh:mm（畫面顯示仍為24小時制）
PASS - 交通接駁工作表「去程上車時間」欄為 Excel 日期/時間型別
PASS - 交通接駁工作表「去程上車時間」欄 number format 為 hh:mm
PASS - 交通接駁工作表：單程預約沒有回程時間，儲存格保持留白，不得被誤轉成錯誤的日期/時間值
PASS - 每日預約總表「日期」欄底層為可供 Excel 排序比較的日期數值
PASS - 每日預約總表「開始時間」欄底層為可供 Excel 排序比較的時間數值
PASS - 手機版寬度下導覽列仍然可見可操作
PASS - 手機版寬度下日期欄位仍然可見
PASS - 編號重用測試：第一筆為 R261020-001
PASS - 刪除唯一一筆 R261020-001 後，下一號是 R261020-002（不重複使用已刪除的編號）
PASS - 醫師治療同時段重疊只顯示提醒文字（不阻擋）
PASS - 醫師治療沒有容量上限，重疊時仍可確認新增

合計：59 項通過、0 項失敗
```

## 如何重新執行測試

```bash
npm ci                                        # 或 npm install（若沒有 package-lock.json）
npx playwright install chromium               # 第一次執行前，下載 Playwright 自行管理的瀏覽器
npm install -D playwright                     # 僅測試腳本需要，正式專案不依賴此套件
npm run build
npm run preview -- --port 4174 --strictPort   # 另開一個終端機視窗，保持執行中
node scripts/verify-e2e.mjs
```

測試腳本每次執行前會自動清空瀏覽器的 localStorage，確保可重複執行、彼此不互相干擾。若需要在無法連上 `cdn.playwright.dev` 的環境（例如受限的企業網路或容器）執行，可設定環境變數 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指向系統上已有的 Chromium 執行檔。
