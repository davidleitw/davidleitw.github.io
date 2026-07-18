---
title: "Agentic Design Patterns 第 19 章：Evaluation and Monitoring（評估與監控）"
description: "怎麼評估 Agent 的表現：評測、上線監控與 LLM-as-a-Judge。《Agentic Design Patterns》第 19 章繁體中文翻譯。"
pubDatetime: 2026-07-17T20:41:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

本章探討的方法論，讓智慧型 Agent 能有系統地評估自己的表現、追蹤目標達成的進度，並偵測運作上的異常。第 11 章談過目標設定與監控，第 17 章談過推理機制，而本章聚焦在對 Agent 效能、效率與需求符合度所做的持續性、而且往往是外部的量測。這包含定義指標、建立回饋迴圈，以及導入回報系統，確保 Agent 在實際運作環境中的表現符合預期（見圖 1）。

![監控與評估 Agent 效能](/assets/agentic-design-patterns/Monitoring_and_Evaluating_Agent_Performance.png)

圖 1：評估與監控的最佳實務

## 實際應用與使用情境

最常見的應用與使用情境：

* **線上系統的效能追蹤：** 持續監控部署在正式環境中的 Agent，包含準確度、延遲與資源消耗（例如客服聊天機器人的問題解決率、回應時間）。
* **Agent 改進的 A/B 測試：** 有系統地並行比較不同 Agent 版本或策略的表現，找出最佳做法（例如替物流 Agent 試兩種不同的規劃演算法）。
* **合規與安全稽核：** 產生自動化的稽核報告，長期追蹤 Agent 對倫理準則、法規要求與安全規範的遵守情況。這些報告可以交由 Human-in-the-Loop（人類參與其中）或另一個 Agent 驗證，並能產出 KPI，或在發現問題時觸發警示。
* **企業系統：** 要治理企業系統裡的 Agentic AI，需要一種新的控制工具，也就是 AI「合約（Contract）」。這種動態協議會把交付給 AI 的任務的目標、規則與控制機制明文化。
* **漂移偵測（Drift Detection）：** 長期監控 Agent 輸出的相關性或準確度，偵測它的表現何時因為輸入資料分布改變（概念漂移，concept drift）或環境變動而退化。
* **Agent 行為的異常偵測：** 找出 Agent 做出的異常或非預期動作，這些動作可能代表錯誤、惡意攻擊，或涌現出來的不良行為。
* **學習進度評估：** 對於設計來學習的 Agent，追蹤它的學習曲線、特定技能的進步，或在不同任務、資料集上的泛化能力。

## 實作範例

替 AI Agent 開發一套完整的評估框架是件很有挑戰的事，複雜度堪比一門學術領域，或一份份量十足的論文。困難來自要考慮的因素太多，例如模型效能、使用者互動、倫理影響，以及更廣泛的社會衝擊。不過就實務落地來說，可以把焦點收斂到幾個攸關 AI Agent 高效運作的關鍵情境。

**Agent 回應評估：** 這個核心流程對於評估 Agent 輸出的品質與準確度很重要。它要判斷 Agent 針對給定輸入，是否提供了切題、正確、合乎邏輯、不帶偏見且準確的資訊。評估指標可能包含事實正確性、流暢度、文法精確度，以及是否符合使用者想達成的目的。

```python
def evaluate_response_accuracy(agent_output: str, expected_output: str) -> float:
    """Calculates a simple accuracy score for agent responses."""
    # This is a very basic exact match; real-world would use more sophisticated metrics
    return 1.0 if agent_output.strip().lower() == expected_output.strip().lower() else 0.0


# Example usage
agent_response = "The capital of France is Paris."
ground_truth = "Paris is the capital of France."
score = evaluate_response_accuracy(agent_response, ground_truth)
print(f"Response accuracy: {score}")
```

Python 函式 `evaluate_response_accuracy` 會替 AI Agent 的回應算出一個基本的準確度分數。做法是先去掉頭尾空白，再對 Agent 輸出與期望輸出做精確、不分大小寫的比較。完全相符就回傳 1.0，否則回傳 0.0，代表非對即錯的二元評估。這種做法對簡單檢查來說很直觀，但無法處理換句話說或語意等價之類的變化。

