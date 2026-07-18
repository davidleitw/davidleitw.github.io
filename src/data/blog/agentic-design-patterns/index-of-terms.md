---
title: "Agentic Design Patterns 術語索引"
description: "從 Prompt、Context Window 到 MoE，全書術語索引與解釋。《Agentic Design Patterns》繁體中文翻譯。"
pubDatetime: 2026-07-17T20:28:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## 基本概念

- **Prompt（提示詞）**：Prompt 是使用者提供給 AI 模型、用來引出回應的輸入，通常以問題、指令或陳述的形式出現。Prompt 的品質與結構會大幅影響模型的輸出，因此 Prompt Engineering 是有效運用 AI 的一項關鍵技能。

- **Context Window（上下文視窗）**：Context Window 是 AI 模型一次能處理的最大 Token 數量，同時涵蓋輸入與它產生的輸出。這個固定大小是很關鍵的限制，因為落在視窗之外的資訊會被忽略；視窗越大，就越能支援更複雜的對話與文件分析。

- **In-Context Learning（上下文學習）**：In-Context Learning 是 AI 直接從 Prompt 裡提供的範例學會新任務、而不需要重新訓練的能力。這項能力讓單一的通用模型可以即時適應無數的特定任務。

- **Zero-Shot、One-Shot 與 Few-Shot Prompting（零樣本、單樣本與少樣本提示）**：這些是給模型零個、一個或數個任務範例來引導其回應的提示技巧。範例給得越多，通常越能幫助模型理解使用者的意圖，並提升它在特定任務上的準確度。

- **Multimodality（多模態）**：Multimodality 是 AI 跨多種資料型態（例如文字、圖像與音訊）理解與處理資訊的能力。這讓互動更多元、更貼近人類，例如描述一張圖片或回答一個口說的問題。

- **Grounding（接地）**：Grounding 是把模型的輸出連結到可驗證、真實世界的資訊來源，以確保事實正確並減少幻覺（hallucination）的過程。這通常搭配 RAG 這類技術來達成，讓 AI 系統更值得信賴。

## 核心 AI 模型架構

- **Transformers**：Transformer 是大多數現代 LLM（大型語言模型）的基礎神經網路架構。它的關鍵創新是自注意力（self-attention）機制，能高效處理長文字序列，並捕捉詞與詞之間的複雜關係。

- **Recurrent Neural Network（RNN，循環神經網路）**：循環神經網路是早於 Transformer 的基礎架構。RNN 按順序處理資訊，用迴圈來維持對先前輸入的「記憶」，因此適合文字與語音處理這類任務。

- **Mixture of Experts（MoE，專家混合）**：專家混合是一種高效的模型架構，由一個「路由器（router）」網路動態選出一小部分「專家（expert）」網路來處理任一輸入。這讓模型能擁有龐大的參數量，同時把運算成本控制在可負擔的範圍。

- **Diffusion Models（擴散模型）**：擴散模型是擅長產生高品質圖像的生成模型。它們的做法是先對資料加入隨機雜訊，再訓練模型仔細地逆轉這個過程，因此能從一個隨機起點生成全新的資料。

- **Mamba**：Mamba 是近期的 AI 架構，使用選擇性狀態空間模型（Selective State Space Model, SSM）以高效率處理序列，特別適合非常長的上下文。它的選擇性機制能專注在相關資訊、同時濾掉雜訊，被視為 Transformer 的一個潛在替代方案。

## LLM 開發生命週期

- 一個強大語言模型的開發會依循一套明確的順序。它先從預訓練（Pre-training）開始：用海量的通用網路文字資料集訓練出一個龐大的基礎模型，讓它學會語言、推理與世界知識。接著是微調（Fine-tuning），這是一個專門化階段，用較小、針對特定任務的資料集進一步訓練通用模型，把它的能力調整到符合特定用途。最後一個階段是對齊（Alignment），調整這個專門化模型的行為，確保它的輸出有幫助、無害，並且符合人類的價值觀。

- 預訓練技術（Pre-training Techniques）：預訓練是模型從海量資料中學習通用知識的初始階段。這方面的主要技術，靠的是給模型設定不同的學習目標。最常見的是因果語言建模（Causal Language Modeling, CLM），讓模型預測句子中的下一個字。另一種是遮罩語言建模（Masked Language Modeling, MLM），讓模型填回文字中被刻意隱藏的字。其他重要方法還包括去噪目標（Denoising Objectives），讓模型學會把被破壞的輸入還原成原始狀態；對比學習（Contrastive Learning），讓它學會區分相似與不相似的資料；以及下一句預測（Next Sentence Prediction, NSP），讓它判斷兩個句子在邏輯上是否前後相接。

