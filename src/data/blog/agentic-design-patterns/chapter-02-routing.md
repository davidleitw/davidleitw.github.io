---
title: "Agentic Design Patterns 第 2 章：Routing（路由）"
description: "讓 Agent 依輸入內容動態決定走哪一條處理路徑。《Agentic Design Patterns》第 2 章繁體中文翻譯，含程式碼範例。"
pubDatetime: 2026-07-17T20:58:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## 模式概觀

透過 Prompt Chaining 做循序處理，是讓語言模型執行確定性、線性工作流程的基礎技術；但在需要隨機應變的場景，它就不夠用了。真實世界的 Agentic 系統，常常得根據各種變動因素──環境狀態、使用者輸入、前一步操作的結果──在多個可能的行動之間做出裁決。這種動態決策的能力，負責把控制流程導向不同的專門函式、工具或子流程，其背後的機制就叫路由（Routing）。

Routing 為 Agent 的運作框架引入條件邏輯：從固定的執行路徑，轉變成由 Agent 動態評估特定條件、從一組可能的後續行動中做選擇的模式。系統的行為因此更靈活、更能因應上下文。

舉例來說，一個處理客戶詢問的 Agent，配備路由功能之後，可以先對進來的查詢做分類、判斷使用者意圖，再根據分類結果，把查詢導向專門回答問題的 Agent、查帳戶資訊的資料庫檢索工具，或處理疑難案件的升級（escalation）程序，而不是一律走同一條預設的回應路徑。因此，一個具備路由能力的進階 Agent 可以：

1. 分析使用者的查詢。
2. 根據查詢的**意圖**做**路由**：
   * 意圖是「查訂單狀態」，就導向與訂單資料庫互動的子 Agent 或工具鏈。
   * 意圖是「產品資訊」，就導向搜尋產品目錄的子 Agent 或鏈。
   * 意圖是「技術支援」，就導向另一條能查閱疑難排解指南、或升級給真人處理的鏈。
   * 意圖不明確，就導向負責釐清問題的子 Agent 或 Prompt 鏈。

Routing 模式的核心元件，是一個負責評估並引導流向的機制。這個機制有幾種實作方式：

* **LLM 路由：** 直接用 Prompt 讓語言模型分析輸入，輸出一個代表下一步或目的地的特定識別字。例如 Prompt 可以要求 LLM：「分析以下使用者查詢，只輸出類別：『訂單狀態』『產品資訊』『技術支援』或『其他』。」Agentic 系統讀取這個輸出，據此引導工作流程。
* **Embedding 路由：** 把輸入查詢轉成向量 embedding（見第 14 章 RAG），再與代表各條路徑或能力的 embedding 比對，把查詢導向 embedding 最相似的那條路。這適合語意路由（semantic routing）：決策依據是輸入的意義，而不只是關鍵字。
* **規則路由：** 用預先定義的規則或邏輯（例如 if-else、switch case），根據關鍵字、模式，或從輸入中抽取的結構化資料來做判斷。這比 LLM 路由更快、更確定，但面對細膩或沒見過的輸入就比較不靈活。
* **機器學習模型路由：** 使用判別式模型（例如分類器），以一小批標註資料專門訓練來執行路由任務。它在概念上跟 embedding 路由相似，但關鍵差別在於監督式微調的過程：透過調整模型參數，練出一個專門的路由函式。這個技術跟 LLM 路由不同，因為做決策的元件不是在推論階段執行 Prompt 的生成式模型──路由邏輯已經編碼在微調後模型學到的權重裡。LLM 或許會在前處理步驟中用來生成合成資料、擴充訓練集，但即時的路由決策本身沒有 LLM 參與。

路由機制可以放在 Agent 運作週期的多個節點上：可以放在一開始，對主要任務做分類；可以放在處理鏈的中段，決定下一步動作；也可以放在子程序裡，從一組工具中挑出最合適的那一個。

LangChain、LangGraph、Google 的 Agent Developer Kit（ADK）這些計算框架，都提供了定義和管理這類條件邏輯的明確構件。LangGraph 以狀態為基礎的圖（graph）架構，特別適合複雜的路由場景──那些決策取決於整個系統累積狀態的情況。同樣地，Google ADK 提供了組織 Agent 能力與互動模型的基礎元件，作為實作路由邏輯的底層。在這些框架提供的執行環境裡，開發者定義可能的運作路徑，以及決定計算圖節點之間如何轉移的函式或模型評估。