問題出在它的比較方式。這個函式對兩個字串做嚴格的逐字元比較。以範例來說：

* `agent_response`：「The capital of France is Paris.」
* `ground_truth`：「Paris is the capital of France.」

就算去掉空白、轉成小寫，這兩個字串還是不相同。結果是這個函式會錯誤地回傳 `0.0` 的準確度分數，即使兩句話表達的是同一個意思。

單純的比較在評估語意相似度上不夠用，只有在 Agent 回應與期望輸出完全一致時才會成功。更有效的評估需要進階的自然語言處理（NLP）技術，去辨別句子之間的意義。要在真實情境中徹底評估 AI Agent，更精細的指標往往不可或缺。這些指標可以包含字串相似度量測（例如 Levenshtein distance 與 Jaccard similarity）、關鍵字分析（檢查特定關鍵字有沒有出現）、用 embedding 模型搭配餘弦相似度算出的語意相似度、LLM-as-a-Judge 評估（稍後會談，用來評判細膩的正確性與有用程度），以及 RAG 專屬指標（例如忠實度 faithfulness 與相關性 relevance）。

**延遲監控：** 在 AI Agent 回應或動作速度是關鍵因素的應用裡，對 Agent 動作做延遲監控非常重要。這個流程量測 Agent 處理請求、產生輸出所需的時間。延遲太高會拖累使用者體驗與 Agent 的整體效果，在即時或互動式環境裡尤其明顯。實務上，只把延遲資料印到主控台是不夠的，建議把這些資訊記錄到持久化的儲存系統。可選方案包含結構化的 log 檔（例如 JSON）、時間序列資料庫（例如 InfluxDB、Prometheus）、資料倉儲（例如 Snowflake、BigQuery、PostgreSQL），或可觀測性平台（例如 Datadog、Splunk、Grafana Cloud）。

**追蹤 LLM 互動的 Token 用量：** 對於由 LLM（大型語言模型）驅動的 Agent，追蹤 Token 用量對於管理成本、最佳化資源配置很重要。LLM 互動的計費通常取決於處理的 Token 數量（輸入與輸出），所以有效率地使用 Token 會直接降低營運費用。此外，監控 Token 數量也有助於找出 Prompt engineering 或回應生成流程裡可以改進的地方。

```python
# This is conceptual as actual token counting depends on the LLM API
class LLMInteractionMonitor:
    def __init__(self):
        self.total_input_tokens = 0
        self.total_output_tokens = 0

    def record_interaction(self, prompt: str, response: str):
        # In a real scenario, use LLM API's token counter or a tokenizer
        input_tokens = len(prompt.split())  # Placeholder
        output_tokens = len(response.split())  # Placeholder
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        print(f"Recorded interaction: Input tokens={input_tokens}, Output tokens={output_tokens}")

    def get_total_tokens(self):
        return self.total_input_tokens, self.total_output_tokens


# Example usage
monitor = LLMInteractionMonitor()
monitor.record_interaction("What is the capital of France?", "The capital of France is Paris.")
monitor.record_interaction("Tell me a joke.", "Why don't scientists trust atoms? Because they make up everything!")
input_t, output_t = monitor.get_total_tokens()
print(f"Total input tokens: {input_t}, Total output tokens: {output_t}")
```

這一段介紹一個概念性的 Python 類別 `LLMInteractionMonitor`，用來追蹤大型語言模型互動中的 Token 用量。這個類別內含輸入與輸出 Token 的計數器。它的 `record_interaction` 方法用切分 Prompt 與回應字串的方式來模擬 Token 計數。實際落地時，會改用特定 LLM API 的 tokenizer 來取得精確的 Token 數。隨著互動發生，這個 monitor 會累加輸入與輸出的 Token 總數。`get_total_tokens` 方法則提供這些累計總量，對成本管理與 LLM 用量最佳化很重要。