- 微調技術（Fine-tuning Techniques）：微調是用較小、專門的資料集，把通用的預訓練模型調整到特定任務上的過程。最常見的做法是監督式微調（Supervised Fine-Tuning, SFT），用標註好的正確輸入-輸出配對範例來訓練模型。一個流行的變體是指令微調（Instruction Tuning），著重在訓練模型更好地遵循使用者的指令。為了讓這個過程更有效率，會採用參數高效微調（Parameter-Efficient Fine-Tuning, PEFT）方法，其中的主要技術包括只更新少量參數的 LoRA（Low-Rank Adaptation，低秩適應），以及它的記憶體最佳化版本 QLoRA。另一種技術是檢索增強生成（Retrieval-Augmented Generation, RAG），在微調或推理階段把模型連結到外部知識來源，藉此強化模型。

- 對齊與安全技術（Alignment & Safety Techniques）：對齊是確保 AI 模型的行為符合人類價值觀與期待、使其有幫助且無害的過程。最主要的技術是基於人類回饋的強化學習（Reinforcement Learning from Human Feedback, RLHF），用一個在人類偏好上訓練出來的「獎勵模型（reward model）」引導 AI 的學習過程，並常搭配近端策略最佳化（Proximal Policy Optimization, PPO）這類演算法來維持穩定。後來也出現了更簡單的替代方案，例如直接偏好最佳化（Direct Preference Optimization, DPO），它省去了另外訓練一個獎勵模型的需求；以及 Kahneman-Tversky 最佳化（Kahneman-Tversky Optimization, KTO），進一步簡化了資料蒐集。為了確保安全部署，會實作 Guardrails（護欄）作為最後一道安全防線，即時過濾輸出並攔阻有害的行為。

## 增強 AI Agent 的能力

- AI Agent 是能感知自身環境、並採取自主行動以達成目標的系統。有了穩健的推理框架，它們會更有效。

- **Chain of Thought（CoT，思維鏈）**：這種提示技巧會鼓勵模型在給出最終答案之前，一步一步說明自己的推理。這種「把思考講出來」的過程，往往能在複雜推理任務上得到更準確的結果。

- **Tree of Thoughts（ToT，思維樹）**：思維樹是一種進階的推理框架，讓 Agent 像樹的分枝一樣同時探索多條推理路徑。它能讓 Agent 自我評估不同的思路，並選出最有希望的一條去追下去，因此在解決複雜問題時更有效。

- **ReAct（Reason and Act，推理與行動）**：ReAct 是一種在迴圈中結合推理與行動的 Agent 框架。Agent 先「思考」該做什麼，接著用工具採取一個「行動」，再用得到的觀察結果來引導下一步的思考，因此非常擅長解決複雜任務。

- **Planning（規劃）**：這是 Agent 把一個高階目標拆解成一連串較小、好處理的子任務的能力。Agent 接著會擬定計畫，依序執行這些步驟，讓它能應付複雜的多步驟任務。

- **Deep Research（深度研究）**：深度研究指的是 Agent 能自主地深入探究一個主題的能力：反覆搜尋資訊、綜合各項發現、並找出新的問題。這讓 Agent 對一個主題建立起遠超單次搜尋查詢的全面理解。

- **Critique Model（評判模型）**：評判模型是一種專門的 AI 模型，經過訓練可以審查、評估另一個 AI 模型的輸出並提供回饋。它扮演自動評審的角色，協助找出錯誤、改進推理，並確保最終輸出達到期望的品質標準。

## 術語索引

這份術語索引是用 Gemini Pro 2.5 產生的。文末附上了當時使用的 Prompt 與推理步驟，用來展示它省時的好處，也供教學參考。

### A

