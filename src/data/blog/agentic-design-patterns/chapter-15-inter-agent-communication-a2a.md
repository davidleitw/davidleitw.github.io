---
title: "Agentic Design Patterns 第 15 章：Inter-Agent Communication（A2A）"
description: "Agent 之間怎麼用 A2A 協定互相溝通、委派任務。《Agentic Design Patterns》第 15 章繁體中文翻譯。"
pubDatetime: 2026-07-18T20:45:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

單一 AI Agent 就算能力再強，面對複雜、牽涉多個面向的問題時往往還是會撞到極限。為了突破這個限制，Inter-Agent Communication（Agent 間通訊，A2A）讓不同的 AI Agent（甚至可能是用不同框架打造出來的）能有效協作。這種協作包含順暢的協調、任務委派，以及資訊交換。

Google 的 A2A 協定是一套開放標準，目的就是讓這種通用的通訊成為可能。本章會探討 A2A、它的實際應用，以及在 Google ADK 裡怎麼實作。

## Inter-Agent Communication 模式概觀

Agent2Agent（A2A）協定是一套開放標準，設計目的是讓不同的 AI Agent 框架之間能互相通訊、協作。它確保了互通性，讓用 LangGraph、CrewAI 或 Google ADK 等技術開發出來的 AI Agent 能一起運作，不管它們出身哪裡、框架差異有多大。

A2A 背後有一大票科技公司和服務供應商支持，包括 Atlassian、Box、LangChain、MongoDB、Salesforce、SAP 和 ServiceNow。Microsoft 打算把 A2A 整合進 Azure AI Foundry 和 Copilot Studio，展現它對開放協定的投入。此外，Auth0 和 SAP 也正把 A2A 的支援整合到自家平台和 Agent 裡。

身為一套開源協定，A2A 歡迎社群貢獻，好讓它持續演進、被廣泛採用。

## A2A 的核心概念

A2A 協定為 Agent 之間的互動提供了一套結構化的做法，這套做法建立在幾個核心概念之上。任何要開發、或要跟 A2A 相容系統整合的人，徹底搞懂這些概念都很關鍵。A2A 的幾根基礎支柱包括核心參與者（Core Actors）、Agent Card、Agent 探索（Agent Discovery）、通訊與任務、互動機制，以及安全性，以下會逐一詳細說明。

**核心參與者（Core Actors）：** A2A 牽涉三個主要角色：

* User（使用者）：發起請求，尋求 Agent 協助。
* A2A Client（Client Agent，客戶端 Agent）：一個應用程式或 AI Agent，代表使用者去請求動作或資訊。
* A2A Server（Remote Agent，遠端 Agent）：一個 AI Agent 或系統，提供 HTTP 端點來處理客戶端的請求並回傳結果。這個遠端 Agent 是以「不透明（opaque）」的方式運作，意思是客戶端不需要了解它內部的運作細節。

**Agent Card：** Agent 的數位身分由它的 Agent Card 定義，通常是一個 JSON 檔。這個檔案包含了讓客戶端能互動、能自動探索的關鍵資訊，包括 Agent 的身分、端點 URL 和版本。它也詳列了支援哪些能力（例如串流或推播通知）、有哪些特定技能、預設的輸入／輸出模式，以及身分驗證的要求。以下是一個 WeatherBot 的 Agent Card 範例。

```json
{
    "name": "WeatherBot",
    "description": "Provides accurate weather forecasts and historical data.",
    "url": "http://weather-service.example.com/a2a",
    "version": "1.0.0",
    "capabilities": {
        "streaming": true,
        "pushNotifications": false,
        "stateTransitionHistory": true
    },
    "authentication": {
        "schemes": [
            "apiKey"
        ]
    },
    "defaultInputModes": [
        "text"
    ],
    "defaultOutputModes": [
        "text"
    ],
    "skills": [
        {
            "id": "get_current_weather",
            "name": "Get Current Weather",
            "description": "Retrieve real-time weather for any location.",
            "inputModes": [
                "text"
            ],
            "outputModes": [
                "text"
            ],
            "examples": [
                "What's the weather in Paris?",
                "Current conditions in Tokyo"
            ],
            "tags": [
                "weather",
                "current",
                "real-time"
            ]
        },
        {
            "id": "get_forecast",
            "name": "Get Forecast",
            "description": "Get 5-day weather predictions.",
            "inputModes": [
                "text"
            ],
            "outputModes": [
                "text"
            ],
            "examples": [
                "5-day forecast for New York",
                "Will it rain in London this weekend?"
            ],
            "tags": [
                "weather",
                "forecast",
                "prediction"
            ]
        }
    ]
}
```

