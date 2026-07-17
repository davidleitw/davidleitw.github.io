---
title: "Agentic Design Patterns 第 21 章：Exploration and Discovery（探索與發現）"
description: "讓 Agent 主動探索未知、發現新知識。《Agentic Design Patterns》第 21 章繁體中文翻譯。"
pubDatetime: 2026-07-18T20:39:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

本章探討的模式，是讓 Agent 能主動去找出新資訊、發掘新可能性，並辨識出所處環境中「連自己都不知道自己不知道」的盲點。探索與發現跟被動反應行為不同，也跟在既有解決方案空間裡做最佳化不同。它的重點在於 Agent 主動踏進陌生領域、嘗試新方法，並產出新的知識或理解。這個模式對於在開放式、複雜或快速變化的領域裡運作的 Agent 特別重要，因為在這些領域裡，靜態知識或事先寫死的解法根本不夠用。它強調的是 Agent 擴展自身理解與能力的本事。

## 實際應用與使用情境

AI Agent 具備聰明地排序優先順序並進行探索的能力，這讓它們能應用在各種領域。透過自主評估並排序各種可能的行動，這些 Agent 可以在複雜環境中前進、挖出隱藏的洞見，並推動創新。這種帶有優先順序的探索能力，讓它們能夠最佳化流程、發現新知識，並生成內容。

範例：

* **科學研究自動化：** Agent 設計並執行實驗、分析結果、提出新假設，藉此發現新材料、候選藥物或科學原理。
* **遊戲對弈與策略生成：** Agent 探索遊戲狀態，找出新湧現的策略，或辨識出遊戲環境中的弱點（例如 AlphaGo）。
* **市場研究與趨勢發掘：** Agent 掃描非結構化資料（社群媒體、新聞、報告），從中辨識趨勢、消費者行為或市場機會。
* **資安漏洞發掘：** Agent 探測系統或程式碼庫，找出安全缺陷或攻擊路徑。
* **創意內容生成：** Agent 探索各種風格、主題或資料的組合，生成藝術作品、音樂創作或文學作品。
* **個人化教育與訓練：** AI 家教依據學生的進度、學習風格，以及需要加強的地方，排定學習路徑與內容的優先順序。

Google Co-Scientist

AI co-scientist 是 Google Research 開發的一套 AI 系統，定位是「計算型科學協作者」。它在假設生成、提案打磨、實驗設計等研究環節上協助人類科學家。這套系統跑在 Gemini LLM（大型語言模型）之上。

開發 AI co-scientist 是為了因應科學研究上的一些難題，包括處理大量資訊、產出可驗證的假設，以及管理實驗規劃。AI co-scientist 透過執行大規模資訊處理與整合的任務來支援研究人員，過程中還可能揭露出資料裡的關聯。它的目的是接手早期研究裡運算量吃重的部分，藉此增強人類的認知過程。

**系統架構與方法論：** AI co-scientist 的架構建立在 Multi-Agent 框架上，設計上是要模擬協作且反覆迭代的過程。這套設計整合了多個各司其職的 AI Agent，每一個都在達成研究目標上扮演特定角色。一個 supervisor agent（主管 Agent）在非同步的任務執行框架裡管理並協調這些個別 Agent 的活動，這個框架也讓運算資源能夠彈性擴展。

核心的幾個 Agent 及其功能如下（見圖 1）：

* **Generation agent（生成 Agent）**：透過文獻探索與模擬的科學辯論產出初始假設，替整個流程開頭。
* **Reflection agent（反思 Agent）**：扮演同儕審稿人的角色，批判性地評估所生成假設的正確性、新穎性與品質。
* **Ranking agent（排名 Agent）**：採用基於 Elo 的錦標賽機制，透過模擬的科學辯論來比較假設、排名並排定優先順序。
* **Evolution agent（演化 Agent）**：透過簡化概念、整合想法、探索非常規推理，持續打磨排名最前面的那些假設。
* **Proximity agent（鄰近度 Agent）**：計算一張鄰近度圖，把相似的想法聚成一群，協助探索整片假設版圖。
* **Meta-review agent（後設審查 Agent）**：整合所有審查與辯論得到的洞見，找出共通的模式並提供回饋，讓系統能持續進步。

