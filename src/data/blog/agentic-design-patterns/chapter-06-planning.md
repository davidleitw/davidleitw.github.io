---
title: "Agentic Design Patterns 第 6 章：Planning（規劃）"
description: "讓 Agent 先把目標拆成多步計畫再執行。《Agentic Design Patterns》第 6 章繁體中文翻譯，含程式碼範例。"
pubDatetime: 2026-07-18T20:54:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

有智慧的行為，往往不只是對眼前的輸入做出反應。它需要前瞻：把複雜任務拆成更小、可掌控的步驟，並為達成目標擬定策略。這就是 Planning（規劃）模式的用武之地。規劃的核心，是 Agent（或一組 Agent）制定一連串行動、從初始狀態走向目標狀態的能力。

## 模式概觀

在 AI 的脈絡下，可以把規劃型 Agent 想成一位你委以複雜目標的專家。當你請它「籌辦一場團隊異地會議」時，你定義的是「做什麼」──目標和它的限制條件──而不是「怎麼做」。Agent 的核心任務，是自主地規劃出通往目標的路線。它得先理解初始狀態（例如預算、人數、期望日期）和目標狀態（順利訂好的異地會議），再找出連接兩者的最佳行動序列。計畫不是事先就有的，而是針對請求即時產生的。

這個過程的標誌是適應力。初始計畫只是起點，不是死板的腳本。Agent 真正的威力在於它能吸收新資訊、繞過障礙繼續推進。比方說，首選場地訂不到了、選定的外燴商滿檔了，一個有能力的 Agent 不會就此失敗，而是會調整：記下新的限制條件、重新評估選項、擬出新計畫──也許是建議替代場地或日期。

不過，必須認清「靈活性」和「可預測性」之間的取捨。動態規劃是特定用途的工具，不是萬用解。當問題的解法已經很清楚、可以重複套用時，把 Agent 限制在預先定義的固定工作流程反而更有效：限縮 Agent 的自主性，可以降低不確定性和不可預測行為的風險，保證結果可靠且一致。所以「用規劃型 Agent 還是簡單的任務執行 Agent」，取決於一個問題：「怎麼做」需要被發現，還是已經知道了？

## 實際應用與使用情境

Planning 模式是自主系統的核心計算過程，讓 Agent 能為指定目標合成出一連串行動，特別是在動態或複雜的環境中。這個過程把高層次的目標，轉化為由分立、可執行步驟組成的結構化計畫。

在程序性任務自動化這類領域，規劃用來調度複雜的工作流程。例如「新員工入職」這樣的業務流程，可以分解成一連串有方向的子任務：建立系統帳號、指派訓練課程、與各部門協調。Agent 生成一個按邏輯順序執行這些步驟的計畫，呼叫必要的工具、與各系統互動來處理依賴關係。

在機器人與自主導航領域，規劃是狀態空間遍歷的基礎。不管是實體機器人還是虛擬實體，系統都必須生成一條路徑或一串行動，從初始狀態轉移到目標狀態。這牽涉到對時間、能耗等指標的最佳化，同時遵守環境限制，例如避開障礙物或遵守交通規則。

這個模式對結構化的資訊綜合也很關鍵。接到「生成一份研究報告」這類複雜產出的任務時，Agent 可以擬定一個包含明確階段的計畫：蒐集資訊、摘要資料、組織內容、迭代修訂。同樣地，在需要多步驟解決問題的客服場景，Agent 可以建立並遵循一套系統化的計畫：診斷、實施解法、必要時升級。

本質上，Planning 模式讓 Agent 超越簡單的反應式行動，走向目標導向的行為。它提供了解決「需要一連串環環相扣的操作」的問題所必需的邏輯框架。

## 實作範例（CrewAI）

接下來示範用 CrewAI 框架實作 Planner 模式：Agent 先為複雜的查詢擬定一個多步驟計畫，再依序執行。

```python
import os
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI


# Load environment variables from .env file for security
load_dotenv()


# 1. Explicitly define the language model for clarity
llm = ChatOpenAI(model="gpt-4-turbo")


# 2. Define a clear and focused agent
planner_writer_agent = Agent(
    role='Article Planner and Writer',
    goal='Plan and then write a concise, engaging summary on a specified topic.',
    backstory=(
        'You are an expert technical writer and content strategist. '
        'Your strength lies in creating a clear, actionable plan before writing, '
        'ensuring the final summary is both informative and easy to digest.'
    ),
    verbose=True,
    allow_delegation=False,
    llm=llm,  # Assign the specific LLM to the agent
)


# 3. Define a task with a more structured and specific expected output
topic = "The importance of Reinforcement Learning in AI"

high_level_task = Task(
    description=(
        f"1. Create a bullet-point plan for a summary on the topic: '{topic}'.\n"
        f"2. Write the summary based on your plan, keeping it around 200 words."
    ),
    expected_output=(
        "A final report containing two distinct sections:\n\n"
        "### Plan\n"
        "- A bulleted list outlining the main points of the summary.\n\n"
        "### Summary\n"
        "- A concise and well-structured summary of the topic."
    ),
    agent=planner_writer_agent,
)


# Create the crew with a clear process
crew = Crew(
    agents=[planner_writer_agent],
    tasks=[high_level_task],
    process=Process.sequential,
)


# Execute the task
print("## Running the planning and writing task ##")
result = crew.kickoff()

print("\n\n---\n## Task Result ##\n---")
print(result)
```

