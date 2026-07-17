---
title: "Agentic Design Patterns 附錄 C：Agentic 框架速覽"
description: "LangChain、LangGraph、CrewAI、Google ADK 等 Agentic 框架速覽。《Agentic Design Patterns》附錄 C 繁體中文翻譯。"
pubDatetime: 2026-07-18T20:36:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## LangChain

LangChain 是一個用來開發由 LLM（大型語言模型）驅動的應用的框架。它最核心的優勢是 LangChain Expression Language（LCEL），讓你可以像接水管一樣把各個元件「串」成一條鏈。這樣會形成一條清楚的線性流程，前一步的輸出就是下一步的輸入。它是為有向無環圖（DAG）這種工作流程設計的，也就是流程只朝一個方向走、不會繞回來。

適用場景：

* 簡單的 RAG：檢索一份文件、組出一段 prompt，再從 LLM 拿到答案。
* 摘要：把使用者的文字丟進摘要 prompt，然後回傳結果。
* 資料萃取：從一段文字裡抽出結構化資料（例如 JSON）。

Python

```python
# A simple LCEL chain conceptually # (This is not runnable code, just illustrates the flow) 
chain = prompt | model | output_parse
```

## LangGraph

LangGraph 是建構在 LangChain 之上的函式庫，用來處理更進階的 Agentic 系統。它讓你把工作流程定義成一張圖，節點是函式或 LCEL 鏈，邊則是條件邏輯。它最大的好處是能建立循環，讓應用可以繞迴圈、重試、或以彈性的順序呼叫工具，直到任務完成為止。它會明確地管理應用狀態，這個狀態會在節點之間傳遞，並在整個流程中持續更新。

適用場景：

* Multi-Agent 系統：由一個 supervisor Agent 把任務分派給各個專職的 worker Agent，過程中可能反覆繞迴圈直到達成目標。
* 規劃並執行（Plan-and-Execute）的 Agent：Agent 先擬出計畫、執行其中一步，再依照結果繞回來更新計畫。
* Human-in-the-Loop：這張圖可以先等人類輸入，再決定接下來要走到哪個節點。

| 特性 | LangChain | LangGraph |
| :---- | :---- | :---- |
| 核心抽象 | 鏈（使用 LCEL） | 節點組成的圖 |
| 工作流程類型 | 線性（有向無環圖） | 循環（帶迴圈的圖） |
| 狀態管理 | 每次執行通常是無狀態的 | 明確且持久的狀態物件 |
| 主要用途 | 簡單、可預測的序列 | 複雜、動態、有狀態的 Agent |

### 該選哪一個？

* 當你的應用有一條清楚、可預測的線性步驟流程時，選 LangChain。如果你能把流程定義成 A 到 B 再到 C、不需要繞回頭，那用搭配 LCEL 的 LangChain 就再適合不過。
* 當你的應用需要推理、規劃或以迴圈方式運作時，選 LangGraph。如果你的 Agent 需要用工具、對結果做反思、可能還要換個方法再試一次，那你就需要 LangGraph 這種帶循環又有狀態的特性。

```python
# Graph state
class State(TypedDict):
    topic: str
    joke: str
    story: str
    poem: str
    combined_output: str


# Nodes
def call_llm_1(state: State):
    """First LLM call to generate initial joke"""
    msg = llm.invoke(f"Write a joke about {state['topic']}")
    return {"joke": msg.content}


def call_llm_2(state: State):
    """Second LLM call to generate story"""
    msg = llm.invoke(f"Write a story about {state['topic']}")
    return {"story": msg.content}


def call_llm_3(state: State):
    """Third LLM call to generate poem"""
    msg = llm.invoke(f"Write a poem about {state['topic']}")
    return {"poem": msg.content}


def aggregator(state: State):
    """Combine the joke and story into a single output"""
    combined = f"Here's a story, joke, and poem about {state['topic']}!\n\n"
    combined += f"STORY:\n{state['story']}\n\n"
    combined += f"JOKE:\n{state['joke']}\n\n"
    combined += f"POEM:\n{state['poem']}"
    return {"combined_output": combined}


# Build workflow
parallel_builder = StateGraph(State)

# Add nodes
parallel_builder.add_node("call_llm_1", call_llm_1)
parallel_builder.add_node("call_llm_2", call_llm_2)
parallel_builder.add_node("call_llm_3", call_llm_3)
parallel_builder.add_node("aggregator", aggregator)

# Add edges to connect nodes
parallel_builder.add_edge(START, "call_llm_1")
parallel_builder.add_edge(START, "call_llm_2")
parallel_builder.add_edge(START, "call_llm_3")
parallel_builder.add_edge("call_llm_1", "aggregator")
parallel_builder.add_edge("call_llm_2", "aggregator")
parallel_builder.add_edge("call_llm_3", "aggregator")
parallel_builder.add_edge("aggregator", END)

parallel_workflow = parallel_builder.compile()

# Show workflow
display(Image(parallel_workflow.get_graph().draw_mermaid_png()))

# Invoke
state = parallel_workflow.invoke({"topic": "cats"})
print(state["combined_output"])
```