系統運作的基礎倚賴 Gemini，由它提供語言理解、推理與生成能力。系統納入了「test-time compute scaling（測試時運算擴展）」機制，也就是投入更多運算資源來反覆推理、強化輸出。系統會處理並整合來自不同來源的資訊，包括學術文獻、網路資料與資料庫。

![AI Co-Scientist：從構思到驗證](/assets/agentic-design-patterns/AI_Co_Scientist_Ideation_to_Validation.png)

圖 1：（由作者提供）AI Co-Scientist：從構思到驗證

系統遵循一種反映科學方法的迭代做法，也就是「生成、辯論、演化」。在人類科學家輸入一個科學問題之後，系統就進入一個自我改善的循環，反覆進行假設生成、評估與打磨。每個假設都會經過系統化的評估，包括 Agent 之間的內部評估，以及一套以錦標賽為基礎的排名機制。

**驗證與結果：** AI co-scientist 的實用性已在多項驗證研究中得到證明，特別是在生物醫學領域，透過自動化基準測試、專家評審，以及端到端的濕實驗室（wet-lab）實驗來衡量它的表現。

**自動化與專家評估：** 在頗具挑戰性的 GPQA 基準測試上，系統內部的 Elo 評分被證明與其結果的正確率一致，在困難的「diamond set（鑽石集）」上達到 78.4% 的 top-1 正確率。針對超過 200 個研究目標的分析顯示，擴展測試時運算能持續提升假設的品質（以 Elo 評分來衡量）。在一組精選的 15 個高難度問題上，AI co-scientist 的表現勝過其他頂尖的 AI 模型，也勝過人類專家給出的「最佳猜測」解法。在一次小規模評估中，生物醫學專家認為 co-scientist 的輸出比其他基準模型更新穎、更有影響力。系統針對藥物再利用（drug repurposing）提出的提案（格式化為 NIH Specific Aims 頁面）也被一個由六位腫瘤科專家組成的小組評為高品質。

**端到端的實驗驗證：**

藥物再利用：針對急性骨髓性白血病（AML），系統提出了新的候選藥物。其中有些，例如 KIRA6，是完全新穎的建議，先前並沒有用於 AML 的臨床前證據。後續的體外（in vitro）實驗證實，KIRA6 與其他建議的藥物，在多個 AML 細胞株中都能以臨床相關濃度抑制腫瘤細胞的存活。

發現新標靶：系統辨識出肝纖維化的新表觀遺傳標靶。用人類肝臟類器官（organoids）進行的實驗室實驗驗證了這些發現，顯示針對這些建議的表觀遺傳修飾因子所開發的藥物具有顯著的抗纖維化活性。其中一種被辨識出來的藥物已經獲得 FDA 核准用於另一種疾病，這替再利用開了一扇門。

抗微生物抗藥性：AI co-scientist 獨立重現了一項尚未發表的實驗發現。它被交付的任務是解釋為什麼某些移動遺傳元件（cf-PICIs）會出現在許多細菌物種裡。兩天內，系統排名最前面的假設就是：cf-PICIs 會與各式各樣的噬菌體尾部（phage tails）交互作用，藉此擴大自己的宿主範圍。這與另一個獨立研究團隊花了十多年研究才得到、且經實驗驗證的新穎發現不謀而合。

**增強，以及局限：** AI co-scientist 背後的設計理念強調的是「增強」人類研究，而不是把它完全自動化。研究人員透過自然語言與系統互動、給予引導，提供回饋、貢獻自己的想法，並在「scientist-in-the-loop（科學家在環中）」的協作範式裡引導 AI 的探索過程。不過這套系統也有一些局限。它的知識受限於對開放取用文獻的依賴，可能會漏掉付費牆後面的關鍵先前研究。它能取得的負面實驗結果也很有限，這類結果很少被發表，但對經驗豐富的科學家卻很關鍵。除此之外，系統也繼承了底層 LLM 的局限，包括可能出現事實錯誤或「幻覺（hallucination）」。