- A/B Testing（A/B 測試）- 第 3 章：Parallelization（平行化）
- Action Selection（行動選擇）- 第 20 章：Prioritization（優先排序）
- Adaptation（適應）- 第 9 章：學習與適應
- Adaptive Task Allocation（自適應任務分配）- 第 16 章：資源感知最佳化
- Adaptive Tool Use & Selection（自適應工具使用與選擇）- 第 16 章：資源感知最佳化
- Agent - 什麼讓 AI 系統成為 Agent？
- Agent-Computer Interfaces（ACIs，Agent 與電腦的介面）- 附錄 B
- Agent-Driven Economy（Agent 驅動的經濟）- 什麼讓 AI 系統成為 Agent？
- Agent as a Tool（把 Agent 當成工具）- 第 7 章：Multi-Agent 協作
- Agent Cards（Agent 卡片）- 第 15 章：Agent 間通訊（A2A）
- Agent Development Kit（ADK，Agent 開發套件）- 第 2 章：Routing（路由）、第 3 章：Parallelization（平行化）、第 4 章：Reflection（反思）、第 5 章：Tool Use（工具使用）、第 7 章：Multi-Agent 協作、第 8 章：記憶管理、第 12 章：例外處理與恢復、第 13 章：Human-in-the-Loop（人機協作）、第 15 章：Agent 間通訊（A2A）、第 16 章：資源感知最佳化、第 19 章：評估與監控、附錄 C
- Agent Discovery（Agent 發現）- 第 15 章：Agent 間通訊（A2A）
- Agent Trajectories（Agent 軌跡）- 第 19 章：評估與監控
- Agentic Design Patterns（Agentic 設計模式）- 引言
- Agentic RAG - 第 14 章：知識檢索（RAG）
- Agentic Systems（Agentic 系統）- 引言
- AI Co-scientist（AI 共同科學家）- 第 21 章：探索與發現
- Alignment（對齊）- 術語表
- AlphaEvolve - 第 9 章：學習與適應
- Analogies（類比）- 附錄 A
- Anomaly Detection（異常偵測）- 第 19 章：評估與監控
- Anthropic's Claude 4 Series（Anthropic Claude 4 系列）- 附錄 B
- Anthropic's Computer Use（Anthropic 的電腦操作）- 附錄 B
- API Interaction（API 互動）- 第 10 章：Model Context Protocol（MCP）
- Artifacts（工件）- 第 15 章：Agent 間通訊（A2A）
- Asynchronous Polling（非同步輪詢）- 第 15 章：Agent 間通訊（A2A）
- Audit Logs（稽核日誌）- 第 15 章：Agent 間通訊（A2A）
- Automated Metrics（自動化指標）- 第 19 章：評估與監控
- Automatic Prompt Engineering（APE，自動化 Prompt Engineering）- 附錄 A
- Autonomy（自主性）- 引言
- A2A（Agent-to-Agent，Agent 對 Agent）- 第 15 章：Agent 間通訊（A2A）

### B

- Behavioral Constraints（行為約束）- 第 18 章：Guardrails／安全模式
- Browser Use（瀏覽器操作）- 附錄 B

### C

- Callbacks（回呼）- 第 18 章：Guardrails／安全模式
- Causal Language Modeling（CLM，因果語言建模）- 術語表
- Chain of Debates（CoD，辯論鏈）- 第 17 章：推理技術
- Chain-of-Thought（CoT，思維鏈）- 第 17 章：推理技術、附錄 A
- Chatbots（聊天機器人）- 第 8 章：記憶管理
- ChatMessageHistory - 第 8 章：記憶管理
- Checkpoint and Rollback（檢查點與回滾）- 第 18 章：Guardrails／安全模式
- Chunking（分塊）- 第 14 章：知識檢索（RAG）
- Clarity and Specificity（清晰與具體）- 附錄 A
- Client Agent（客戶端 Agent）- 第 15 章：Agent 間通訊（A2A）
- Code Generation（程式碼生成）- 第 1 章：Prompt Chaining（提示鏈）、第 4 章：Reflection（反思）
- Code Prompting（程式碼 Prompting）- 附錄 A
- CoD（Chain of Debates，辯論鏈）- 第 17 章：推理技術
- CoT（Chain of Thought，思維鏈）- 第 17 章：推理技術、附錄 A
- Collaboration（協作）- 第 7 章：Multi-Agent 協作
- Compliance（合規）- 第 19 章：評估與監控
- Conciseness（簡潔）- 附錄 A
- Content Generation（內容生成）- 第 1 章：Prompt Chaining（提示鏈）、第 4 章：Reflection（反思）
- Context Engineering（上下文工程）- 第 1 章：Prompt Chaining（提示鏈）
- Context Window（上下文視窗）- 術語表
- Contextual Pruning & Summarization（上下文修剪與摘要）- 第 16 章：資源感知最佳化
- Contextual Prompting（情境式 Prompting）- 附錄 A
- Contractor Model（承包商模型）- 第 19 章：評估與監控
- ConversationBufferMemory - 第 8 章：記憶管理
- Conversational Agents（對話式 Agent）- 第 1 章：Prompt Chaining（提示鏈）、第 4 章：Reflection（反思）
- Cost-Sensitive Exploration（成本敏感的探索）- 第 16 章：資源感知最佳化
- CrewAI - 第 3 章：Parallelization（平行化）、第 5 章：Tool Use（工具使用）、第 6 章：Planning（規劃）、第 7 章：Multi-Agent 協作、第 18 章：Guardrails／安全模式、附錄 C
- Critique Agent（評判 Agent）- 第 16 章：資源感知最佳化
- Critique Model（評判模型）- 術語表
- Customer Support（客戶支援）- 第 13 章：Human-in-the-Loop（人機協作）

