---
title: "Agentic Design Patterns 第 13 章：Human-in-the-Loop（人機協作）"
description: "在關鍵決策點把人拉進迴圈：審核、修正、接手。《Agentic Design Patterns》第 13 章繁體中文翻譯。"
pubDatetime: 2026-07-18T20:47:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

Human-in-the-Loop（HITL，人機協作）模式是 Agent 開發與部署中的關鍵策略。它刻意把人類認知的獨特強項──判斷力、創造力、對細微差異的理解──和 AI 的運算能力與效率結合在一起。這種策略性的整合不只是一種選項，很多時候更是必要，尤其是當 AI 系統越來越深入地嵌進關鍵決策流程裡。

HITL 的核心原則，是確保 AI 在道德邊界內運作、遵守安全規範，並以最佳效果達成目標。在複雜、模糊或高風險的領域，這些考量特別突出，因為 AI 一旦出錯或誤判，後果可能相當嚴重。在這種情況下，完全自主──也就是 AI 系統在沒有任何人為介入下獨立運作──可能是不明智的。HITL 承認這個現實，並強調即使 AI 技術快速進步，人類的監督、策略性投入和協作互動仍然不可或缺。

HITL 方法從根本上圍繞著人工智慧與人類智慧之間的協同這個概念。HITL 不把 AI 當成人類工作者的替代品，而是把 AI 定位成擴充、強化人類能力的工具。這種強化可以有很多形式，從自動化例行工作，到提供以資料驅動的洞見來輔助人類決策。最終目標是打造一個協作的生態系，讓人類和 AI Agent 都能發揮各自的強項，達成任何一方單獨都做不到的成果。

實務上，HITL 有很多種實作方式。常見的做法之一，是讓人類擔任驗證者或審查者，檢查 AI 的輸出來確保準確、找出可能的錯誤。另一種做法是讓人類主動引導 AI 的行為，即時提供回饋或做出修正。在更複雜的設計裡，人類可能和 AI 以夥伴的身分協作，透過互動式對話或共用介面一起解決問題、做決策。不管具體怎麼實作，HITL 模式都強調維持人類控制與監督的重要性，確保 AI 系統始終和人類的道德、價值觀、目標及社會期待保持一致。

## 模式概觀

Human-in-the-Loop（HITL）模式把人工智慧和人類的輸入結合起來，藉此強化 Agent 的能力。這種做法承認：要讓 AI 發揮最佳表現，往往需要自動化處理和人類洞見的結合，尤其是在高度複雜或涉及道德考量的情境中。HITL 的目標不是取代人類的輸入，而是透過確保關鍵判斷與決策都建立在人類理解之上，來擴充人類的能力。

HITL 涵蓋幾個關鍵面向：人類監督（Human Oversight），也就是監控 AI Agent 的表現和輸出（例如透過日誌審查或即時儀表板），確保符合準則、避免出現不樂見的結果。介入與修正（Intervention and Correction）發生在 AI Agent 遇到錯誤或模糊情境、可能請求人為介入的時候；人類操作員可以修正錯誤、補上缺漏的資料，或引導 Agent，這同時也為未來的 Agent 改進提供依據。用於學習的人類回饋（Human Feedback for Learning）會被收集起來，用來調校 AI 模型，在「以人類回饋進行的強化學習」這類方法中特別明顯，其中人類的偏好直接影響 Agent 的學習軌跡。決策增強（Decision Augmentation）是指 AI Agent 向人類提供分析和建議，再由人類做出最終決定，用 AI 產出的洞見來強化人類決策，而不是完全交由 AI 自主。人機協作（Human-Agent Collaboration）是一種合作式互動，人類和 AI Agent 各自貢獻所長；例行的資料處理可以交給 Agent，而創意性的問題解決或複雜的談判則由人類掌控。最後，升級策略（Escalation Policies）是預先制定的規範，規定 Agent 在什麼時候、以什麼方式把任務升級交給人類操作員，避免在超出 Agent 能力範圍的情況下出錯。

