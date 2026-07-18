---
title: "Agentic Design Patterns 第 17 章：Reasoning Techniques（推理技巧）"
description: "CoT、ToT、ReAct 等推理技巧，以及推理階段的 scaling。《Agentic Design Patterns》第 17 章繁體中文翻譯。"
pubDatetime: 2026-07-17T20:43:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

本章深入探討智慧型 Agent 的進階推理方法，重點放在多步驟的邏輯推論與問題解決。這些技巧超越了單純的循序操作，讓 Agent 內部的推理過程變得清楚可見。這樣一來，Agent 就能拆解問題、思考中間步驟，得出更穩健、更準確的結論。這些進階方法有一個共通的核心原則：在推理（inference，模型實際生成答案的階段）時投入更多運算資源。也就是給 Agent 或底層 LLM（大型語言模型）更多處理時間或步驟，來消化問題並生成回應。與其快速跑完單一一次，Agent 可以反覆修正、探索多條解題路徑，或動用外部工具。這種在推理階段拉長的處理時間，往往能大幅提升準確性、連貫性與穩健度，尤其面對需要深入分析與審慎斟酌的複雜問題時特別明顯。

## 實際應用與使用情境

實際的應用場景包括：

* **複雜問答：** 協助解決多跳（multi-hop）查詢，這類查詢需要整合來自不同來源的資料並進行邏輯推導，過程中可能得檢視多條推理路徑，並靠拉長的推理時間來綜合各方資訊。
* **數學問題求解：** 把數學問題拆成更小、可解的部分，展示逐步的解題過程，並用程式碼執行來做精確計算；拉長推理時間能讓程式碼的生成與驗證做得更細緻。
* **程式碼除錯與生成：** 支援 Agent 說明自己生成或修正程式碼的理由，逐一指出潛在問題，並根據測試結果反覆改進程式碼（自我修正），用拉長的推理時間跑完整的除錯循環。
* **策略規劃：** 透過對各種選項、後果與前提條件的推理，協助擬定完整計畫，並根據即時回饋調整計畫（ReAct）；多花時間審慎斟酌，能得出更有效、更可靠的計畫。
* **醫療診斷：** 協助 Agent 有系統地評估症狀、檢驗結果與病史來做出診斷，在每個階段都把推理講清楚，並可能動用外部工具取得資料（ReAct）。推理時間增加，就能做出更周全的鑑別診斷。
* **法律分析：** 支援分析法律文件與判例，用來構建論點或提供指引，詳細說明每一步的邏輯，並透過自我修正確保邏輯前後一致。推理時間增加，就能做更深入的法律研究與論證。

## 推理技巧

一開始，我們先深入了解幾種核心的推理技巧，它們都是用來強化 AI 模型解決問題的能力。

**Chain-of-Thought（CoT，思維鏈）** 提示法會模擬一步步的思考過程，大幅強化 LLM 的複雜推理能力（見圖 1）。CoT 提示不是要模型直接給答案，而是引導它生成一連串的中間推理步驟。這種把過程攤開來的做法，讓 LLM 能把複雜問題拆解成更小、更好處理的子問題來解。這個技巧在需要多步推理的任務上，例如算術、常識推理與符號操作，能明顯提升模型表現。CoT 的一大優勢，是能把困難的單步問題轉成一連串較簡單的步驟，進而讓 LLM 的推理過程更透明。這種做法不只提高準確度，也讓人得以一窺模型的決策方式，對除錯與理解都有幫助。CoT 可以用多種策略來實作，包括提供示範逐步推理的少樣本（few-shot）範例，或單純指示模型「一步一步想」。它之所以有效，是因為能引導模型的內部處理往更審慎、更有邏輯的方向走。因此，Chain-of-Thought 已經成為當代 LLM 具備進階推理能力的基石技術。這種更高的透明度、以及把複雜問題拆成好處理的子問題的能力，對自主 Agent 特別重要，因為它讓 Agent 在複雜環境中能做出更可靠、更可稽核的動作。

![CoT：Chain of Thought（思維鏈）](/assets/agentic-design-patterns/COT_Chain_of_Thought.png)

圖 1：CoT 提示，以及 Agent 生成的詳細逐步回應。

我們來看一個例子。它以一組指令開頭，告訴 AI 該怎麼思考，界定它的角色，並給出一套清楚的五步驟流程要它遵循。這就是啟動結構化思考的提示。

接著，這個例子展示 CoT 過程實際跑起來的樣子。標示為「Agent's Thought Process」的段落，是模型執行指令步驟時的內部獨白，這就是字面意義上的「思維鏈」。最後，「Agent's Final Answer」則是這番仔細、逐步推理之後生成的完整精煉輸出。

