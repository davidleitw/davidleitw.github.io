---
title: "Agentic Design Patterns 第 16 章：Resource-Aware Optimization（資源感知最佳化）"
description: "依成本、延遲與品質動態選模型、配資源。《Agentic Design Patterns》第 16 章繁體中文翻譯。"
pubDatetime: 2026-07-17T20:44:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

Resource-Aware Optimization（資源感知最佳化）讓智慧型 Agent 在運作過程中能動態監控與管理運算、時間和財務資源。這跟單純的規劃不一樣，規劃主要在安排動作的先後順序；Resource-Aware Optimization 則要求 Agent 針對動作的執行方式做決策，好在指定的資源預算內達成目標，或是把效率最佳化。這牽涉到在「更準確但昂貴的模型」和「更快、成本更低的模型」之間做取捨，也牽涉到要不要多分配一些運算資源去產生更精緻的回應，還是直接回傳一個較快但細節較少的答案。

舉個例子，假設有個 Agent 被指派為某位金融分析師分析一份大型資料集。如果分析師需要立刻拿到初步報告，Agent 可能會用比較快、比較便宜的模型快速摘要出關鍵趨勢。但如果分析師是要一份高度準確的預測來支撐一項關鍵的投資決策，而且手上有更充裕的預算和時間，Agent 就會分配更多資源，改用一個功能強大、速度較慢但更精確的預測模型。這一類做法裡有個關鍵策略叫做 fallback 機制（備援機制），它像一道保險：當首選模型因為過載或被限流而無法使用時派上用場。為了確保優雅降級（graceful degradation），系統會自動切換到預設或更便宜的模型，維持服務不中斷，而不是整個掛掉。

## 實際應用與使用情境

實際的使用情境包括：

* **成本最佳化的 LLM 使用：**Agent 根據預算限制，決定複雜任務要用大型、昂貴的 LLM（大型語言模型），還是簡單查詢用較小、較便宜的模型。
* **延遲敏感的操作：**在即時系統裡，Agent 選一條較快但可能不夠周全的推理路徑，以確保能及時回應。
* **能源效率：**對於部署在邊緣裝置或電力受限環境的 Agent，最佳化其處理流程來延長電池續航。
* **服務可靠性的 fallback：**當首選模型無法使用時，Agent 自動切換到備用模型，確保服務不中斷並優雅降級。
* **資料用量管理：**Agent 選擇取回摘要後的資料，而不是下載整份資料集，以節省頻寬或儲存空間。
* **自適應任務分配：**在 Multi-Agent 系統中，Agent 根據自己當前的運算負載或可用時間來自行認領任務。

## 實作範例

一個用來回答使用者問題的智慧系統，可以先評估每個問題的難度。對於簡單的查詢，它會用像 Gemini Flash 這種成本效益高的語言模型；對於複雜的問題，才會考慮動用更強大、但也更貴的語言模型（例如 Gemini Pro）。要不要用更強大的模型，也取決於資源是否足夠，具體來說就是預算和時間的限制。這套系統會動態地挑選合適的模型。

再舉個例子，假設有個用階層式 Agent 打造的旅遊規劃器。高層次的規劃工作，包含理解使用者複雜的需求、把它拆解成多步驟的行程、並做出合乎邏輯的決策，會交給像 Gemini Pro 這種複雜又強大的 LLM 來管。這就是那個需要深入理解上下文、又要有推理能力的「planner（規劃者）」Agent。

不過，一旦計畫定案，計畫裡的各項任務,像是查機票價格、確認飯店有沒有空房、或找餐廳評論，本質上都是簡單、重複的網路查詢。這些「工具函式呼叫（tool function calls）」交給像 Gemini Flash 這種更快、更便宜的模型就能執行。這樣就很容易想像為什麼這些直接的網路搜尋可以用便宜的模型，而複雜的規劃階段則需要更先進模型的更高智慧，才能確保旅遊計畫連貫又合乎邏輯。

Google 的 ADK 透過它的 Multi-Agent 架構支援這種做法，讓應用程式可以模組化、也好擴充。不同的 Agent 可以各自負責專門的任務。模型的彈性讓你能直接使用各種 Gemini 模型，包括 Gemini Pro 和 Gemini Flash，或是透過 LiteLLM 整合其他模型。ADK 的編排能力支援動態、由 LLM 驅動的路由，藉此實現自適應行為。內建的評估功能讓你能有系統地評量 Agent 的表現，用來持續改進整套系統（參見〈評估與監控〉那一章）。

