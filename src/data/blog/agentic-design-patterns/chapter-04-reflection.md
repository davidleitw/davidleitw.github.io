---
title: "Agentic Design Patterns 第 4 章：Reflection（反思）"
description: "讓 Agent 檢視並修正自己的輸出，迭代提升品質。《Agentic Design Patterns》第 4 章繁體中文翻譯，含程式碼範例。"
pubDatetime: 2026-07-18T20:56:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## 模式概觀

前幾章我們談了幾個基礎的 Agentic 模式：循序執行的 Chaining、動態選路的 Routing、並行任務的 Parallelization。這些模式讓 Agent 能更有效率、更靈活地執行複雜任務。然而，就算工作流程再精密，Agent 的初版輸出或計畫仍可能不夠好、不夠準確、不夠完整。這就是 **Reflection（反思）** 模式登場的地方。

Reflection 模式指的是 Agent 評估自己的工作、輸出或內部狀態，並利用這個評估來改善表現或修正回應。這是一種自我修正、自我改進的能力：Agent 根據回饋、內部批評，或與目標準則的比對，迭代地打磨輸出或調整做法。反思有時也可以由另一個 Agent 來執行，它的專職就是分析第一個 Agent 的輸出。

不同於單純把輸出直接傳給下一步的循序鏈，也不同於選擇路徑的路由，反思引入了一個回饋循環。Agent 不是產出結果就了事，而是接著檢視這個結果（或產生它的過程），找出潛在的問題或可改進之處，再利用這些洞察生成更好的版本，或修正之後的行動。

流程通常包含：

1. **執行：** Agent 執行任務或生成初版輸出。
2. **評估／批評：** Agent（通常透過另一次 LLM 呼叫或一組規則）分析上一步的結果。評估的面向可能包括事實正確性、連貫性、風格、完整性、是否遵守指示，或其他相關準則。
3. **反思／修正：** 根據批評，Agent 決定怎麼改進：可能是生成修正後的輸出、調整下一步的參數，甚至修改整體計畫。
4. **迭代（可選但常見）：** 修正後的輸出或調整後的做法再次執行，反思流程重複進行，直到得到滿意的結果或觸發停止條件。

Reflection 模式有一種關鍵且非常有效的實作方式：把流程拆成兩個分立的邏輯角色──生產者（Producer）和批評者（Critic），常稱為「Generator-Critic」或「Producer-Reviewer」模型。單一 Agent 也能自我反思，但用兩個專職的 Agent（或兩次帶不同系統 Prompt 的 LLM 呼叫），通常能得到更穩健、更客觀的結果。

1. 生產者 Agent：主要職責是執行任務本身。它全心投入內容的生成，不管是寫程式、起草部落格文章，還是擬定計畫。它接收最初的 Prompt，產出第一版輸出。

2. 批評者 Agent：唯一的任務就是評估生產者的輸出。它拿到的是另一套指示，通常還有一個獨立的人設（例如「你是一位資深軟體工程師」「你是一位一絲不苟的事實查核員」）。批評者的指示引導它根據特定準則──事實正確性、程式碼品質、風格要求、完整性──去分析生產者的作品。它的設計目標就是找碴、提改進建議、給出結構化的回饋。

這種關注點分離之所以強大，是因為它避開了「自己審自己作品」的認知偏誤。批評者 Agent 用全新的視角看待輸出，一心一意找錯誤和改進空間。批評者的回饋接著傳回生產者 Agent，作為生成新版本的指引。後面提供的 LangChain 和 ADK 程式碼範例都實作了這種雙 Agent 模型：LangChain 範例用一個專門的 `reflector_prompt` 建立批評者人設，ADK 範例則明確定義了一個生產者和一個審查者 Agent。

實作反思通常需要把這些回饋循環納入 Agent 的工作流程結構。做法可以是程式碼裡的迭代迴圈，或使用支援狀態管理、能根據評估結果做條件轉移的框架。單次的評估與修正在 LangChain／LangGraph、ADK 或 CrewAI 的鏈裡都做得出來，但真正的迭代式反思通常需要更複雜的調度。

