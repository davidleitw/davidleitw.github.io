---
title: "Agentic Design Patterns 第 3 章：Parallelization（平行化）"
description: "同時執行多個獨立子任務，縮短整體延遲。《Agentic Design Patterns》第 3 章繁體中文翻譯，含程式碼範例。"
pubDatetime: 2026-07-18T20:57:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## 模式概觀

前兩章我們談了處理循序工作流程的 Prompt Chaining，以及負責動態決策、在不同路徑間切換的 Routing。這些模式固然重要，但許多複雜的 Agentic 任務包含多個子任務，這些子任務其實可以*同時*執行，不必一個接一個排隊。這就是 **Parallelization（平行化）** 模式派上用場的地方。

平行化指的是同時執行多個元件：LLM 呼叫、工具使用，甚至整個子 Agent（見圖 1）。不必等一步做完才開始下一步；平行執行讓彼此獨立的任務同時進行，對於可以拆成獨立部分的任務，整體執行時間會大幅縮短。

想像一個負責研究某主題並摘要發現的 Agent。循序的做法可能是：

1. 搜尋來源 A。
2. 摘要來源 A。
3. 搜尋來源 B。
4. 摘要來源 B。
5. 從摘要 A 和 B 綜合出最終答案。

平行的做法則可以是：

1. 同時搜尋來源 A *和*來源 B。
2. 兩個搜尋都完成後，同時摘要來源 A *和*來源 B。
3. 從摘要 A 和 B 綜合出最終答案（這一步通常是循序的，要等平行步驟結束）。

核心概念是：找出工作流程中不依賴其他部分輸出的環節，讓它們平行執行。這在面對有延遲的外部服務（例如 API 或資料庫）時特別有效，因為你可以同時發出多個請求。

實作平行化通常需要支援非同步執行或多執行緒／多行程的框架。現代的 Agentic 框架在設計時就把非同步操作考慮進去了，讓你能輕鬆定義可平行執行的步驟。

![以子 Agent 實現平行化](/assets/agentic-design-patterns/Parallelization_with_Sub_Agents.png)

圖 1：以子 Agent 實現平行化的例子。

LangChain、LangGraph、Google ADK 都提供了平行執行的機制。在 LangChain Expression Language（LCEL）裡，你可以用 |（循序）這類運算子組合 runnable 物件，並把鏈或圖的結構設計成有可以同時執行的分支，達成平行執行。LangGraph 靠它的圖結構，允許從單一狀態轉移出發執行多個節點，等於在工作流程中開出平行的分支。Google ADK 則提供穩固的原生機制來支援和管理 Agent 的平行執行，大幅提升複雜 Multi-Agent 系統的效率和可擴展性。ADK 框架內建的這個能力，讓開發者能設計並實作多個 Agent 同時運作（而非依序執行）的方案。

Parallelization 模式對提升 Agentic 系統的效率和反應速度至關重要，特別是任務中包含多個獨立查詢、計算，或與外部服務互動的時候。它是最佳化複雜 Agent 工作流程效能的關鍵技術。

## 實際應用與使用情境

平行化是最佳化 Agent 效能的強力模式，應用範圍很廣：

### 1. 資訊蒐集與研究

同時從多個來源蒐集資訊，是經典的使用情境。

* **情境：** 研究一家公司的 Agent。
  * **平行任務：** 同時搜尋新聞、抓股價資料、查社群媒體聲量、查詢公司資料庫。
  * **好處：** 比循序查詢快得多地拼出全貌。

### 2. 資料處理與分析

同時套用不同的分析技術，或同時處理不同的資料片段。

* **情境：** 分析客戶回饋的 Agent。
  * **平行任務：** 對一批回饋同時跑情感分析、抽取關鍵字、分類回饋、找出緊急問題。
  * **好處：** 快速得到多面向的分析。

### 3. 多 API 或多工具互動

呼叫多個彼此獨立的 API 或工具，蒐集不同類型的資訊或執行不同的動作。

* **情境：** 旅遊規劃 Agent。
  * **平行任務：** 同時查機票價格、搜飯店空房、查當地活動、找餐廳推薦。
  * **好處：** 更快端出完整的旅遊計畫。

### 4. 多元件的內容生成

平行生成一份複雜內容的不同部分。

* **情境：** 製作行銷 email 的 Agent。
  * **平行任務：** 同時生成主旨、起草內文、找合適的圖片、寫行動呼籲按鈕的文字。
  * **好處：** 更有效率地組裝出最終的 email。