### D

- Data Extraction（資料擷取）- 第 1 章：Prompt Chaining（提示鏈）
- Data Labeling（資料標註）- 第 13 章：Human-in-the-Loop（人機協作）
- Database Integration（資料庫整合）- 第 10 章：Model Context Protocol（MCP）
- DatabaseSessionService - 第 8 章：記憶管理
- Debate and Consensus（辯論與共識）- 第 7 章：Multi-Agent 協作
- Decision Augmentation（決策增強）- 第 13 章：Human-in-the-Loop（人機協作）
- Decomposition（分解）- 附錄 A
- Deep Research（深度研究）- 第 6 章：Planning（規劃）、第 17 章：推理技術、術語表
- Delimiters（分隔符）- 附錄 A
- Denoising Objectives（去噪目標）- 術語表
- Dependencies（相依關係）- 第 20 章：Prioritization（優先排序）
- Diffusion Models（擴散模型）- 術語表
- Direct Preference Optimization（DPO，直接偏好最佳化）- 第 9 章：學習與適應
- Discoverability（可發現性）- 第 10 章：Model Context Protocol（MCP）
- Drift Detection（漂移偵測）- 第 19 章：評估與監控
- Dynamic Model Switching（動態模型切換）- 第 16 章：資源感知最佳化
- Dynamic Re-prioritization（動態重新排定優先順序）- 第 20 章：Prioritization（優先排序）

### E

- Embeddings（嵌入）- 第 14 章：知識檢索（RAG）
- Embodiment（具身化）- 什麼讓 AI 系統成為 Agent？
- Energy-Efficient Deployment（節能部署）- 第 16 章：資源感知最佳化
- Episodic Memory（情節記憶）- 第 8 章：記憶管理
- Error Detection（錯誤偵測）- 第 12 章：例外處理與恢復
- Error Handling（錯誤處理）- 第 12 章：例外處理與恢復
- Escalation Policies（升級策略）- 第 13 章：Human-in-the-Loop（人機協作）
- Evaluation（評估）- 第 19 章：評估與監控
- Exception Handling（例外處理）- 第 12 章：例外處理與恢復
- Expert Teams（專家團隊）- 第 7 章：Multi-Agent 協作
- Exploration and Discovery（探索與發現）- 第 21 章：探索與發現
- External Moderation APIs（外部審核 API）- 第 18 章：Guardrails／安全模式

### F

- Factored Cognition（分解式認知）- 附錄 A
- FastMCP - 第 10 章：Model Context Protocol（MCP）
- Fault Tolerance（容錯）- 第 18 章：Guardrails／安全模式
- Few-Shot Learning（少樣本學習）- 第 9 章：學習與適應
- Few-Shot Prompting（少樣本提示）- 附錄 A
- Fine-tuning（微調）- 術語表
- Formalized Contract（形式化合約）- 第 19 章：評估與監控
- Function Calling - 第 5 章：Tool Use（工具使用）、附錄 A

### G

- Gemini Live - 附錄 B
- Gems - 附錄 A
- Generative Media Orchestration（生成式媒體編排）- 第 10 章：Model Context Protocol（MCP）
- Goal Setting（目標設定）- 第 11 章：目標設定與監控
- GoD（Graph of Debates，辯論圖）- 第 17 章：推理技術
- Google Agent Development Kit（ADK，Google Agent 開發套件）- 第 2 章：Routing（路由）、第 3 章：Parallelization（平行化）、第 4 章：Reflection（反思）、第 5 章：Tool Use（工具使用）、第 7 章：Multi-Agent 協作、第 8 章：記憶管理、第 12 章：例外處理與恢復、第 13 章：Human-in-the-Loop（人機協作）、第 15 章：Agent 間通訊（A2A）、第 16 章：資源感知最佳化、第 19 章：評估與監控、附錄 C
- Google Co-Scientist - 第 21 章：探索與發現
- Google DeepResearch - 第 6 章：Planning（規劃）
- Google Project Mariner - 附錄 B
- Graceful Degradation（優雅降級）- 第 12 章：例外處理與恢復、第 16 章：資源感知最佳化
- Graph of Debates（GoD，辯論圖）- 第 17 章：推理技術
- Grounding（接地）- 術語表
- Guardrails（護欄）- 第 18 章：Guardrails／安全模式