實作路由讓系統得以超越確定性的循序處理，發展出更有適應力的執行流程，能對更廣泛的輸入和狀態變化做出動態且恰當的回應。

## 實際應用與使用情境

Routing 模式是設計自適應 Agentic 系統的關鍵控制機制，讓系統能根據多變的輸入和內部狀態，動態改變執行路徑。它提供了一層必要的條件邏輯，用途橫跨多個領域。

在人機互動方面，例如虛擬助理或 AI 家教，路由用來解讀使用者意圖。先對自然語言查詢做初步分析，決定接下來最合適的動作：呼叫特定的資訊檢索工具、升級給真人客服，或根據使用者的表現挑選課程的下一個單元。系統因此不再受限於線性的對話流程，能因應情境回應。

在自動化的資料與文件處理 pipeline 裡，路由扮演分類與分發的角色。進來的資料──email、客服工單、API 酬載（payload）──依內容、中繼資料或格式進行分析，系統再把每一筆導向對應的工作流程：業務潛在客戶的匯入流程、針對 JSON 或 CSV 格式的特定資料轉換函式，或緊急問題的升級路徑。

在包含多個專門工具或 Agent 的複雜系統中，路由扮演高階調度員。一個由搜尋、摘要、分析等不同 Agent 組成的研究系統，會用一個 router 根據當前目標，把任務指派給最合適的 Agent。同樣地，AI 程式助理會先用路由判斷程式語言和使用者的意圖──除錯、解釋還是轉換語言──再把程式碼片段交給正確的專門工具。

歸結起來，路由提供了邏輯裁決的能力，這是打造功能多樣、能感知情境的系統所不可或缺的。它把 Agent 從「照預定序列執行的靜態執行者」，轉變成「能在變動條件下決定最有效做法的動態系統」。

## 實作範例（LangChain）

用程式碼實作路由，就是定義可能的路徑，以及決定走哪條路的邏輯。LangChain 和 LangGraph 這類框架為此提供了專門的元件和結構。LangGraph 以狀態為基礎的圖結構，在視覺化和實作路由邏輯上特別直觀。

這段程式碼示範一個簡單的類 Agent 系統，使用 LangChain 和 Google 的生成式 AI。它建立一個「協調者」（coordinator），根據請求的意圖（訂位、查資訊，或不明確），把使用者請求導向不同的模擬「子 Agent」處理器。系統用語言模型對請求分類，再委派給對應的處理函式，模擬 Multi-Agent 架構中常見的基本委派模式。

先確認必要的函式庫都裝好了：

```bash
pip install langchain langgraph google-cloud-aiplatform langchain-google-genai google-adk deprecated pydantic
```

你也需要在環境中設定所選語言模型（例如 OpenAI、Google Gemini、Anthropic）的 API key。