### 5. 驗證與查核

同時執行多個獨立的檢查或驗證。

* **情境：** 驗證使用者輸入的 Agent。
  * **平行任務：** 同時檢查 email 格式、驗證電話號碼、對資料庫核對地址、檢查不當用語。
  * **好處：** 更快回饋輸入是否有效。

### 6. 多模態處理

同時處理同一份輸入的不同模態（文字、圖片、音訊）。

* **情境：** 分析一則帶圖片的社群貼文的 Agent。
  * **平行任務：** 同時分析文字的情感和關鍵字，*並*分析圖片中的物件和場景描述。
  * **好處：** 更快整合不同模態的洞察。

### 7. A/B 測試或多選項生成

平行生成多個版本的回應或輸出，再從中挑出最好的。

* **情境：** 生成多個創意文案選項的 Agent。
  * **平行任務：** 用略有差異的 Prompt 或模型，同時為一篇文章生成三個不同的標題。
  * **好處：** 能快速比較、挑出最佳選項。

平行化是 Agentic 設計中的基本最佳化技術，讓開發者藉由獨立任務的並行執行，打造效能更好、反應更快的應用。

## 實作範例（LangChain）

LangChain 框架的平行執行由 LangChain Expression Language（LCEL）提供。主要做法是把多個 runnable 元件放進一個 dictionary 或 list 結構裡；當這個集合作為輸入傳給鏈中的下一個元件時，LCEL 執行環境會並行執行其中的 runnable。

在 LangGraph 裡，同樣的原則應用在圖的拓撲上：把圖設計成多個彼此沒有直接循序依賴的節點可以從同一個節點出發，就定義出了平行的工作流程。這些平行路徑各自獨立執行，之後在圖中某個匯合點聚合結果。

下面的實作示範用 LangChain 建構的平行處理工作流程。這個流程針對單一使用者查詢，同時執行兩個互相獨立的操作。這些平行流程以不同的鏈或函式實作，各自的輸出最後再聚合成一個統一的結果。

實作的前置條件包括安裝必要的 Python 套件（例如 langchain、langchain-community，以及模型供應商的函式庫如 langchain-openai），並在本機環境設定所選語言模型的有效 API key 用於驗證。

```python
import os
import asyncio
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable, RunnableParallel, RunnablePassthrough


# --- Configuration ---
# Ensure your API key environment variable is set (e.g., OPENAI_API_KEY)
try:
    llm: Optional[ChatOpenAI] = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
except Exception as e:
    print(f"Error initializing language model: {e}")
    llm = None


# --- Define Independent Chains ---
# These three chains represent distinct tasks that can be executed in parallel.
summarize_chain: Runnable = (
    ChatPromptTemplate.from_messages([
        ("system", "Summarize the following topic concisely:"),
        ("user", "{topic}"),
    ])
    | llm
    | StrOutputParser()
)

questions_chain: Runnable = (
    ChatPromptTemplate.from_messages([
        ("system", "Generate three interesting questions about the following topic:"),
        ("user", "{topic}"),
    ])
    | llm
    | StrOutputParser()
)

terms_chain: Runnable = (
    ChatPromptTemplate.from_messages([
        ("system", "Identify 5-10 key terms from the following topic, separated by commas:"),
        ("user", "{topic}"),
    ])
    | llm
    | StrOutputParser()
)


# --- Build the Parallel + Synthesis Chain ---
# 1. Define the block of tasks to run in parallel. The results of these,
#    along with the original topic, will be fed into the next step.
map_chain = RunnableParallel(
    {
        "summary": summarize_chain,
        "questions": questions_chain,
        "key_terms": terms_chain,
        "topic": RunnablePassthrough(),  # Pass the original topic through
    }
)

# 2. Define the final synthesis prompt which will combine the parallel results.
synthesis_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        """Based on the following information:
        Summary: {summary}
        Related Questions: {questions}
        Key Terms: {key_terms}
        Synthesize a comprehensive answer."""
    ),
    ("user", "Original topic: {topic}"),
])

# 3. Construct the full chain by piping the parallel results directly
#    into the synthesis prompt, followed by the LLM and output parser.
full_parallel_chain = map_chain | synthesis_prompt | llm | StrOutputParser()


# --- Run the Chain ---
async def run_parallel_example(topic: str) -> None:
    """
    Asynchronously invokes the parallel processing chain with a specific topic
    and prints the synthesized result.

    Args:
        topic: The input topic to be processed by the LangChain chains.
    """
    if not llm:
        print("LLM not initialized. Cannot run example.")
        return

    print(f"\n--- Running Parallel LangChain Example for Topic: '{topic}' ---")
    try:
        # The input to `ainvoke` is the single 'topic' string,
        # then passed to each runnable in the `map_chain`.
        response = await full_parallel_chain.ainvoke(topic)
        print("\n--- Final Response ---")
        print(response)
    except Exception as e:
        print(f"\nAn error occurred during chain execution: {e}")


if __name__ == "__main__":
    test_topic = "The history of space exploration"
    # In Python 3.7+, asyncio.run is the standard way to run an async function.
    asyncio.run(run_parallel_example(test_topic))
```