### H

- Haystack - 附錄 C
- Hierarchical Decomposition（階層式分解）- 第 19 章：評估與監控
- Hierarchical Structures（階層式結構）- 第 7 章：Multi-Agent 協作
- HITL（Human-in-the-Loop，人機協作）- 第 13 章：Human-in-the-Loop（人機協作）
- Human-in-the-Loop（HITL，人機協作）- 第 13 章：Human-in-the-Loop（人機協作）
- Human-on-the-loop（人在環路之上）- 第 13 章：Human-in-the-Loop（人機協作）
- Human Oversight（人類監督）- 第 13 章：Human-in-the-Loop（人機協作）、第 18 章：Guardrails／安全模式

### I

- In-Context Learning（上下文學習）- 術語表
- InMemoryMemoryService - 第 8 章：記憶管理
- InMemorySessionService - 第 8 章：記憶管理
- Input Validation/Sanitization（輸入驗證／清理）- 第 18 章：Guardrails／安全模式
- Instructions Over Constraints（指令優先於約束）- 附錄 A
- Inter-Agent Communication（A2A，Agent 間通訊）- 第 15 章：Agent 間通訊（A2A）
- Intervention and Correction（介入與修正）- 第 13 章：Human-in-the-Loop（人機協作）
- IoT Device Control（IoT 裝置控制）- 第 10 章：Model Context Protocol（MCP）
- Iterative Prompting / Refinement（迭代式提示／精修）- 附錄 A

### J

- Jailbreaking（越獄）- 第 18 章：Guardrails／安全模式

### K

- Kahneman-Tversky Optimization（KTO，Kahneman-Tversky 最佳化）- 術語表
- Knowledge Retrieval（RAG，知識檢索）- 第 14 章：知識檢索（RAG）

### L

- LangChain - 第 1 章：Prompt Chaining（提示鏈）、第 2 章：Routing（路由）、第 3 章：Parallelization（平行化）、第 4 章：Reflection（反思）、第 5 章：Tool Use（工具使用）、第 8 章：記憶管理、第 20 章：Prioritization（優先排序）、附錄 C
- LangGraph - 第 1 章：Prompt Chaining（提示鏈）、第 2 章：Routing（路由）、第 3 章：Parallelization（平行化）、第 4 章：Reflection（反思）、第 5 章：Tool Use（工具使用）、第 8 章：記憶管理、附錄 C
- Latency Monitoring（延遲監控）- 第 19 章：評估與監控
- Learned Resource Allocation Policies（習得的資源分配策略）- 第 16 章：資源感知最佳化
- Learning and Adaptation（學習與適應）- 第 9 章：學習與適應
- LLM-as-a-Judge（以 LLM 作為裁判）- 第 19 章：評估與監控
- LlamaIndex - 附錄 C
- LoRA（Low-Rank Adaptation，低秩適應）- 術語表
- Low-Rank Adaptation（LoRA，低秩適應）- 術語表

### M

- Mamba - 術語表
- Masked Language Modeling（MLM，遮罩語言建模）- 術語表
- MASS（Multi-Agent System Search，多 Agent 系統搜尋）- 第 17 章：推理技術
- MCP（Model Context Protocol，模型上下文協定）- 第 10 章：Model Context Protocol（MCP）
- Memory Management（記憶管理）- 第 8 章：記憶管理
- Memory-Based Learning（基於記憶的學習）- 第 9 章：學習與適應
- MetaGPT - 附錄 C
- Microsoft AutoGen - 附錄 C
- Mixture of Experts（MoE，專家混合）- 術語表
- Model Context Protocol（MCP，模型上下文協定）- 第 10 章：Model Context Protocol（MCP）
- Modularity（模組化）- 第 18 章：Guardrails／安全模式
- Monitoring（監控）- 第 11 章：目標設定與監控、第 19 章：評估與監控
- Multi-Agent Collaboration（Multi-Agent 協作）- 第 7 章：Multi-Agent 協作
- Multi-Agent System Search（MASS，多 Agent 系統搜尋）- 第 17 章：推理技術
- Multimodality（多模態）- 術語表
- Multimodal Prompting（多模態提示）- 附錄 A