**安全性：** 安全性是一個關鍵的考量，系統納入了多重防護機制。所有研究目標在輸入時都會經過安全審查，生成的假設也會被檢查，以防止系統被拿去做不安全或不道德的研究。一次使用 1,200 個對抗性研究目標進行的初步安全評估發現，系統能夠穩健地拒絕危險的輸入。為了確保負責任地開發，這套系統正透過一個 Trusted Tester Program（受信任測試者計畫）開放給更多科學家，以蒐集真實世界的回饋。

## 實作範例

我們來看一個探索與發現的 Agentic AI 實際運作的具體例子：Agent Laboratory，這是 Samuel Schmidgall 在 MIT 授權條款下開發的專案。

「Agent Laboratory」是一個自主研究工作流程框架，目的是增強人類的科學工作，而不是取代它。這套系統運用各司其職的 LLM 來自動化科學研究過程的各個階段，好讓人類研究人員能把更多心力放在概念發想與批判性分析上。

這個框架整合了「AgentRxiv」，一個給自主研究 Agent 用的去中心化儲存庫。AgentRxiv 讓研究成果的存放、取用與後續發展變得更容易。

Agent Laboratory 把研究過程拆成幾個明確的階段來引導：

1. **文獻回顧（Literature Review）：** 在這個初始階段，由 LLM 驅動、各司其職的 Agent 負責自主蒐集並批判性分析相關的學術文獻。這會用到 arXiv 之類的外部資料庫，來辨識、整合並分類相關研究，等於是替後續階段建立起一個完整的知識庫。
2. **實驗（Experimentation）：** 這個階段涵蓋協作制定實驗設計、資料準備、實驗執行，以及結果分析。Agent 運用整合好的工具來進行自動化實驗，例如用 Python 來生成並執行程式碼、用 Hugging Face 來取用模型。這套系統是為了反覆打磨而設計的，Agent 可以根據即時的結果調整並最佳化實驗流程。
3. **報告撰寫（Report Writing）：** 在最後這個階段，系統會自動生成完整的研究報告。這牽涉到把實驗階段的發現與文獻回顧的洞見整合起來，依照學術慣例組織文件結構，並整合像 LaTeX 這樣的外部工具來做專業排版與圖表生成。
4. **知識分享（Knowledge Sharing）**：AgentRxiv 是一個讓自主研究 Agent 能夠分享、取用並協作推進科學發現的平台。它讓 Agent 能夠在先前的發現之上繼續往前，促成研究進展的累積。

Agent Laboratory 的模組化架構確保了運算上的彈性。它的目標是透過自動化各項任務來提升研究產能，同時保留人類研究人員的參與。

**程式碼分析：** 雖然完整的程式碼分析超出本書範圍，我還是想給你一些關鍵的觀察，並鼓勵你自己深入去看看程式碼。

**評判：** 為了模擬人類的評估過程，系統採用一套三方 Agent 評判機制來評估輸出。這牽涉到部署三個各自獨立的自主 Agent，每一個都被設定成從特定角度來評估產出，合起來就模仿了人類判斷那種細膩且多面向的性質。這種做法讓評估更穩健、更全面，超越單一指標，捕捉到更豐富的質化評價。

```python
class ReviewersAgent:
    def __init__(self, model="gpt-4o-mini", notes=None, openai_api_key=None):
        if notes is None:
            self.notes = []
        else:
            self.notes = notes
        self.model = model
        self.openai_api_key = openai_api_key

    def inference(self, plan, report):
        reviewer_1 = "You are a harsh but fair reviewer and expect good experiments that lead to insights for the research topic."
        review_1 = get_score(
            outlined_plan=plan,
            latex=report,
            reward_model_llm=self.model,
            reviewer_type=reviewer_1,
            openai_api_key=self.openai_api_key
        )

        reviewer_2 = "You are a harsh and critical but fair reviewer who is looking for an idea that would be impactful in the field."
        review_2 = get_score(
            outlined_plan=plan,
            latex=report,
            reward_model_llm=self.model,
            reviewer_type=reviewer_2,
            openai_api_key=self.openai_api_key
        )

        reviewer_3 = "You are a harsh but fair open-minded reviewer that is looking for novel ideas that have not been proposed before."
        review_3 = get_score(
            outlined_plan=plan,
            latex=report,
            reward_model_llm=self.model,
            reviewer_type=reviewer_3,
            openai_api_key=self.openai_api_key
        )

        return f"Reviewer #1:\n{review_1}, \nReviewer #2:\n{review_2}, \nReviewer #3:\n{review_3}"
```

