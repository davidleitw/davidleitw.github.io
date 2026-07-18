---
title: "Agentic Design Patterns 附錄 D：用 AgentSpace 打造 Agent"
description: "用 Google AgentSpace 在企業環境打造 Agent。《Agentic Design Patterns》附錄 D 繁體中文翻譯。"
pubDatetime: 2026-07-17T20:35:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## 概觀

AgentSpace 是一個把 AI 融入日常工作流程、藉此推動「Agent 驅動型企業」的平台。它的核心能力，是對整個組織的數位資產（包括文件、電子郵件、資料庫）提供統一的搜尋。系統會用 Google Gemini 這類先進的 AI 模型，去理解並整合這些不同來源的資訊。

這個平台能建立並部署專門的 AI Agent，用來執行複雜任務、把流程自動化。這些 Agent 不只是聊天機器人，它們能推理、規劃，並自主執行多步驟的動作。舉例來說，一個 Agent 可以研究某個主題、寫出附引用的報告，甚至產生一段語音摘要。

為了做到這件事，AgentSpace 會建立一張企業知識圖譜（Knowledge Graph），把人員、文件、資料之間的關聯畫出來。有了這張圖，AI 就能理解上下文，給出更貼切、更個人化的結果。平台還內建一個叫 Agent Designer 的無程式碼介面，讓你不用深厚的技術背景也能打造自訂 Agent。

除此之外，AgentSpace 支援 Multi-Agent 系統，不同的 AI Agent 之間可以透過一套開放協定 Agent2Agent（A2A）Protocol 來溝通、協作。這種互通性讓更複雜、更有編排的工作流程成為可能。安全性是整個架構的基礎，具備角色權限控管（role-based access control）和資料加密等功能，用來保護企業的敏感資訊。歸結來說，AgentSpace 想做的，是把智慧、自主的系統直接嵌進組織的營運環節裡，藉此提升生產力和決策品質。

## 如何用 AgentSpace UI 打造 Agent

圖 1 示範如何從 Google Cloud Console 選取 AI Applications 來進入 AgentSpace。

![GCP：進入 AgentSpace](/assets/agentic-design-patterns/GCP_Access_AgentSpace.png)

圖 1：如何用 Google Cloud Console 進入 AgentSpace

你的 Agent 可以連接各種服務，包括 Calendar、Google Mail、Workday、Jira、Outlook 和 Service Now（見圖 2）。

![GCP：整合各種服務](/assets/agentic-design-patterns/GCP_Integrate_with_diverse_services.png)

圖 2：整合各種服務，包括 Google 及第三方平台。

接著，Agent 可以使用從 Google 提供的現成 prompt 集裡挑選的 prompt，如圖 3 所示。

![GCP：Google 的現成 prompt 集](/assets/agentic-design-patterns/GCP_Googles_Gallery_of_Pre_Assembled_Prompts.png)

圖 3：Google 的現成 prompt 集

或者，你也可以像圖 4 那樣寫自己的 prompt，讓 Agent 拿去用。

![GCP：自訂 Agent 的 prompt](/assets/agentic-design-patterns/GCP_Customizing_the_Agents_Prompt.png)

圖 4：自訂 Agent 的 prompt

AgentSpace 提供不少進階功能，例如：整合資料儲存（datastore）來存放你自己的資料、串接 Google Knowledge Graph 或你私有的 Knowledge Graph、用來把 Agent 對外開放到網路上的 Web 介面、監控使用情況的分析功能等等（見圖 5）。

![GCP：AgentSpace 進階功能](/assets/agentic-design-patterns/GCP_AgentSpace_Advanced_Capabilities.png)

圖 5：AgentSpace 進階功能

設定完成後，就能進入 AgentSpace 的聊天介面（圖 6）。

![GCP：用來和你的 Agent 開始對話的 AgentSpace 使用者介面](/assets/agentic-design-patterns/GCP_AgentSpace_User_Interface_for_initiating_a_chat_with_your_Agent.png)

圖 6：用來和你的 Agent 開始對話的 AgentSpace 使用者介面。

## 結語

總的來說，AgentSpace 提供了一套實用的框架，讓你在組織現有的數位基礎設施裡開發並部署 AI Agent。這套系統的架構，把自主推理、企業知識圖譜對應這類複雜的後端流程，接到一個用來組建 Agent 的圖形化介面上。透過這個介面，使用者可以整合各種資料服務、用 prompt 定義 Agent 的運作參數，最後得到量身打造、能感知情境的自動化系統。

這種做法把底層的技術複雜度隱藏起來，讓你不需要深厚的程式設計功力，也能組出專門的 Multi-Agent 系統。它的主要目標，是把自動化的分析與操作能力直接嵌進工作流程裡，藉此提升流程效率、強化資料驅動的分析。想動手實作的話，也有現成的學習模組可用，例如 Google Cloud Skills Boost 上的「Build a Gen AI Agent with Agentspace」實驗，提供一個結構化的環境讓你動手練習。

## 參考資料

1. Create a no-code agent with Agent Designer, [https://cloud.google.com/agentspace/agentspace-enterprise/docs/agent-designer](https://cloud.google.com/agentspace/agentspace-enterprise/docs/agent-designer)
2. Google Cloud Skills Boost, [https://www.cloudskillsboost.google/](https://www.cloudskillsboost.google/)