接下來，我們會定義兩個設定相同、但使用不同模型、成本也不同的 Agent。

```python
# Conceptual Python-like structure, not runnable code
from google.adk.agents import Agent
# from google.adk.models.lite_llm import LiteLlm  # If using models not directly supported by ADK's default Agent

# Agent using the more expensive Gemini Pro 2.5
gemini_pro_agent = Agent(
    name="GeminiProAgent",
    model="gemini-2.5-pro",  # Placeholder for actual model name if different
    description="A highly capable agent for complex queries.",
    instruction="You are an expert assistant for complex problem-solving.",
)

# Agent using the less expensive Gemini Flash 2.5
gemini_flash_agent = Agent(
    name="GeminiFlashAgent",
    model="gemini-2.5-flash",  # Placeholder for actual model name if different
    description="A fast and efficient agent for simple queries.",
    instruction="You are a quick assistant for straightforward questions.",
)
```

一個 Router Agent（路由 Agent）可以根據像查詢長度這種簡單的指標來分派查詢，比如較短的查詢送去較便宜的模型、較長的查詢送去更強的模型。不過，更精細的 Router Agent 可以用 LLM 或 ML 模型來分析查詢的細微差異與複雜度。這種 LLM router 能判斷哪個下游的語言模型最適合。舉例來說，一個只是要求回憶事實的查詢會被路由到 Flash 模型，而一個需要深入分析的複雜查詢則會被路由到 Pro 模型。

一些最佳化技巧可以進一步提升 LLM router 的效果。Prompt tuning（提示調校）是指精心設計 Prompt 來引導 router LLM 做出更好的路由決策。而在一份「查詢及其最佳模型選擇」的資料集上對 LLM router 做 fine-tuning（微調），能提升它的準確度和效率。這種動態路由的能力，在回應品質和成本效益之間取得了平衡。

```python
# Conceptual Python-like structure, not runnable code
import asyncio
from typing import AsyncGenerator

from google.adk.agents import Agent, BaseAgent
from google.adk.events import Event
from google.adk.agents.invocation_context import InvocationContext


class QueryRouterAgent(BaseAgent):
    name: str = "QueryRouter"
    description: str = "Routes user queries to the appropriate LLM agent based on complexity."

    async def _run_async_impl(self, context: InvocationContext) -> AsyncGenerator[Event, None]:
        user_query = context.current_message.text  # Assuming text input
        query_length = len(user_query.split())  # Simple metric: number of words

        if query_length < 20:  # Example threshold for simplicity vs. complexity
            print(f"Routing to Gemini Flash Agent for short query (length: {query_length})")
            # In a real ADK setup, you would 'transfer_to_agent' or directly invoke
            # For demonstration, we'll simulate a call and yield its response
            response = await gemini_flash_agent.run_async(context.current_message)
            yield Event(author=self.name, content=f"Flash Agent processed: {response}")
        else:
            print(f"Routing to Gemini Pro Agent for long query (length: {query_length})")
            response = await gemini_pro_agent.run_async(context.current_message)
            yield Event(author=self.name, content=f"Pro Agent processed: {response}")
```

Critique Agent（批判 Agent）負責評估語言模型的回應，提供的回饋有好幾種用途。就自我修正而言，它會找出錯誤或前後不一致的地方，促使負責回答的 Agent 修正輸出、提升品質。它也會有系統地評量回應，用於效能監控，追蹤像準確度和相關性這類指標，這些指標會拿來做最佳化。

除此之外，它的回饋還能為強化學習或 fine-tuning 提供訊號；舉例來說，如果它一直發現 Flash 模型的回應不夠好，這個訊號就能拿來改進 router agent 的邏輯。Critique Agent 雖然不直接管理預算，但它會找出那些不理想的路由選擇（例如把簡單查詢送去 Pro 模型、或把複雜查詢送去 Flash 模型，結果導致效果不佳），藉此間接參與預算管理。這些發現會回饋成調整依據，改善資源分配、節省成本。

Critique Agent 可以設定成只審查回答 Agent 產生的文字，或是同時審查原始查詢和產生的文字，這樣就能全面評估回應跟原本問題的契合程度。