```markdown
You are an Information Retrieval Agent. Your goal is to answer the user's question comprehensively and accurately by thinking step-by-step. 

Here's the process you must follow: 
1.  **Analyze the Query:** Understand the core subject and specific requirements of the user's question. Identify key entities, keywords, and the type of information being sought. 
2.  **Formulate Search Queries (for Knowledge Base):** Based on your analysis, generate a list of precise search queries that you would use to retrieve relevant information from a knowledge base or external tools. 
3.  **Simulate Information Retrieval (Self-Correction/Reasoning):** For each search query, mentally consider what kind of information you expect to find. If you were to retrieve the content, what would be the most relevant snippets? Think about potential ambiguities or missing pieces. 
4.  **Synthesize Information:** Based on the simulated retrieval and your understanding of the user's original query, synthesize the gathered information into a coherent and complete answer. Ensure all aspects of the query are addressed. 
5.  **Review and Refine:** Before finalizing, critically evaluate your answer. Is it accurate? Is it comprehensive? Is it easy to understand? Is it concise? If not, identify what needs to be improved and how. 

**User Query:** "Explain the main differences between classical computers and quantum computers, and briefly describe a potential application of quantum computing." 

**Agent's Thought Process (Internal CoT Output - encouraged by the prompt):** 

**Thought 1 (Analyze Query):** 
The user wants two things: 
    1.  Main differences between classical and quantum computers. 
    2.  One potential application of quantum computing. Keywords: classical computers, quantum computers, differences, potential application. 

**Thought 2 (Formulate Search Queries):** 
    - "differences classical vs quantum computers" 
    - "how quantum computers work" 
    - "how classical computers work" 
    - "applications of quantum computing" 
    
**Thought 3 (Simulate Information Retrieval & Identify Key Concepts):** 
    - From "differences": Expect concepts like bits vs. qubits, superposition, entanglement, probabilistic nature, computational power for specific problems. 
    - From "how they work": Classical uses transistors/binary. Quantum uses quantum mechanics. 
    - From "applications": Expect drug discovery, material science, cryptography, optimization. 

**Thought 4 (Synthesize Information):** 
Classical computers use bits (0 or 1), processing information sequentially. Quantum computers use qubits, which can be 0, 1, or both simultaneously (superposition), and can be entangled, allowing for vastly different computational approaches. This enables them to solve certain problems (like factoring large numbers or simulating complex molecules) far more efficiently than classical computers. A potential application is in drug discovery, where quantum computers could simulate molecular interactions with unprecedented accuracy, accelerating the development of new medicines. 

**Thought 5 (Review and Refine):** 
    - Differences are covered (bits vs qubits, superposition, entanglement, processing). 
    - Application is given (drug discovery). - Is it brief? Yes. - Is it clear? Yes. - Looks good. 

**Agent's Final Answer (Output to User):** 
Classical computers process information using bits, which can be either a 0 or a 1 at any given time, performing operations sequentially. In contrast, quantum computers utilize qubits, which can exist in multiple states simultaneously through superposition and can be linked through entanglement, allowing for exponentially more complex computations. This fundamental difference enables quantum machines to tackle certain problems, such as simulating molecular structures or breaking complex encryption, that are intractable for even the most powerful classical supercomputers. A significant potential application of quantum computing lies in drug discovery, where its ability to precisely model molecular behavior could revolutionize the development of new pharmaceuticals.
```

**Tree-of-Thought（ToT，思維樹）** 是一種建立在 Chain-of-Thought（CoT）之上的推理技巧。它讓大型語言模型透過分岔出不同的中間步驟來探索多條推理路徑，形成一個樹狀結構（見圖 2）。這種做法支援回溯、自我修正與探索替代方案，因而能應付複雜的問題求解。維護一棵「可能性之樹」，讓模型在拍板答案之前能評估各種推理走向。這種反覆的過程，強化了模型處理那些需要策略規劃與決策的困難任務的能力。

![ToT：Tree of Thought（思維樹）](/assets/agentic-design-patterns/TOT_Tree_of_Thought.png)

圖 2：Tree of Thoughts 範例

**自我修正（Self-correction）**，又稱為自我精修（self-refinement），是 Agent 推理過程中的關鍵環節，在 Chain-of-Thought 提示裡尤其如此。它指的是 Agent 對自己生成的內容與中間思考過程做內部評估。這種批判性的檢視，讓 Agent 能找出自己理解或解法中的模糊之處、資訊缺口或不準確的地方。透過這種「檢視、精修」的反覆循環，Agent 能調整做法、提升回應品質，並在交出最終輸出前確保準確與周全。這種內部自評，強化了 Agent 產出可靠、高品質結果的能力，第 4 章有專門的範例示範。

這個例子示範了一套有系統的自我修正流程，這對於精修 AI 生成的內容至關重要。它包含一個反覆循環：先起草、再對照原始需求檢視、然後落實具體的改進。示範一開始先勾勒出 AI 作為「自我修正 Agent」的職責，並定義了一套五步驟的分析與修訂工作流程。接著，秀出一則品質不佳的社群媒體貼文「初稿」。「自我修正 Agent 的思考過程」是整個示範的核心，Agent 在這裡依照指令批判性地評估初稿，指出諸如互動率偏低、行動呼籲含糊等弱點，再提出具體的改進建議，包括使用更有力的動詞與表情符號。整個流程以「最終修訂內容」作結，那是一個經過打磨、明顯改善的版本，把自己找出來的調整全都整合了進去。