這段程式碼定義並執行了一個以並行方式運作的 LangGraph 工作流程。它的主要目的是針對一個給定主題，同時生成一則笑話、一則故事和一首詩，然後把它們組合成單一、有格式的文字輸出。

## Google's ADK

Google 的 Agent Development Kit（ADK）提供了一個高階、結構化的框架，用來建構與部署由多個彼此互動的 AI Agent 組成的應用。它和 LangChain、LangGraph 的差別在於，它提供的是一套更有主見、更偏向正式上線的系統，用來協調 Agent 之間的協作，而不是提供打造 Agent 內部邏輯的基礎積木。

LangChain 運作在最底層，提供各種元件和標準化介面，用來組出一連串操作，例如呼叫模型再解析它的輸出。LangGraph 在這之上做了擴充，引入更彈性、更強大的控制流程；它把 Agent 的工作流程當成一張有狀態的圖來看待。用 LangGraph 時，開發者要明確定義節點（也就是函式或工具）和邊（決定執行的路徑）。這種圖結構能支援複雜的循環推理，讓系統可以繞迴圈、重試任務，並根據一個在節點間傳遞、由開發者明確管理的狀態物件來做決定。它給開發者對單一 Agent 思考過程的細部控制權，也讓你能從頭打造一個 Multi-Agent 系統。

Google 的 ADK 把這些底層的建圖工作大多抽象掉了。它不要求開發者去定義每一個節點和邊，而是為 Multi-Agent 互動提供了預先做好的架構模式。舉例來說，ADK 內建了像 SequentialAgent 或 ParallelAgent 這類 Agent 型別，會自動管理不同 Agent 之間的控制流程。它的架構是圍繞一個 Agent「團隊」的概念設計的，通常會有一個主 Agent 把任務委派給各個專職的子 Agent。狀態和 session 管理則交由框架用比較隱性的方式處理，比起 LangGraph 那種明確的狀態傳遞，這種做法更一體成型，但顆粒度也比較粗。所以說，如果 LangGraph 給你的是設計單一機器人或一個團隊複雜接線用的精細工具，那 Google 的 ADK 給你的就是一條工廠生產線，專門用來打造與管理一支本來就懂得彼此協作的機器人艦隊。

```python
from google.adk.agents import LlmAgent
from google.adk.tools import google_Search

dice_agent = LlmAgent(
    model="gemini-2.0-flash-exp",
    name="question_answer_agent",
    description="A helpful assistant agent that can answer questions.",
    instruction="""Respond to the query using google search""",
    tools=[google_search],
)
```

這段程式碼建立了一個搜尋增強型的 Agent。當這個 Agent 收到問題時，它不會只靠自己既有的知識。相反地，它會照著指令，用 Google Search 工具從網路上找到相關、即時的資訊，再用這些資訊組出答案。

## Crew.AI

CrewAI 提供了一套協調框架，透過聚焦在協作角色和結構化流程上，來建構 Multi-Agent 系統。它運作的抽象層級比那些基礎工具包更高，提供一個對照人類團隊的概念模型。開發者不用把邏輯的細部流程定義成一張圖，而是定義有哪些角色、各自負責什麼，再由 CrewAI 來管理它們之間的互動。

這個框架的核心元件是 Agent、Task 和 Crew。一個 Agent 不只由它的功能來定義，還帶有一個人格設定，包括特定的角色、目標和背景故事，用來引導它的行為和溝通風格。一個 Task 是一份界線清楚的工作單位，有明確的描述和預期產出，並指派給特定的 Agent。Crew 則是把這些 Agent 和 Task 清單聚在一起的整體單元，它會執行一套預先定義好的 Process（流程）。這個流程決定了工作方式，通常不是循序型（一個任務的輸出成為下一個任務的輸入），就是階層型（由一個類似經理的 Agent 分派任務，並協調其他 Agent 之間的工作流程）。

跟其他框架比起來，CrewAI 佔了一個獨特的位置。它不走 LangGraph 那種底層、明確的狀態管理與控制流程（在那裡開發者得把每一個節點和條件邊都接好）。開發者要做的不是打造一台狀態機，而是設計一份團隊章程。相較於 Google 的 ADK 為整個 Agent 生命週期提供了一個全面、偏向正式上線的平台，CrewAI 則專門聚焦在 Agent 協作的邏輯，以及模擬一支由專家組成的團隊。

```python
@crew
def crew(self) -> Crew:
   """Creates the research crew"""
   return Crew(
     agents=self.agents,
     tasks=self.tasks,
     process=Process.sequential,
     verbose=True,
   )
```

這段程式碼為一支 AI Agent 團隊設定了一個循序工作流程，讓它們按特定順序處理一份任務清單，並開啟詳細的日誌記錄來監控進度。

## 其他 Agent 開發框架

**Microsoft AutoGen**：AutoGen 是一個以協調多個 Agent、透過對話來解決任務為核心的框架。它的架構讓具備不同能力的 Agent 彼此互動，能把複雜問題拆解開來協作解決。AutoGen 的主要優勢是它那套彈性、以對話驅動的做法，能支援動態又複雜的 Multi-Agent 互動。不過這種對話式的模式可能讓執行路徑比較難預測，也可能需要精細的 prompt engineering 才能讓任務有效率地收斂。