**用 LLM-as-a-Judge 打造「有用程度」的自訂指標：** 要評估像 AI Agent「有用程度」這種主觀特質，難度超出一般客觀指標所能處理。一種可行的框架是拿一個 LLM 來當評審。這種 LLM-as-a-Judge 的做法，會依據事先定義好的「有用程度」標準，去評判另一個 AI Agent 的輸出。借助 LLM 強大的語言能力，這種方法能對主觀特質做出細膩、近似人類的評估，勝過單純的關鍵字比對或規則式評判。這項技術雖然還在發展中，但在自動化與擴大質性評估規模上很有潛力。

```python
import os
import json
import logging
from typing import Optional

import google.generativeai as genai

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Set your API key as an environment variable to run this script
# For example, in your terminal: export GOOGLE_API_KEY='your_key_here'
try:
    genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
except KeyError:
    logging.error("Error: GOOGLE_API_KEY environment variable not set.")
    exit(1)

# --- LLM-as-a-Judge Rubric for Legal Survey Quality ---
LEGAL_SURVEY_RUBRIC = """
 You are an expert legal survey methodologist and a critical legal reviewer. Your task is to evaluate the quality of a given legal survey question. Provide a score from 1 to 5 for overall quality, along with a detailed rationale and specific feedback.

 Focus on the following criteria:

 1.  **Clarity & Precision (Score 1-5):**
    * 1: Extremely vague, highly ambiguous, or confusing.
    * 3: Moderately clear, but could be more precise.
    * 5: Perfectly clear, unambiguous, and precise in its legal terminology (if applicable) and intent.

 2.  **Neutrality & Bias (Score 1-5):**
    * 1: Highly leading or biased, clearly influencing the respondent towards a specific answer.
    * 3: Slightly suggestive or could be interpreted as leading.
    * 5: Completely neutral, objective, and free from any leading language or loaded terms.

 3.  **Relevance & Focus (Score 1-5):**
    * 1: Irrelevant to the stated survey topic or out of scope.
    * 3: Loosely related but could be more focused.
    * 5: Directly relevant to the survey's objectives and well-focused on a single concept.

 4.  **Completeness (Score 1-5):**
    * 1: Omits critical information needed to answer accurately or provides insufficient context.
    * 3: Mostly complete, but minor details are missing.
    * 5: Provides all necessary context and information for the respondent to answer thoroughly.

 5.  **Appropriateness for Audience (Score 1-5):**
    * 1: Uses jargon inaccessible to the target audience or is overly simplistic for experts.
    * 3: Generally appropriate, but some terms might be challenging or oversimplified.
    * 5: Perfectly tailored to the assumed legal knowledge and background of the target survey audience.

 **Output Format:**
 Your response MUST be a JSON object with the following keys:
 * `overall_score`: An integer from 1 to 5 (average of criterion scores, or your holistic judgment).
 * `rationale`: A concise summary of why this score was given, highlighting major strengths and weaknesses.
 * `detailed_feedback`: A bullet-point list detailing feedback for each criterion (Clarity, Neutrality, Relevance, Completeness, Audience Appropriateness). Suggest specific improvements.
 * `concerns`: A list of any specific legal, ethical, or methodological concerns.
 * `recommended_action`: A brief recommendation (e.g., "Revise for neutrality", "Approve as is", "Clarify scope").
"""

class LLMJudgeForLegalSurvey:
    """A class to evaluate legal survey questions using a generative AI model."""

    def __init__(self, model_name: str = 'gemini-1.5-flash-latest', temperature: float = 0.2):
        """
        Initializes the LLM Judge.

        Args:
            model_name (str): The name of the Gemini model to use.
                              'gemini-1.5-flash-latest' is recommended for speed and cost.
                              'gemini-1.5-pro-latest' offers the highest quality.
            temperature (float): The generation temperature. Lower is better for deterministic evaluation.
        """
        self.model = genai.GenerativeModel(model_name)
        self.temperature = temperature

    def _generate_prompt(self, survey_question: str) -> str:
        """Constructs the full prompt for the LLM judge."""
        return f"{LEGAL_SURVEY_RUBRIC}\n\n---\n**LEGAL SURVEY QUESTION TO EVALUATE:**\n{survey_question}\n---"

    def judge_survey_question(self, survey_question: str) -> Optional[dict]:
        """
        Judges the quality of a single legal survey question using the LLM.

        Args:
            survey_question (str): The legal survey question to be evaluated.

        Returns:
            Optional[dict]: A dictionary containing the LLM's judgment, or None if an error occurs.
        """
        full_prompt = self._generate_prompt(survey_question)

        try:
            logging.info(f"Sending request to '{self.model.model_name}' for judgment...")
            response = self.model.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=self.temperature,
                    response_mime_type="application/json"
                )
            )

            # Check for content moderation or other reasons for an empty response.
            if not response.parts:
                safety_ratings = response.prompt_feedback.safety_ratings
                logging.error(f"LLM response was empty or blocked. Safety Ratings: {safety_ratings}")
                return None

            return json.loads(response.text)
        except json.JSONDecodeError:
            logging.error(f"Failed to decode LLM response as JSON. Raw response: {response.text}")
            return None
        except Exception as e:
            logging.error(f"An unexpected error occurred during LLM judgment: {e}")
            return None


# --- Example Usage ---
if __name__ == "__main__":
    judge = LLMJudgeForLegalSurvey()

    # --- Good Example ---
    good_legal_survey_question = """
    To what extent do you agree or disagree that current intellectual property laws in Switzerland adequately protect emerging AI-generated content, assuming the content meets the originality criteria established by the Federal Supreme Court?
    (Select one: Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree)
    """
    print("\n--- Evaluating Good Legal Survey Question ---")
    judgment_good = judge.judge_survey_question(good_legal_survey_question)
    if judgment_good:
        print(json.dumps(judgment_good, indent=2))

    # --- Biased/Poor Example ---
    biased_legal_survey_question = """
    Don't you agree that overly restrictive data privacy laws like the FADP are hindering essential technological innovation and economic growth in Switzerland?
    (Select one: Yes, No)
    """
    print("\n--- Evaluating Biased Legal Survey Question ---")
    judgment_biased = judge.judge_survey_question(biased_legal_survey_question)
    if judgment_biased:
        print(json.dumps(judgment_biased, indent=2))

    # --- Ambiguous/Vague Example ---
    vague_legal_survey_question = """
    What are your thoughts on legal tech?
    """
    print("\n--- Evaluating Vague Legal Survey Question ---")
    judgment_vague = judge.judge_survey_question(vague_legal_survey_question)
    if judgment_vague:
        print(json.dumps(judgment_vague, indent=2))
```

