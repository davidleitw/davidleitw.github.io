---
title: "Agentic Design Patterns：什麼讓 AI 系統成為 Agent？"
description: "從單純的 LLM 呼叫到有目標、能用工具的 Agent，一層層拆解。《Agentic Design Patterns》繁體中文翻譯。"
pubDatetime: 2026-07-18T20:27:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

簡單來說，**AI Agent** 是一種為了達成特定目標，而去感知環境並採取行動的系統。它是標準大型語言模型（LLM）的進化版，多了規劃、使用工具、與周遭環境互動的能力。你可以把 Agentic AI 想成一位會在工作中學習的聰明助理。它靠一個簡單的五步驟循環把事情做完（見圖 1）：

1. **接下任務**：你給它一個目標，例如「幫我整理行程」。
2. **掃描現場**：它蒐集所有必要的資訊──讀信、查行事曆、翻通訊錄──搞清楚現在是什麼狀況。
3. **想清楚**：它思考達成目標的最佳做法，擬出行動計畫。
4. **動手執行**：它照計畫行動：發出邀請、安排會議、更新你的行事曆。
5. **學習與進步**：它觀察哪些做法成功，並據此調整。例如某場會議被改期了，系統會從這件事學習，讓之後表現更好。

![Agentic AI 解決問題的流程](/assets/agentic-design-patterns/Agentic_AI_Problem_Solving_Process.png)

圖 1：Agentic AI 像一位持續從經驗中學習的智慧助理，透過一個簡單的五步驟循環完成任務。

Agent 正以驚人的速度普及。近期研究指出，多數大型 IT 企業已經在實際使用 Agent，其中五分之一是在過去一年內才開始的。金融市場也注意到了：截至 2024 年底，AI Agent 新創已募資超過 20 億美元，市場規模達 52 億美元，預估到 2034 年會暴增到接近 2,000 億美元。簡而言之，所有跡象都指向同一件事：AI Agent 將在未來的經濟中扮演重要角色。

短短兩年，AI 的典範已經大幅轉移，從簡單的自動化走向精密的自主系統（見圖 2）。最初的工作流程靠基本的 Prompt 和觸發條件，用 LLM 處理資料。接著出現了檢索增強生成（RAG），讓模型建立在事實資訊之上，提高了可靠性。然後我們看到能使用各種工具的單體 AI Agent。今天，我們正進入 Agentic AI 的時代：一組各有專長的 Agent 協同合作，達成複雜的目標──這是 AI 協作能力的一大躍進。

![從 LLM 到 RAG，再到 Agentic RAG，最後到 Agentic AI 的演進](/assets/agentic-design-patterns/Transitioning_from_LLMs_to_RAG_to_Agentic_RAG_to_Agentic_AI.png)

圖 2：從 LLM 到 RAG，再到 Agentic RAG，最後到 Agentic AI 的演進。

本書要討論的，就是這些專門化的 Agent 如何協同合作、達成複雜目標的設計模式。每一章你都會看到一種協作與互動的典範。

在那之前，先來看幾個例子，感受一下 Agent 複雜度的光譜（見圖 3）。

## Level 0：核心推理引擎

LLM 本身不是 Agent，但它可以充當基礎 Agentic 系統的推理核心。在「Level 0」的配置下，LLM 沒有工具、沒有記憶、不與環境互動，只靠預訓練知識回答問題。它的強項是利用龐大的訓練資料來解釋既有的概念；代價則是對時事一無所知。舉例來說，如果 2025 年奧斯卡最佳影片不在它的預訓練知識裡，它就答不出來。

## Level 1：連上外界的問題解決者

到了這一級，LLM 藉由連接並使用外部工具，成為一個能實際做事的 Agent。它解決問題不再受限於預訓練知識，而是能執行一連串動作，從網路（透過搜尋）或資料庫（透過檢索增強生成，RAG）等來源蒐集並處理資訊。細節請參考第 14 章。

比方說，要找新的電視影集，Agent 會意識到自己需要最新資訊，於是使用搜尋工具找到資料，再把結果整合起來。更關鍵的是，它還能呼叫專門工具來提高準確度，例如呼叫金融 API 查 AAPL 的即時股價。這種跨多個步驟與外部世界互動的能力，就是 Level 1 Agent 的核心。

## Level 2：有策略的問題解決者

到了這一級，Agent 的能力大幅擴展，涵蓋策略規劃、主動協助與自我改進，而 Prompt Engineering 和 Context Engineering 是背後的核心技能。