```markdown
You are a highly critical and detail-oriented Self-Correction Agent. Your task is to review a previously generated piece of content against its original requirements and identify areas for improvement. Your goal is to refine the content to be more accurate, comprehensive, engaging, and aligned with the prompt. 

Here's the process you must follow for self-correction: 

1.  **Understand Original Requirements:** Review the initial prompt/requirements that led to the content's creation. What was the *original intent*? What were the key constraints or goals? 
2.  **Analyze Current Content:** Read the provided content carefully. 
3.  **Identify Discrepancies/Weaknesses:** Compare the current content against the original requirements. Look for:    
    * **Accuracy Issues:** Are there any factual errors or misleading statements?    
    * **Completeness Gaps:** Does it fully address all aspects of the original prompt? Is anything missing?    
    * **Clarity & Coherence:** Is the language clear, concise, and easy to understand? Does it flow logically?    
    * **Tone & Style:** Does it match the desired tone and style (e.g., professional, engaging, concise)?    
    * **Engagement:** Is it captivating? Does it hold the reader's attention?    
    * **Redundancy/Verbosity:** Can any parts be condensed or removed without losing meaning? 
4.  **Propose Specific Improvements:** For each identified weakness, suggest concrete and actionable changes. Do not just state the problem; propose a solution. 
5.  **Generate Revised Content:** Based on your proposed improvements, rewrite the original content to incorporate all the necessary changes. Ensure the revised content is polished and ready for final use. 

**Original Prompt/Requirements:** "Write a short, engaging social media post (max 150 characters) announcing a new eco-friendly product line: 'GreenTech Gadgets'." 

**Initial Draft (Content to be corrected):** "We have new products. They are green and techy. Buy GreenTech Gadgets now!" 

**Self-Correction Agent's Thought Process (Internal CoT Output - encouraged by the prompt):** 

**Thought 1 (Understand Original Requirements):** 
    - Short, engaging social media post. 
    - Max 150 characters. 
    - Announce "GreenTech Gadgets" - a new eco-friendly product line. 

**Thought 2 (Analyze Current Content):** 
"We have new products. They are green and techy. Buy GreenTech Gadgets now!" (64 characters) 

**Thought 3 (Identify Discrepancies/Weaknesses):** - **Engaging:** Not very engaging. Sounds generic. - **Eco-friendly:** Implied by "green," but not explicitly highlighted as a benefit. - **Call to Action:** "Buy now!" is okay, but could be more compelling. - **Conciseness:** It's short, but could use stronger verbs/phrasing. - **Impact:** Lacks excitement for a new product launch. 

**Thought 4 (Propose Specific Improvements):** - Make it more dynamic and exciting. - Emphasize "eco-friendly" and "innovation." - Use stronger verbs and more active voice. - Add a clear, engaging call to action. - Ensure it stays under 150 characters. **Thought 5 (Generate Revised Content):** Original: "We have new products. They are green and techy. Buy GreenTech Gadgets now!" Revised idea 1: "🌱 Discover GreenTech Gadgets! Our new eco-friendly line blends innovation with sustainability. Go green, go smart! Shop now! #EcoFriendly #GreenTech" (148 characters) This revision directly addresses eco-friendliness, uses emojis for engagement, adds a stronger call to action, and includes relevant hashtags while staying within the character limit. **Self-Correction Agent's Final Revised Content (Output to User):** 🌱 Discover GreenTech Gadgets! Our new eco-friendly line blends innovation with sustainability. Go green, go smart! Shop now! #EcoFriendly #GreenTech
```

歸根究柢，這個技巧把一道品質把關直接嵌進了 Agent 的內容生成流程，產出更精煉、更精確、更優質的結果，也就更能滿足複雜的使用者需求。

**Program-Aided Language Models（PALMs，程式輔助語言模型）** 把 LLM 和符號推理能力結合起來。這種結合讓 LLM 在解題過程中可以生成並執行程式碼，例如 Python。PALMs 把複雜的計算、邏輯運算與資料處理，卸載給一個確定性的程式執行環境。這種做法借用傳統程式設計的長處，去處理那些 LLM 在準確性或一致性上可能力有未逮的任務。碰到符號類的挑戰時，模型可以產生程式碼、執行它，再把結果轉回自然語言。這種混合方法結合了 LLM 的理解與生成能力，加上精確的計算，讓模型能處理更廣泛的複雜問題，可靠性與準確性也可能隨之提高。這對 Agent 很重要，因為它讓 Agent 在自身的理解與生成能力之外，還能靠精確計算做出更準確、更可靠的動作。一個例子是在 Google 的 ADK 裡使用外部工具來生成程式碼。

```python
from google.adk.tools import agent_tool
from google.adk.agents import Agent
from google.adk.tools import google_search
from google.adk.code_executors import BuiltInCodeExecutor


search_agent = Agent(
    model="gemini-2.0-flash",
    name="SearchAgent",
    instruction="""
    You're a specialist in Google Search
    """,
    tools=[google_search],
)

coding_agent = Agent(
    model="gemini-2.0-flash",
    name="CodeAgent",
    instruction="""
    You're a specialist in Code Execution
    """,
    code_executor=BuiltInCodeExecutor(),
)

root_agent = Agent(
    name="RootAgent",
    model="gemini-2.0-flash",
    description="Root Agent",
    tools=[
        agent_tool.AgentTool(agent=search_agent),
        agent_tool.AgentTool(agent=coding_agent),
    ],
)
```