Reflection 模式對打造能產出高品質結果、處理細膩任務、展現某種程度自我覺察與適應力的 Agent 至關重要。它讓 Agent 從單純執行指令，走向更精密的問題解決與內容生成。

值得注意的是反思與目標設定、監控（見第 11 章）的交集。目標為 Agent 的自我評估提供了終極基準，監控則追蹤它的進度。在許多實際案例中，反思扮演修正引擎的角色：利用監控回饋來分析偏差、調整策略。這種協同作用讓 Agent 從被動的執行者，轉變成有目的、能主動朝目標調整的系統。

此外，當 LLM 保有對話記憶（見第 8 章）時，Reflection 模式的效果會大幅提升。對話歷史為評估階段提供了關鍵的上下文，讓 Agent 不是孤立地評估輸出，而是對照先前的互動、使用者回饋和不斷演變的目標來評估。它讓 Agent 能從過去的批評中學習、避免重蹈覆轍。沒有記憶，每次反思都是獨立事件；有了記憶，反思成為累積的過程，每一輪都建立在上一輪之上，修正也就更聰明、更貼合情境。

## 實際應用與使用情境

在輸出品質、準確性，或對複雜約束的遵守程度攸關重大的場景，Reflection 模式特別有價值：

### 1. 創意寫作與內容生成

打磨生成的文章、故事、詩或行銷文案。

* **情境：** 寫部落格文章的 Agent。
  * **反思：** 先生成草稿，批評它的行文、語氣和清晰度，再根據批評重寫。重複直到文章達到品質標準。
  * **好處：** 產出更精緻、更有效的內容。

### 2. 程式碼生成與除錯

寫程式、找錯誤、修正錯誤。

* **情境：** 寫 Python 函式的 Agent。
  * **反思：** 先寫初版程式碼，跑測試或靜態分析，找出錯誤或低效之處，再根據發現修改程式碼。
  * **好處：** 生成更穩健、更能用的程式碼。

### 3. 複雜問題解決

在多步推理任務中，評估中間步驟或候選解法。

* **情境：** 解邏輯謎題的 Agent。
  * **反思：** 提出一步，評估它是否更接近解答、有沒有引入矛盾，必要時回溯或改走別步。
  * **好處：** 提升 Agent 在複雜問題空間中穿行的能力。

### 4. 摘要與資訊綜合

打磨摘要的準確性、完整性和精簡度。

* **情境：** 摘要長文件的 Agent。
  * **反思：** 先生成初版摘要，對照原文的重點，補上遺漏的資訊、修正不準確之處。
  * **好處：** 產出更準確、更全面的摘要。

### 5. 規劃與策略

評估提出的計畫，找出潛在缺陷或改進空間。

* **情境：** 為達成目標規劃一連串行動的 Agent。
  * **反思：** 先生成計畫，模擬執行或對照約束評估可行性，再根據評估修訂計畫。
  * **好處：** 擬出更有效、更務實的計畫。

### 6. 對話 Agent

回顧先前的對話輪次，維持上下文、修正誤解、提升回應品質。

* **情境：** 客服聊天機器人。
  * **反思：** 使用者回覆後，回顧對話歷史和上一則生成的訊息，確保連貫並準確回應使用者最新的輸入。
  * **好處：** 對話更自然、更有效。

反思為 Agentic 系統加上了一層後設認知（meta-cognition）：讓系統能從自己的輸出和過程中學習，結果也就更聰明、更可靠、品質更高。

## 實作範例（LangChain）

要實作完整的迭代式反思流程，需要狀態管理和循環執行的機制。這些在 LangGraph 這類圖框架裡有原生支援，也可以用自訂的程序式程式碼處理；但單一反思循環的基本原理，用 LCEL（LangChain Expression Language）的組合語法就能有效示範。

這個範例用 LangChain 函式庫和 OpenAI 的 GPT-4o 模型實作一個反思迴圈，迭代地生成並打磨一個計算階乘的 Python 函式。流程從任務 Prompt 開始，先生成初版程式碼，然後反覆進行反思：由一個模擬的「資深軟體工程師」角色提出批評，每一輪迭代據此修正程式碼，直到批評階段判定程式碼完美，或達到最大迭代次數為止。最後印出修正完成的程式碼。