這段程式碼用 CrewAI 函式庫建立一個「先規劃、再撰寫指定主題摘要」的 AI Agent。它先匯入必要的函式庫（包括 CrewAI 和 `langchain_openai`），並從 .env 檔載入環境變數。程式明確定義了一個 ChatOpenAI 語言模型給 Agent 使用。接著建立名為 `planner_writer_agent` 的 Agent，賦予明確的角色和目標：先規劃、再寫出簡潔的摘要；它的 backstory 強調規劃與技術寫作的專長。然後定義一個 Task，清楚描述要先擬計畫、再就主題「The importance of Reinforcement Learning in AI」寫摘要，並指定了預期輸出的格式。最後把 Agent 和任務組成一個 Crew，設定為循序處理，呼叫 crew.kickoff() 執行任務並印出結果。

## Google DeepResearch

Google Gemini DeepResearch（見圖 1）是一個為自主資訊檢索與綜合而設計的 Agent 系統。它透過一條多步驟的 Agentic pipeline 運作，動態、迭代地查詢 Google 搜尋，有系統地探索複雜主題。這個系統的設計目標是：處理大量網路來源、評估蒐集到的資料的相關性和知識缺口，再進行後續搜尋來填補缺口。最終輸出把驗證過的資訊整合成一份結構化的多頁摘要，並附上原始來源的引用。

進一步說，這個系統的運作不是一次性的「問答」，而是一個受管理的長時間流程。它先把使用者的 Prompt 拆解成一份多要點的研究計畫（見圖 1），呈給使用者審閱和修改──在執行之前，研究方向可以協作式地調整。計畫核准後，Agentic pipeline 就啟動迭代的「搜尋與分析」循環。這不只是執行一串預先定義的搜尋：Agent 會根據蒐集到的資訊動態地擬定和調整查詢，主動找出知識缺口、交叉驗證資料點、解決不一致之處。

![Google Deep Research Agent 為「以 Google 搜尋為工具」生成執行計畫](/assets/agentic-design-patterns/Google_Deep_Research_Agent_Generating_an_execution_plan_for_using_Google_Search_as_a_Tool.png)

圖 1：Google Deep Research Agent 為「以 Google 搜尋為工具」生成執行計畫。

一個關鍵的架構元件，是系統以非同步方式管理整個流程的能力。這個設計確保這場可能要分析上百個來源的調查，能承受單點故障，也讓使用者可以先離開、完成後再收到通知。系統還能整合使用者提供的文件，把私有來源的資訊和網路研究結合起來。最終輸出不只是把發現串在一起的清單，而是一份結構化的多頁報告。在綜合階段，模型會對蒐集到的資訊做批判性的評估：找出主要議題，把內容組織成有邏輯段落的連貫敘事。報告設計成可互動的，通常包含語音導覽、圖表、原始引用來源的連結等功能，方便使用者驗證和進一步探索。除了綜合結果之外，模型還會明確列出它搜尋和參考過的完整來源清單（見圖 2），以引用的形式呈現，提供完全的透明度和直達原始資訊的路徑。整個過程把一個簡單的查詢，轉化成一套全面、綜合過的知識。

![Deep Research 計畫執行中的例子：Google 搜尋作為工具，搜尋各種網路來源](/assets/agentic-design-patterns/Example_of_Deep_Research_Plan_Being_Executed_Resulting_in_Google_Search_being_used_as_a_Tool_to_Search_Various_Web_Sources.png)

圖 2：Deep Research 計畫執行中的例子──Google 搜尋作為工具，搜尋各種網路來源。

Gemini DeepResearch 省去了手動蒐集和綜合資料所需的大量時間與資源，為資訊探索提供了更有結構、更詳盡的方法。在各領域複雜、多面向的研究任務中，這個系統的價值特別明顯。

例如在競爭分析中，可以指示 Agent 有系統地蒐集和整理市場趨勢、競品規格、來自各種網路來源的輿論，以及行銷策略。這個自動化流程取代了手動追蹤多個競爭對手的苦工，讓分析師能專注在更高層次的策略解讀，而不是資料蒐集（見圖 3）。