**Reinforcement Learning with Verifiable Rewards（RLVR，可驗證獎勵的強化學習）：** 許多 LLM 使用的標準 Chain-of-Thought（CoT）提示雖然有效，但推理方式其實相對陽春。它只會生成單一、事先固定的一條思路，無法依問題的複雜度隨機應變。為了突破這些限制，一類新的專門「推理模型」應運而生。這些模型的運作方式不太一樣：在給出答案之前，會先花上一段長短不定的「思考」時間。這段「思考」會產出一條更長、更靈活的 Chain-of-Thought，長度可能達到數千個 token。這種拉長的推理讓自我修正、回溯等更複雜的行為得以出現，模型也會在較難的問題上投入更多心力。讓這些模型成形的關鍵創新，是一種叫做「可驗證獎勵的強化學習（RLVR）」的訓練策略。做法是拿有已知正確答案的問題（例如數學或程式碼）來訓練模型，讓它透過反覆試誤，學會生成有效的長篇推理。這使得模型能在沒有人類直接監督的情況下，自行演化出解題能力。最終，這些推理模型不只是給出一個答案，還會生成一條「推理軌跡」，展現規劃、監控與評估等進階技能。這種更強的推理與策略能力，是打造自主 AI Agent 的根本，讓它們能在最少人為介入下拆解並解決複雜任務。

**ReAct**（Reasoning and Acting，推理與行動，見圖 3，其中 KB 代表知識庫）是一種把 Chain-of-Thought（CoT）提示，和 Agent 透過工具與外部環境互動的能力結合起來的範式。跟直接給出最終答案的生成式模型不同，ReAct Agent 會針對「該採取哪些行動」進行推理。這個推理階段包含一個類似 CoT 的內部規劃過程：Agent 決定下一步、盤點可用的工具、預想可能的結果。接著，Agent 會透過執行一個工具或函式呼叫來行動，例如查詢資料庫、進行計算，或與 API 互動。

![ReAct：Reasoning and Act（推理與行動）](/assets/agentic-design-patterns/REACT_Reasoning_and_Act.png)

圖 3：推理與行動

ReAct 以交錯的方式運作：Agent 執行一個動作、觀察結果，再把這個觀察納入後續的推理。這種「思考、行動、觀察、思考……」的反覆循環，讓 Agent 能動態調整計畫、修正錯誤，達成那些需要跟環境多次互動才能完成的目標。跟線性的 CoT 相比，這是一種更穩健、更靈活的解題方式，因為 Agent 會回應即時的回饋。ReAct 把語言模型的理解與生成能力，和使用工具的能力結合起來，讓 Agent 能執行那些同時需要推理與實際操作的複雜任務。這種做法對 Agent 至關重要，因為它讓 Agent 不只會推理，還能實際執行步驟、與動態環境互動。

**CoD**（Chain of Debates，辯論鏈）是微軟提出的一套正式 AI 框架，讓多個各異其趣的模型協作、辯論來解決問題，跳脫單一 AI 的「思維鏈」。這套系統運作起來像一場 AI 委員會會議：不同的模型提出初步想法、彼此批評對方的推理、交換反駁的論點。主要目標是借助群體智慧來提高準確性、減少偏誤，並改善最終答案的整體品質。它形同 AI 版的同儕審查，替推理過程留下一份透明可信的紀錄。歸根究柢，它代表一種轉變：從單一 Agent 給出答案，轉向由一群 Agent 協作，共同找出更穩健、更經得起驗證的解法。

**GoD**（Graph of Debates，辯論圖）是一套進階的 Agentic 框架，它把討論重新想像成一張動態、非線性的網路，而不是簡單的鏈狀結構。在這個模型裡，論點是一個個節點，節點之間用邊連起來，邊代表「支持」或「反駁」這類關係，反映真實辯論多線交錯的本質。這種結構讓新的探究方向能動態分岔出去、獨立演化，甚至隨時間彼此匯合。結論不是在一條序列的末端得出，而是靠在整張圖中找出最穩健、最有支持度的論點群集來達成。這裡的「有支持度」指的是那些已經穩固確立、可驗證的知識。這可以包括被視為基準真相（ground truth）的資訊，也就是本質上正確、被廣泛接受為事實的內容；也涵蓋透過搜尋接地（search grounding）取得的事實證據，也就是資訊經過外部來源與真實世界資料的驗證；最後也包括辯論過程中多個模型達成的共識，代表對所呈現資訊有高度的一致與信心。這種全面的做法，替所討論的資訊打下更穩健、更可靠的基礎，也為複雜的協作式 AI 推理提供一個更全面、更貼近真實的模型。

