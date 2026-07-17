---
title: "Agentic Design Patterns 第 12 章：Exception Handling and Recovery（例外處理與恢復）"
description: "工具失敗、輸出不對勁時，Agent 怎麼偵測、恢復、優雅降級。《Agentic Design Patterns》第 12 章繁體中文翻譯。"
pubDatetime: 2026-07-18T20:48:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

AI Agent 要在各種真實環境中可靠運作，就必須能應付預料之外的狀況、錯誤和故障。就像人類會適應意外的障礙，智慧型 Agent 也需要一套穩健的機制來偵測問題、啟動恢復程序，至少也要確保失敗是可控的。這個基本需求，正是 Exception Handling and Recovery（例外處理與恢復）模式的出發點。

這個模式的重點，是打造格外耐操、有韌性的 Agent，讓它們即使碰到各種困難和例外狀況，仍能維持功能不中斷、運作完整。它同時強調「事前準備」和「事後應對」兩種策略，確保面臨挑戰時仍能持續運作。這種適應力，對 Agent 能否在複雜又難以預測的環境中順利運作至關重要，最終也提升了它們的整體效能和可信度。

處理意外事件的能力，讓這些 AI 系統不只是聰明，更是穩定可靠，也因此讓人更放心地部署它們、更信任它們的表現。再整合完善的監控和診斷工具，Agent 就能更快找出並解決問題，避免潛在的中斷，在不斷變化的條件下運作得更順。這類進階機制，對維護 AI 運作的完整性和效率很關鍵，也強化了它們駕馭複雜與不確定性的能力。

這個模式有時會和 Reflection（反思）搭配使用。舉例來說，如果第一次嘗試失敗並拋出例外，反思流程可以分析失敗原因，改用更好的方法（例如優化過的 Prompt）重新嘗試任務，把錯誤解掉。

## 模式概觀

Exception Handling and Recovery 模式，處理的是 AI Agent 面對運作失敗時的需求。這個模式的做法，是預先設想可能出現的問題，例如工具出錯或服務無法使用，並想好因應的緩解策略。這些策略可能包括錯誤記錄（logging）、重試（retries）、備援方案（fallbacks）、優雅降級（graceful degradation）和通知（notifications）。此外，這個模式也強調各種恢復機制，例如狀態回滾（state rollback）、診斷、自我修正和升級處理（escalation），把 Agent 拉回穩定的運作狀態。實作這個模式，能提升 AI Agent 的可靠性和穩健性，讓它們在難以預測的環境中也能運作。實際應用的例子包括：處理資料庫錯誤的聊天機器人、處理金融錯誤的交易機器人，以及應付裝置故障的智慧家庭 Agent。這個模式確保 Agent 即使碰到各種複雜狀況和失敗，仍能持續有效運作。

![AI Agent 例外處理與恢復的關鍵組成](/assets/agentic-design-patterns/Key_Components_of_Exception_Handling_and_Recovery_for_AI_agents.png)

圖 1：AI Agent 例外處理與恢復的關鍵組成

**錯誤偵測（Error Detection）：** 這一步要在問題發生時仔細把它們找出來。問題的形式可能是：無效或格式錯誤的工具輸出、特定的 API 錯誤（例如 404「找不到」或 500「內部伺服器錯誤」代碼）、服務或 API 異常過長的回應時間，或是偏離預期格式、前後不通、毫無意義的回應。除此之外，也可以安排由其他 Agent 或專門的監控系統來監看，做更主動的異常偵測，讓系統能在潛在問題惡化之前就抓到它們。

**錯誤處理（Error Handling）：** 一旦偵測到錯誤，就需要一套經過深思熟慮的應對計畫。這包括在日誌裡仔細記下錯誤細節，方便日後除錯和分析（logging）。重試該操作或請求，有時搭配稍微調整過的參數，可能是可行的策略，對暫時性（transient）的錯誤尤其有效（retries）。改用替代的策略或方法（fallbacks），可以確保至少維持部分功能。在無法立即完全恢復的情況下，Agent 可以維持部分功能，至少提供一些價值（graceful degradation）。最後，對需要人工介入或協作的情況，向人類操作員或其他 Agent 發出警示可能很關鍵（notification）。