首先，Agent 不再只用單一工具，而是透過有策略的解題方式，處理複雜、多環節的問題。在執行一連串動作的過程中，它會主動進行 Context Engineering：有策略地挑選、打包、管理每個步驟最相關的資訊。例如，要找兩地之間的咖啡店，它先用地圖工具，然後對輸出動手腳──整理出一份簡短聚焦的上下文，也許只是幾條街名──再餵給本地搜尋工具，避免認知超載，讓第二步又快又準。要讓 AI 發揮最高的準確度，就必須給它簡短、聚焦、有力的上下文。Context Engineering 就是做到這件事的學問：從所有可用來源中，有策略地挑選、打包、管理最關鍵的資訊，妥善分配模型有限的注意力，避免超載，確保每個任務都有高品質、高效率的表現。細節請參考附錄 A。

這一級也帶來了主動、持續的運作。一個連上你信箱的旅行助理就是例子：它從一封冗長的航班確認信中萃取上下文，只挑出關鍵細節（航班編號、日期、地點），打包後再去呼叫你的行事曆和天氣 API。

在軟體工程這類專業領域，Agent 靠同一套方法管理完整的工作流程。接到 bug 回報時，它先讀報告、存取程式碼庫，再把這些龐大的資訊來源，有策略地提煉成精準聚焦的上下文，讓自己能有效率地撰寫、測試並提交正確的修補程式。

最後，Agent 透過改進自己的 Context Engineering 流程，達到自我改進。當它主動詢問「這個 Prompt 怎麼寫會更好」時，它是在學習怎麼更好地整理自己的初始輸入。這讓它能自動改進未來任務的資訊打包方式，形成一個強大的自動回饋循環，準確度和效率會隨時間越來越好。細節請參考第 17 章。

![展示 Agent 複雜度光譜的各種實例](/assets/agentic-design-patterns/Various_Instances_Demonstrating_the_Spectrum_of_Agent_Complexity.png)

圖 3：展示 Agent 複雜度光譜的各種實例。

## Level 3：協作式 Multi-Agent 系統的崛起

到了 Level 3，AI 的發展出現一個重要的典範轉移：不再追求單一、全能的超級 Agent，轉而打造精密的協作式 Multi-Agent 系統。這個路線背後的想法是：複雜的挑戰往往不該交給一個通才，而該交給一組各有專長、協同作戰的專家。這個模型直接對應人類組織的結構──不同部門各司其職，合作解決多面向的目標。這種系統的整體戰力，來自分工，以及協調合作產生的綜效。細節請參考第 7 章。

讓這個概念具體一點：想像新產品上市的複雜流程。與其讓一個 Agent 包辦所有事情，可以由一個「專案經理」Agent 擔任中央協調者，把任務分派給其他專門的 Agent：「市場研究」Agent 蒐集消費者資料、「產品設計」Agent 發展概念、「行銷」Agent 製作宣傳素材。成敗的關鍵在於它們之間的順暢溝通與資訊共享，確保每個人的努力都對齊共同目標。

這種自主的團隊式自動化願景已經在開發中，但也要誠實面對眼前的障礙。這類 Multi-Agent 系統的效果，目前仍受限於它們所使用的 LLM 的推理能力。此外，它們真正互相學習、作為一個整體共同進步的能力，還在很早期的階段。突破這些技術瓶頸是關鍵的下一步；一旦突破，這一級的深層承諾就會兌現：把整條業務流程從頭到尾自動化。

## Agent 的未來：五大假說

AI Agent 的發展正以前所未有的速度推進，橫跨軟體自動化、科學研究、客戶服務等領域。現在的系統已經很讓人驚豔，但這只是開始。下一波創新可能會聚焦在讓 Agent 更可靠、更會協作、更深入地融入我們的生活。以下是關於未來的五個主要假說（見圖 4）。

### 假說一：通才 Agent 的出現

第一個假說是：AI Agent 會從狹窄的專才，演化成真正的通才，能高度可靠地處理複雜、模糊、長期的目標。例如，你可以只丟給 Agent 一句話：「下一季幫公司在里斯本辦一場 30 人的異地會議。」接下來幾週，Agent 會管理整個專案：預算簽核、機票議價、場地挑選、根據員工回饋排出詳細行程，還會定期回報進度。要達到這種自主程度，AI 在推理、記憶和近乎完美的可靠性上，都需要根本性的突破。另一條路線（跟前者不衝突）是小型語言模型（SLM）的興起：像樂高一樣，用多個小而專的專家 Agent 組合出系統，而不是把單一模型越做越大。這條路的好處是更便宜、除錯更快、也更容易部署。最終，大型通才模型和小型專才組合這兩條路都走得通，甚至可能互補。

### 假說二：深度個人化與主動發現目標

第二個假說是：Agent 會成為深度個人化、主動出擊的夥伴。我們正在見證一類新 Agent 的出現：主動型夥伴。透過學習你獨特的模式和目標，這些系統開始從「聽命行事」轉向「預判需求」。AI 系統之所以稱得上 Agent，是因為它不只回應聊天或指令，而是主動替使用者發起並執行任務，積極參與整個過程。這已經超出單純的任務執行，進入「主動發現目標」的領域。