**MASS（選讀的進階主題）：** 深入剖析多 Agent 系統的設計就會發現，它們的成效關鍵取決於兩件事：拿來設定各個 Agent 的提示品質，以及決定 Agent 之間如何互動的拓撲結構。設計這類系統的複雜度相當高，因為牽涉到一個龐大而錯綜的搜尋空間。為了應對這個挑戰，研究者開發出一套新框架，叫做 Multi-Agent System Search（MASS，多 Agent 系統搜尋），用來自動化並最佳化多 Agent 系統的設計。

MASS 採用一套多階段的最佳化策略，透過交錯進行提示最佳化與拓撲最佳化，有系統地在複雜的設計空間中穿梭（見圖 4）。

**1. 區塊層級的提示最佳化：** 這個流程從對個別 Agent 類型（也就是「區塊」）的提示做局部最佳化開始，確保每個元件在被整合進更大的系統之前，都能好好扮演自己的角色。這一步很關鍵，因為它讓後續的拓撲最佳化建立在表現良好的 Agent 之上，而不是被配置不良的 Agent 拖累、讓問題層層放大。舉例來說，在針對 HotpotQA 資料集做最佳化時，「Debator（辯論者）」Agent 的提示被巧妙地設計成要它扮演「某大出版社的專業事實查核員」。它最佳化後的任務，是仔細審查其他 Agent 提出的答案，跟提供的上下文段落交叉比對，找出任何前後矛盾或沒有根據的說法。這種在區塊層級最佳化時發現的專門角色扮演提示，目的是讓辯論者 Agent 在被放進更大的工作流程之前，就已經很擅長綜合資訊。

**2. 工作流程拓撲最佳化：** 局部最佳化之後，MASS 會從一個可自訂的設計空間中，挑選並安排不同的 Agent 互動方式，藉此最佳化工作流程的拓撲。為了讓這種搜尋更有效率，MASS 採用一種「影響力加權」的方法。這個方法會衡量每一種拓撲相對於基準 Agent 的效能增益，算出它的「增量影響力」，再用這些分數引導搜尋往更有潛力的組合走。舉例來說，在針對 MBPP 這個程式編寫任務做最佳化時，拓撲搜尋發現某一種混合式工作流程最有效。找到的最佳拓撲不是什麼簡單結構，而是把「反覆精修流程」和「使用外部工具」組合起來：具體來說，它包含一個負責預測的 Agent，會進行好幾輪反思，而它寫出的程式碼會交由另一個負責執行的 Agent，拿測試案例實際跑一遍來驗證。這個被發現的工作流程顯示：對程式編寫任務而言，把「反覆的自我修正」與「外部驗證」結合起來的結構，勝過較簡單的多 Agent 系統設計。

![MASS：Multi-Agent System Search（多 Agent 系統搜尋）](/assets/agentic-design-patterns/MASS_Multi_Agent_System_Search.png)

圖 4：（由作者提供）Multi-Agent System Search（MASS）框架是一套三階段的最佳化流程，它所穿梭的搜尋空間，涵蓋可最佳化的提示（指令與示範），以及可配置的 Agent 建構區塊（聚合、反思、辯論、摘要與工具使用）。第一階段「區塊層級提示最佳化」，會獨立地為每個 Agent 模組最佳化提示。第二階段「工作流程拓撲最佳化」，從一個影響力加權的設計空間中取樣出有效的系統配置，並整合已最佳化的提示。最後一個階段「工作流程層級提示最佳化」，則是在第二階段找出最佳工作流程之後，對整個多 Agent 系統再做一輪提示最佳化。

**3. 工作流程層級的提示最佳化：** 最後一個階段是對整個系統的提示做全域最佳化。找出表現最好的拓撲之後，這些提示會被當成單一的整體來微調，確保它們是為了「編排協調」而量身打造，並讓 Agent 之間的相互依賴關係達到最佳。舉個例子，找到 DROP 資料集的最佳拓撲之後，最後的最佳化階段會精修「Predictor（預測器）」Agent 的提示。最終最佳化後的提示相當詳盡：一開始先給 Agent 一份資料集本身的摘要，指出它聚焦於「抽取式問答」與「數值資訊」；接著附上正確問答行為的少樣本範例，並把核心指令包裝成一個高風險情境：「你是一個高度專精的 AI，任務是為一則緊急新聞報導抽取關鍵的數值資訊。一場現場直播正仰賴你的準確與速度。」這種多管齊下的提示，結合了後設知識、範例與角色扮演，專門針對最終的工作流程調校，把準確度推到最高。

關鍵發現與原則：實驗顯示，經 MASS 最佳化的多 Agent 系統，在一系列任務上都明顯勝過現有的人工設計系統，以及其他自動化的設計方法。從這項研究歸納出的有效多 Agent 系統設計原則，可以分成三點：

* 在組合各個 Agent 之前，先用高品質的提示把它們各自最佳化好。
* 用「組合有影響力的拓撲」的方式來建構多 Agent 系統，而不是在一個無約束的搜尋空間裡亂找。
* 透過最後一輪工作流程層級的聯合最佳化，來建模並最佳化 Agent 之間的相互依賴關係。