**Agent 探索（Agent Discovery）：** 它讓客戶端能找到 Agent Card，而 Agent Card 描述了可用 A2A Server 的能力。這個過程有幾種策略：

* 知名 URI（Well-Known URI）：Agent 把自己的 Agent Card 放在一個標準化的路徑上（例如 /.well-known/agent.json）。這種做法能提供廣泛、通常是自動化的存取，適合公開或特定領域的用途。
* 精選登錄庫（Curated Registries）：這類登錄庫提供一個集中的目錄，Agent Card 會發布在這裡，並可依特定條件查詢。這很適合需要集中管理和存取控制的企業環境。
* 直接設定（Direct Configuration）：Agent Card 的資訊直接內嵌，或私下分享。這種方式適合緊密耦合或私有的系統，這類系統裡動態探索不是重點。

不管選哪種方式，保護好 Agent Card 端點都很重要。這可以透過存取控制、雙向 TLS（mTLS）或網路限制來達成，尤其是當卡片裡含有敏感（雖然不算機密）資訊的時候。

**通訊與任務：** 在 A2A 框架裡，通訊是圍繞著非同步任務（asynchronous task）來組織的，這些任務代表了長時間執行流程中最基本的工作單位。每個任務都會被指派一個唯一識別碼，並在一系列狀態之間移動，例如已提交（submitted）、工作中（working）或已完成（completed），這種設計能支援複雜操作中的平行處理。Agent 之間的通訊則是透過 Message（訊息）進行。

這種通訊包含 attributes（屬性，也就是描述訊息的鍵值對 metadata，例如優先順序或建立時間），以及一個或多個 parts（部分，用來承載實際遞送的內容，例如純文字、檔案或結構化的 JSON 資料）。Agent 在任務期間產生的具體產出，稱為 artifacts（工件）。跟訊息一樣，artifacts 也是由一個或多個 parts 組成，並可在結果陸續就緒時逐步串流出來。A2A 框架裡所有通訊都是透過 HTTP(S) 進行，payload 使用 JSON-RPC 2.0 協定。為了在多次互動之間維持連續性，會用一個伺服器產生的 contextId 來把相關任務歸為一組，並保留上下文。

**互動機制（Interaction Mechanisms）：** 請求／回應（輪詢）、伺服器發送事件（Server-Sent Events, SSE）。A2A 提供多種互動方法，來滿足各式各樣 AI 應用的需求，每一種各有不同的機制：

* 同步請求／回應（Synchronous Request/Response）：用於快速、即時的操作。在這種模式下，客戶端送出請求後，會主動等待伺服器處理完並在單一一次同步交換裡回傳完整回應。
* 非同步輪詢（Asynchronous Polling）：適合處理時間比較久的任務。客戶端送出請求後，伺服器會立刻用一個「工作中（working）」狀態和一個任務 ID 來確認收到。接著客戶端就能去做別的事，並可週期性地送出新請求來輪詢伺服器、查看任務狀態，直到任務被標記為「已完成（completed）」或「失敗（failed）」為止。
* 串流更新（伺服器發送事件，Server-Sent Events - SSE）：適合接收即時、增量的結果。這種方法會建立一條從伺服器到客戶端的持久單向連線。它讓遠端 Agent 能持續推送更新，例如狀態變化或部分結果，而客戶端不需要一直發請求。
* 推播通知（Webhooks）：專為那種執行非常久、或很耗資源的任務設計，這類任務要一直維持連線或頻繁輪詢都很沒效率。客戶端可以註冊一個 webhook URL，當任務狀態有重大變化時（例如完成時），伺服器就會往那個 URL 送出一則非同步通知（一次「推播」）。

Agent Card 會指明一個 Agent 是否支援串流或推播通知的能力。此外，A2A 是與模態無關（modality-agnostic）的，意思是它不只能為文字，也能為音訊、影片等其他資料類型提供這些互動模式，讓豐富的多模態 AI 應用成為可能。串流和推播通知這兩種能力都在 Agent Card 裡指明。