這些評判 Agent 都搭配了特定的 Prompt，貼近地模擬人類審稿人平常採用的認知框架與評估標準。這個 Prompt 引導 Agent 用類似人類專家的視角來分析輸出，考量相關性、連貫性、事實正確性與整體品質等因素。透過把這些 Prompt 打磨成貼合人類審查流程的樣子，系統想達到一種接近人類辨別力的評估水準。

````python
def get_score(outlined_plan, latex, reward_model_llm, reviewer_type=None, attempts=3, openai_api_key=None):
   e = str()
   for _attempt in range(attempts):
       try:
          
           template_instructions = """
           Respond in the following format:

           THOUGHT:
           <THOUGHT>

           REVIEW JSON:
           ```json
           <JSON>
           ```

           In <THOUGHT>, first briefly discuss your intuitions 
           and reasoning for the evaluation.
           Detail your high-level arguments, necessary choices 
           and desired outcomes of the review.
           Do not make generic comments here, but be specific 
           to your current paper.
           Treat this as the note-taking phase of your review.

           In <JSON>, provide the review in JSON format with 
           the following fields in the order:
           - "Summary": A summary of the paper content and 
           its contributions.
           - "Strengths": A list of strengths of the paper.
           - "Weaknesses": A list of weaknesses of the paper.
           - "Originality": A rating from 1 to 4 
             (low, medium, high, very high).
           - "Quality": A rating from 1 to 4 
             (low, medium, high, very high).
           - "Clarity": A rating from 1 to 4 
             (low, medium, high, very high).
           - "Significance": A rating from 1 to 4 
             (low, medium, high, very high).
           - "Questions": A set of clarifying questions to be
              answered by the paper authors.
           - "Limitations": A set of limitations and potential
              negative societal impacts of the work.
           - "Ethical Concerns": A boolean value indicating 
              whether there are ethical concerns.
           - "Soundness": A rating from 1 to 4 
              (poor, fair, good, excellent).
           - "Presentation": A rating from 1 to 4 
              (poor, fair, good, excellent).
           - "Contribution": A rating from 1 to 4 
             (poor, fair, good, excellent).
           - "Overall": A rating from 1 to 10 
             (very strong reject to award quality).
           - "Confidence": A rating from 1 to 5 
             (low, medium, high, very high, absolute).
           - "Decision": A decision that has to be one of the
             following: Accept, Reject.

           For the "Decision" field, don't use Weak Accept,   
           Borderline Accept, Borderline Reject, or Strong Reject.  
           Instead, only use Accept or Reject.
           This JSON will be automatically parsed, so ensure 
           the format is precise.
           """
````

在這個 Multi-Agent 系統裡，研究過程是圍繞著各司其職的角色來組織的，模仿典型的學術層級結構，好讓工作流程更順暢、輸出更理想。

**Professor Agent（教授 Agent）：** Professor Agent 扮演主要的研究總監，負責訂定研究議程、界定研究問題，並把任務指派給其他 Agent。這個 Agent 設定策略方向，並確保與專案目標保持一致。

````python
class ProfessorAgent(BaseAgent):
   def __init__(self, model="gpt4omini", notes=None, max_steps=100, openai_api_key=None):
       super().__init__(model, notes, max_steps, openai_api_key)
       self.phases = ["report writing"]

   def generate_readme(self):
       sys_prompt = f"""You are {self.role_description()} \n Here is the written paper \n{self.report}. Task instructions: Your goal is to integrate all of the knowledge, code, reports, and notes provided to you and generate a readme.md for a github repository."""
       history_str = "\n".join([_[1] for _ in self.history])
       prompt = (
           f"""History: {history_str}\n{'~' * 10}\n"""
           f"Please produce the readme below in markdown:\n")
       model_resp = query_model(model_str=self.model, system_prompt=sys_prompt, prompt=prompt, openai_api_key=self.openai_api_key)
       return model_resp.replace("```markdown", "")