在討論完幾種關鍵推理技巧之後，我們先來看一個核心的效能原則：LLM 的 Scaling Inference Law（推理階段的擴展定律）。這條定律指出，隨著分配給模型的運算資源增加，它的效能會以可預期的方式提升。我們可以在像 Deep Research 這樣的複雜系統裡看到這個原則實際運作：AI Agent 利用這些資源，把一個主題拆成子問題、拿網路搜尋當工具、再綜合自己的發現，自主地完成調查。

**Deep Research。** 「Deep Research」一詞指的是一類 AI Agentic 工具，設計來扮演不知疲倦、有條不紊的研究助理。這個領域的主要平台包括 Perplexity AI、Google 的 Gemini 研究功能，以及 OpenAI 在 ChatGPT 裡的進階功能（見圖 5）。

![Google Deep Research 用於資訊蒐集](/assets/agentic-design-patterns/Google_Deep_Research_for_Information_Gathering.png)

圖 5：Google Deep Research 用於資訊蒐集

這些工具帶來的一個根本轉變，在於搜尋過程本身。一般的搜尋會立刻給你一堆連結，把「綜合整理」的工作丟給你自己做。Deep Research 走的是另一套模式。在這裡，你交給 AI 一個複雜的查詢，並給它一份「時間預算」，通常是幾分鐘。作為對這份耐心的回報，你會收到一份詳盡的報告。

在這段時間裡，AI 會以 agentic 的方式代替你工作。它自主地執行一連串精密的步驟，這些步驟對人來說會極度耗時：

1. 初步探索：根據你最初的提示，跑好幾個有針對性的搜尋。
2. 推理與精修：閱讀並分析第一波結果、綜合各項發現，並批判性地找出其中的缺口、矛盾，或需要更多細節的地方。
3. 後續追問：根據自己的內部推理，進行新的、更細膩的搜尋，來補上那些缺口、加深理解。
4. 最終綜合：經過好幾輪這種反覆的搜尋與推理之後，把所有經過驗證的資訊，彙整成一份單一、連貫、結構化的摘要。

這種有系統的做法，確保回應既全面又有充分的推理依據，大幅提升了資訊蒐集的效率與深度，也讓決策更有 agentic 的味道。

## Scaling Inference Law（推理階段的擴展定律）

這條關鍵原則，界定了 LLM 的效能，與它在運作階段（也就是推理，inference）所分配到的運算資源之間的關係。Scaling Inference Law 不同於我們比較熟悉的「訓練階段擴展定律」，後者關注的是模型品質如何隨著模型建立過程中資料量與運算力的增加而提升。相對地，這條定律專門檢視 LLM 在實際生成輸出或答案時，所出現的動態取捨。

這條定律的一塊基石，是揭示了一件事：只要在推理階段加碼投入運算，往往就能從一個相對較小的 LLM 得到更優異的結果。這不見得是指用更強的 GPU，而是採用更精密、更吃資源的推理策略。這類策略的一個典型例子，是指示模型生成多個可能的答案（也許透過多樣化束搜尋（diverse beam search）或自一致性（self-consistency）等技術），再用一套挑選機制找出最理想的輸出。這種反覆精修、或生成多個候選的過程，會耗掉更多運算週期，但能顯著拉高最終回應的品質。

這條原則替 Agent 系統的部署，提供了一套明智又符合經濟考量的決策框架。它挑戰了「模型越大、效能一定越好」這個直覺想法。這條定律主張：一個較小的模型，只要在推理階段被給予更充裕的「思考預算」，有時就能勝過那些倚賴較簡單、較不吃運算的生成流程的更大模型。這裡的「思考預算」，指的是推理階段額外投入的運算步驟或複雜演算法，讓較小的模型能探索更廣的可能性，或在拍板答案前套用更嚴謹的內部檢查。

因此，Scaling Inference Law 成為打造高效又符合成本效益的 Agentic 系統的根本。它提供了一套方法論，用來仔細權衡幾個彼此牽動的因素：

* **模型大小：** 較小的模型在記憶體與儲存上，本來就要求較低。
* **回應延遲：** 增加推理階段的運算固然可能拉高延遲，但這條定律能幫忙找出「效能增益開始蓋過延遲增加」的那個臨界點，或是教你怎麼有策略地投入運算，避免造成過度的延遲。
* **營運成本：** 部署與運行更大的模型，通常會因為更高的耗電與基礎設施需求，帶來更高的持續營運成本。這條定律示範了如何在不必要地推高這些成本的前提下，把效能最佳化。

理解並應用 Scaling Inference Law，開發者與組織就能做出有策略的取捨，替特定的 agentic 應用達到最佳效能，確保運算資源被投放在最能提升 LLM 輸出品質與實用性的地方。這讓 AI 的部署方式更細膩、也更經濟可行，不再停留在「越大越好」這種簡單的思維。

## 實作範例

Google 開源的 DeepSearch 程式碼，可以透過 gemini-fullstack-langgraph-quickstart 這個儲存庫取得（圖 6）。這個儲存庫提供了一個範本，讓開發者可以用 Gemini 2.5 和 LangGraph 編排框架，來建構全端的 AI Agent。這套開源技術棧方便大家實驗各種以 Agent 為基礎的架構，也能跟 Gemma 這類本地端 LLM 整合。它利用 Docker 與模組化的專案骨架來做快速原型開發。要注意的是，這個版本是一個結構完善的示範，並不打算當成可直接上線的正式後端。