比方說，你正在研究永續能源，Agent 可能會辨識出你潛在的目標，主動支援：推薦課程、摘要研究文獻。這些系統還在發展中，但方向很清楚：它們會越來越主動，在高度確信某個行動有幫助時，學著替你採取主動。最終，Agent 會成為不可或缺的盟友，幫你發現並實現那些你自己都還沒說清楚的抱負。

![關於 Agent 未來的五個假說](/assets/agentic-design-patterns/Five_Hypotheses_about_the_Future_of_Agents.png)

圖 4：關於 Agent 未來的五個假說。

### 假說三：具身化與實體世界互動

這個假說預見 Agent 掙脫純數位的疆界，進入實體世界運作。把 Agentic AI 與機器人技術結合，「具身 Agent」（embodied agents）就會出現。你不再只是請 Agent 幫你預約水電師傅，而是直接請家裡的 Agent 修理漏水的水龍頭。它會用視覺感測器觀察問題、查閱水電知識庫擬定計畫，然後精準操控機械手臂完成修理。這會是巨大的一步：銜接數位智慧與實體行動，改變的範圍從製造、物流，到長照與居家維修。

### 假說四：Agent 驅動的經濟

第四個假說是：高度自主的 Agent 會成為經濟活動的積極參與者，創造新的市場和商業模式。我們可能會看到 Agent 作為獨立的經濟實體運作，任務是最大化某個特定成果，例如利潤。一位創業者可以放一個 Agent 出去經營一整家電商：它分析社群媒體找出趨勢商品、生成行銷文案和視覺素材、跟其他自動化系統對接來管理供應鏈物流，再根據即時需求動態調價。這種轉變會催生一個全新的、超高效率的「Agent 經濟」，其運轉速度和規模是人類無法直接管理的。

### 假說五：目標驅動、可變形的 Multi-Agent 系統

這個假說提出一種新的智慧系統：它的運作不是來自明確的程式設計，而是來自一個被宣告的目標。使用者只要說出想要的結果，系統就自己想辦法達成。這是一個根本性的轉變，走向能在個體與集體兩個層次上真正自我改進的「可變形」（metamorphic）Multi-Agent 系統。

這種系統是一個動態的整體，不是單一 Agent。它能分析自己的表現，並調整 Multi-Agent 團隊的拓撲結構：視需要建立、複製或移除 Agent，組出最適合當前任務的隊形。這種演化發生在多個層次：

* 架構層的修改：在最深的層次，個別 Agent 能改寫自己的原始碼、重新設計內部結構以提高效率，如同最初的假說所描述的。
* 指令層的修改：在較高的層次，系統持續進行自動化的 Prompt Engineering 和 Context Engineering，不斷打磨給每個 Agent 的指令和資訊，確保它們在最佳指引下運作，全程不需要人類介入。

舉個例子：創業者只要宣告意圖──「開一家成功的精品咖啡電商」──系統不需要進一步的程式設計就會動起來。它可能先生出一個「市場研究」Agent 和一個「品牌」Agent；根據初步發現，它可能決定移除品牌 Agent，改生出三個新的專門 Agent：「Logo 設計」「網店平台」「供應鏈」。它會不斷調校這些 Agent 的內部 Prompt 來提升表現。如果網店 Agent 成了瓶頸，系統可能把它複製成三個平行的 Agent，分頭處理網站的不同部分──等於即時重新設計自己的結構，來達成那個被宣告的目標。

## 結論

總結來說，AI Agent 是對傳統模型的一次重大跨越：它是一個自主系統，會感知、規劃、行動，以達成特定目標。這項技術正從單一的、會用工具的 Agent，走向複雜的協作式 Multi-Agent 系統，處理多面向的目標。對未來的各種假說預測了通才型、個人化、甚至具身化的 Agent，它們將成為經濟活動的參與者。這條發展軌跡指向一個重大的典範轉移：自我改進、目標驅動的系統，將把整條工作流程自動化，並從根本上重新定義我們與科技的關係。

## 參考資料

1. Cloudera, Inc. (April 2025), 96% of enterprises are increasing their use of AI agents. [https://www.cloudera.com/about/news-and-blogs/press-releases/2025-04-16-96-percent-of-enterprises-are-expanding-use-of-ai-agents-according-to-latest-data-from-cloudera.html](https://www.cloudera.com/about/news-and-blogs/press-releases/2025-04-16-96-percent-of-enterprises-are-expanding-use-of-ai-agents-according-to-latest-data-from-cloudera.html)
2. Autonomous generative AI agents: [https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2025/autonomous-generative-ai-agents-still-under-development.html](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2025/autonomous-generative-ai-agents-still-under-development.html)
3. Market.us. Global Agentic AI Market Size, Trends and Forecast 2025–2034. [https://market.us/report/agentic-ai-market/](https://market.us/report/agentic-ai-market/)