### N

- Negative Examples（負面範例）- 附錄 A
- Next Sentence Prediction（NSP，下一句預測）- 術語表

### O

- Observability（可觀測性）- 第 18 章：Guardrails／安全模式
- One-Shot Prompting（單樣本提示）- 附錄 A
- Online Learning（線上學習）- 第 9 章：學習與適應
- OpenAI Deep Research API - 第 6 章：Planning（規劃）
- OpenEvolve - 第 9 章：學習與適應
- OpenRouter - 第 16 章：資源感知最佳化
- Output Filtering/Post-processing（輸出過濾／後處理）- 第 18 章：Guardrails／安全模式

### P

- PAL（Program-Aided Language Models，程式輔助語言模型）- 第 17 章：推理技術
- Parallelization（平行化）- 第 3 章：Parallelization（平行化）
- Parallelization & Distributed Computing Awareness（平行化與分散式運算感知）- 第 16 章：資源感知最佳化
- Parameter-Efficient Fine-Tuning（PEFT，參數高效微調）- 術語表
- PEFT（Parameter-Efficient Fine-Tuning，參數高效微調）- 術語表
- Performance Tracking（效能追蹤）- 第 19 章：評估與監控
- Persona Pattern（角色人設模式）- 附錄 A
- Personalization（個人化）- 什麼讓 AI 系統成為 Agent？
- Planning（規劃）- 第 6 章：Planning（規劃）、術語表
- Prioritization（優先排序）- 第 20 章：Prioritization（優先排序）
- Principle of Least Privilege（最小權限原則）- 第 18 章：Guardrails／安全模式
- Proactive Resource Prediction（主動資源預測）- 第 16 章：資源感知最佳化
- Procedural Memory（程序性記憶）- 第 8 章：記憶管理
- Program-Aided Language Models（PAL，程式輔助語言模型）- 第 17 章：推理技術
- Project Astra - 附錄 B
- Prompt（提示詞）- 術語表
- Prompt Chaining（提示鏈）- 第 1 章：Prompt Chaining（提示鏈）
- Prompt Engineering - 附錄 A
- Proximal Policy Optimization（PPO，近端策略最佳化）- 第 9 章：學習與適應
- Push Notifications（推播通知）- 第 15 章：Agent 間通訊（A2A）

### Q

- QLoRA - 術語表
- Quality-Focused Iterative Execution（品質導向的迭代執行）- 第 19 章：評估與監控

### R

- RAG（Retrieval-Augmented Generation，檢索增強生成）- 第 8 章：記憶管理、第 14 章：知識檢索（RAG）、附錄 A
- ReAct（Reason and Act，推理與行動）- 第 17 章：推理技術、附錄 A、術語表
- Reasoning（推理）- 第 17 章：推理技術
- Reasoning-Based Information Extraction（基於推理的資訊擷取）- 第 10 章：Model Context Protocol（MCP）
- Recovery（恢復）- 第 12 章：例外處理與恢復
- Recurrent Neural Network（RNN，循環神經網路）- 術語表
- Reflection（反思）- 第 4 章：Reflection（反思）
- Reinforcement Learning（強化學習）- 第 9 章：學習與適應
- Reinforcement Learning from Human Feedback（RLHF，基於人類回饋的強化學習）- 術語表
- Reinforcement Learning with Verifiable Rewards（RLVR，可驗證獎勵的強化學習）- 第 17 章：推理技術
- Remote Agent（遠端 Agent）- 第 15 章：Agent 間通訊（A2A）
- Request/Response（Polling，請求／回應（輪詢））- 第 15 章：Agent 間通訊（A2A）
- Resource-Aware Optimization（資源感知最佳化）- 第 16 章：資源感知最佳化
- Retrieval-Augmented Generation（RAG，檢索增強生成）- 第 8 章：記憶管理、第 14 章：知識檢索（RAG）、附錄 A
- RLHF（Reinforcement Learning from Human Feedback，基於人類回饋的強化學習）- 術語表
- RLVR（Reinforcement Learning with Verifiable Rewards，可驗證獎勵的強化學習）- 第 17 章：推理技術
- RNN（Recurrent Neural Network，循環神經網路）- 術語表
- Role Prompting（角色提示）- 附錄 A
- Router Agent（路由 Agent）- 第 16 章：資源感知最佳化
- Routing（路由）- 第 2 章：Routing（路由）