![具有多個反思步驟的 DeepSearch 範例](/assets/agentic-design-patterns/Example_of_DeepSearch_with_multiple_Reflection_Steps.png)


圖 6：（由作者提供）具有多個反思步驟的 DeepSearch 範例

這個專案提供一個全端應用程式，前端用 React、後端用 LangGraph，專為進階研究與對話式 AI 而設計。一個 LangGraph Agent 會用 Google Gemini 模型動態生成搜尋查詢，並透過 Google Search API 整合網路研究。系統採用「反思式推理」來找出知識缺口、反覆精修搜尋，並綜合出附帶引用的答案。前端與後端都支援熱重載（hot-reloading）。專案結構包含分開的 frontend/ 與 backend/ 目錄。安裝環境需要 Node.js、npm、Python 3.8+，以及一組 Google Gemini API 金鑰。在後端的 .env 檔案裡設好 API 金鑰之後，就能分別安裝後端（用 pip install .）與前端（npm install）的相依套件。開發用的伺服器可以用 make dev 同時啟動，也可以個別啟動。後端 Agent 定義在 backend/src/agent/graph.py 裡，它會生成初始的搜尋查詢、進行網路研究、做知識缺口分析、反覆精修查詢，並用一個 Gemini 模型綜合出附帶引用的答案。正式環境的部署，會由後端伺服器提供一份靜態的前端建置檔，並需要 Redis 來串流即時輸出、Postgres 資料庫來管理資料。你可以用 docker-compose up 來建置並運行 Docker 映像檔，而 docker-compose.yml 這個範例還需要一組 LangSmith API 金鑰。這個應用程式用到了搭配 Vite 的 React、Tailwind CSS、Shadcn UI、LangGraph 以及 Google Gemini。專案採用 Apache License 2.0 授權。

| ``# Create our Agent Graph builder = StateGraph(OverallState, config_schema=Configuration) # Define the nodes we will cycle between builder.add_node("generate_query", generate_query) builder.add_node("web_research", web_research) builder.add_node("reflection", reflection) builder.add_node("finalize_answer", finalize_answer) # Set the entrypoint as `generate_query` # This means that this node is the first one called builder.add_edge(START, "generate_query") # Add conditional edge to continue with search queries in a parallel branch builder.add_conditional_edges(    "generate_query", continue_to_web_research, ["web_research"] ) # Reflect on the web research builder.add_edge("web_research", "reflection") # Evaluate the research builder.add_conditional_edges(    "reflection", evaluate_research, ["web_research", "finalize_answer"] ) # Finalize the answer builder.add_edge("finalize_answer", END) graph = builder.compile(name="pro-search-agent")`` |
| :---- |

圖 4：使用 LangGraph 的 DeepSearch 範例（程式碼取自 backend/src/agent/graph.py）

## 所以，Agent 到底在想什麼？

總的來說，Agent 的思考過程是一套結構化的方法，把推理和行動結合起來解決問題。這套方法讓 Agent 能明確地規劃自己的步驟、監控自己的進度，並與外部工具互動來蒐集資訊。

Agent 的「思考」，核心是靠一個強大的 LLM 來驅動。這個 LLM 會生成一連串的思考，引導 Agent 接下來的行動。這個過程通常遵循一個「思考—行動—觀察」的循環：

1. **思考（Thought）：** Agent 先生成一段文字形式的思考，用來拆解問題、擬定計畫，或分析當前狀況。這段內部獨白讓 Agent 的推理過程變得透明，也可被引導。
2. **行動（Action）：** 根據這段思考，Agent 從一組預先定義好的離散選項中挑一個行動。舉例來說，在問答的情境裡，行動空間可能包括線上搜尋、從特定網頁擷取資訊，或直接給出最終答案。
3. **觀察（Observation）：** 接著，Agent 會根據所採取的行動，從環境中收到回饋。這可能是網路搜尋的結果，或某個網頁的內容。

這個循環會不斷重複，每一次觀察都會餵給下一次的思考，直到 Agent 判定自己已經得出最終解答，並執行一個「結束（finish）」的行動為止。

這套做法的成效，取決於底層 LLM 的進階推理與規劃能力。為了引導 Agent，ReAct 框架常會採用少樣本學習：給 LLM 看一些近似人類解題軌跡的範例，示範怎麼有效地把思考和行動結合起來，解決類似的任務。

Agent 思考的頻率，可以依任務調整。對於知識密集的推理任務（例如事實查核），思考通常會跟每一個行動交錯進行，以確保資訊蒐集與推理的邏輯順暢。相對地，對於需要大量行動的決策任務（例如在模擬環境裡導航），思考則可以用得省一點，讓 Agent 自己決定什麼時候才需要思考。

## 速覽

**問題：** 複雜的問題求解，往往需要的不只是單一、直接的答案，這對 AI 是一大挑戰。核心問題在於：怎麼讓 AI Agent 能應付那些需要邏輯推論、拆解與策略規劃的多步驟任務。少了結構化的方法，Agent 可能無法處理其中的複雜細節，導致結論不準確或不完整。這些進階推理方法的目標，就是把 Agent 內部的「思考」過程攤開來，讓它能有系統地一路解決難題。

