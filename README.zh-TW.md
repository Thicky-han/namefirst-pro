# NameFirst Pro

![Pro 圖示提案](./assets/brand/icon-128.png)

**名稱優先，搜尋當下查核證據。** 獨立開發、非 fork 的 AGPL-3.0-only 擴充功能，適用桌面 Chrome/Edge 的 Bing/百度一般網頁搜尋。目前為 `1.0.0-rc.1` 本機候選版，圖示與公開發行待確認。公開下載連結尚未建立。介面目前僅簡體中文，九語 README 不代表九語介面。

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

## 安裝與使用

1. 在本機 `release/1.0.0-rc.1/` 選擇結尾為 `chrome.zip` 或 `edge.zip` 的對應檔；完整解壓至長期保留的資料夾。`source.zip` 是對應原始碼，不是擴充功能載入包。
2. 開啟 `chrome://extensions` 或 `edge://extensions`，啟用開發人員模式，載入直接包含 `manifest.json` 的解壓資料夾。
3. 開啟工具列彈窗及總開關/所需引擎開關。按需要選擇「开启联网核验权限」，閱讀瀏覽器提示；未授權不讀取外部證據，可隨時撤銷。
4. 在一般桌面搜尋查詢名稱，例如 `Apache Arrow official website`。卡片列出本次狀態、確切網址、來源與時間；不自動跳轉，原結果保留。
5. 查資料時可用「这次查资料」糾正。只有明確標籤才訓練；略過或未點擊不訓練。個人網址、別名與否定獨立儲存，不會認證官方身分。
6. 管理頁匯出 JSON，在新瀏覽器選擇檔案、預覽合併/取代再確認。合併保留本機衝突，未知格式不覆寫；權限、開關、歷史證據與復原紀錄不遷移。
7. 更新前備份；替換解壓檔案後，在擴充功能頁重新載入並重新整理搜尋頁。不要先解除安裝，解除安裝會清除資料。

完整步驟見 [簡中安裝說明](./INSTALL.md) 或 [English](./INSTALL.en.md)。[管理](./MANAGEMENT.md)、[隱私](./PRIVACY.md) 說明單步復原、並行草稿保護與本機保留。

## 範圍與限制

未知名稱不需要在預裝目錄中。唯一正向權威政策目前支援 Apache 官方專案目錄明確列出的首頁/下載入口；Wikidata 只提供線索。排名、HTTPS、自稱官方、模型分數與個人選擇不能單獨證明官方身分。文件/登入沒有通用認證政策，也不保證任意官網、安全或資質。

僅支援已辨識的桌面 Bing HTTPS `/search` 和 `www.baidu.com/s` UTF-8 一般結果。驗證碼、登入、隱藏/未知版面、限流與逾時會停止或降級，不繞過限制。本輪正常線上矩陣已依要求不作階段門檻。學習和提示可關閉；不預設儲存完整搜尋歷史。歷史證據永遠標為快取，失敗不更新舊認證時間。

[評估](./EVALUATION.md)：36 條人工編寫的真實名稱查詢，學習後正確 25、保留不確定 6、5 條資料誤作找入口。24 個合成信任案例符合期望 23 個，3 次認證中誤認證 0；文件案例安全拒絕而未達目標。這不是自然使用流量或全網準確率。

## 原始碼與授權

建置需要 Node.js 24+、pnpm 11.25.0：`pnpm install --frozen-lockfile`、`pnpm check`、`pnpm test`、`pnpm build`。一般安裝成品不需要工具、帳號或 API Key。發行打包另需 Git/Python 3.9+，使用 `pnpm release:prepare`、`pnpm release:verify`；校驗和見 `SHA256SUMS`。

原創程式與本輪授權的 Pro 衍生圖示採 AGPL-3.0-only，允許商用並遵守條款；依賴保留其授權。沒有複製原專案程式、目錄、插件身分或 Git 歷史。圖示來源與待確認狀態見 [品牌紀錄](./assets/brand/README.md)。[發行說明](./RELEASE_NOTES.md) · [LICENSE](./LICENSE)。