````

**PostDoc Agent（博士後 Agent）：** PostDoc Agent 的角色是實際執行研究。這包括進行文獻回顧、設計並實作實驗，以及生成論文等研究產出。重要的是，PostDoc Agent 有能力撰寫並執行程式碼，讓實驗流程與資料分析得以實際落地。這個 Agent 是研究成果的主要生產者。

```python
class PostdocAgent(BaseAgent):
    def __init__(self, model="gpt4omini", notes=None, max_steps=100, openai_api_key=None):
        super().__init__(model, notes, max_steps, openai_api_key)
        self.phases = ["plan formulation", "results interpretation"]

    def context(self, phase):
        sr_str = str()
        if self.second_round:
            sr_str = (
                f"The following are results from the previous experiments\n",
                f"Previous Experiment code: {self.prev_results_code}\n"
                f"Previous Results: {self.prev_exp_results}\n"
                f"Previous Interpretation of results: {self.prev_interpretation}\n"
                f"Previous Report: {self.prev_report}\n"
                f"{self.reviewer_response}\n\n\n"
            )

        if phase == "plan formulation":
            return (
                sr_str,
                f"Current Literature Review: {self.lit_review_sum}",
            )
        elif phase == "results interpretation":
            return (
                sr_str,
                f"Current Literature Review: {self.lit_review_sum}\n"
                f"Current Plan: {self.plan}\n"
                f"Current Dataset code: {self.dataset_code}\n"
                f"Current Experiment code: {self.results_code}\n"
                f"Current Results: {self.exp_results}"
            )

        return ""
```

**Reviewer Agents（審稿 Agent）：** 審稿 Agent 會對 PostDoc Agent 的研究產出進行批判性評估，衡量論文與實驗結果的品質、有效性與科學嚴謹度。這個評估階段模擬學術界的同儕審查流程，確保研究產出在定稿前維持高標準。

**ML Engineering Agents（機器學習工程 Agent）**：機器學習工程 Agent 扮演機器學習工程師，與一位博士生對話協作來開發程式碼。它們的核心功能是為資料前處理產出簡潔的程式碼，並整合從所提供的文獻回顧與實驗流程中得到的洞見。這確保了資料被適當地格式化，並為指定的實驗做好準備。

```markdown
"You are a machine learning engineer being directed by a PhD student who will help you write the code, and you can interact with them through dialogue.\n"
"Your goal is to produce code that prepares the data for the provided experiment. You should aim for simple code to prepare the data, not complex code. You should integrate the provided literature review and the plan and come up with code to prepare data for this experiment.\n"
```

**SWEngineerAgents（軟體工程 Agent）：** 軟體工程 Agent 負責引導機器學習工程 Agent。它們的主要目的是協助機器學習工程 Agent 為特定實驗撰寫直截了當的資料準備程式碼。軟體工程 Agent 整合所提供的文獻回顧與實驗計畫，確保生成的程式碼簡潔明瞭，並與研究目標直接相關。

```markdown
"You are a software engineer directing a machine learning engineer, where the machine learning engineer will be writing the code, and you can interact with them through dialogue.\n"
"Your goal is to help the ML engineer produce code that prepares the data for the provided experiment. You should aim for very simple code to prepare the data, not complex code. You should integrate the provided literature review and the plan and come up with code to prepare data for this experiment.\n"
```

總的來說，「Agent Laboratory」是一個相當精巧的自主科學研究框架。它的設計是要透過自動化關鍵研究階段、促成 AI 驅動的協作式知識生成，來增強人類的研究能力。這套系統的目標是接手例行任務、提升研究效率，同時維持人類的監督。

## 速覽

**問題：** AI Agent 常常只能在事先給定的知識範圍裡運作，這限制了它們處理新情境或開放式問題的能力。在複雜且動態的環境裡，這種靜態、事先寫死的資訊不足以帶來真正的創新或發現。根本的挑戰在於：如何讓 Agent 超越單純的最佳化，主動去找出新資訊、辨識出「連自己都不知道自己不知道」的盲點。這需要一種典範轉移，從純粹的被動反應行為，轉向能擴展系統自身理解與能力的主動式、Agentic 探索。