```json
# Synchronous Request Example 
{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "sendTask",
    "params": {
        "id": "task-001",
        "sessionId": "session-001",
        "message": {
            "role": "user",
            "parts": [
                {
                    "type": "text",
                    "text": "What is the exchange rate from USD to EUR?"
                }
            ]
        },
        "acceptedOutputModes": [
            "text/plain"
        ],
        "historyLength": 5
    }
}
```

同步請求用的是 sendTask 方法，客戶端就是在問一個問題、並期待拿到單一一個完整的答案。相對地，串流請求用的是 sendTaskSubscribe 方法來建立一條持久連線，讓 Agent 能隨時間陸續送回多筆增量更新或部分結果。

```json
# Streaming Request Example 
{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "sendTaskSubscribe",
    "params": {
        "id": "task-002",
        "sessionId": "session-001",
        "message": {
            "role": "user",
            "parts": [
                {
                    "type": "text",
                    "text": "What's the exchange rate for JPY to GBP today?"
                }
            ]
        },
        "acceptedOutputModes": [
            "text/plain"
        ],
        "historyLength": 5
    }
}
```

**安全性（Security）：** Inter-Agent Communication（A2A）是系統架構裡很關鍵的一環，它讓 Agent 之間能安全、順暢地交換資料。它靠幾個內建機制來確保穩健與完整。

雙向傳輸層安全（Mutual Transport Layer Security, TLS）：建立加密且經過驗證的連線，防止未授權存取和資料被攔截，確保通訊安全。

完整的稽核日誌（Comprehensive Audit Logs）：所有 Agent 之間的通訊都被鉅細靡遺地記錄下來，詳載了資訊流向、牽涉哪些 Agent、做了哪些動作。這份稽核軌跡對於究責、排除問題和安全分析都很關鍵。

Agent Card 宣告（Agent Card Declaration）：身分驗證的要求會在 Agent Card 裡明確宣告，Agent Card 是一份設定用的工件，載明了 Agent 的身分、能力和安全政策。這讓身分驗證的管理集中化、也更簡單。

憑證處理（Credential Handling）：Agent 通常用安全的憑證來做身分驗證，例如 OAuth 2.0 token 或 API key，透過 HTTP 標頭傳遞。這種做法避免了憑證暴露在 URL 或訊息本體裡，整體提升了安全性。

## A2A 與 MCP

A2A 這套協定是用來跟 Anthropic 的 Model Context Protocol（MCP）互補的（見圖 1）。MCP 專注在替 Agent 組織上下文、以及 Agent 跟外部資料和工具之間的互動；而 A2A 則著重在 Agent 之間的協調與通訊，讓任務委派和協作成為可能。

![A2A 與 MCP 協定的比較](/assets/agentic-design-patterns/Comparison_A2A_and_MCP_Protocols.png)

圖 1：A2A 與 MCP 協定的比較

A2A 的目標是提升效率、降低整合成本，並在複雜的多 Agent AI 系統開發中促進創新和互通性。因此，要有效地設計、實作和應用 A2A 來打造協作、可互通的 AI Agent 系統，徹底搞懂 A2A 的核心元件和運作方式是不可或缺的。

## 實際應用與使用情境

要在各種領域打造成熟的 AI 解決方案，Inter-Agent Communication 都是不可或缺的，它帶來了模組化、可擴展性，以及更強的智慧。

* **多框架協作：** A2A 最主要的使用情境，就是讓各自獨立的 AI Agent 不管底層是什麼框架（例如 ADK、LangChain、CrewAI）都能互相通訊、協作。這對於打造複雜的多 Agent 系統很根本，因為在這種系統裡，不同 Agent 各自專精於問題的不同面向。
* **自動化工作流程編排：** 在企業環境裡，A2A 能讓 Agent 之間委派、協調任務，藉此支撐複雜的工作流程。舉例來說，某個 Agent 可能負責一開始的資料收集，接著委派給另一個 Agent 做分析，最後再委派給第三個 Agent 產生報告，這一切通訊全都透過 A2A 協定進行。
* **動態資訊擷取：** Agent 之間可以互相通訊來擷取、交換即時資訊。一個主要的 Agent 可能向專門的「資料擷取 Agent」請求即時市場資料，後者接著用外部 API 去蒐集資訊、再送回來。