這段 Python 程式碼實作了一個 LangChain 應用，利用平行執行有效率地處理給定主題。要注意的是，asyncio 提供的是並行（concurrency），不是真正的平行（parallelism）：它在單一執行緒上靠事件迴圈運作，當某個任務閒置（例如在等網路請求）時聰明地切換到別的任務。這造成多個任務同時推進的效果，但程式碼實際上仍由單一執行緒執行，受 Python 的全域直譯器鎖（GIL）限制。

程式先從 `langchain_openai` 和 `langchain_core` 匯入必要模組，包括語言模型、Prompt、輸出解析和 runnable 結構等元件。接著嘗試初始化一個 ChatOpenAI 實例，指定使用 "gpt-4o-mini" 模型，並設定 temperature 控制創意程度；初始化包在 try-except 區塊裡以確保穩健。然後定義三條獨立的 LangChain「鏈」，各自對輸入主題執行不同的任務：第一條鏈負責簡潔地摘要主題，由一則系統訊息和一則帶主題佔位符的使用者訊息組成；第二條鏈生成三個與主題相關的有趣問題；第三條鏈從輸入主題中找出 5 到 10 個關鍵詞，要求以逗號分隔。這三條獨立的鏈都由針對各自任務打造的 ChatPromptTemplate、初始化好的語言模型，以及把輸出格式化成字串的 StrOutputParser 組成。

接著建構一個 RunnableParallel 區塊，把這三條鏈捆在一起同時執行。這個平行 runnable 還包含一個 RunnablePassthrough，確保原始的輸入主題能傳給後續步驟。另外定義了一個 ChatPromptTemplate 給最後的綜合步驟，它接收摘要、問題、關鍵詞和原始主題，生成一個全面的答案。完整的端到端處理鏈叫 `full_parallel_chain`，由 `map_chain`（平行區塊）接綜合 Prompt、再接語言模型和輸出解析器串成。程式提供了非同步函式 `run_parallel_example` 示範如何呼叫這條鏈：它接收主題作為輸入，用 invoke 執行非同步的鏈。最後，標準的 Python `if __name__ == "__main__":` 區塊示範用範例主題「The history of space exploration」執行 `run_parallel_example`，以 asyncio.run 管理非同步執行。

簡而言之，這段程式碼建立了一個工作流程：針對給定主題，多個 LLM 呼叫（摘要、問題、關鍵詞）同時進行，結果再由最後一個 LLM 呼叫合併。這正是 LangChain 中 Agentic 工作流程平行化的核心概念。

## 實作範例（Google ADK）

接下來把注意力轉到 Google ADK 框架中的具體例子，看看 ADK 的基本元件（primitives）──例如 ParallelAgent 和 SequentialAgent──如何用來打造一個利用並行執行提升效率的 Agent 流程。