這段 Python 程式定義了一個類別 LLMJudgeForLegalSurvey，用生成式 AI 模型來評估法律問卷題目的品質。它透過 google.`generativeai` 函式庫和 Gemini 模型互動。

核心功能是把一道問卷題目連同一份詳細的評分準則（rubric）一起送給模型。這份準則列出五項評判問卷題目的標準：清晰與精確（Clarity & Precision）、中立與偏見（Neutrality & Bias）、相關與聚焦（Relevance & Focus）、完整性（Completeness），以及對受眾的適切性（Appropriateness for Audience）。每一項標準都給 1 到 5 分，輸出裡還要附上詳細的理由與回饋。程式會組出一個 Prompt，把準則和要評估的問卷題目包在一起。

`judge_survey_question` 方法會把這個 Prompt 送給設定好的 Gemini 模型，要求它回傳依照既定結構格式化的 JSON。預期的輸出 JSON 包含一個總分、一段摘要理由、對每項標準的詳細回饋、一份疑慮清單，以及一個建議行動。這個類別會處理與 AI 模型互動時可能出現的錯誤，例如 JSON 解碼失敗或回應為空。這段腳本會用幾個法律問卷題目範例來示範運作，說明 AI 如何依照事先定義的標準評判品質。

在收尾之前，我們先來看看幾種評估方法，並比較各自的優缺點。