### S

- Safety（安全）- 第 18 章：Guardrails／安全模式
- Scaling Inference Law（推理擴展法則）- 第 17 章：推理技術
- Scheduling（排程）- 第 20 章：Prioritization（優先排序）
- Self-Consistency（自我一致性）- 附錄 A
- Self-Correction（自我修正）- 第 4 章：Reflection（反思）、第 17 章：推理技術
- Self-Improving Coding Agent（SICA，自我改進的編碼 Agent）- 第 9 章：學習與適應
- Self-Refinement（自我精修）- 第 17 章：推理技術
- Semantic Kernel - 附錄 C
- Semantic Memory（語意記憶）- 第 8 章：記憶管理
- Semantic Similarity（語意相似度）- 第 14 章：知識檢索（RAG）
- Separation of Concerns（關注點分離）- 第 18 章：Guardrails／安全模式
- Sequential Handoffs（循序交接）- 第 7 章：Multi-Agent 協作
- Server-Sent Events（SSE，伺服器推送事件）- 第 15 章：Agent 間通訊（A2A）
- Session（工作階段）- 第 8 章：記憶管理
- SICA（Self-Improving Coding Agent，自我改進的編碼 Agent）- 第 9 章：學習與適應
- SMART Goals（SMART 目標）- 第 11 章：目標設定與監控
- State（狀態）- 第 8 章：記憶管理
- State Rollback（狀態回滾）- 第 12 章：例外處理與恢復
- Step-Back Prompting（後退式提示）- 附錄 A
- Streaming Updates（串流更新）- 第 15 章：Agent 間通訊（A2A）
- Structured Logging（結構化日誌）- 第 18 章：Guardrails／安全模式
- Structured Output（結構化輸出）- 第 1 章：Prompt Chaining（提示鏈）、附錄 A
- SuperAGI - 附錄 C
- Supervised Fine-Tuning（SFT，監督式微調）- 術語表
- Supervised Learning（監督式學習）- 第 9 章：學習與適應
- System Prompting（系統提示）- 附錄 A

### T

- Task Evaluation（任務評估）- 第 20 章：Prioritization（優先排序）
- Text Similarity（文字相似度）- 第 14 章：知識檢索（RAG）
- Token Usage（Token 用量）- 第 19 章：評估與監控
- Tool Use（工具使用）- 第 5 章：Tool Use（工具使用）、附錄 A
- Tool Use Restrictions（工具使用限制）- 第 18 章：Guardrails／安全模式
- ToT（Tree of Thoughts，思維樹）- 第 17 章：推理技術、附錄 A、術語表
- Transformers - 術語表
- Tree of Thoughts（ToT，思維樹）- 第 17 章：推理技術、附錄 A、術語表

### U

- Unsupervised Learning（非監督式學習）- 第 9 章：學習與適應
- User Persona（使用者人設）- 附錄 A

### V

- Validation（驗證）- 第 3 章：Parallelization（平行化）
- Vector Search（向量搜尋）- 第 14 章：知識檢索（RAG）
- VertexAiRagMemoryService - 第 8 章：記憶管理
- VertexAiSessionService - 第 8 章：記憶管理
- Vibe Coding - 附錄 B
- Visual Perception（視覺感知）- 附錄 B

### W

- Webhooks - 第 15 章：Agent 間通訊（A2A）

### Z

- Zero-Shot Learning（零樣本學習）- 第 9 章：學習與適應
- Zero-Shot Prompting（零樣本提示）- 附錄 A

## Prompt

以下是用來產生這份術語索引的 Prompt。

> *你能讀 <https://docs.google.com/document/d/1rsaK53T3Lg5KoGwvf8ukOUvbELRtH-V0LnOIFDxBryE/edit?tab=t.0> 以及它第一頁裡所有相關的文件嗎？請把每一章的標題都擷取出來並印出來。接著處理所有各章的內容，建立一份可供出版用的詳細索引：一份由字詞或片語（「標題」）組成的清單，並附上指向文件或文件集合中相關有用材料位置的指標（「定位符」）。我不要範例索引，我要完整的索引，包含 100 個索引詞條。*

## Gemini 2.5：推理步驟

### 開始建立索引

我已經開始這個流程，先讀取了提供的 Google 文件。目前我專注在理解使用者的需求：擷取章節標題來建立一份詳細索引。我正仔細檢視文件，尋找能標示出章節分界的清楚結構元素，希望能找出一致的格式或關鍵字來引導索引流程。