```python
from google.adk.agents import LlmAgent, ParallelAgent, SequentialAgent
from google.adk.tools import google_search

GEMINI_MODEL = "gemini-2.0-flash"


# --- 1. Define Researcher Sub-Agents (to run in parallel) ---

# Researcher 1: Renewable Energy
researcher_agent_1 = LlmAgent(
    name="RenewableEnergyResearcher",
    model=GEMINI_MODEL,
    instruction="""You are an AI Research Assistant specializing in energy. Research the latest advancements in 'renewable energy sources'. Use the Google Search tool provided. Summarize your key findings concisely (1-2 sentences). Output *only* the summary. """,
    description="Researches renewable energy sources.",
    tools=[google_search],
    # Store result in state for the merger agent
    output_key="renewable_energy_result",
)

# Researcher 2: Electric Vehicles
researcher_agent_2 = LlmAgent(
    name="EVResearcher",
    model=GEMINI_MODEL,
    instruction="""You are an AI Research Assistant specializing in transportation. Research the latest developments in 'electric vehicle technology'. Use the Google Search tool provided. Summarize your key findings concisely (1-2 sentences). Output *only* the summary. """,
    description="Researches electric vehicle technology.",
    tools=[google_search],
    # Store result in state for the merger agent
    output_key="ev_technology_result",
)

# Researcher 3: Carbon Capture
researcher_agent_3 = LlmAgent(
    name="CarbonCaptureResearcher",
    model=GEMINI_MODEL,
    instruction="""You are an AI Research Assistant specializing in climate solutions. Research the current state of 'carbon capture methods'. Use the Google Search tool provided. Summarize your key findings concisely (1-2 sentences). Output *only* the summary. """,
    description="Researches carbon capture methods.",
    tools=[google_search],
    # Store result in state for the merger agent
    output_key="carbon_capture_result",
)


# --- 2. Create the ParallelAgent (Runs researchers concurrently) ---
# This agent orchestrates the concurrent execution of the researchers.
# It finishes once all researchers have completed and stored their results in state.
parallel_research_agent = ParallelAgent(
    name="ParallelWebResearchAgent",
    sub_agents=[researcher_agent_1, researcher_agent_2, researcher_agent_3],
    description="Runs multiple research agents in parallel to gather information.",
)


# --- 3. Define the Merger Agent (Runs after the parallel agents) ---
# This agent takes the results stored in the session state by the parallel agents
# and synthesizes them into a single, structured response with attributions.
merger_agent = LlmAgent(
    name="SynthesisAgent",
    model=GEMINI_MODEL,  # Or potentially a more powerful model if needed for synthesis
    instruction="""You are an AI Assistant responsible for combining research findings into a structured report. Your primary task is to synthesize the following research summaries, clearly attributing findings to their source areas. Structure your response using headings for each topic. Ensure the report is coherent and integrates the key points smoothly.

**Crucially:** Your entire response MUST be grounded *exclusively* on the information provided in the 'Input Summaries' below. Do NOT add any external knowledge, facts, or details not present in these specific summaries.

**Input Summaries:**
*   **Renewable Energy:**
    {renewable_energy_result}
*   **Electric Vehicles:**
    {ev_technology_result}
*   **Carbon Capture:**
    {carbon_capture_result}

**Output Format:**
## Summary of Recent Sustainable Technology Advancements

### Renewable Energy Findings (Based on RenewableEnergyResearcher's findings)
[Synthesize and elaborate *only* on the renewable energy input summary provided above.]

### Electric Vehicle Findings (Based on EVResearcher's findings)
[Synthesize and elaborate *only* on the EV input summary provided above.]

### Carbon Capture Findings (Based on CarbonCaptureResearcher's findings)
[Synthesize and elaborate *only* on the carbon capture input summary provided above.]

### Overall Conclusion
[Provide a brief (1-2 sentence) concluding statement that connects *only* the findings presented above.]

Output *only* the structured report following this format. Do not include introductory or concluding phrases outside this structure, and strictly adhere to using only the provided input summary content.
""",
    description="Combines research findings from parallel agents into a structured, cited report, strictly grounded on provided inputs.",
    # No tools needed for merging
    # No output_key needed here, as its direct response is the final output of the sequence
)


# --- 4. Create the SequentialAgent (Orchestrates the overall flow) ---
# This is the main agent that will be run. It first executes the ParallelAgent
# to populate the state, and then executes the MergerAgent to produce the final output.
sequential_pipeline_agent = SequentialAgent(
    name="ResearchAndSynthesisPipeline",
    # Run parallel research first, then merge
    sub_agents=[parallel_research_agent, merger_agent],
    description="Coordinates parallel research and synthesizes the results.",
)

root_agent = sequential_pipeline_agent
```

這段程式碼定義了一個 Multi-Agent 系統，用來研究並綜合永續科技進展的資訊。它建立三個 LlmAgent 實例擔任專門的研究員：`ResearcherAgent_1` 專注再生能源，`ResearcherAgent_2` 研究電動車技術，`ResearcherAgent_3` 調查碳捕捉方法。每個研究員 Agent 都設定使用 `GEMINI_MODEL` 和 `google_search` 工具，被指示簡潔地摘要發現（1-2 句），並透過 `output_key` 把摘要存進 session 狀態。

接著建立一個名為 ParallelWebResearchAgent 的 ParallelAgent，讓這三個研究員 Agent 同時執行。研究因此能平行進行，有機會省下時間。所有子 Agent（研究員）都完成並把結果寫入狀態後，ParallelAgent 就結束執行。