**LlamaIndex**：LlamaIndex 本質上是一個資料框架，用來把大型語言模型連接到外部和私有的資料來源。它擅長打造精密的資料匯入與檢索流水線，這對於建構能執行 RAG、有知識底子的 Agent 來說很關鍵。它的資料索引與查詢能力在打造具情境感知的 Agent 上格外強大，但跟那些以 Agent 為優先的框架比起來，它在複雜的 Agentic 控制流程和 Multi-Agent 協調上的原生工具就沒那麼成熟。當核心技術挑戰是資料檢索與整合時，LlamaIndex 是最佳選擇。

**Haystack**：Haystack 是一個開源框架，專門用來打造由語言模型驅動、可擴展又能正式上線的搜尋系統。它的架構由模組化、可互通的節點組成，這些節點串成文件檢索、問答和摘要的流水線。Haystack 的主要強項是它專注在大規模資訊檢索任務的效能與可擴展性，很適合企業級的應用。一個可能的取捨是，它為搜尋流水線最佳化過的設計，在實作高度動態、需要創意的 Agentic 行為時可能會顯得比較僵硬。

**MetaGPT**：MetaGPT 透過一套預先定義好的標準作業程序（SOP）來指派角色和任務，藉此實作 Multi-Agent 系統。這個框架把 Agent 的協作結構安排得像一家軟體開發公司，Agent 會扮演產品經理或工程師之類的角色來完成複雜任務。這種由 SOP 驅動的做法會產出高度結構化、前後連貫的成果，這對程式碼生成這類專門領域是很大的優勢。這個框架的主要限制是它高度專門化，讓它在核心設計之外的通用 Agentic 任務上適應力比較差。

**SuperAGI**：SuperAGI 是一個開源框架，目標是為自主 Agent 提供一套完整的生命週期管理系統。它包含 Agent 佈建、監控以及圖形化介面等功能，希望能提升 Agent 執行的可靠度。它的關鍵好處是專注在正式上線的成熟度上，內建了處理常見失效模式（例如卡在迴圈裡）的機制，並提供對 Agent 表現的可觀測性。一個可能的缺點是，比起更輕量、以函式庫為主的框架，它這種大而全的平台做法可能帶來更多複雜度和額外負擔。

**Semantic Kernel**：由 Microsoft 開發的 Semantic Kernel 是一套 SDK，透過「plugin」和「planner」的機制，把大型語言模型和一般的程式碼整合起來。它讓 LLM 能呼叫原生函式並協調工作流程，實際上是把模型當成一個更大型軟體應用裡的推理引擎。它的主要強項是能和既有的企業程式碼庫無縫整合，尤其是在 .NET 和 Python 環境裡。它那套 plugin 與 planner 架構的概念負擔，可能讓學習曲線比那些更直白的 Agent 框架來得陡一些。

**Strands Agents**：AWS 出品的一套輕量又有彈性的 SDK，採用以模型驅動的方式來建構與執行 AI Agent。它的設計簡單又可擴展，從基本的對話助理到複雜的 Multi-Agent 自主系統都能支援。這個框架與模型無關，廣泛支援各種 LLM 供應商，並內建與 MCP 的整合，方便存取外部工具。它的核心優勢是簡單又靈活，有一個好上手、可自訂的 agent loop。一個可能的取捨是，它輕量的設計意味著開發者可能得自己多蓋一些周邊的維運基礎設施，例如進階的監控或生命週期管理系統，而這些在更全面的框架裡可能是開箱即用的。

## 結語

Agentic 框架的整體樣貌提供了各式各樣的工具，從定義 Agent 邏輯的底層函式庫，到協調 Multi-Agent 協作的高階平台都有。在最基礎的層級，LangChain 讓你做出簡單、線性的工作流程，而 LangGraph 則引入了有狀態、帶循環的圖，用來處理更複雜的推理。像 CrewAI 和 Google 的 ADK 這類更高階的框架，把重心轉到協調一支支帶有預定義角色的 Agent 團隊，而像 LlamaIndex 這類框架則專攻資料密集型的應用。這麼多樣的選擇，給了開發者一個核心的取捨：是要基於圖的系統那種細部控制，還是更有主見的平台那種流暢的開發體驗。也因此，選對框架的關鍵在於：你的應用需要的是一條簡單的序列、一個動態的推理迴圈，還是一支受管理的專家團隊。最終，這個不斷演進的生態系讓開發者能挑到專案所需的那個精確抽象層級，藉此打造出越來越精密的 AI 系統。

參考資料

1. LangChain, [https://www.langchain.com/](https://www.langchain.com/)
2. LangGraph, [https://www.langchain.com/langgraph](https://www.langchain.com/langgraph)
3. Google's ADK, [https://google.github.io/adk-docs/](https://google.github.io/adk-docs/)
4. Crew.AI, [https://docs.crewai.com/en/introduction](https://docs.crewai.com/en/introduction)