| 評估方法 | 優點 | 缺點 |
| :---- | :---- | :---- |
| 人工評估 | 能捕捉細膩的行為 | 難以擴展、昂貴又耗時，因為要考量主觀的人為因素。 |
| LLM-as-a-Judge | 一致、有效率且可擴展。 | 中間步驟可能被忽略。受限於 LLM 本身的能力。 |
| 自動化指標 | 可擴展、有效率且客觀 | 有可能無法完整捕捉全部能力。 |

## Agent 軌跡

評估 Agent 的軌跡（trajectory）很重要，因為傳統軟體測試在這裡不夠用。一般程式碼會給出可預期的通過／失敗結果，但 Agent 是機率性運作的，需要對最終輸出以及 Agent 的軌跡（也就是它為了得到解答所走過的一連串步驟）做質性評估。評估多 Agent 系統很有挑戰，因為這些系統一直在變動。這需要發展出更精細的指標，不只看個別表現，還要衡量溝通與團隊合作的效果。而且環境本身也不是靜態的，這要求評估方法（包含測試案例）能隨時間調整。

這牽涉到檢視決策的品質、推理過程，以及整體結果。導入自動化評估很有價值，尤其是在超出原型階段的開發上。分析軌跡與工具使用，包含評估 Agent 為了達成目標所採用的步驟，例如工具選擇、策略與任務效率。舉例來說，一個處理顧客產品詢問的 Agent，理想上可能會走這樣的軌跡：判斷意圖、使用資料庫搜尋工具、檢視結果、產生報告。把 Agent 實際做的動作和這條預期（或說 ground truth，標準答案）軌跡做比較，就能找出錯誤與沒效率的地方。比較方法包含完全比對（exact match，要求和理想序列完全一致）、依序比對（in-order match，正確動作依序出現，允許多餘步驟）、任意順序比對（any-order match，正確動作以任意順序出現，允許多餘步驟）、精確率（precision，衡量預測動作的相關程度）、召回率（recall，衡量抓到了多少必要動作），以及單一工具使用（single-tool use，檢查是否有某個特定動作）。指標的選擇取決於各個 Agent 的具體需求，高風險情境可能要求完全比對，而較有彈性的情況則可能用依序或任意順序比對。

評估 AI Agent 主要有兩種做法：用 test file（測試檔）以及用 evalset file（評估集檔）。test file 採 JSON 格式，代表單一、簡單的 Agent 與模型互動或 session，適合在開發過程中做單元測試，重點在快速執行與簡單的 session 複雜度。每個 test file 包含單一 session、多個 turn，其中一個 turn 是一次使用者與 Agent 的互動，含使用者的查詢、預期的工具使用軌跡、Agent 的中間回應，以及最終回應。舉例來說，一個 test file 可能描述使用者要求「Turn off `device_2` in the Bedroom」，指定 Agent 使用 `set_device_info` 工具，帶入 location: Bedroom、`device_id: device_2`、status: OFF 之類的參數，以及一個預期的最終回應「I have set the `device_2` status to off.」。test file 可以整理進資料夾，也可以放一個 `test_config`.json 檔來定義評估標準。evalset file 則用一個叫「evalset」的資料集來評估互動，內含多個可能很長的 session，適合模擬複雜的多輪對話與整合測試。一個 evalset file 由多個「eval」組成，每個 eval 代表一個獨立的 session，含一或多個「turn」，包含使用者查詢、預期工具使用、中間回應，以及一個參考用的最終回應。一個 evalset 範例可能包含這樣一個 session：使用者先問「What can you do?」，接著說「Roll a 10 sided dice twice and then check if 9 is a prime or not」，定義出預期的 `roll_die` 工具呼叫與一個 `check_prime` 工具呼叫，以及總結擲骰結果與質數檢查的最終回應。

**多 Agent：** 評估一套有多個 Agent 的複雜 AI 系統，很像在評量一個團隊專案。因為步驟與交接很多，這種複雜度反而是優勢，讓你可以檢查每個階段的工作品質。你可以檢視每個「Agent」把自己的專職做得多好，但也必須評估整個系統作為一個整體運作得如何。