再來定義一個 MergerAgent（也是 LlmAgent）來綜合研究結果。這個 Agent 以平行研究員存進 session 狀態的摘要作為輸入。它的 instruction 強調輸出必須嚴格只根據提供的輸入摘要，禁止添加外部知識。MergerAgent 要把整合後的發現組織成一份報告：每個主題一個標題，最後加一段簡短的整體結論。

最後，建立一個名為 ResearchAndSynthesisPipeline 的 SequentialAgent 來調度整個工作流程。作為主控制器，這個主 Agent 先執行 ParallelAgent 完成研究；ParallelAgent 結束後，SequentialAgent 再執行 MergerAgent 綜合蒐集到的資訊。`sequential_pipeline_agent` 被設為 `root_agent`，是執行這個 Multi-Agent 系統的進入點。整個流程的設計，就是先平行地從多個來源蒐集資訊，再把它們合併成一份結構化的報告。

## 速覽

**問題：** 許多 Agentic 工作流程要完成多個子任務才能達成最終目標。純循序的執行──每個任務都等前一個做完──往往又慢又沒效率。當任務依賴外部 I/O 操作（呼叫不同的 API、查詢多個資料庫）時，這種延遲會成為明顯的瓶頸。沒有並行執行的機制，總處理時間就是所有任務時間的總和，拖累系統的整體效能和反應速度。

**解法：** Parallelization 模式提供了標準化的解法：讓獨立的任務同時執行。做法是找出工作流程中不依賴彼此即時輸出的元件（例如工具使用或 LLM 呼叫）。LangChain 和 Google ADK 這類 Agentic 框架內建了定義和管理並行操作的構件。例如，主流程可以啟動幾個平行執行的子任務，等它們全部完成後再進行下一步。讓獨立任務同時跑而不是排隊跑，這個模式能大幅縮短總執行時間。

**經驗法則：** 當工作流程包含多個可以同時執行的獨立操作時，就用這個模式──例如同時從多個 API 抓資料、處理不同的資料塊，或生成多份內容供後續綜合。

**圖解：**

![Parallelization 設計模式](/assets/agentic-design-patterns/Parallelization_Design_Pattern.png)

圖 2：Parallelization 設計模式。

## 重點回顧

幾個重點：

* Parallelization 是讓獨立任務並行執行以提升效率的模式。
* 當任務需要等待外部資源（例如 API 呼叫）時特別有用。
* 採用並行或平行架構會帶來可觀的複雜度和成本，影響設計、除錯、系統記錄等關鍵開發環節。
* LangChain 和 Google ADK 這類框架內建了定義和管理平行執行的支援。
* 在 LangChain Expression Language（LCEL）中，RunnableParallel 是讓多個 runnable 並排執行的關鍵構件。
* Google ADK 可以透過 LLM 驅動的委派（LLM-Driven Delegation）實現平行執行：協調者 Agent 的 LLM 辨識出獨立的子任務，觸發專門的子 Agent 並行處理。
* 平行化有助於降低整體延遲，讓 Agentic 系統在複雜任務上反應更快。

## 結語

Parallelization 模式是最佳化計算工作流程的方法：讓獨立的子任務並行執行。這種做法能降低整體延遲，在涉及多次模型推論或外部服務呼叫的複雜操作中尤其明顯。

各框架提供了不同的實作機制。在 LangChain 中，RunnableParallel 這類構件用來明確定義並同時執行多條處理鏈。相對地，Google ADK 這類框架可以透過 Multi-Agent 委派達成平行化：由主要的協調者模型把不同子任務指派給能並行運作的專門 Agent。

把平行處理與循序（chaining）和條件（routing）控制流程結合起來，就能建構出精密、高效能的計算系統，有能力應付多樣且複雜的任務。

## 參考資料

以下是關於 Parallelization 模式和相關概念的延伸閱讀資源：

1. LangChain Expression Language (LCEL) Documentation (Parallelism): [https://python.langchain.com/docs/concepts/lcel/](https://python.langchain.com/docs/concepts/lcel/)
2. Google Agent Developer Kit (ADK) Documentation (Multi-Agent Systems): [https://google.github.io/adk-docs/agents/multi-agents/](https://google.github.io/adk-docs/agents/multi-agents/)
3. Python `asyncio` Documentation: [https://docs.python.org/3/library/asyncio.html](https://docs.python.org/3/library/asyncio.html)
