---
title: "Agentic Design Patterns 繁體中文版:21 個 AI Agent 設計模式(全書目錄)"
description: "《Agentic Design Patterns》(Antonio Gulli 著)繁體中文翻譯全書目錄:21 個 AI Agent 設計模式,從 Prompt Chaining、Tool Use 到 Multi-Agent 協作、Guardrails 與評估監控。邊翻譯邊學習的完整紀錄。"
pubDatetime: 2026-07-17T21:00:00+08:00
featured: true
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

![Agentic Design Patterns 書封](/assets/agentic-design-patterns/Agentic_Design_Patterns_Book_Cover.png)

《Agentic Design Patterns: A Hands-On Guide to Building Intelligent Systems》是 Google 資深工程總監 [Antonio Gulli](https://www.linkedin.com/in/searchguy/) 寫的書,整理了 21 個建構 AI Agent 系統的設計模式——從 Prompt Chaining、Routing 這種基礎的,到 Multi-Agent 協作、Guardrails、評估與監控這種上線前你遲早要面對的,每章都附程式碼範例。我把整本書翻成了繁體中文,這一頁是全書目錄。

## 為什麼要翻這本書

主要是為了逼自己讀懂。英文技術書很容易「看過」但沒「讀進去」,眼睛掃過一段就自動點頭。翻譯不行,每一段都要先真的理解,才有辦法用中文把它講清楚。卡住的地方,通常就是我其實沒懂的地方。

所以與其說這是翻譯專案,不如說是一份做得比較完整的讀書筆記,剛好完整到變成一整本書。

翻譯流程老實講:AI 出初稿,然後逐章對照英文原文審一輪語意,用語照著自己整理的風格指南走——哪些詞保留英文(Agent、Prompt、RAG 這類工程圈慣用原文的詞不硬翻)、哪些詞怎麼譯,全書一致。程式碼區塊完全不動,保留英文原文。翻錯難免,發現問題歡迎到 [GitHub repo](https://github.com/davidleitw/agentic-design-patterns) 開 issue。

## 關於原書

原書 2025 年由 [Springer 出版](https://link.springer.com/book/10.1007/978-3-032-01402-3),作者把版稅全數捐給 Save the Children,也把全書內容公開給社群。這份翻譯是**非官方**的,僅供學習交流,不做任何商業用途;內容以英文原書為準,讀完覺得有收穫,請支持正版。

也感謝 [Tom Mathews](https://github.com/mathews-tom/Agentic-Design-Patterns) 整理的英文 Markdown 版(本翻譯的底本),以及 [xindoo](https://github.com/xindoo) 發起的簡體中文翻譯專案(術語參考)。

## 從哪裡開始讀

沒寫過 agent 的話,先看[什麼讓 AI 系統成為 Agent?](/posts/agentic-design-patterns/what-makes-an-ai-system-an-agent)搞清楚定義,然後從第 1 章照順序讀,第一部七章都是基礎。已經在用 LangChain、LangGraph 這類框架的人,可以直接跳第 8 章的記憶管理和第三部,那邊講的是系統要上線前真正會踩的坑。第 17 章的推理技巧和附錄 A 的 Prompt 技巧可以當工具書,需要時再翻。

## 全書目錄

### 前言

- [獻詞](/posts/agentic-design-patterns/dedication)
- [致謝](/posts/agentic-design-patterns/acknowledgment)
- [序](/posts/agentic-design-patterns/foreword)
- [思想領袖的觀點:力量與責任](/posts/agentic-design-patterns/a-thought-leaders-perspective)
- [前言](/posts/agentic-design-patterns/introduction)
- [什麼讓 AI 系統成為 Agent?](/posts/agentic-design-patterns/what-makes-an-ai-system-an-agent)

### 第一部:基礎模式

- [第 1 章:Prompt Chaining(提示鏈)](/posts/agentic-design-patterns/chapter-01-prompt-chaining)
- [第 2 章:Routing(路由)](/posts/agentic-design-patterns/chapter-02-routing)
- [第 3 章:Parallelization(平行化)](/posts/agentic-design-patterns/chapter-03-parallelization)
- [第 4 章:Reflection(反思)](/posts/agentic-design-patterns/chapter-04-reflection)
- [第 5 章:Tool Use(工具使用,Function Calling)](/posts/agentic-design-patterns/chapter-05-tool-use)
- [第 6 章:Planning(規劃)](/posts/agentic-design-patterns/chapter-06-planning)
- [第 7 章:Multi-Agent Collaboration(多 Agent 協作)](/posts/agentic-design-patterns/chapter-07-multi-agent-collaboration)

### 第二部:進階系統

- [第 8 章:Memory Management(記憶管理)](/posts/agentic-design-patterns/chapter-08-memory-management)
- [第 9 章:Learning and Adaptation(學習與適應)](/posts/agentic-design-patterns/chapter-09-learning-and-adaptation)
- [第 10 章:Model Context Protocol(MCP)](/posts/agentic-design-patterns/chapter-10-mcp)
- [第 11 章:Goal Setting and Monitoring(目標設定與監控)](/posts/agentic-design-patterns/chapter-11-goal-setting-and-monitoring)

### 第三部:上線前的考量

- [第 12 章:Exception Handling and Recovery(例外處理與恢復)](/posts/agentic-design-patterns/chapter-12-exception-handling-and-recovery)
- [第 13 章:Human-in-the-Loop(人機協作)](/posts/agentic-design-patterns/chapter-13-human-in-the-loop)
- [第 14 章:Knowledge Retrieval(知識檢索,RAG)](/posts/agentic-design-patterns/chapter-14-knowledge-retrieval-rag)

### 第四部:Multi-Agent 架構

- [第 15 章:Inter-Agent Communication(Agent 間通訊,A2A)](/posts/agentic-design-patterns/chapter-15-inter-agent-communication-a2a)
- [第 16 章:Resource-Aware Optimization(資源感知最佳化)](/posts/agentic-design-patterns/chapter-16-resource-aware-optimization)
- [第 17 章:Reasoning Techniques(推理技巧)](/posts/agentic-design-patterns/chapter-17-reasoning-techniques)
- [第 18 章:Guardrails / Safety Patterns(護欄與安全模式)](/posts/agentic-design-patterns/chapter-18-guardrails-safety-patterns)
- [第 19 章:Evaluation and Monitoring(評估與監控)](/posts/agentic-design-patterns/chapter-19-evaluation-and-monitoring)
- [第 20 章:Prioritization(優先排序)](/posts/agentic-design-patterns/chapter-20-prioritization)
- [第 21 章:Exploration and Discovery(探索與發現)](/posts/agentic-design-patterns/chapter-21-exploration-and-discovery)

### 附錄

- [附錄 A:進階 Prompt 技巧](/posts/agentic-design-patterns/appendix-a-advanced-prompting-techniques)
- [附錄 B:AI Agent 的互動介面:從 GUI 到真實世界](/posts/agentic-design-patterns/appendix-b-ai-agentic-interactions)
- [附錄 C:Agentic 框架速覽](/posts/agentic-design-patterns/appendix-c-agentic-frameworks-overview)
- [附錄 D:用 AgentSpace 打造 Agent(僅線上版)](/posts/agentic-design-patterns/appendix-d-building-an-agent-with-agentspace)
- [附錄 E:CLI 上的 AI Agent](/posts/agentic-design-patterns/appendix-e-ai-agents-on-the-cli)
- [附錄 F:深入內部:Agent 推理引擎解析](/posts/agentic-design-patterns/appendix-f-under-the-hood)
- [附錄 G:Coding Agent](/posts/agentic-design-patterns/appendix-g-coding-agents)

### 結尾

- [結語](/posts/agentic-design-patterns/conclusion)
- [常見問題](/posts/agentic-design-patterns/faq)
- [術語表](/posts/agentic-design-patterns/glossary)
- [術語索引](/posts/agentic-design-patterns/index-of-terms)