## 實作範例

我們來看看 A2A 協定的實際應用。位於 [https://github.com/google-a2a/a2a-samples/tree/main/samples](https://github.com/google-a2a/a2a-samples/tree/main/samples) 的儲存庫提供了 Java、Go 和 Python 的範例，說明各種 Agent 框架（例如 LangGraph、CrewAI、Azure AI Foundry 和 AG2）怎麼用 A2A 來通訊。這個儲存庫裡所有程式碼都以 Apache 2.0 授權釋出。為了進一步說明 A2A 的核心概念，我們會看幾段程式碼摘錄，重點放在怎麼用一個以 ADK 為基礎、並帶有 Google 身分驗證工具的 Agent 來架設一台 A2A Server。可參考 [https://github.com/google-a2a/a2a-samples/blob/main/samples/python/agents/birthday_planner_adk/calendar_agent/adk_agent.py](https://github.com/google-a2a/a2a-samples/blob/main/samples/python/agents/birthday_planner_adk/calendar_agent/adk_agent.py)

```python
import datetime

from google.adk.agents import LlmAgent  # type: ignore[import-untyped]
from google.adk.tools.google_api_tool import CalendarToolset  # type: ignore[import-untyped]


async def create_agent(client_id: str, client_secret: str) -> LlmAgent:
    """Constructs the ADK agent."""
    toolset = CalendarToolset(client_id=client_id, client_secret=client_secret)
    return LlmAgent(
        model="gemini-2.0-flash-001",
        name="calendar_agent",
        description="An agent that can help manage a user's calendar",
        instruction=(
            f""" You are an agent that can help manage a user's calendar. Users will request information about the state of their calendar """
            f""" or to make changes to their calendar. Use the provided tools for interacting with the calendar API. """
            f""" If not specified, assume the calendar the user wants is the 'primary' calendar. """
            f""" When using the Calendar API tools, use well-formed RFC3339 timestamps. Today is {datetime.datetime.now()}. """
        ),
        tools=await toolset.get_tools(),
    )
```

這段 Python 程式碼定義了一個非同步函式 `create_agent`，用來建構一個 ADK 的 LlmAgent。它一開始先用傳入的客戶端憑證初始化一個 `CalendarToolset`，以便存取 Google Calendar API。接著建立一個 `LlmAgent` 實例，設定了指定的 Gemini 模型、一個具描述性的名稱，以及一段管理使用者行事曆的指令。這個 Agent 配上了來自 `CalendarToolset` 的行事曆工具，讓它能跟 Calendar API 互動、回應使用者關於行事曆狀態或修改的查詢。Agent 的指令會動態帶入當前日期，好提供時間上的上下文。為了說明一個 Agent 是怎麼建構出來的，我們來看看 GitHub 上 A2A 範例裡 `calendar_agent` 的一個關鍵段落。

底下這段程式碼展示了這個 Agent 是怎麼帶著它特定的指令和工具被定義出來的。請注意，這裡只列出說明這個功能所需要的程式碼；你可以在這裡取得完整檔案：[https://github.com/a2aproject/a2a-samples/blob/main/samples/python/agents/birthday_planner_adk/calendar_agent/__main__.py](https://github.com/a2aproject/a2a-samples/blob/main/samples/python/agents/birthday_planner_adk/calendar_agent/__main__.py)

```python
def main(host: str = "0.0.0.0", port: int = 8000):
    # Verify an API key is set.
    # Not required if using Vertex AI APIs.
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") != "TRUE" and not os.getenv("GOOGLE_API_KEY"):
        raise ValueError(
            "GOOGLE_API_KEY environment variable not set and "
            "GOOGLE_GENAI_USE_VERTEXAI is not TRUE."
        )

    skill = AgentSkill(
        id="check_availability",
        name="Check Availability",
        description="Checks a user's availability for a time using their Google Calendar",
        tags=["calendar"],
        examples=["Am I free from 10am to 11am tomorrow?"],
    )

    agent_card = AgentCard(
        name="Calendar Agent",
        description="An agent that can manage a user's calendar",
        url=f"http://{host}:{port}/",
        version="1.0.0",
        defaultInputModes=["text"],
        defaultOutputModes=["text"],
        capabilities=AgentCapabilities(streaming=True),
        skills=[skill],
    )

    adk_agent = asyncio.run(
        create_agent(
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        )
    )

    runner = Runner(
        app_name=agent_card.name,
        agent=adk_agent,
        artifact_service=InMemoryArtifactService(),
        session_service=InMemorySessionService(),
        memory_service=InMemoryMemoryService(),
    )
    agent_executor = ADKAgentExecutor(runner, agent_card)

    async def handle_auth(request: Request) -> PlainTextResponse:
        await agent_executor.on_auth_callback(
            str(request.query_params.get("state")),
            str(request.url),
        )
        return PlainTextResponse("Authentication successful.")

    request_handler = DefaultRequestHandler(
        agent_executor=agent_executor,
        task_store=InMemoryTaskStore(),
    )

    a2a_app = A2AStarletteApplication(
        agent_card=agent_card,
        http_handler=request_handler,
    )
    routes = a2a_app.routes()
    routes.append(
        Route(
            path="/authenticate",
            methods=["GET"],
            endpoint=handle_auth,
        )
    )
    app = Starlette(routes=routes)

    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
```

這段 Python 程式碼示範了怎麼架設一個符合 A2A 規範的「Calendar Agent（行事曆 Agent）」，用來透過 Google Calendar 檢查使用者的空檔。它會為了身分驗證的目的去驗證 API key 或 Vertex AI 的設定。這個 Agent 的能力（包括「check_availability」這個技能）被定義在一個 AgentCard 裡，AgentCard 同時也指明了這個 Agent 的網路位址。接著建立一個 ADK Agent，並配上一組記憶體內（in-memory）服務來管理工件、session 和記憶。然後程式碼初始化一個 Starlette Web 應用程式，把身分驗證的回呼和 A2A 協定的處理器都納進來，最後用 Uvicorn 執行它，透過 HTTP 把這個 Agent 對外開放。

這些範例說明了打造一個符合 A2A 規範的 Agent 是什麼流程，從定義它的能力，到把它當成一個 Web 服務跑起來。開發者靠著 Agent Card 和 ADK，就能建立出能跟 Google Calendar 這類工具整合、又能互通的 AI Agent。這種務實的做法展示了 A2A 在建立多 Agent 生態系上的應用。

想更深入探索 A2A，推薦看 [https://www.trickle.so/blog/how-to-build-google-a2a-project](https://www.trickle.so/blog/how-to-build-google-a2a-project) 的程式碼示範。這個連結提供的資源包括 Python 和 JavaScript 的 A2A 客戶端和伺服器範例、多 Agent 的 Web 應用程式、命令列介面，以及各種 Agent 框架的範例實作。

## 速覽

**問題：** 單一 AI Agent，尤其是那些用不同框架打造出來的，各自面對複雜、牽涉多個面向的問題時常常吃力。最主要的難題在於，它們缺乏一種共同的語言或協定，讓它們能有效地通訊、協作。這種各自為政的孤立狀態，讓人沒辦法打造出那種由多個專精 Agent 各展所長、合力解決更大任務的成熟系統。少了標準化的做法，要整合這些各不相同的 Agent 就會又貴又費時，也拖累了更強大、更整合的 AI 解決方案的發展。

**解法：** Inter-Agent Communication（A2A）協定為這個問題提供了一套開放、標準化的解法。它是一套以 HTTP 為基礎的協定，能實現互通性，讓不同的 AI Agent 不管底層技術是什麼，都能協調、委派任務、共享資訊。它的一個核心元件是 Agent Card，這是一份數位身分檔，描述了一個 Agent 的能力、技能和通訊端點，讓探索和互動變得順暢。A2A 定義了多種互動機制，包括同步和非同步通訊，好支援各式各樣的使用情境。透過替 Agent 協作打造一套通用標準，A2A 培養出一個模組化、可擴展的生態系，用來打造複雜的多 Agent Agentic 系統。

**經驗法則：** 當你需要協調兩個以上的 AI Agent 協作時，就用這個模式，尤其是當它們是用不同框架（例如 Google ADK、LangGraph、CrewAI）打造的。它很適合用來打造複雜、模組化的應用程式，讓專精的 Agent 各自負責工作流程的特定部分，例如把資料分析委派給某個 Agent、把報告產生委派給另一個 Agent。當一個 Agent 需要動態地探索、並取用其他 Agent 的能力來完成任務時，這個模式也不可或缺。

**圖解：**

![A2A Inter-Agent Communication 模式](/assets/agentic-design-patterns/A2A_Inter-Agent_Communication_Pattern.png)

圖 2：A2A Inter-Agent Communication 模式

## 重點回顧

重點回顧：

* Google A2A 協定是一套開放、以 HTTP 為基礎的標準，讓用不同框架打造的 AI Agent 之間能通訊、協作。
* AgentCard 是一個 Agent 的數位識別，讓其他 Agent 能自動探索、理解它的能力。
* A2A 同時提供同步的請求—回應互動（用 `tasks/send`）和串流更新（用 `tasks/sendSubscribe`），來因應不同的通訊需求。
* 這套協定支援多輪對話，包括一個 `input-required` 狀態，讓 Agent 能在互動過程中請求更多資訊、並維持上下文。
* A2A 鼓勵一種模組化架構，讓專精的 Agent 能各自在不同的埠（port）上獨立運作，帶來系統的可擴展性和分散式部署。
* Trickle AI 這類工具能幫忙把 A2A 通訊視覺化、追蹤起來，協助開發者監控、除錯並最佳化多 Agent 系統。
* A2A 是一套高階協定，管的是不同 Agent 之間的任務和工作流程；而 Model Context Protocol（MCP）則是替 LLM 提供一個標準化介面，好讓它跟外部資源對接。

## 結語

Inter-Agent Communication（A2A）協定建立了一套關鍵、開放的標準，用來克服單一 AI Agent 天生的孤立問題。它提供了一套共同的、以 HTTP 為基礎的框架，確保在不同平台上（例如 Google ADK、LangGraph 或 CrewAI）打造出來的 Agent 能順暢協作、互通。它的一個核心元件是 Agent Card，作為數位身分，清楚定義了一個 Agent 的能力，讓其他 Agent 能動態探索。這套協定的彈性支援多種互動模式，包括同步請求、非同步輪詢和即時串流，滿足了各式各樣的應用需求。

這讓開發者能打造出模組化、可擴展的架構，把專精的 Agent 組合起來，去編排複雜的自動化工作流程。安全性是很根本的一環，內建了像 mTLS 和明確身分驗證要求這樣的機制來保護通訊。A2A 一方面跟 MCP 這類標準互補，另一方面它獨特的著重點在於 Agent 之間高階的協調和任務委派。主要科技公司的強力背書，加上實際實作的可取得性，凸顯了它日益增長的重要性。這套協定為開發者鋪好了路，讓他們能打造出更成熟、更分散式、更聰明的多 Agent 系統。歸根究柢，A2A 是一根基礎支柱，培養出一個創新、可互通、彼此協作的 AI 生態系。

## 參考資料

1. Chen, B. (2025, April 22). *How to Build Your First Google A2A Project: A Step-by-Step Tutorial*. Trickle.so Blog. [https://www.trickle.so/blog/how-to-build-google-a2a-project](https://www.trickle.so/blog/how-to-build-google-a2a-project)
2. Google A2A GitHub Repository. [https://github.com/google-a2a/A2A](https://github.com/google-a2a/A2A)
3. Google Agent Development Kit (ADK) [https://google.github.io/adk-docs/](https://google.github.io/adk-docs/)
4. Getting Started with Agent-to-Agent (A2A) Protocol: [https://codelabs.developers.google.com/intro-a2a-purchasing-concierge\#0](https://codelabs.developers.google.com/intro-a2a-purchasing-concierge#0)
5. Google AgentDiscovery \- [https://a2a-protocol.org/latest/](https://a2a-protocol.org/latest/)
6. Communication between different AI frameworks such as LangGraph, CrewAI, and Google ADK [https://www.trickle.so/blog/how-to-build-google-a2a-project](https://www.trickle.so/blog/how-to-build-google-a2a-project#setting-up-your-a2a-development-environment)
7. Designing Collaborative Multi-Agent Systems with the A2A Protocol [https://www.oreilly.com/radar/designing-collaborative-multi-agent-systems-with-the-a2a-protocol/](https://www.oreilly.com/radar/designing-collaborative-multi-agent-systems-with-the-a2a-protocol/)