### 定義索引擷取流程

我現在已經完全投入這項任務，把使用者的請求拆解成可執行的步驟。第一步是用 Workspaces 存取主要的 Google 文件，接著解析文件、找出並讀取相關文件（同樣用 Workspaces），最後從所有文件中擷取章節標題並建立一份完整的索引。整個詳細流程已經規劃好了。

### 完善擷取策略

使用者的指示很清楚：讀取一份 Google 文件及其相關文件，建立一份詳細的章節標題索引。我已經擬定了多步驟的計畫。首先，Workspaces 會存取主文件；接著我會解析它、找出並讀取相關文件，同樣使用 Workspaces。我現在專注在擷取標題並用所需的詞條建立詳細索引，並以準確為優先，以滿足使用者對完整索引的特定要求。

#### 1. 確立使用者意圖

我已經判定使用者想要一份章節標題清單，以及一份取自 Google 文件與相關文件的完整索引。現在我需要想出最有效的擷取與索引方法。我正在探索可用的 API 功能來簡化這項任務，並評估處理不同文件結構的最佳策略。

#### 2. 思考工具的使用

我已經用正規表示式從主文件中擷取出各章的 URL。現在我準備用 Workspaces 取得每一章的實際內容。一旦拿到各章的文字，就會開始進行索引工作。

### 存取章節內容

我已經成功地從主文件中辨識出各章的 URL，現在可以使用 Workspaces。下一步是從這些 URL 取得內容，好讓我產生索引。我專注在效率上，目標是快速處理這些資訊。

### 擷取章節內容

我已經成功從主文件中辨識出各章的 URL，準備使用 Workspaces。我的計畫包括：擷取這些 URL、把呼叫批次化以提升效率，再處理取回的內容來建立所需的索引。這能確保所有相關資訊都被涵蓋，為完整又準確的結果打好基礎。

### 啟動 URL 取回

我現在已經成功從主文件中擷取出章節 URL。目前正在設定對 Workspaces 工具的呼叫，準備取得每一章的內容。目標是取得索引所需的文字，進而建立包含至少 100 個詞條的索引。

### 啟動章節擷取

我已經成功辨識並擷取出主文件中的章節 URL（如上所列）。現在我繼續針對每個 URL 使用 Workspaces 來取得章節內容。目標是取得索引所需的文字，進而建立包含至少 100 個詞條的索引。我已經開始取回這些資訊。

### 編排章節取回

我已經擷取出章節 URL，並發起了對 Workspaces 的呼叫。目前正在取回各章的內容。為了讓流程順暢，我把呼叫批次化，以避免遇到速率限制的問題。這應該能讓我有效率地彙整索引所需的文字。

### 解讀使用者請求

我已經判定使用者的需求：他們要兩項主要成果——第一，一份從 Google 文件擷取出來的完整章節標題清單；第二，一份至少包含一百個關鍵詞條的詳細索引。擷取標題看起來相當直接，而編纂索引則需要更細緻的分析。

### 擷取標題與建立索引

我已經成功辨識出使用者的需求：從提供的文件中擷取章節標題並編纂一份完整索引。我已經取回 31 份 Google 文件的內容，包括主文件及其各章。我確認不需要其他工具。我的計畫分兩步：先從文件檔名中擷取章節標題，再仔細處理內文來建立含有關鍵詞條與章節定位符的索引。

### 制定擷取計畫

我已經完善了處理使用者請求的方法，擬定出一套精確的計畫。首先，我會從 31 份已取回文件的檔名中彙整章節標題。其次，也是較複雜的部分，我會仔細分析內容，建立一份按字母順序排列、超過 100 個詞條的完整索引。擷取與索引策略都已定案，現在可以開始執行。

### 打磨擷取策略

我的方法已經定義清楚：從 31 份已取回文件的檔名中彙整章節標題，接著仔細分析內容，建立一份按字母順序組織、超過 100 個詞條的索引。擷取與索引策略都已定案，現在可以開始實作。使用者想要一份詳細索引——涵蓋《Agentic Design Patterns》系列各章與各附錄的內容——這個目標現在已經觸手可及。我會專注在交出一份完整的成果，而不只是一份範例索引。

### 定義方法

我已經釐清使用者的需求：從文件檔名中擷取章節標題，接著仔細建立一份超過 100 個詞條的索引，按字母順序排列並註明章節位置。我已經準備好開始索引與擷取的流程。