導入 HITL 模式，讓 Agent 能夠用在那些完全自主不可行、或不被允許的敏感產業裡。它也透過回饋迴圈，提供了持續改進的機制。舉例來說，在金融領域，一筆大額企業貸款的最終核准，需要人類放款專員來評估像是領導層品格這類質性因素。同樣地，在法律領域，正義與問責的核心原則要求由人類法官保有對關鍵決定（例如量刑）的最終權力，因為這些決定牽涉複雜的道德推理。

> **注意事項：** 儘管 HITL 模式好處很多，它也有幾個重要的隱憂，其中最主要的是缺乏可擴展性。人類監督雖然能提供高準確度，但操作員沒辦法處理數以百萬計的任務，這造成了一個根本性的取捨，往往需要採用混合式做法──用自動化來衝規模、用 HITL 來顧準確度。此外，這個模式的成效高度取決於人類操作員的專業程度；舉例來說，AI 雖然能產生軟體程式碼，但只有熟練的開發者才能準確找出細微的錯誤、給出正確的修正指引。這種對專業的需求，在用 HITL 產生訓練資料時同樣存在，因為人類標註員可能需要接受特別訓練，才能學會用「能產出高品質資料」的方式去修正 AI。最後，導入 HITL 會引發重大的隱私疑慮，因為敏感資訊往往必須經過嚴格匿名化，才能交給人類操作員看，這又多加了一層流程上的複雜度。

## 實際應用與使用情境

Human-in-the-Loop 模式在許多產業和應用中都很關鍵，尤其是在準確性、安全、道德或細膩理解最為重要的場合。

* **內容審核：** AI Agent 可以快速過濾大量線上內容、找出違規的部分（例如仇恨言論、垃圾訊息）。不過，模糊的案例或處於邊界的內容會被升級交給人類審核員審查、做最終決定，確保判斷細膩、並符合複雜的政策。
* **自動駕駛：** 自駕車雖然自主處理大部分駕駛工作，但它們被設計成在 AI 沒把握應付的複雜、難以預測或危險情境下（例如極端天氣、異常路況），把控制權交還給人類駕駛。
* **金融詐欺偵測：** AI 系統可以依據模式標記可疑交易。不過，高風險或模糊的警示常常會送給人類分析師，由他們進一步調查、聯繫客戶，並對一筆交易是否為詐欺做出最終判定。
* **法律文件審查：** AI 可以快速掃描、分類數千份法律文件，找出相關的條款或證據。接著由人類法律專業人員審查 AI 的發現，確認其準確性、脈絡和法律意涵，關鍵案件尤其如此。
* **客戶支援（複雜問題）：** 聊天機器人可以處理例行的客戶詢問。如果使用者的問題太過複雜、情緒激動，或需要 AI 給不出的同理心，對話就會順暢地交接給人類客服人員。
* **資料標記與標註：** AI 模型訓練時常常需要大量已標記的資料集。把人類納入流程，是為了準確標記圖像、文字或音訊，提供 AI 學習所依據的標準答案（ground truth）。隨著模型持續演進，這是一個不斷進行的過程。
* **生成式 AI 精修：** 當 LLM（大型語言模型）產生創意內容（例如行銷文案、設計構想）時，由人類編輯或設計師來審查、精修輸出，確保它符合品牌準則、能打動目標受眾，並維持品質。
* **自主網路：** AI 系統能夠運用關鍵績效指標（KPI）和已辨識的模式，分析警示、預測網路問題和流量異常。不過，關鍵決策──例如處理高風險警示──常常會被升級交給人類分析師。這些分析師會進一步調查，並對是否核准網路變更做出最終判定。

這個模式示範了一種務實的 AI 導入方法。它借助 AI 來提升可擴展性和效率，同時維持人類監督，以確保品質、安全和道德合規。

「Human-on-the-loop」是這個模式的一種變體，由人類專家定義整體的政策方針，再由 AI 處理即時的行動來確保合規。我們來看兩個例子：