要做到這點，你要針對團隊的運作動態問幾個關鍵問題，並搭配具體例子：

* Agent 之間有沒有有效合作？舉例來說，「訂機票 Agent」訂到機票後，有沒有成功把正確的日期與目的地傳給「訂飯店 Agent」？合作失敗可能導致飯店訂到錯的那一週。
* 它們有沒有訂出好計畫並照著走？想像計畫是先訂機票、再訂飯店。如果「飯店 Agent」在機票還沒確認前就想訂房，那它就偏離了計畫。你也要檢查 Agent 會不會卡住，例如沒完沒了地找一台「完美」的租車，卻始終沒進到下一步。
* 有沒有替對的任務挑到對的 Agent？如果使用者問這趟旅程的天氣，系統應該用一個能提供即時資料的專門「天氣 Agent」。如果它改用一個「一般知識 Agent」，給出「夏天通常很熱」這種籠統答案，那就是挑錯了工具。
* 最後，加更多 Agent 有沒有提升表現？如果你替團隊加一個新的「餐廳訂位 Agent」，它會讓整體的行程規劃變得更好、更有效率嗎？還是會製造衝突、拖慢系統，暴露出擴展性的問題？

## 從 Agent 到進階承包者

最近有人提出（Agent Companion，gulli 等人），從簡單的 AI Agent 演進到進階的「承包者（contractor）」，從機率性、往往不可靠的系統，走向更確定、更能負責、專為複雜高風險環境設計的系統（見圖 2）。

今天常見的 AI Agent 靠的是簡短、規格不清的指令，這讓它們適合做簡單的展示，卻在正式環境裡很脆弱，因為模糊會導致失敗。「承包者」模型解決這點的方式，是在使用者與 AI 之間建立一種嚴謹、正式化的關係，奠基在清楚定義、雙方同意的條款上，很像人類世界裡的法律服務合約。這個轉變由四根關鍵支柱支撐，共同確保任務的清晰、可靠與穩健執行，而這些任務在過去是自主系統做不到的。

第一根支柱是正式化合約（Formalized Contract），也就是一份詳細規格，作為某項任務的單一事實來源（single source of truth）。它遠不只是一段簡單的 Prompt。舉例來說，一份財務分析任務的合約不會只說「分析上一季的銷售」；它會要求「一份 20 頁的 PDF 報告，分析 2025 年第一季的歐洲市場銷售，包含五張特定的資料視覺化圖表、一份與 2024 年第一季的比較分析，以及一份根據所附供應鏈中斷資料集所做的風險評估。」這份合約明確定義了必須交付的成果、精確規格、可接受的資料來源、工作範圍，甚至包含預期的運算成本與完成時間，讓結果能被客觀驗證。

第二根支柱是協商與回饋的動態生命週期（Dynamic Lifecycle of Negotiation and Feedback）。合約不是一道靜態命令，而是一段對話的開端。承包者 Agent 可以分析最初的條款並協商。舉例來說，如果合約要求使用某個 Agent 無法存取的特定專屬資料來源，它可以回饋說：「指定的 XYZ 資料庫無法存取。請提供憑證，或核准改用另一個公開資料庫，這可能會稍微改變資料的粒度。」這個協商階段同時讓 Agent 能標示出模糊之處或潛在風險，在開始執行前先化解誤會，避免代價高昂的失敗，確保最終輸出完全符合使用者真正的意圖。

![Agent 之間的合約執行範例](/assets/agentic-design-patterns/Contract_Execution_Example_Among_Agents.png)

圖 2：Agent 之間的合約執行範例