```python
CRITIC_SYSTEM_PROMPT = """
You are the **Critic Agent**, serving as the quality assurance arm of our collaborative research assistant system. Your primary function is to **meticulously review and challenge** information from the Researcher Agent, guaranteeing **accuracy, completeness, and unbiased presentation**. Your duties encompass: * **Assessing research findings** for factual correctness, thoroughness, and potential leanings. * **Identifying any missing data** or inconsistencies in reasoning. * **Raising critical questions** that could refine or expand the current understanding. * **Offering constructive suggestions** for enhancement or exploring different angles. * **Validating that the final output is comprehensive** and balanced. All criticism must be constructive. Your goal is to fortify the research, not invalidate it. Structure your feedback clearly, drawing attention to specific points for revision. Your overarching aim is to ensure the final research product meets the highest possible quality standards. 
"""
```

Critic Agent 依照一份預先定義好的系統 Prompt 來運作，這份 Prompt 會勾勒出它的角色、職責和給回饋的方式。給這個 Agent 的 Prompt 要設計得好，就必須明確確立它作為「評估者」的職能。它應該指定要著重批判的面向，並強調要提供建設性的回饋，而不只是一味否定。這份 Prompt 也應該鼓勵同時找出優點和缺點，而且必須引導 Agent 該怎麼組織與呈現它的回饋。

## 使用 OpenAI 的實作範例

這套系統用一種資源感知的最佳化策略來高效處理使用者查詢。它會先把每個查詢分成三類其中之一，藉此決定最合適、最具成本效益的處理路徑。這種做法避免在簡單請求上浪費運算資源，同時又確保複雜查詢得到該有的關注。這三類是：

* simple：適用於可以直接回答、不需要複雜推理或外部資料的簡單問題。
* reasoning：適用於需要邏輯推導或多步驟思考過程的查詢，這些會被路由到更強大的模型。
* `internet_search`：適用於需要即時資訊的問題，會自動觸發 Google 搜尋來提供最新的答案。