```python
# Copyright (c) 2025 Marco Fago
# https://www.linkedin.com/in/marco-fago/
#
# This code is licensed under the MIT License.
# See the LICENSE file in the repository for the full license text.

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableBranch


# --- Configuration ---
# Ensure your API key environment variable is set (e.g., GOOGLE_API_KEY)
try:
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)
    print(f"Language model initialized: {llm.model}")
except Exception as e:
    print(f"Error initializing language model: {e}")
    llm = None


# --- Define Simulated Sub-Agent Handlers (equivalent to ADK sub_agents) ---
def booking_handler(request: str) -> str:
    """Simulates the Booking Agent handling a request."""
    print("\n--- DELEGATING TO BOOKING HANDLER ---")
    return f"Booking Handler processed request: '{request}'. Result: Simulated booking action."


def info_handler(request: str) -> str:
    """Simulates the Info Agent handling a request."""
    print("\n--- DELEGATING TO INFO HANDLER ---")
    return f"Info Handler processed request: '{request}'. Result: Simulated information retrieval."


def unclear_handler(request: str) -> str:
    """Handles requests that couldn't be delegated."""
    print("\n--- HANDLING UNCLEAR REQUEST ---")
    return f"Coordinator could not delegate request: '{request}'. Please clarify."


# --- Define Coordinator Router Chain (equivalent to ADK coordinator's instruction) ---
# This chain decides which handler to delegate to.
coordinator_router_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        """Analyze the user's request and determine which specialist handler should process it.
        - If the request is related to booking flights or hotels,
           output 'booker'.
        - For all other general information questions, output 'info'.
        - If the request is unclear or doesn't fit either category,
           output 'unclear'.
        ONLY output one word: 'booker', 'info', or 'unclear'."""
    ),
    ("user", "{request}")
])

if llm:
    coordinator_router_chain = coordinator_router_prompt | llm | StrOutputParser()


# --- Define the Delegation Logic (equivalent to ADK's Auto-Flow based on sub_agents) ---
# Use RunnableBranch to route based on the router chain's output.

# Define the branches for the RunnableBranch
branches = {
    "booker": RunnablePassthrough.assign(
        output=lambda x: booking_handler(x['request']['request'])
    ),
    "info": RunnablePassthrough.assign(
        output=lambda x: info_handler(x['request']['request'])
    ),
    "unclear": RunnablePassthrough.assign(
        output=lambda x: unclear_handler(x['request']['request'])
    ),
}

# Create the RunnableBranch. It takes the output of the router chain
# and routes the original input ('request') to the corresponding handler.
delegation_branch = RunnableBranch(
    (lambda x: x['decision'].strip() == 'booker', branches["booker"]),  # Added .strip()
    (lambda x: x['decision'].strip() == 'info', branches["info"]),      # Added .strip()
    branches["unclear"]  # Default branch for 'unclear' or any other output
)

# Combine the router chain and the delegation branch into a single runnable
# The router chain's output ('decision') is passed along with the original input ('request')
# to the delegation_branch.
coordinator_agent = {
    "decision": coordinator_router_chain,
    "request": RunnablePassthrough()
} | delegation_branch | (lambda x: x['output'])  # Extract the final output


# --- Example Usage ---
def main():
    if not llm:
        print("\nSkipping execution due to LLM initialization failure.")
        return

    print("--- Running with a booking request ---")
    request_a = "Book me a flight to London."
    result_a = coordinator_agent.invoke({"request": request_a})
    print(f"Final Result A: {result_a}")

    print("\n--- Running with an info request ---")
    request_b = "What is the capital of Italy?"
    result_b = coordinator_agent.invoke({"request": request_b})
    print(f"Final Result B: {result_b}")

    print("\n--- Running with an unclear request ---")
    request_c = "Tell me about quantum physics."
    result_c = coordinator_agent.invoke({"request": request_c})
    print(f"Final Result C: {result_c}")


if __name__ == "__main__":
    main()
```

如前所述，這段 Python 程式碼用 LangChain 和 Google 的生成式 AI 模型（gemini-2.5-flash）建構了一個簡單的類 Agent 系統。具體來說，它定義了三個模擬的子 Agent 處理器：`booking_handler`、`info_handler` 和 `unclear_handler`，各自負責處理特定類型的請求。

核心元件是 `coordinator_router_chain`：它用一個 ChatPromptTemplate 指示語言模型，把進來的使用者請求歸類為 `booker`、`info` 或 `unclear` 三類之一。這條 router 鏈的輸出接著交給 RunnableBranch，由它把原始請求委派給對應的處理函式。RunnableBranch 檢查語言模型的判斷結果，把請求資料導向 `booking_handler`、`info_handler` 或 `unclear_handler`。`coordinator_agent` 把這些元件組合起來：先把請求送去做路由判斷，再把請求交給選中的處理器，最後從處理器的回應中取出最終輸出。

main 函式用三個範例請求示範系統的用法，展示不同輸入如何被路由、由模擬的 Agent 處理。程式也包含語言模型初始化的錯誤處理，確保穩健性。整體結構模仿一個基本的 Multi-Agent 框架：中央協調者依意圖把任務委派給專門的 Agent。

## 實作範例（Google ADK）

Agent Development Kit（ADK）是打造 Agentic 系統的框架，為定義 Agent 的能力和行為提供了結構化的環境。與基於明確計算圖的架構不同，ADK 典範下的路由，通常是靠定義一組分立的「工具」來代表 Agent 的功能。至於針對使用者查詢挑選合適工具這件事，由框架的內部邏輯負責：它利用底層模型，把使用者意圖對應到正確的功能處理器。

這段 Python 程式碼示範一個使用 Google ADK 函式庫的應用。它建立一個「Coordinator」Agent，根據既定指令把使用者請求路由給專門的子 Agent（處理訂位的「Booker」和處理一般資訊的「Info」）。子 Agent 再用特定工具模擬處理請求，展示 Agent 系統內的基本委派模式。