* **自動化金融交易系統**：在這個情境裡，人類金融專家設定整體的投資策略和規則。舉例來說，人類可能把政策定義成：「維持 70% 科技股、30% 債券的投資組合，任何單一公司的投資不超過 5%，並自動賣出任何跌破買進價 10% 的股票。」接著 AI 即時監控股市，一旦滿足這些預先定義的條件就立刻執行交易。AI 負責的是即時、高速的行動，依據的則是人類操作員設定的、較慢也較具策略性的政策。
* **現代化客服中心**：在這個設計裡，人類主管為客戶互動建立高階政策。舉例來說，主管可能設定像這樣的規則：「任何提到『服務中斷』的來電應立即轉接給技術支援專員」，或「如果客戶的語氣顯示高度不滿，系統應主動提議直接為他接通人類客服」。接著 AI 系統處理最初的客戶互動，即時聆聽並解讀他們的需求。它會自主執行主管的政策，立刻轉接來電或提議升級，不需要對每個個別案例都做人為介入。這讓 AI 能依據人類操作員給出的、較慢也較具策略性的指引，處理大量的即時行動。

## 實作範例

為了示範 Human-in-the-Loop 模式，一個 ADK Agent 可以辨識出需要人類審查的情境，並啟動升級流程。這讓 Agent 在自主決策能力受限、或需要複雜判斷的情況下，能有人為介入的空間。這並不是單一框架獨有的功能；其他熱門框架也採用了類似的能力。以 LangChain 為例，它同樣提供了實作這類互動的工具。

```python
from typing import Optional

from google.adk.agents import Agent
from google.adk.tools.tool_context import ToolContext
from google.adk.callbacks import CallbackContext
from google.adk.models.llm import LlmRequest
from google.genai import types


# Placeholder for tools (replace with actual implementations if needed)
def troubleshoot_issue(issue: str) -> dict:
    return {"status": "success", "report": f"Troubleshooting steps for {issue}."}


def create_ticket(issue_type: str, details: str) -> dict:
    return {"status": "success", "ticket_id": "TICKET123"}


def escalate_to_human(issue_type: str) -> dict:
    # This would typically transfer to a human queue in a real system
    return {"status": "success", "message": f"Escalated {issue_type} to a human specialist."}


technical_support_agent = Agent(
    name="technical_support_specialist",
    model="gemini-2.0-flash-exp",
    instruction="""
    You are a technical support specialist for our electronics company.
    FIRST, check if the user has a support history in state["customer_info"]["support_history"].
    If they do, reference this history in your responses.

    For technical issues:
    1. Use the troubleshoot_issue tool to analyze the problem.
    2. Guide the user through basic troubleshooting steps.
    3. If the issue persists, use create_ticket to log the issue.

    For complex issues beyond basic troubleshooting:
    1. Use escalate_to_human to transfer to a human specialist.

    Maintain a professional but empathetic tone. Acknowledge the frustration technical issues can cause,
    while providing clear steps toward resolution.
    """,
    tools=[troubleshoot_issue, create_ticket, escalate_to_human],
)


def personalization_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> Optional[LlmRequest]:
    """Adds personalization information to the LLM request."""
    # Get customer info from state
    customer_info = callback_context.state.get("customer_info")
    if customer_info:
        customer_name = customer_info.get("name", "valued customer")
        customer_tier = customer_info.get("tier", "standard")
        recent_purchases = customer_info.get("recent_purchases", [])

        personalization_note = (
            f"\nIMPORTANT PERSONALIZATION:\n"
            f"Customer Name: {customer_name}\n"
            f"Customer Tier: {customer_tier}\n"
        )
        if recent_purchases:
            personalization_note += f"Recent Purchases: {', '.join(recent_purchases)}\n"

        if llm_request.contents:
            # Add as a system message before the first content
            system_content = types.Content(
                role="system",
                parts=[types.Part(text=personalization_note)],
            )
            llm_request.contents.insert(0, system_content)

    return None  # Return None to continue with the modified request
```

這段程式碼提供了一個藍圖，示範如何用 Google 的 ADK 打造一個技術支援 Agent，整體圍繞著 HITL 框架來設計。這個 Agent 扮演的是聰明的第一線支援角色，配上特定的指令，並搭載 `troubleshoot_issue`、`create_ticket` 和 `escalate_to_human` 等工具，來管理一整套完整的支援工作流程。其中的升級工具是 HITL 設計的核心，確保複雜或敏感的案例會被交給人類專員。