**解法：** 標準化的解法，是打造專門為自主探索與發現而設計的 Agentic AI 系統。這類系統通常會用到 Multi-Agent 框架，讓各司其職的 LLM 協作，模擬像科學方法這樣的過程。舉例來說，可以指派不同的 Agent 去生成假設、批判性地審查假設，以及演化出最有潛力的概念。這種結構化、協作式的做法，讓系統能聰明地在龐大的資訊版圖裡前進、設計並執行實驗，並生成真正的新知識。透過把探索過程中勞力密集的部分自動化，這類系統增強了人類的智識，並大幅加快了發現的步調。

**經驗法則：** 當你在開放式、複雜或快速變化、解決方案空間尚未完全界定的領域裡運作時，就採用探索與發現模式。它特別適合需要生成新假設、新策略或新洞見的任務，例如科學研究、市場分析與創意內容生成。當目標是要挖出「連自己都不知道自己不知道」的盲點，而不只是最佳化一個已知流程時，這個模式就不可或缺。

**圖解：**

![探索與發現設計模式](/assets/agentic-design-patterns/Exploration_and_Discovery_Design_Pattern.png)

圖 2：探索與發現設計模式

## 重點回顧

* AI 中的探索與發現讓 Agent 能主動追尋新資訊與新可能性，這對於在複雜且不斷演變的環境裡前進至關重要。
* 像 Google Co-Scientist 這樣的系統展示了 Agent 如何自主生成假設、設計實驗，補足人類的科學研究。
* Multi-Agent 框架（以 Agent Laboratory 各司其職的角色為例）透過自動化文獻回顧、實驗與報告撰寫來改善研究。
* 歸根究柢，這些 Agent 的目標是接手運算量吃重的任務，藉此增強人類的創造力與解決問題的能力，進而加速創新與發現。

## 結語

總結來說，探索與發現模式正是一個真正 Agentic 系統的核心本質，它界定了系統超越被動聽命行事、主動去探索所處環境的能力。這種與生俱來的 Agentic 驅動力，正是讓 AI 能夠在複雜領域裡自主運作的關鍵——不只是執行任務，還能獨立設定子目標去挖出新資訊。這種進階的 Agentic 行為，在 Multi-Agent 框架裡實現得最為淋漓盡致，框架裡的每個 Agent 都在一個更大的協作過程中體現一個特定、主動的角色。舉例來說，Google Co-scientist 這套高度 Agentic 的系統，就有能自主生成、辯論並演化科學假設的 Agent。

像 Agent Laboratory 這樣的框架則更進一步，打造出一套模仿人類研究團隊的 Agentic 層級結構，讓系統能自我管理整個發現的生命週期。這個模式的核心，在於編排出湧現的 Agentic 行為，讓系統能以最少的人為介入去追求長期、開放式的目標。這提升了人類與 AI 的夥伴關係，把 AI 定位成一個真正的 Agentic 協作者，由它負責探索性任務的自主執行。透過把這種主動發現的工作交給 Agentic 系統，人類的智識得到顯著增強，創新也隨之加速。要發展出這麼強大的 Agentic 能力，也必然需要對安全性與倫理監督做出堅定的承諾。歸根究柢，這個模式提供了打造真正 Agentic AI 的藍圖，把運算工具轉變成在追求知識這條路上獨立、會主動尋找目標的夥伴。

## 參考資料

1. Exploration-Exploitation Dilemma：強化學習與不確定性下決策的一個基本問題。[https://en.wikipedia.org/wiki/Exploration%E2%80%93exploitation_dilemma](https://en.wikipedia.org/wiki/Exploration%E2%80%93exploitation_dilemma)
2. Google Co-Scientist: [https://research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/](https://research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/)
3. Agent Laboratory: Using LLM Agents as Research Assistants [https://github.com/SamuelSchmidgall/AgentLaboratory](https://github.com/SamuelSchmidgall/AgentLaboratory)
4. AgentRxiv: Towards Collaborative Autonomous Research: [https://agentrxiv.github.io/](https://agentrxiv.github.io/)