![Google Deep Research Agent 生成的最終輸出：代替我們分析以 Google 搜尋為工具取得的來源](/assets/agentic-design-patterns/Final_Output_Generated_by_Google_Deep_Research_Agent_Analyzing_on_our_Behalf_Sources_Obtained_using_Google_Search_as_a_Tool.png)

圖 3：Google Deep Research Agent 生成的最終輸出，代替我們分析以 Google 搜尋為工具取得的來源。

同樣地，在學術探索中，這個系統是進行大規模文獻回顧的利器：它能找出並摘要奠基性的論文、跨大量文獻追蹤概念的發展脈絡、描繪特定領域新興的研究前沿，大幅加速學術研究中最初也最耗時的階段。

這種做法的效率，來自把「迭代搜尋與過濾」這個手動研究的核心瓶頸自動化。全面性則來自系統能在相近的時間內，處理比人類研究者多得多、雜得多的資訊來源。更廣的分析範圍有助於降低選擇偏誤，也更有機會挖出不那麼顯眼、但可能很關鍵的資訊，讓你對主題的理解更穩固、更有依據。

## OpenAI Deep Research API

OpenAI Deep Research API 是專門把複雜研究任務自動化的工具。它使用一個先進的 Agentic 模型，能獨立地推理、規劃，並從真實世界的來源綜合資訊。與簡單的問答模型不同，它接收一個高層次的查詢，自主地把它拆成子問題、用內建工具做網頁搜尋，最後交出一份結構化、引用豐富的報告。這個 API 讓你以程式化的方式直接使用整個流程；在撰寫本文時，可用的模型包括高品質綜合的 o3-deep-research-2025-06-26，以及速度較快、適合延遲敏感應用的 o4-mini-deep-research-2025-06-26。

Deep Research API 的價值在於：它把原本要花上數小時的手動研究自動化，交出專業等級、以資料為本的報告，適合用來支撐商業策略、投資決策或政策建議。主要好處包括：

* **結構化、有引用的輸出：** 產出組織良好的報告，行內引用連結到來源的中繼資料，確保論點可驗證、有資料支撐。
* **透明度：** 不同於 ChatGPT 裡被抽象掉的過程，API 揭露所有中間步驟，包括 Agent 的推理、實際執行的搜尋查詢、跑過的程式碼。這讓你能細緻地除錯、分析，更深入理解最終答案是怎麼組出來的。
* **可擴充性：** 支援 Model Context Protocol（MCP），開發者能把 Agent 接上私有知識庫和內部資料來源，讓公開的網路研究與專屬資訊結合。

使用 API 時，向 client.responses.create 端點發送請求，指定模型、輸入 Prompt，以及 Agent 可用的工具。輸入通常包含定義 Agent 人設和期望輸出格式的 `system_message`，加上 `user_query`。你必須帶上 `web_search_preview` 工具，也可以選擇加上 `code_interpreter`，或用於內部資料的自訂 MCP 工具（見第 10 章）。

```python
from openai import OpenAI


# Initialize the client with your API key
client = OpenAI(api_key="YOUR_OPENAI_API_KEY")


# Define the agent's role and the user's research question
system_message = """
You are a professional researcher preparing a structured, data-driven report.
Focus on data-rich insights, use reliable sources, and include inline citations.
"""

user_query = "Research the economic impact of semaglutide on global healthcare systems."


# Create the Deep Research API call
response = client.responses.create(
    model="o3-deep-research-2025-06-26",
    input=[
        {
            "role": "developer",
            "content": [{"type": "input_text", "text": system_message}],
        },
        {
            "role": "user",
            "content": [{"type": "input_text", "text": user_query}],
        },
    ],
    reasoning={"summary": "auto"},
    tools=[{"type": "web_search_preview"}],
)


# Access and print the final report from the response
final_report = response.output[-1].content[0].text
print(final_report)


# --- ACCESS INLINE CITATIONS AND METADATA ---
print("--- CITATIONS ---")
annotations = response.output[-1].content[0].annotations

if not annotations:
    print("No annotations found in the report.")
else:
    for i, citation in enumerate(annotations):
        # The text span the citation refers to
        cited_text = final_report[citation.start_index : citation.end_index]
        print(f"Citation {i + 1}:")
        print(f"  Cited Text: {cited_text}")
        print(f"  Title: {citation.title}")
        print(f"  URL: {citation.url}")
        print(f"  Location: chars {citation.start_index}–{citation.end_index}")

print("\n" + "=" * 50 + "\n")


# --- INSPECT INTERMEDIATE STEPS ---
print("--- INTERMEDIATE STEPS ---")

# 1. Reasoning Steps: Internal plans and summaries generated by the model.
try:
    reasoning_step = next(item for item in response.output if item.type == "reasoning")
    print("\n[Found a Reasoning Step]")
    for summary_part in reasoning_step.summary:
        print(f"  - {summary_part.text}")
except StopIteration:
    print("\nNo reasoning steps found.")

# 2. Web Search Calls: The exact search queries the agent executed.
try:
    search_step = next(item for item in response.output if item.type == "web_search_call")
    print("\n[Found a Web Search Call]")
    print(f"  Query Executed: '{search_step.action['query']}'")
    print(f"  Status: {search_step.status}")
except StopIteration:
    print("\nNo web search steps found.")

# 3. Code Execution: Any code run by the agent using the code interpreter.
try:
    code_step = next(item for item in response.output if item.type == "code_interpreter_call")
    print("\n[Found a Code Execution Step]")
    print("  Code Input:")
    print(f"  ```python\n{code_step.input}\n  ```")
    print("  Code Output:")
    print(f"  {code_step.output}")
except StopIteration:
    print("\nNo code execution steps found.")
```