第三根支柱是以品質為重的迭代執行（Quality-Focused Iterative Execution）。不像那些為了低延遲回應而設計的 Agent，承包者優先考慮正確性與品質。它運作在自我驗證與修正的原則上。以一份程式碼生成合約為例，這個 Agent 不會只寫出程式碼；它會產生多種演算法途徑，把它們拿去編譯、跑過合約裡定義的一整套單元測試，依效能、安全性、可讀性等指標替每個解法打分，最後只提交那個通過所有驗證標準的版本。這種持續生成、審視、改進自己作品，直到滿足合約規格的內部迴圈，對於建立對其輸出的信任很關鍵。

最後，第四根支柱是透過子合約做階層式拆解（Hierarchical Decomposition via Subcontracts）。對於相當複雜的任務，一個主承包者 Agent 可以扮演專案經理的角色，把主目標拆成更小、更好管理的子任務。它靠產生新的、正式的「子合約（subcontract）」來達成。舉例來說，一份「打造一款電商行動應用程式」的主合約，可以被主 Agent 拆成幾份子合約：「設計 UI/UX」、「開發使用者驗證模組」、「建立產品資料庫 schema」，以及「整合金流閘道」。這每一份子合約都是一份完整、獨立、有自己交付成果與規格的合約，可以指派給其他專門的 Agent。這種結構化的拆解讓系統能以高度有條理、可擴展的方式，處理龐大、多面向的專案，標誌著 AI 從一個簡單工具，轉變成一個真正自主、可靠的解題引擎。

歸根究柢，這套承包者框架把正式規格、協商與可驗證執行的原則，直接嵌進 Agent 的核心邏輯，重新想像了 AI 互動的樣貌。這種有條理的做法，把人工智慧從一個前景看好卻常常難以預測的助手，提升成一個可靠、能以可稽核的精準度自主管理複雜專案的系統。透過解決模糊與可靠這兩個關鍵難題，這個模型為在信任與問責至上的關鍵任務領域中部署 AI 鋪好了路。

## Google 的 ADK

在收尾前，我們來看一個支援評估的框架的具體例子。用 Google 的 ADK 做 Agent 評估（見圖 3）可以透過三種方法進行：網頁式 UI（adk web），用於互動式評估與資料集生成；用 pytest 做程式化整合，納入測試流水線；以及直接用命令列介面（adk eval），用於適合定期建置產出與驗證流程的自動化評估。

![Google ADK 的評估支援](/assets/agentic-design-patterns/Evaluation_Support_for_Google_ADK.png)

圖 3：Google ADK 的評估支援

網頁式 UI 讓你能互動式地建立 session、存進既有或新的 eval set，並顯示評估狀態。pytest 整合則讓你能把 test file 當成整合測試的一部分來跑，做法是呼叫 AgentEvaluator.evaluate，指定 Agent 模組與 test file 路徑。

命令列介面則透過提供 Agent 模組路徑與 eval set 檔案來促成自動化評估，並可選擇指定設定檔或印出詳細結果。你可以在 eval set 檔名後面用逗號分隔列出特定的 eval，藉此從較大的 eval set 中挑出這些 eval 來執行。

## 速覽

**問題：** Agentic 系統與 LLM 運作在複雜、動態的環境中，它們的表現可能隨時間退化。它們機率性、非確定性的本質，意味著傳統軟體測試不足以確保可靠度。評估動態的多 Agent 系統是一大挑戰，因為它們與其環境不斷改變的特性，要求發展出能適應的測試方法，以及能衡量超越個別表現的協作成功的精細指標。像資料漂移、非預期互動、工具呼叫，以及偏離既定目標之類的問題，都可能在部署後出現。因此需要持續評估，來衡量 Agent 的效果、效率，以及對運作與安全需求的遵守程度。

**解法：** 一套標準化的評估與監控框架，提供了一種有系統的方式，來評估並確保智慧型 Agent 持續的表現。這牽涉到替準確度、延遲與資源消耗（例如 LLM 的 Token 用量）定義清楚的指標。它也包含進階技術，例如分析 Agent 軌跡以理解推理過程，以及動用 LLM-as-a-Judge 來做細膩的質性評估。透過建立回饋迴圈與回報系統，這套框架讓持續改進、A/B 測試，以及偵測異常或效能漂移成為可能，確保 Agent 持續與其目標對齊。