```python
# Copyright (c) 2025 Marco Fago
#
# This code is licensed under the MIT License.
# See the LICENSE file in the repository for the full license text.

import uuid
from typing import Dict, Any, Optional

from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner
from google.adk.tools import FunctionTool
from google.genai import types
from google.adk.events import Event


# --- Define Tool Functions ---
# These functions simulate the actions of the specialist agents.
def booking_handler(request: str) -> str:
    """
    Handles booking requests for flights and hotels.

    Args:
        request: The user's request for a booking.

    Returns:
        A confirmation message that the booking was handled.
    """
    print("-------------------------- Booking Handler Called ----------------------------")
    return f"Booking action for '{request}' has been simulated."


def info_handler(request: str) -> str:
    """
    Handles general information requests.

    Args:
        request: The user's question.

    Returns:
        A message indicating the information request was handled.
    """
    print("-------------------------- Info Handler Called ----------------------------")
    return f"Information request for '{request}'. Result: Simulated information retrieval."


def unclear_handler(request: str) -> str:
    """Handles requests that couldn't be delegated."""
    return f"Coordinator could not delegate request: '{request}'. Please clarify."


# --- Create Tools from Functions ---
booking_tool = FunctionTool(booking_handler)
info_tool = FunctionTool(info_handler)

# Define specialized sub-agents equipped with their respective tools
booking_agent = Agent(
    name="Booker",
    model="gemini-2.0-flash",
    description="A specialized agent that handles all flight "
                "and hotel booking requests by calling the booking tool.",
    tools=[booking_tool],
)

info_agent = Agent(
    name="Info",
    model="gemini-2.0-flash",
    description="A specialized agent that provides general information "
                "and answers user questions by calling the info tool.",
    tools=[info_tool],
)

# Define the parent agent with explicit delegation instructions
coordinator = Agent(
    name="Coordinator",
    model="gemini-2.0-flash",
    instruction=(
        "You are the main coordinator. Your only task is to analyze "
        "incoming user requests "
        "and delegate them to the appropriate specialist agent. Do not try to answer the user directly.\n"
        "- For any requests related to booking flights or hotels, delegate to the 'Booker' agent.\n"
        "- For all other general information questions, delegate to the 'Info' agent."
    ),
    description="A coordinator that routes user requests to the correct specialist agent.",
    # The presence of sub_agents enables LLM-driven delegation (Auto-Flow) by default.
    sub_agents=[booking_agent, info_agent],
)


# --- Execution Logic ---
async def run_coordinator(runner: InMemoryRunner, request: str):
    """Runs the coordinator agent with a given request and delegates."""
    print(f"\n--- Running Coordinator with request: '{request}' ---")
    final_result = ""
    try:
        user_id = "user_123"
        session_id = str(uuid.uuid4())

        await runner.session_service.create_session(
            app_name=runner.app_name,
            user_id=user_id,
            session_id=session_id,
        )

        for event in runner.run(
            user_id=user_id,
            session_id=session_id,
            new_message=types.Content(
                role='user',
                parts=[types.Part(text=request)],
            ),
        ):
            if event.is_final_response() and event.content:
                # Try to get text directly from event.content to avoid iterating parts
                if hasattr(event.content, 'text') and event.content.text:
                    final_result = event.content.text
                elif event.content.parts:
                    # Fallback: Iterate through parts and extract text (might trigger warning)
                    text_parts = [part.text for part in event.content.parts if getattr(part, "text", None)]
                    final_result = "".join(text_parts)
                # Assuming the loop should break after the final response
                break

        print(f"Coordinator Final Response: {final_result}")
        return final_result

    except Exception as e:
        print(f"An error occurred while processing your request: {e}")
        return f"An error occurred while processing your request: {e}"


async def main():
    """Main function to run the ADK example."""
    print("--- Google ADK Routing Example (ADK Auto-Flow Style) ---")
    print("Note: This requires Google ADK installed and authenticated.")

    runner = InMemoryRunner(coordinator)

    # Example Usage
    result_a = await run_coordinator(runner, "Book me a hotel in Paris.")
    print(f"Final Output A: {result_a}")

    result_b = await run_coordinator(runner, "What is the highest mountain in the world?")
    print(f"Final Output B: {result_b}")

    result_c = await run_coordinator(runner, "Tell me a random fact.")  # Should go to Info
    print(f"Final Output C: {result_c}")

    result_d = await run_coordinator(runner, "Find flights to Tokyo next month.")  # Should go to Booker
    print(f"Final Output D: {result_d}")


if __name__ == "__main__":
    import nest_asyncio

    nest_asyncio.apply()
    await main()
```