**恢復（Recovery）：** 這個階段的重點，是在錯誤發生後把 Agent 或系統拉回穩定、可運作的狀態。它可能涉及撤銷最近的變更或交易，把錯誤造成的影響回復（state rollback）。徹底調查錯誤的成因，對防止再度發生很重要。透過自我修正機制或重新規劃流程，調整 Agent 的計畫、邏輯或參數，可能是避免未來重蹈覆轍所必需的。在複雜或嚴重的情況下，把問題交給人類操作員或更高層級的系統（escalation），也許才是最好的做法。

實作這套穩健的例外處理與恢復模式，能把 AI Agent 從脆弱、不可靠的系統，轉變成穩健、可信賴的元件，在充滿挑戰、高度難以預測的環境中依然能有效、有韌性地運作。這確保了 Agent 維持功能、把停機時間降到最低，即使碰上意外問題，也能提供順暢又可靠的體驗。

## 實際應用與使用情境

只要 Agent 部署到無法保證條件完美的真實場景，Exception Handling and Recovery 就是不可或缺的。

* **客服聊天機器人：** 如果聊天機器人想存取客戶資料庫，而資料庫暫時當機，它不該直接崩潰。它應該偵測到這個 API 錯誤、告知使用者這是暫時性問題，或許建議稍後再試，或是把這個查詢升級給真人客服。
* **自動化金融交易：** 交易機器人在執行交易時，可能碰到「資金不足」或「市場已收盤」的錯誤。它得處理這些例外：記錄錯誤、不要一再嘗試同一筆無效交易，並視情況通知使用者或調整策略。
* **智慧家庭自動化：** 控制智慧燈的 Agent，可能因為網路問題或裝置故障而點不亮燈。它應該偵測到這次失敗，或許重試，如果還是不成功，就通知使用者燈無法開啟，並建議手動處理。
* **資料處理 Agent：** 負責處理一批文件的 Agent，可能碰到損壞的檔案。它應該跳過損壞的檔案、記錄錯誤、繼續處理其他檔案，並在最後回報被跳過的檔案，而不是讓整個流程停擺。
* **網頁爬蟲 Agent：** 當網頁爬蟲 Agent 碰到 CAPTCHA、網站結構改變或伺服器錯誤（例如 404 Not Found、503 Service Unavailable）時，它得優雅地應對。做法可能包括暫停、改用代理伺服器（proxy），或回報是哪個 URL 失敗了。
* **機器人與製造業：** 執行組裝任務的機械手臂，可能因為對位不準而抓不起某個零件。它得偵測到這次失敗（例如透過感測器回饋）、嘗試重新調整、再試著抓取，如果持續失敗，就警示人類操作員或改用其他零件。

簡而言之，這個模式是打造 Agent 的根本，讓它們面對真實世界的複雜性時，不只聰明，還可靠、有韌性、對使用者友善。

## 實作範例（ADK）

例外處理與恢復，對系統的穩健性和可靠性至關重要。舉個例子，想想 Agent 面對一次失敗的工具呼叫時該怎麼反應。這類失敗可能源自錯誤的工具輸入，也可能來自工具所依賴的外部服務出了問題。

```python
from google.adk.agents import Agent, SequentialAgent


# Agent 1: Tries the primary tool. Its focus is narrow and clear.
primary_handler = Agent(
    name="primary_handler",
    model="gemini-2.0-flash-exp",
    instruction="""
    Your job is to get precise location information. Use the get_precise_location_info
    tool with the user's provided address.
    """,
    tools=[get_precise_location_info],
)

# Agent 2: Acts as the fallback handler, checking state to decide its action.
fallback_handler = Agent(
    name="fallback_handler",
    model="gemini-2.0-flash-exp",
    instruction="""
    Check if the primary location lookup failed by looking at state["primary_location_failed"].
    - If it is True, extract the city from the user's original query and use the get_general_area_info tool.
    - If it is False, do nothing.
    """,
    tools=[get_general_area_info],
)

# Agent 3: Presents the final result from the state.
response_agent = Agent(
    name="response_agent",
    model="gemini-2.0-flash-exp",
    instruction="""
    Review the location information stored in state["location_result"]. Present this information
    clearly and concisely to the user. If state["location_result"] does not exist or is empty,
    apologize that you could not retrieve the location.
    """,
    tools=[],  # This agent only reasons over the final state.
)

# The SequentialAgent ensures the handlers run in a guaranteed order.
robust_location_agent = SequentialAgent(
    name="robust_location_agent",
    sub_agents=[primary_handler, fallback_handler, response_agent],
)
```