這段程式碼採用 MIT 授權，可在 Github 上取得：（[https://github.com/mahtabsyed/21-Agentic-Patterns/blob/main/16ResourceAwareOptLLMReflectionv2.ipynb](https://github.com/mahtabsyed/21-Agentic-Patterns/blob/main/16_Resource_Aware_Opt_LLM_Reflection_v2.ipynb)）

```python
# MIT License
# Copyright (c) 2025 Mahtab Syed
# https://www.linkedin.com/in/mahtabsyed/

import os
import json
import requests
from dotenv import load_dotenv
from openai import OpenAI


# Load environment variables
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GOOGLE_CUSTOM_SEARCH_API_KEY = os.getenv("GOOGLE_CUSTOM_SEARCH_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")

if not OPENAI_API_KEY or not GOOGLE_CUSTOM_SEARCH_API_KEY or not GOOGLE_CSE_ID:
    raise ValueError(
        "Please set OPENAI_API_KEY, GOOGLE_CUSTOM_SEARCH_API_KEY, and GOOGLE_CSE_ID in your .env file."
    )

client = OpenAI(api_key=OPENAI_API_KEY)


# --- Step 1: Classify the Prompt ---
def classify_prompt(prompt: str) -> dict:
    system_message = {
        "role": "system",
        "content": (
            "You are a classifier that analyzes user prompts and returns one of three categories ONLY:\n\n"
            "- simple\n"
            "- reasoning\n"
            "- internet_search\n\n"
            "Rules:\n"
            "- Use 'simple' for direct factual questions that need no reasoning or current events.\n"
            "- Use 'reasoning' for logic, math, or multi-step inference questions.\n"
            "- Use 'internet_search' if the prompt refers to current events, recent data, or things not in your training data.\n\n"
            "Respond ONLY with JSON like:\n"
            '{ "classification": "simple" }'
        ),
    }
    user_message = {"role": "user", "content": prompt}

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[system_message, user_message],
        temperature=1,
    )
    reply = response.choices[0].message.content
    return json.loads(reply)


# --- Step 2: Google Search ---
def google_search(query: str, num_results: int = 1) -> list:
    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": GOOGLE_CUSTOM_SEARCH_API_KEY,
        "cx": GOOGLE_CSE_ID,
        "q": query,
        "num": num_results,
    }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        results = response.json()
        if "items" in results and results["items"]:
            return [
                {
                    "title": item.get("title"),
                    "snippet": item.get("snippet"),
                    "link": item.get("link"),
                }
                for item in results["items"]
            ]
        else:
            return []
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}


# --- Step 3: Generate Response ---
def generate_response(prompt: str, classification: str, search_results=None) -> tuple[str, str]:
    if classification == "simple":
        model = "gpt-4o-mini"
        full_prompt = prompt

    elif classification == "reasoning":
        model = "o4-mini"
        full_prompt = prompt

    elif classification == "internet_search":
        model = "gpt-4o"
        # Convert each search result dict to a readable string
        if search_results:
            search_context = "\n".join(
                [
                    f"Title: {item.get('title')}\nSnippet: {item.get('snippet')}\nLink: {item.get('link')}"
                    for item in search_results
                ]
            )
        else:
            search_context = "No search results found."
        full_prompt = (
            "Use the following web results to answer the user query: "
            f"{search_context}\nQuery: {prompt}"
        )
    else:
        # Fallback
        model = "gpt-4o"
        full_prompt = prompt

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": full_prompt}],
        temperature=1,
    )
    return response.choices[0].message.content, model


# --- Step 4: Combined Router ---
def handle_prompt(prompt: str) -> dict:
    classification_result = classify_prompt(prompt)
    classification = classification_result["classification"]

    search_results = None
    if classification == "internet_search":
        search_results = google_search(prompt)

    answer, model = generate_response(prompt, classification, search_results)
    return {"classification": classification, "response": answer, "model": model}


if __name__ == "__main__":
    test_prompt = "What is the capital of Australia?"
    # test_prompt = "Explain the impact of quantum computing on cryptography."
    # test_prompt = "When does the Australian Open 2026 start, give me full date?"

    result = handle_prompt(test_prompt)

    print("🔍 Classification:", result["classification"])
    print("🧠 Model Used:", result["model"])
    print("🧠 Response:\n", result["response"])
```

這段 Python 程式碼實作了一套 Prompt 路由系統來回答使用者的問題。它一開始會從 .env 檔案載入 OpenAI 和 Google Custom Search 所需的 API 金鑰。核心功能在於把使用者的 Prompt 分成三類：simple、reasoning 或 internet search。有一個專門的函式利用 OpenAI 模型來做這個分類步驟。如果 Prompt 需要即時資訊，就會用 Google Custom Search API 執行一次 Google 搜尋。接著另一個函式會產生最終回應，根據分類結果選一個合適的 OpenAI 模型。對於網路搜尋類的查詢，搜尋結果會當成上下文提供給模型。主函式 `handle_prompt` 負責編排整個工作流程，在產生回應之前，會先呼叫分類函式和（必要時）搜尋函式。它最後回傳分類結果、使用的模型，以及產生的答案。這套系統能高效地把不同類型的查詢導向各自最佳化的處理方式，以得到更好的回應。

# 實作範例（OpenRouter）

OpenRouter 透過單一個 API 端點，提供一個統一的介面來存取數百個 AI 模型。它提供自動 failover（故障轉移）和成本最佳化，還能透過你偏好的 SDK 或框架輕鬆整合。

```python
import json
import requests

response = requests.post(
    url="https://openrouter.ai/api/v1/chat/completions",
    headers={
        "Authorization": "Bearer <OPENROUTER_API_KEY>",
        "HTTP-Referer": "<YOUR_SITE_URL>",  # Optional. Site URL for rankings on openrouter.ai.
        "X-Title": "<YOUR_SITE_NAME>",      # Optional. Site title for rankings on openrouter.ai.
    },
    data=json.dumps({
        "model": "openai/gpt-4o",  # Optional
        "messages": [
            {
                "role": "user",
                "content": "What is the meaning of life?"
            }
        ]
    }),
)
```

這段程式碼片段用 requests 函式庫跟 OpenRouter API 互動。它向 chat completion 端點送出一個 POST 請求，帶著一則使用者訊息。請求裡包含帶有 API 金鑰的授權標頭，以及選填的網站資訊。目的是要從指定的語言模型（這裡是「openai/gpt-4o」）取得回應。

OpenRouter 提供兩種不同的方法，來決定要用哪個運算模型處理某個請求、以及如何路由。

* **自動模型選擇（Automated Model Selection）：**這個功能會把請求路由到一個最佳化過的模型，這個模型是從一組精選的可用模型中挑出來的。挑選的依據是使用者 Prompt 的具體內容。最終處理請求的那個模型的識別碼，會放在回應的中繼資料（metadata）裡回傳。

```json
{  
    "model": "openrouter/auto",  
    ... // Other params 
}
```

* **循序模型 fallback（Sequential Model Fallback）：**這個機制讓使用者可以指定一份有先後順序的模型清單，藉此提供運作上的備援。系統會先嘗試用清單裡的第一個（主要）模型來處理請求。萬一這個主要模型因為各種錯誤狀況而沒有回應，例如服務無法使用、被速率限制（rate-limiting）、或內容被過濾，系統就會自動把請求改送到清單裡的下一個模型。這個過程會一直持續，直到清單中有某個模型成功執行了請求，或是整份清單都用完為止。這次操作的最終成本、以及回應裡回傳的模型識別碼，都會對應到那個成功完成運算的模型。

```json
{  
    "models": ["anthropic/claude-3.5-sonnet", "gryphe/mythomax-l2-13b"],  
    ... // Other params }
```

OpenRouter 提供一份詳細的排行榜（[https://openrouter.ai/rankings](https://openrouter.ai/rankings)），根據各個可用 AI 模型累積產出的 token 數量來排名。它也提供來自不同供應商（ChatGPT、Gemini、Claude）的最新模型（見圖 1）。

![OpenRouter 網站](/assets/agentic-design-patterns/OpenRouter_Web_Site.png) 

圖 1：OpenRouter 網站（[https://openrouter.ai/](https://openrouter.ai/)）

## 超越動態模型切換：Agent 資源最佳化的各種面向

在開發那些要在真實世界限制下高效又有效運作的智慧型 Agent 系統時，資源感知最佳化至關重要。我們來看看還有哪些額外的技巧：

**動態模型切換（Dynamic Model Switching）**是一項關鍵技術，指的是根據手上任務的複雜程度和可用的運算資源，策略性地挑選要用哪個大型語言模型。面對簡單查詢時，可以部署一個輕量、成本效益高的 LLM；而複雜、多面向的問題，就必須動用更精密、也更耗資源的模型。

**自適應工具使用與選擇（Adaptive Tool Use & Selection）**確保 Agent 能從一整套工具裡明智地挑選，為每個特定的子任務選出最合適、最有效率的那一個，過程中會仔細衡量像 API 使用成本、延遲和執行時間這些因素。這種動態的工具選擇，透過最佳化外部 API 和服務的使用，提升了整套系統的效率。

**上下文修剪與摘要（Contextual Pruning & Summarization）**在管理 Agent 要處理的資訊量方面扮演關鍵角色，它會聰明地摘要互動歷史、並只選擇性地保留其中最相關的資訊，藉此策略性地壓低 Prompt 的 token 數量、降低推理成本，避免不必要的運算開銷。

**主動資源預測（Proactive Resource Prediction）**是指藉由預測未來的工作負載和系統需求，來預先估算資源需求，這樣就能主動分配和管理資源，確保系統反應靈敏、防止出現瓶頸。

**成本敏感探索（Cost-Sensitive Exploration）**在 Multi-Agent 系統中，把最佳化的考量從傳統的運算成本延伸到通訊成本，這會影響 Agent 之間協作與共享資訊的策略，目標是把整體的資源花費降到最低。

**節能部署（Energy-Efficient Deployment）**專門為資源受到嚴格限制的環境量身打造，目標是把智慧型 Agent 系統的能源足跡壓到最低，延長運作時間、降低整體運行成本。

**平行化與分散式運算感知（Parallelization & Distributed Computing Awareness）**善用分散式資源來提升 Agent 的處理能力和吞吐量，把運算工作負載分散到多台機器或多個處理器上，以達到更高的效率、更快完成任務。

**學習型資源分配策略（Learned Resource Allocation Policies）**引入一種學習機制，讓 Agent 能根據回饋和效能指標，隨著時間調整並最佳化自己的資源分配策略，透過持續的精進來提升效率。

**優雅降級與 fallback 機制（Graceful Degradation and Fallback Mechanisms）**確保智慧型 Agent 系統即使在資源限制很嚴苛的情況下也能繼續運作，也許只能以較低的能力運行，但它會優雅地降低效能、退回到替代策略，以維持運作並提供必要的基本功能。

## 速覽

**問題：**Resource-Aware Optimization 要解決的是「如何在智慧系統中管理運算、時間和財務資源的消耗」這個難題。基於 LLM 的應用程式可能又貴又慢，而且為每一項任務都挑最佳的模型或工具，往往效率不彰。這在「系統輸出的品質」和「產生這個輸出所需的資源」之間造成了一個根本性的取捨。少了動態的管理策略，系統就無法適應不同任務的複雜度，也無法在預算和效能的限制內運作。

**解法：**標準化的做法是打造一套會智慧地監控與分配資源的 Agentic 系統。這個模式通常會用一個「Router Agent」先把進來的請求分類，判斷它的複雜度。接著再把請求轉送給最合適的 LLM 或工具，簡單查詢用快又便宜的模型，複雜推理則用更強大的模型。「Critique Agent」還能透過評估回應的品質、提供回饋來進一步改進這個流程，隨著時間讓路由邏輯越來越好。這種動態、Multi-Agent 的做法確保系統高效運作，在回應品質和成本效益之間取得平衡。

**經驗法則：** 在以下情況使用這個模式：API 呼叫或運算能力有嚴格的財務預算；打造延遲敏感、快速回應至關重要的應用程式；在資源受限的硬體上部署 Agent，例如電池續航有限的邊緣裝置；需要用程式化的方式在回應品質和營運成本之間做取捨；以及管理那種不同任務有不同資源需求的複雜多步驟工作流程。

**圖解：**

![Resource-Aware Optimization 設計模式](/assets/agentic-design-patterns/Resource_Aware_Optimization_Design_Pattern.png)

圖 2：Resource-Aware Optimization 設計模式

## 重點回顧

* Resource-Aware Optimization 不可或缺：智慧型 Agent 能動態管理運算、時間和財務資源。關於模型使用和執行路徑的決策，都是根據即時的限制與目標做出來的。
* 為了可擴充性而採用 Multi-Agent 架構：Google 的 ADK 提供一個 Multi-Agent 框架，讓模組化設計成為可能。不同的 Agent（回答、路由、批判）各自處理特定的任務。
* 動態、由 LLM 驅動的路由：一個 Router Agent 根據查詢的複雜度和預算，把查詢導向不同的語言模型（簡單查詢用 Gemini Flash，複雜查詢用 Gemini Pro）。這能同時最佳化成本和效能。
* Critique Agent 的功能：一個專門的 Critique Agent 提供回饋，用於自我修正、效能監控、以及改進路由邏輯，藉此提升整套系統的效果。
* 透過回饋和彈性來最佳化：用於批判的評估能力、以及整合各種模型的彈性，共同促成了自適應、能自我改進的系統行為。
* 其他資源感知的最佳化技巧：其他方法包括自適應工具使用與選擇、上下文修剪與摘要、主動資源預測、Multi-Agent 系統中的成本敏感探索、節能部署、平行化與分散式運算感知、學習型資源分配策略、優雅降級與 fallback 機制，以及關鍵任務的優先排序。

## 結語

資源感知最佳化對於開發智慧型 Agent 至關重要，它讓 Agent 能在真實世界的限制下高效運作。透過管理運算、時間和財務資源，Agent 能同時達到最佳的效能和成本效益。像動態模型切換、自適應工具使用、上下文修剪這些技巧，是達成這些效率的關鍵。而更進階的策略，包括學習型資源分配策略和優雅降級，則強化了 Agent 在各種條件下的適應力和韌性。把這些最佳化原則融入 Agent 的設計，是打造可擴充、穩健、又能永續運行的 AI 系統的根本。

## 參考資料

1. Google's Agent Development Kit (ADK)：[https://google.github.io/adk-docs/](https://google.github.io/adk-docs/)
2. Gemini Flash 2.5 & Gemini 2.5 Pro：[https://aistudio.google.com/](https://aistudio.google.com/)
3. OpenRouter：[https://openrouter.ai/docs/quickstart](https://openrouter.ai/docs/quickstart)