**經驗法則：** 當你要把 Agent 部署到即時、正式的環境，且即時效能與可靠度很關鍵時，採用這個模式。此外，當你需要有系統地比較某個 Agent 或其底層模型的不同版本以推動改進時，以及當你在受監管或高風險領域運作、需要合規、安全與倫理稽核時，也適用。當 Agent 的表現可能因資料或環境變化（漂移）而隨時間退化，或當你要評估複雜的 Agent 行為（包含動作序列，也就是軌跡，以及像有用程度這類主觀輸出的品質）時，這個模式同樣合適。

**圖解：**

![評估與監控設計模式](/assets/agentic-design-patterns/Evaluation_and_Monitoring_Design_Pattern.png)

圖 4：評估與監控設計模式

## 重點回顧

* 評估智慧型 Agent 超出了傳統測試的範圍，要在真實環境中持續衡量它們的效果、效率，以及對需求的遵守程度。
* Agent 評估的實際應用包含線上系統的效能追蹤、用於改進的 A/B 測試、合規稽核，以及偵測行為上的漂移或異常。
* 基本的 Agent 評估牽涉到評估回應準確度，而真實情境則要求更精細的指標，例如針對 LLM 驅動的 Agent 做延遲監控與 Token 用量追蹤。
* Agent 軌跡（Agent 走過的步驟序列）對評估很關鍵，做法是把實際動作和理想的 ground-truth 路徑比對，以找出錯誤與沒效率的地方。
* ADK 透過個別的 test file（用於單元測試）與完整的 evalset file（用於整合測試）提供結構化的評估方法，兩者都定義了預期的 Agent 行為。
* Agent 評估可以透過網頁式 UI 做互動式測試、用 pytest 做程式化的 CI/CD 整合，或透過命令列介面用於自動化工作流程。
* 要讓 AI 在複雜、高風險的任務上變得可靠，我們必須從簡單的 Prompt 走向正式的「合約」，精確定義可驗證的交付成果與範圍。這種結構化的協議讓 Agent 能協商、釐清模糊之處，並反覆驗證自己的工作，把它從一個難以預測的工具，轉變成一個能負責、值得信任的系統。

## 結語

總結來說，要有效評估 AI Agent，必須從簡單的準確度檢查，走向對它們在動態環境中表現的持續、多面向評估。這牽涉到對延遲與資源消耗等指標的實務監控，以及透過軌跡對 Agent 決策過程所做的精細分析。對於像有用程度這類細膩的特質，LLM-as-a-Judge 之類的創新方法正變得不可或缺，而像 Google ADK 這樣的框架則替單元測試與整合測試提供了結構化的工具。到了多 Agent 系統，挑戰會加劇，焦點轉移到評估協作的成功與有效的合作。

要在關鍵應用中確保可靠度，典範正從簡單、由 Prompt 驅動的 Agent，轉向受正式協議約束的進階「承包者」。這些承包者 Agent 運作在明確、可驗證的條款上，讓它們能協商、拆解任務，並自我驗證工作，以達到嚴格的品質標準。這種結構化的做法，把 Agent 從難以預測的工具，轉變成能處理複雜、高風險任務的可問責系統。歸根究柢，這場演進對於建立在關鍵任務領域部署精密 Agentic AI 所需的信任，至關重要。

## 參考資料

相關研究包含：

1. ADK Web：[https://github.com/google/adk-web](https://github.com/google/adk-web)
2. ADK Evaluate：[https://google.github.io/adk-docs/evaluate/](https://google.github.io/adk-docs/evaluate/)
3. Survey on Evaluation of LLM-based Agents，[https://arxiv.org/abs/2503.16416](https://arxiv.org/abs/2503.16416)
4. Agent-as-a-Judge: Evaluate Agents with Agents，[https://arxiv.org/abs/2410.10934](https://arxiv.org/abs/2410.10934)
5. Agent Companion, gulli et al：[https://www.kaggle.com/whitepaper-agent-companion](https://www.kaggle.com/whitepaper-agent-companion)