這套架構的一個關鍵特色，是它能做到深度個人化，靠的是一個專門的 callback 函式。在聯繫 LLM 之前，這個函式會從 Agent 的 state 中動態取出客戶專屬的資料──像是姓名、等級和購買紀錄。接著把這些脈絡以系統訊息的形式注入 prompt 裡，讓 Agent 能給出高度客製、有依據的回應，並引用使用者的過往紀錄。透過把結構化的工作流程，和必要的人類監督與動態個人化結合起來，這段程式碼是個實際的範例，展示了 ADK 如何協助開發出成熟、穩健的 AI 支援方案。

## 速覽

**問題：** 包括先進 LLM 在內的 AI 系統，常常在需要細膩判斷、道德推理，或需要深入理解複雜、模糊脈絡的任務上表現吃力。在高風險環境中部署完全自主的 AI 帶有重大風險，因為一旦出錯，可能造成嚴重的安全、財務或道德後果。這些系統缺乏人類天生具備的創造力和常識推理。因此，在關鍵決策流程中只倚賴自動化，往往並不明智，還可能損害系統整體的成效與可信度。

**解法：** Human-in-the-Loop（HITL）模式提供了一套標準化的解法，把人類監督策略性地整合進 AI 的工作流程裡。這種 Agent 式的做法建立起一種共生的夥伴關係：AI 負責繁重的運算和資料處理，人類則提供關鍵的驗證、回饋和介入。透過這樣的分工，HITL 確保 AI 的行動與人類的價值觀和安全規範一致。這個協作框架不只降低了完全自動化的風險，還透過從人類輸入中持續學習來強化系統的能力。最終，這會帶來更穩健、更準確、更符合道德的成果，而這些是人類或 AI 單獨都達不到的。

**經驗法則：** 當你要把 AI 部署到「錯誤會造成重大安全、道德或財務後果」的領域時，例如醫療、金融或自主系統，就使用這個模式。對於那些涉及 LLM 無法可靠處理的模糊性和細微差異的任務，例如內容審核或複雜的客戶支援升級，它更是不可或缺。當目標是用高品質、由人類標記的資料持續改進 AI 模型，或是精修生成式 AI 的輸出以符合特定品質標準時，也採用 HITL。

**圖解：**

![Human-in-the-Loop 設計模式](/assets/agentic-design-patterns/Human_in_the_Loop_Design_Pattern.png)

圖 1：Human-in-the-Loop 設計模式

## 重點回顧

重點包括：

* Human-in-the-Loop（HITL）把人類的智慧和判斷整合進 AI 的工作流程裡。
* 它在複雜或高風險的情境中，對安全、道德和成效至關重要。
* 關鍵面向包括人類監督、介入、用於學習的回饋，以及決策增強。
* 升級策略對於讓 Agent 知道何時該交接給人類，是不可或缺的。
* HITL 讓負責任的 AI 部署和持續改進成為可能。
* Human-in-the-Loop 的主要缺點，是它先天就缺乏可擴展性，在準確度和數量之間造成取捨，而且要有效介入還得倚賴高技能的領域專家。
* 它的導入帶來一些營運上的挑戰，包括為了產生資料而需要訓練人類操作員，以及為了處理隱私疑慮而必須把敏感資訊匿名化。

## 結語

本章探討了至關重要的 Human-in-the-Loop（HITL）模式，強調它在打造穩健、安全、合乎道德的 AI 系統中所扮演的角色。我們討論了把人類監督、介入和回饋整合進 Agent 工作流程，能如何大幅提升它們的表現和可信度，尤其是在複雜、敏感的領域。實際應用展現了 HITL 的廣泛用途，從內容審核、醫療診斷，到自動駕駛和客戶支援都涵蓋在內。概念性的程式碼範例則讓我們一窺 ADK 如何透過升級機制，促成這些人機之間的互動。隨著 AI 能力持續進步，HITL 仍是負責任 AI 開發的基石，確保人類的價值觀和專業，在智慧系統的設計中始終居於核心地位。

## 參考資料

1. A Survey of Human-in-the-loop for Machine Learning, Xingjiao Wu, Luwei Xiao, Yixuan Sun, Junhang Zhang, Tianlong Ma, Liang He, [https://arxiv.org/abs/2108.00941](https://arxiv.org/abs/2108.00941)
