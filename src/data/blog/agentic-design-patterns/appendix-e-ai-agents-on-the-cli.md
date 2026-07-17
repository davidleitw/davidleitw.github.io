---
title: "Agentic Design Patterns 附錄 E：CLI 上的 AI Agent"
description: "終端機裡的 AI Agent：CLI 工具怎麼改變開發流程。《Agentic Design Patterns》附錄 E 繁體中文翻譯。"
pubDatetime: 2026-07-18T20:34:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## 引言

開發者的命令列長期以來都是精確、命令式指令的堡壘，如今正在經歷一場深刻的轉變。它正從單純的 Shell，演變成由一類新工具驅動的智慧協作工作空間，這類工具就是 AI Agent 的命令列介面（CLI）。這些 Agent 已經不只是執行指令：它們聽得懂自然語言，掌握整個程式碼庫的上下文，還能完成複雜的多步驟任務，把開發流程裡相當大一部分工作自動化。

本指南會深入介紹這個新興領域裡四個領先的角色，探討它們各自的強項、最適合的使用情境，以及不同的設計理念，幫助你判斷哪個工具最適合你的工作流程。要提醒的是，這裡替某個工具舉的例子，其實其他 Agent 往往也做得到。這些工具真正的差別，常常在於它們針對同一個任務能達到的結果品質、效率與細膩程度。市面上有專門設計來衡量這些能力的 benchmark（基準測試），後面的段落會談到。

## Claude CLI（Claude Code）

Anthropic 的 Claude CLI 定位是一個高階的編碼 Agent，對專案架構有深入而全面的理解。它的核心強項在於「Agentic」的特性，能替複雜的多步驟任務建立起整個程式碼庫的心智模型。互動方式高度對話化，很像結對程式設計（pair programming）：它會在動手之前先說明自己的計畫。這讓它特別適合在大型專案上工作的專業開發者，尤其是那些涉及大規模重構、或是要實作對架構有廣泛影響的功能的場景。

**使用情境範例：**

1. **大規模重構：** 你可以這樣下指令：「我們目前的使用者認證是靠 session cookie。請把整個程式碼庫重構成使用無狀態的 JWT，並更新 login/logout 端點、middleware，以及前端的 token 處理邏輯。」Claude 接著會讀取所有相關檔案，做出一致協調的修改。
2. **API 整合：** 提供某個新氣象服務的 OpenAPI 規格之後，你可以說：「整合這個新的氣象 API。建立一個 service 模組來處理 API 呼叫，新增一個元件來顯示天氣，並更新主儀表板把它加進去。」
3. **文件生成：** 把它指向某個註解寫得很差的複雜模組，你可以要求：「分析 `./src/utils/data_processing.js` 這個檔案。替每一個函式生成完整的 TSDoc 註解，說明它的用途、參數與回傳值。」

Claude CLI 的角色是一個專門的編碼助手，內建了處理核心開發任務的工具，包括讀取檔案、分析程式碼結構，以及生成編輯內容。它與 Git 深度整合，能直接管理分支與 commit。這個 Agent 的擴充性透過 MCP（原文寫作 Multi-tool Control Protocol；一般指 Model Context Protocol，見第 10 章）來達成，讓使用者可以定義並整合自訂工具。這使它能夠與私有 API 互動、查詢資料庫，並執行專案特有的腳本。這樣的架構把開發者放在決定 Agent 功能範圍的位置上，實際上就是把 Claude 塑造成一個推理引擎，再由使用者自訂的工具來增強它。

## Gemini CLI

Google 的 Gemini CLI 是一個功能全面、開源的 AI Agent，設計目標兼顧強大與易用。它靠著先進的 Gemini 2.5 Pro 模型、超大的 Context Window（上下文視窗），以及多模態能力（可以處理圖片與文字）脫穎而出。它開源、免費額度大方，加上「Reason and Act」（推理與行動）的迴圈機制，讓它成為一個透明、可控又全能的工具，適合廣泛的使用者，從業餘玩家到企業開發者都涵蓋，對於身處 Google Cloud 生態系的人尤其合適。

**使用情境範例：**

1. **多模態開發：** 你從設計檔提供一張 Web 元件的截圖（gemini describe component.png），並下指令：「寫出 HTML 和 CSS 程式碼，做出一個外觀跟這個一模一樣的 React 元件。確保它是響應式的。」
2. **雲端資源管理：** 利用它內建的 Google Cloud 整合，你可以下令：「找出 production 專案裡所有執行版本低於 1.28 的 GKE 叢集，並生成一個 gcloud 指令，逐一把它們升級。」
3. **企業工具整合（透過 MCP）：** 開發者替 Gemini 提供一個叫做 get-employee-details 的自訂工具，它會連上公司內部的 HR API。Prompt 是：「幫我們的新進員工草擬一份歡迎文件。先用 get-employee-details --id=E90210 這個工具取得他的姓名與所屬團隊，再用這些資訊把 welcome_template.md 填好。」
4. **大規模重構：** 開發者需要重構一個龐大的 Java 程式碼庫，把一個已棄用的 logging 函式庫換成新的結構化 logging 框架。他可以對 Gemini 下這樣的 Prompt：讀取 'src/main/java' 目錄下所有的 *.java 檔案。針對每個檔案，把所有 'org.apache.log4j' 的 import 及其 'Logger' 類別，換成 'org.slf4j.Logger' 和 'LoggerFactory'。重寫 logger 的實例化，以及所有 .info()、.debug()、.error() 的呼叫，改用帶有鍵值對的新結構化格式。