先確認必要的函式庫都裝好了：

```bash
pip install langchain langchain-community langchain-openai
```

你也需要在環境中設定所選語言模型（例如 OpenAI、Google Gemini、Anthropic）的 API key。

```python
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage


# --- Configuration ---
# Load environment variables from .env file (for OPENAI_API_KEY)
load_dotenv()

# Check if the API key is set
if not os.getenv("OPENAI_API_KEY"):
    raise ValueError("OPENAI_API_KEY not found in .env file. Please add it.")

# Initialize the Chat LLM. We use gpt-4o for better reasoning.
# A lower temperature is used for more deterministic outputs.
llm = ChatOpenAI(model="gpt-4o", temperature=0.1)


def run_reflection_loop():
    """
    Demonstrates a multi-step AI reflection loop to progressively improve a Python function.
    """
    # --- The Core Task ---
    task_prompt = """
    Your task is to create a Python function named `calculate_factorial`.
    This function should do the following:
    1.  Accept a single integer `n` as input.
    2.  Calculate its factorial (n!).
    3.  Include a clear docstring explaining what the function does.
    4.  Handle edge cases: The factorial of 0 is 1.
    5.  Handle invalid input: Raise a ValueError if the input is a negative number.
    """

    # --- The Reflection Loop ---
    max_iterations = 3
    current_code = ""

    # We will build a conversation history to provide context in each step.
    message_history = [HumanMessage(content=task_prompt)]

    for i in range(max_iterations):
        print("\n" + "=" * 25 + f" REFLECTION LOOP: ITERATION {i + 1} " + "=" * 25)

        # --- 1. GENERATE / REFINE STAGE ---
        # In the first iteration, it generates. In subsequent iterations, it refines.
        if i == 0:
            print("\n>>> STAGE 1: GENERATING initial code...")
            # The first message is just the task prompt.
            response = llm.invoke(message_history)
            current_code = response.content
        else:
            print("\n>>> STAGE 1: REFINING code based on previous critique...")
            # The message history now contains the task,
            # the last code, and the last critique.
            # We instruct the model to apply the critiques.
            message_history.append(HumanMessage(content="Please refine the code using the critiques provided."))
            response = llm.invoke(message_history)
            current_code = response.content

        print("\n--- Generated Code (v" + str(i + 1) + ") ---\n" + current_code)
        message_history.append(response)  # Add the generated code to history

        # --- 2. REFLECT STAGE ---
        print("\n>>> STAGE 2: REFLECTING on the generated code...")
        # Create a specific prompt for the reflector agent.
        # This asks the model to act as a senior code reviewer.
        reflector_prompt = [
            SystemMessage(content="""
                You are a senior software engineer and an expert
                in Python.
                Your role is to perform a meticulous code review.
                Critically evaluate the provided Python code based
                on the original task requirements.
                Look for bugs, style issues, missing edge cases,
                and areas for improvement.
                If the code is perfect and meets all requirements,
                respond with the single phrase 'CODE_IS_PERFECT'.
                Otherwise, provide a bulleted list of your critiques.
            """),
            HumanMessage(content=f"Original Task:\n{task_prompt}\n\nCode to Review:\n{current_code}"),
        ]

        critique_response = llm.invoke(reflector_prompt)
        critique = critique_response.content

        # --- 3. STOPPING CONDITION ---
        if "CODE_IS_PERFECT" in critique:
            print("\n--- Critique ---\nNo further critiques found. The code is satisfactory.")
            break

        print("\n--- Critique ---\n" + critique)
        # Add the critique to the history for the next refinement loop.
        message_history.append(HumanMessage(content=f"Critique of the previous code:\n{critique}"))

    print("\n" + "=" * 30 + " FINAL RESULT " + "=" * 30)
    print("\nFinal refined code after the reflection process:\n")
    print(current_code)


if __name__ == "__main__":
    run_reflection_loop()
```