這個腳本由一個主要的 Coordinator Agent 和兩個專門的 `sub_agents`（Booker 和 Info）組成。每個專門 Agent 都配備一個 FunctionTool，包裝一個模擬動作的 Python 函式：`booking_handler` 模擬處理機票和飯店訂位，`info_handler` 模擬檢索一般資訊。`unclear_handler` 是為協調者無法委派的請求準備的後備方案，不過目前的協調者邏輯在主要的 `run_coordinator` 函式裡，並沒有明確把它用在委派失敗的情況。

Coordinator Agent 的主要職責（定義在它的 instruction 裡）是分析進來的使用者訊息，把它們委派給 Booker 或 Info Agent。因為 Coordinator 定義了 `sub_agents`，這個委派由 ADK 的 Auto-Flow 機制自動處理。`run_coordinator` 函式建立一個 InMemoryRunner、產生使用者與 session ID，再用 runner 讓協調者 Agent 處理使用者的請求。runner.run 方法處理請求並產出事件（event），程式碼從 event.content 中取出最終回應的文字。

main 函式用幾個不同的請求執行協調者，示範系統如何把訂位請求委派給 Booker、資訊請求委派給 Info。

## 速覽

**問題：** Agentic 系統常常要面對各式各樣的輸入和情境，單一的線性流程應付不來。簡單的循序工作流程沒有根據上下文做決策的能力。少了「為特定任務挑選正確工具或子流程」的機制，系統就是死板、不會應變的。這個限制讓我們很難打造能應付真實世界使用者請求的複雜度和多變性的應用。

**解法：** Routing 模式提供了標準化的解法：在 Agent 的運作框架中引入條件邏輯。系統先分析進來的查詢，判斷它的意圖或性質；根據這個分析，Agent 動態地把控制流程導向最合適的專門工具、函式或子 Agent。這個決策可以用多種方法驅動：對 LLM 下 Prompt、套用預先定義的規則，或利用 embedding 的語意相似度。最終，路由把一條靜態、預先決定的執行路徑，轉變成一條靈活、能感知情境、能選出最佳行動的工作流程。

**經驗法則：** 當 Agent 必須根據使用者輸入或當前狀態，在多個不同的工作流程、工具或子 Agent 之間做選擇時，就用 Routing 模式。需要對進來的請求做分流或分類、以處理不同類型任務的應用尤其少不了它──例如客服機器人要分辨銷售詢問、技術支援和帳務問題。

**圖解：**

![Router 模式，以 LLM 作為 Router](/assets/agentic-design-patterns/Router_Pattern_Using_LLM_as_a_Router.png)

圖 1：Router 模式，以 LLM 作為 Router。

## 重點回顧

* Routing 讓 Agent 能根據條件，動態決定工作流程的下一步。
* 它讓 Agent 能處理多樣的輸入、調整自己的行為，不再受限於線性執行。
* 路由邏輯可以用 LLM、規則系統或 embedding 相似度來實作。
* LangGraph 和 Google ADK 這類框架提供了在 Agent 工作流程中定義和管理路由的結構化方式，只是架構取徑不同。

## 結語

Routing 模式是打造真正動態、反應靈敏的 Agentic 系統的關鍵一步。實作了路由，我們就超越了簡單的線性執行流程，讓 Agent 能聰明地決定如何處理資訊、回應使用者輸入、運用手上的工具或子 Agent。

我們看到了路由在各種領域的應用，從客服聊天機器人到複雜的資料處理 pipeline。分析輸入、有條件地引導工作流程的能力，是打造能應付真實任務多變性的 Agent 的根本。

LangChain 和 Google ADK 的程式碼範例，示範了兩種不同但都有效的路由實作方式。LangGraph 以圖為基礎的結構，提供了視覺化、明確定義狀態與轉移的方式，很適合有複雜路由邏輯的多步驟工作流程。Google ADK 則偏向定義分立的能力（Tools），依賴框架把使用者請求路由到合適的工具處理器──對於動作集合明確有限的 Agent，這種做法可以更簡單。

掌握 Routing 模式，是打造能聰明應對不同情境、依上下文給出合適回應或行動的 Agent 的必修課。它是打造多才多藝、穩健的 Agentic 應用的關鍵元件。

## 參考資料

1. LangGraph Documentation: [https://www.langchain.com/](https://www.langchain.com/)
2. Google Agent Developer Kit Documentation: [https://google.github.io/adk-docs/](https://google.github.io/adk-docs/)