這段程式碼用 OpenAI API 執行一次「Deep Research」任務。它先用你的 API key 初始化 OpenAI 客戶端（驗證的關鍵），接著把 AI Agent 的角色定義為專業研究員，並設定使用者的研究問題──semaglutide 對全球醫療體系的經濟影響。程式對 o3-deep-research-2025-06-26 模型發出 API 呼叫，把定義好的系統訊息和使用者查詢作為輸入，同時要求自動生成推理摘要、啟用網頁搜尋能力。呼叫完成後，抽出並印出最終生成的報告。

接著，程式嘗試從報告的 annotations 中取得行內引用和中繼資料，包括被引用的文字、標題、URL，以及在報告中的位置。最後，它檢視並印出模型執行過的中間步驟：推理步驟、網頁搜尋呼叫（包括實際執行的查詢），以及若有使用 code interpreter 時的程式碼執行步驟。

## 速覽

**問題：** 複雜的問題往往無法靠單一動作解決，需要前瞻性才能達成想要的結果。缺少結構化做法的 Agentic 系統，很難應付包含多個步驟和依賴關係的多面向請求，也就難以把高層次的目標拆成一串可掌控、可執行的小任務。結果就是系統無法有效地擬定策略，面對複雜目標時交出不完整或錯誤的結果。

**解法：** Planning 模式的標準化解法，是讓 Agentic 系統先為目標建立一份連貫的計畫：把高層次的目標分解成一連串更小、可執行的步驟或子目標。系統因此能管理複雜的工作流程、調度各種工具、按邏輯順序處理依賴關係。LLM 特別適合這件事，因為它們能基於龐大的訓練資料生成合理且有效的計畫。這種結構化做法把單純的反應式 Agent，轉變成能主動朝複雜目標推進、必要時還能調整計畫的策略執行者。

**經驗法則：** 當使用者的請求複雜到單一動作或工具處理不了時，就用這個模式。它最適合多步驟流程的自動化，例如生成詳細的研究報告、辦理新員工入職、執行競爭分析。只要任務需要一連串相互依賴的操作才能得到最終的綜合結果，就套用 Planning 模式。

**圖解：**

![Planning 設計模式](/assets/agentic-design-patterns/Planning_Design_Pattern.png)

圖 4：Planning 設計模式。

## 重點回顧

* Planning 讓 Agent 能把複雜目標拆解成可執行的循序步驟。
* 它是處理多步驟任務、工作流程自動化、穿越複雜環境的必備能力。
* LLM 能根據任務描述生成一步一步的做法，執行規劃。
* 在 Agent 框架中，明確地用 Prompt 要求規劃步驟、或把任務設計成需要規劃，能引導出這種行為。
* Google Deep Research 是一個代替我們分析「以 Google 搜尋為工具取得的來源」的 Agent。它會反思、規劃、執行。

## 結語

總結來說，Planning 模式是讓 Agentic 系統從「簡單的反應式回應者」升級為「有策略、目標導向的執行者」的基礎元件。現代大型語言模型提供了這件事的核心能力：自主地把高層次目標分解成連貫、可執行的步驟。這個模式的適用範圍很廣：從直接的循序任務執行（像 CrewAI Agent 先擬寫作計畫再照著寫），到更複雜、更動態的系統。Google DeepResearch Agent 就是進階應用的例子：它建立迭代式的研究計畫，隨著持續蒐集的資訊調整和演化。歸根結柢，規劃是連接「人類意圖」和「複雜問題的自動化執行」之間的重要橋梁。透過把解題方法結構化，這個模式讓 Agent 能管理繁複的工作流程，交出全面、綜合過的結果。

## 參考資料

1. Google DeepResearch (Gemini Feature): [gemini.google.com](http://gemini.google.com)
2. OpenAI, Introducing deep research: [https://openai.com/index/introducing-deep-research/](https://openai.com/index/introducing-deep-research/)
3. Perplexity, Introducing Perplexity Deep Research: [https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research)