程式先設定環境、載入 API key，並初始化 GPT-4o 這類推理能力較強的語言模型，temperature 設低以取得聚焦的輸出。核心任務由一個 Prompt 定義：要求寫一個計算階乘的 Python 函式，並明訂 docstring、邊界情況（0 的階乘）、負數輸入的錯誤處理等要求。`run_reflection_loop` 函式負責調度迭代修正的流程。迴圈中，第一輪由語言模型根據任務 Prompt 生成初版程式碼；之後的每一輪則根據上一步的批評修正程式碼。另外有一個「reflector」角色──同樣由語言模型扮演，但用不同的系統 Prompt──以資深軟體工程師的身分，對照原始任務要求批評生成的程式碼。批評以問題條列的形式給出；如果沒有問題，則回覆 `CODE_IS_PERFECT`。迴圈持續進行，直到批評表示程式碼完美，或達到最大迭代次數。對話歷史全程保留，每一步都傳給語言模型，為生成／修正和反思兩個階段提供上下文。最後，腳本印出迴圈結束時的最終版程式碼。

## 實作範例（ADK）

接著來看一個用 Google ADK 實作的概念性程式碼範例。這段程式碼採用 Generator-Critic 結構：一個元件（Generator）產出初步結果或計畫，另一個元件（Critic）提供批評性的回饋，引導 Generator 走向更精煉、更準確的最終輸出。

```python
from google.adk.agents import SequentialAgent, LlmAgent


# The first agent generates the initial draft.
generator = LlmAgent(
    name="DraftWriter",
    description="Generates initial draft content on a given subject.",
    instruction="Write a short, informative paragraph about the user's subject.",
    output_key="draft_text",  # The output is saved to this state key.
)

# The second agent critiques the draft from the first agent.
reviewer = LlmAgent(
    name="FactChecker",
    description="Reviews a given text for factual accuracy and provides a structured critique.",
    instruction="""
    You are a meticulous fact-checker.
    1. Read the text provided in the state key 'draft_text'.
    2. Carefully verify the factual accuracy of all claims.
    3. Your final output must be a dictionary containing two keys:
       - "status": A string, either "ACCURATE" or "INACCURATE".
       - "reasoning": A string providing a clear explanation for your status, citing specific issues if any are found.
    """,
    output_key="review_output",  # The structured dictionary is saved here.
)

# The SequentialAgent ensures the generator runs before the reviewer.
review_pipeline = SequentialAgent(
    name="WriteAndReview_Pipeline",
    sub_agents=[generator, reviewer],
)

# Execution Flow:
# 1. generator runs -> saves its paragraph to state['draft_text'].
# 2. reviewer runs -> reads state['draft_text'] and saves its dictionary output to state['review_output'].
```

這段程式碼示範在 Google ADK 中用循序 Agent pipeline 來生成並審查文字。它定義了兩個 LlmAgent 實例：generator 和 reviewer。generator Agent 負責針對給定主題寫出初版段落，它被指示寫一段簡短、有資訊量的文字，輸出存到狀態鍵 `draft_text`。reviewer Agent 則擔任 generator 產出文字的事實查核員：它被指示從 `draft_text` 讀取文字並驗證事實正確性。reviewer 的輸出是一個結構化的 dictionary，包含兩個鍵：status 和 reasoning。status 標示文字是 "ACCURATE" 還是 "INACCURATE"，reasoning 則解釋判斷的理由。這個 dictionary 存到狀態鍵 `review_output`。名為 `review_pipeline` 的 SequentialAgent 負責管理兩個 Agent 的執行順序：generator 先跑，reviewer 後跑。整體流程是：generator 產出文字存進狀態，reviewer 再從狀態讀取文字、做事實查核，把發現（status 和 reasoning）寫回狀態。這條 pipeline 用分立的 Agent，實現了一個結構化的內容生成與審查流程。

**注意：** 有興趣的讀者也可以參考用 ADK 的 LoopAgent 實作的替代版本。

在結束之前，還有一點必須考慮：Reflection 模式雖然能顯著提升輸出品質，但也有重要的取捨。迭代的過程雖然強大，卻可能推高成本和延遲，因為每一輪修正都可能需要新的 LLM 呼叫，對時間敏感的應用不見得划算。此外，這個模式很吃記憶體：每迭代一次，對話歷史就擴大一圈，包括初版輸出、批評，以及後續的每個修正版本。