Gemini CLI 配備了一整套內建工具，讓它能與所處的環境互動。這些工具包括檔案系統操作（例如讀取和寫入）、執行指令的 shell 工具，以及透過網頁抓取與搜尋來存取網路的工具。為了取得更廣的上下文，它會用專門的工具一次讀取多個檔案，並用一個記憶工具把資訊存下來供之後的 session 使用。這些功能都建立在一個安全的基礎之上：sandboxing（沙箱）機制把模型的動作隔離開來以防範風險，而 MCP 伺服器則扮演橋樑的角色，讓 Gemini 能安全地連上你的本地環境或其他 API。

## Aider

Aider 是一個開源的 AI 編碼助手，它會直接在你的檔案上動工並把變更 commit 進 Git，扮演一個名副其實的結對程式設計夥伴。它最鮮明的特色是「直接」：它套用編輯、跑測試來驗證，並自動把每一個成功的變更 commit 起來。由於它不綁定特定模型，使用者能完全掌控成本與能力。它以 Git 為中心的工作流程，讓它特別適合那些看重效率、掌控感，以及所有程式碼改動都有透明、可稽核軌跡的開發者。

**使用情境範例：**

1. **測試驅動開發（TDD）：** 開發者可以說：「替一個計算數字階乘的函式，建立一個會失敗的測試。」Aider 寫好測試、確認它失敗之後，下一個 Prompt 是：「現在，寫出程式碼讓這個測試通過。」Aider 實作出這個函式，再跑一次測試來確認。
2. **精準除蟲：** 拿到一份 bug 報告，你可以指示 Aider：「billing.py 裡的 `calculate_total` 函式在閏年會出錯。把這個檔案加進上下文，修好這個 bug，並拿現有的測試套件來驗證你的修正。」
3. **相依套件更新：** 你可以下指令：「我們專案用的 'requests' 函式庫版本過舊。請逐一檢查所有 Python 檔案，更新 import 語句以及任何已棄用的函式呼叫，讓它相容於最新版本，然後更新 requirements.txt。」

## GitHub Copilot CLI

GitHub Copilot CLI 把那個廣受歡迎的 AI 結對程式設計夥伴延伸到終端機裡，它最主要的優勢在於與 GitHub 生態系原生而深入的整合。它理解一個專案*在 GitHub 之內*的上下文。它的 Agent 能力讓它可以被指派一個 GitHub issue、著手修復，並提交一個 pull request 交由人工審查。

**使用情境範例：**

1. **自動化 Issue 解決：** 主管把一張 bug 工單（例如「Issue #123：修復分頁的 off-by-one 錯誤」）指派給 Copilot Agent。這個 Agent 接著會 checkout 一個新分支、寫程式碼，並提交一個引用該 issue 的 pull request，全程都不需要開發者手動介入。
2. **具備儲存庫感知的問答：** 團隊裡的新開發者可以問：「這個儲存庫裡的資料庫連線邏輯定義在哪裡，它需要哪些環境變數？」Copilot CLI 靠著它對整個儲存庫的掌握，給出附帶檔案路徑的精確答案。
3. **Shell 指令小幫手：** 遇到不確定的複雜 shell 指令時，使用者可以問：gh? find all files larger than 50MB, compress them, and place them in an archive folder。Copilot 會生成完成這個任務所需的精確 shell 指令。

## Terminal-Bench：命令列介面裡 AI Agent 的 benchmark

Terminal-Bench 是一套新穎的評估框架，用來衡量 AI Agent 在命令列介面裡執行複雜任務的熟練程度。終端機因為基於文字、又具備沙箱特性，被認為是 AI Agent 運作的理想環境。首個版本 Terminal-Bench-Core-v0 收錄了 80 項人工精選的任務，橫跨科學工作流程與資料分析等領域。為了讓比較更公平，開發團隊做了一個極簡的 Agent「Terminus」，作為各種語言模型的標準化測試平台。這套框架設計上具備擴充性，可以透過容器化或直接連線的方式整合各式各樣的 Agent。未來的規劃包括支援大規模平行評估，以及納入現有的成熟 benchmark。這個專案也鼓勵開源社群貢獻，以擴充任務並協力改善框架。

## 結語

這些強大的 AI 命令列 Agent 的出現，標誌著軟體開發的一次根本性轉變，把終端機變成一個動態、可協作的環境。如同我們所見，並不存在單一的「最佳」工具；相反地，一個充滿活力的生態系正在成形，每個 Agent 都提供了某種專門的強項。理想的選擇完全取決於開發者的需求：Claude 適合複雜的架構任務，Gemini 適合全面而多模態的問題解決，Aider 適合以 Git 為中心的直接程式碼編輯，而 GitHub Copilot 則適合無縫融入 GitHub 的工作流程。隨著這些工具持續演進，善用它們的能力會成為一項不可或缺的技能，從根本上改變開發者建構、除錯與管理軟體的方式。

## 參考資料

1. Anthropic. *Claude*. [https://docs.anthropic.com/en/docs/claude-code/cli-reference](https://docs.anthropic.com/en/docs/claude-code/cli-reference)
2. Google Gemini Cli [https://github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
3. Aider. [https://aider.chat/](https://aider.chat/)
4. GitHub *Copilot CLI* [https://docs.github.com/en/copilot/github-copilot-enterprise/copilot-cli](https://docs.github.com/en/copilot/github-copilot-enterprise/copilot-cli)
5. Terminal Bench: [https://www.tbench.ai/](https://www.tbench.ai/)