這段程式碼用 ADK 的 SequentialAgent 搭配三個子 Agent，定義了一套穩健的位置查詢系統。`primary_handler` 是第一個 Agent，會嘗試用 `get_precise_location_info` 工具取得精確的位置資訊。`fallback_handler` 扮演備援角色，透過檢查一個狀態變數，判斷主要查詢是否失敗。如果主要查詢失敗了，備援 Agent 就從使用者的查詢中抽出城市，改用 `get_general_area_info` 工具。`response_agent` 是這個序列裡的最後一個 Agent，它會查看儲存在狀態中的位置資訊，負責把最終結果呈現給使用者；如果沒找到任何位置資訊，就致歉。SequentialAgent 確保這三個 Agent 按照預先定義的順序執行。這種結構讓位置資訊的查詢，能採取一種分層處理的做法。

## 速覽

**問題：** 在真實環境中運作的 AI Agent，難免會碰到預料之外的狀況、錯誤和系統故障。這些干擾的範圍很廣，從工具失效、網路問題到無效資料都有，威脅著 Agent 完成任務的能力。少了一套有結構的方法來管理這些問題，Agent 就會變得脆弱、不可靠，一遇到意外障礙就容易全面崩潰。這種不可靠，讓它們很難被部署到那些「表現必須穩定一致」的關鍵或複雜應用中。

**解法：** Exception Handling and Recovery 模式，為打造穩健、有韌性的 AI Agent 提供了一套標準化的解法。它賦予 Agent 一種 Agentic 能力：預先設想、管理並從運作失敗中恢復。這個模式涵蓋主動的錯誤偵測，例如監看工具輸出和 API 回應；也涵蓋被動的處理策略，例如記錄日誌以供診斷、重試暫時性失敗，或改用備援機制。對更嚴重的問題，它定義了恢復流程，包括回復到穩定狀態、透過調整計畫來自我修正，或把問題升級給人類操作員。這套有系統的做法，確保 Agent 能維持運作的完整性、從失敗中學習，並在難以預測的環境中可靠運作。

**經驗法則：** 只要 AI Agent 部署在動態的真實環境中，可能碰到系統故障、工具錯誤、網路問題或難以預料的輸入，而運作可靠性又是關鍵要求，就適合用這個模式。

**圖解：**

![Exception Handling 模式](/assets/agentic-design-patterns/Exception_Handling_Pattern.png)

圖 2：例外處理模式

## 重點回顧

需要記住的要點：

* Exception Handling and Recovery 是打造穩健、可靠 Agent 的必要條件。
* 這個模式涵蓋偵測錯誤、優雅地處理錯誤，並實作各種恢復策略。
* 錯誤偵測可以包括驗證工具輸出、檢查 API 錯誤碼，以及使用逾時（timeout）機制。
* 處理策略包括 logging、重試、備援、優雅降級和通知。
* 恢復的重點，是透過診斷、自我修正或升級處理，把系統拉回穩定運作。
* 這個模式確保 Agent 即使在難以預測的真實環境中，也能有效運作。

## 結語

本章探討了 Exception Handling and Recovery 模式，它對開發穩健、可信賴的 AI Agent 至關重要。這個模式處理的是：AI Agent 如何辨識並管理意外問題、實施適當的因應措施，並恢復到穩定的運作狀態。本章討論了這個模式的幾個面向，包括錯誤的偵測、透過 logging、重試、備援等機制來處理這些錯誤，以及用來把 Agent 或系統拉回正常運作的各種策略。本章也用好幾個領域的實際應用，說明這個模式在應付真實世界的複雜性和潛在失敗時有多重要。這些應用顯示，替 AI Agent 裝上例外處理能力，如何能提升它們在動態環境中的可靠性和適應力。

## 參考資料

1. McConnell, S. (2004). *Code Complete (2nd ed.)*. Microsoft Press.
2. Shi, Y., Pei, H., Feng, L., Zhang, Y., & Yao, D. (2024). *Towards Fault Tolerance in Multi-Agent Reinforcement Learning*. arXiv preprint arXiv:2412.00534.
3. O'Neill, V. (2022). *Improving Fault Tolerance and Reliability of Heterogeneous Multi-Agent IoT Systems Using Intelligence Transfer*. Electronics, 11(17), 2724.