## 速覽

**問題：** Agent 的初版輸出常常不夠理想：不準確、不完整，或沒達到複雜的要求。基本的 Agentic 工作流程缺少讓 Agent 察覺並修正自身錯誤的內建機制。解法是讓 Agent 評估自己的作品，或更穩健的做法──引入一個獨立的邏輯 Agent 擔任批評者，確保初版回應不會不論品質好壞就直接當成最終結果。

**解法：** Reflection 模式的解法是引入自我修正與精煉的機制。它建立一個回饋循環：「生產者」Agent 生成輸出，「批評者」Agent（或生產者自己）根據預定準則評估它，這份批評再用來生成改進的版本。生成、評估、修正的迭代過程逐步提升最終結果的品質，產出更準確、更連貫、更可靠。

**經驗法則：** 當最終輸出的品質、準確性和細緻程度比速度和成本更重要時，就用 Reflection 模式。它對「產出精緻的長文內容」「寫程式與除錯」「制定詳細計畫」這類任務特別有效。當任務需要高度客觀性，或需要通才生產者 Agent 可能忽略的專門評估時，就用獨立的批評者 Agent。

**圖解：**

![Reflection 設計模式：自我反思](/assets/agentic-design-patterns/Reflection_Design_Pattern_Self_Reflection.png)

圖 1：Reflection 設計模式，自我反思。

![Reflection 設計模式：生產者與批評者 Agent](/assets/agentic-design-patterns/Reflection_Design_Pattern_Producer_and_Critique_Agent.png)

圖 2：Reflection 設計模式，生產者與批評者 Agent。

## 重點回顧

* Reflection 模式最大的優勢，是能迭代地自我修正、打磨輸出，讓品質、準確性和對複雜指令的遵守程度顯著提升。
* 它包含「執行 → 評估／批評 → 修正」的回饋循環。對於需要高品質、準確或細膩輸出的任務，反思不可或缺。
* 一種強大的實作是 Producer-Critic 模型：由獨立的 Agent（或以 Prompt 設定的角色）評估初版輸出。這種關注點分離提升了客觀性，回饋也更專業、更有結構。
* 不過這些好處的代價是更高的延遲和計算成本，也更容易撐爆模型的上下文視窗，或被 API 服務限流。
* 完整的迭代式反思通常需要有狀態的工作流程（例如 LangGraph），但單次反思步驟在 LangChain 裡用 LCEL 就能實作：把輸出傳去批評，再做後續修正。
* Google ADK 可以透過循序工作流程實現反思：一個 Agent 的輸出由另一個 Agent 批評，再接後續的修正步驟。
* 這個模式讓 Agent 能自我修正，表現隨時間越來越好。

## 結語

Reflection 模式為 Agent 的工作流程提供了關鍵的自我修正機制，讓改進不止於一次性的執行。做法是建立一個循環：系統生成輸出、根據特定準則評估它，再利用評估結果產出更精煉的版本。評估可以由 Agent 自己做（自我反思），或者──通常更有效──由一個獨立的批評者 Agent 來做；這是這個模式裡的一個關鍵架構選擇。

完全自主的多步反思流程需要穩固的狀態管理架構，但它的核心原理用一次「生成、批評、修正」的循環就能有效展現。作為一種控制結構，反思可以與其他基礎模式結合，建構出更穩健、功能更複雜的 Agentic 系統。

## 參考資料

以下是關於 Reflection 模式和相關概念的延伸閱讀資源：

1. Training Language Models to Self-Correct via Reinforcement Learning, [https://arxiv.org/abs/2409.12917](https://arxiv.org/abs/2409.12917)
2. LangChain Expression Language (LCEL) Documentation: [https://python.langchain.com/docs/introduction/](https://python.langchain.com/docs/introduction/)
3. LangGraph Documentation: [https://www.langchain.com/langgraph](https://www.langchain.com/langgraph)
4. Google Agent Developer Kit (ADK) Documentation (Multi-Agent Systems): [https://google.github.io/adk-docs/agents/multi-agents/](https://google.github.io/adk-docs/agents/multi-agents/)