**解法：** 標準化的解法，是一整套推理技巧，替 Agent 的解題過程提供結構化的框架。像 Chain-of-Thought（CoT）和 Tree-of-Thought（ToT）這類方法，會引導 LLM 拆解問題、探索多條解題路徑。自我修正則讓答案能反覆精修，確保更高的準確性。像 ReAct 這樣的 Agentic 框架，把推理與行動結合起來，讓 Agent 能與外部工具和環境互動，來蒐集資訊、調整計畫。把明確推理、探索、精修與工具使用組合在一起，就能打造出更穩健、更透明、更有能力的 AI 系統。

**經驗法則：** 當一個問題複雜到無法靠單次作答解決，需要拆解、多步驟邏輯、與外部資料來源或工具互動，或需要策略規劃與隨機應變時，就使用這些推理技巧。對於那些「展示過程」和「最終答案」同等重要的任務，它們特別適用。

**圖解：**

![Reasoning 設計模式](/assets/agentic-design-patterns/Reasoning_Design_Pattern.png)

圖 7：Reasoning 設計模式

## 重點回顧

* 把推理攤開來，Agent 就能擬定透明的多步驟計畫，這是自主行動與贏得使用者信任的基礎能力。
* ReAct 框架給了 Agent 它的核心運作循環，讓它們不再只會推理，而能與外部工具互動，在環境中動態地行動與調整。
* Scaling Inference Law 意味著，Agent 的效能不只取決於底層模型的大小，也取決於分配給它的「思考時間」，這讓自主行動能更審慎、更高品質。
* Chain-of-Thought（CoT）扮演 Agent 的內部獨白，提供一套結構化的方式，把複雜目標拆成一連串可處理的行動，藉此擬定計畫。
* Tree-of-Thought 與自我修正，賦予 Agent 關鍵的「審慎斟酌」能力，讓它們能在執行前評估多套策略、從錯誤中回溯，並改進自己的計畫。
* 像 Chain of Debates（CoD）這樣的協作框架，標誌著從單一 Agent 走向多 Agent 系統的轉變：一群 Agent 可以一起推理，去應付更複雜的問題，並減少個別的偏誤。
* 像 Deep Research 這樣的應用，展示了這些技巧如何匯聚成一個成果：Agent 能完全自主地代替使用者，執行複雜、長時間運行的任務，例如深入的調查。
* 要打造有效的 Agent 團隊，像 MASS 這樣的框架能自動化地最佳化「怎麼指示各個 Agent」以及「它們之間怎麼互動」，確保整個多 Agent 系統以最佳狀態運作。
* 把這些推理技巧整合起來，我們打造出的 Agent 就不只是自動化，而是真正自主的，能被信任去規劃、行動，並在沒有直接監督的情況下解決複雜問題。

## 結語

現代 AI 正從被動的工具，演化成能透過結構化推理應付複雜目標的自主 Agent。這種 agentic 行為，始於一段內部獨白，由 Chain-of-Thought（CoT）這類技巧驅動，讓 Agent 在行動之前先擬好一份連貫的計畫。真正的自主需要審慎斟酌，而 Agent 靠自我修正與 Tree-of-Thought（ToT）來做到這點，讓它們能評估多套策略、獨立地改進自己的成果。邁向完全 agentic 系統的關鍵一躍，來自 ReAct 框架：它讓 Agent 得以跨出思考、開始靠使用外部工具來行動。這確立了「思考、行動、觀察」這個核心的 agentic 循環，讓 Agent 能根據環境的回饋，動態調整策略。

Agent 深度審慎斟酌的能力，是由 Scaling Inference Law 所驅動的：更多的運算「思考時間」，會直接轉化成更穩健的自主行動。下一個前沿是多 Agent 系統，像 Chain of Debates（CoD）這樣的框架，會打造出協作的 Agent 群體，讓它們一起推理來達成共同目標。這不是紙上談兵；像 Deep Research 這樣的 agentic 應用，已經展示了自主 Agent 如何代替使用者，執行複雜、多步驟的調查。整體的目標，是打造出可靠又透明的自主 Agent，能被信任去獨立管理並解決錯綜複雜的問題。歸根究柢，靠著把明確推理與行動能力結合起來，這些方法正在完成一場轉變，把 AI 變成真正能自主解決問題的 Agent。

## 參考資料

相關研究包括：

1. "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" by Wei et al. (2022)
2. "Tree of Thoughts: Deliberate Problem Solving with Large Language Models" by Yao et al. (2023)
3. "Program-Aided Language Models" by Gao et al. (2023)
4. "ReAct: Synergizing Reasoning and Acting in Language Models" by Yao et al. (2023)
5. Inference Scaling Laws: An Empirical Analysis of Compute-Optimal Inference for LLM Problem-Solving, 2024
6. Multi-Agent Design: Optimizing Agents with Better Prompts and Topologies, [https://arxiv.org/abs/2502.02533](https://arxiv.org/abs/2502.02533)
