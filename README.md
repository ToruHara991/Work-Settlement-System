# 工作結算書系統（測試版）

## 🔰 新手教學（第一次使用請先看）

- 教學：[新手教學.md](新手教學.md)（約 15 分鐘，從建立契約書做到轉出結算書）
- 範例檔：[範例_契約詳細表.xlsx](samples/範例_契約詳細表.xlsx)、[範例_受理案件.json](samples/範例_受理案件.json)
- 開啟系統後，首頁的「新手專區」也有同樣的教學和範例下載

## 📖 使用手冊

| 版本 | 連結 | 說明 |
|---|---|---|
| PDF（含截圖） | [manual/manual.pdf](manual/manual.pdf) | 點開即可在 GitHub 上直接閱讀 |
| 文字版 | [manual/manual.md](manual/manual.md) | 純文字，方便搜尋、在手機上看 |

開啟 GitHub Pages 後，也可以直接用網址看 PDF：
`https://toruhara991.github.io/Work-Settlement-System/manual/manual.pdf`

---

## 開啟系統

開啟 GitHub Pages 後的網址：`https://toruhara991.github.io/Work-Settlement-System/`

> 請用上面的網址開啟。直接雙擊下載下來的 `index.html` 會被瀏覽器的安全規則擋下，無法執行。

預設密碼：`1234`

## 檔案說明

- 原系統畫面：`assets/index-BQlNx0cV.js`（React + Vite 打包檔）
- 模擬後端：`assets/backend.js`（攔截 `/api` 請求，資料存在瀏覽器 IndexedDB）
- Excel 讀寫：`assets/xlsx-B2eTCt_Q.js`（xlsx-js-style，Apache-2.0）
- 結算書轉檔：`assets/export-docs.js`
- 結算案件收集器（Chrome 擴充功能）：`downloads/結算案件收集器.zip`

## 注意

- 資料只存在使用者自己的瀏覽器，請用右下角「資料備份」定期備份。
- 僅供測試，請勿輸入真實客戶或廠商資料。
