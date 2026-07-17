---
title: "Agentic Design Patterns 第 9 章：Learning and Adaptation（學習與適應）"
description: "讓 Agent 從經驗與回饋中學習，隨時間越做越好。《Agentic Design Patterns》第 9 章繁體中文翻譯。"
pubDatetime: 2026-07-18T20:51:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

學習與適應是提升 AI Agent 能力的關鍵。這些過程讓 Agent 能突破預先設定的參數，透過經驗和與環境的互動自主進步。有了學習和適應的能力，Agent 就能有效應付沒見過的狀況，不需要人為持續介入也能把表現調到最好。本章詳細探討 Agent 學習與適應背後的原理和機制。

## 整體概念

Agent 靠著根據新的經驗和資料，改變自己的思考、行動或知識來學習和適應。這讓 Agent 從「照指令行事」進化成「越用越聰明」。

* **強化學習（Reinforcement Learning）：** Agent 嘗試各種行動，好結果得到獎勵、壞結果受到懲罰，從中學會在多變情境下的最佳行為。適合控制機器人或玩遊戲的 Agent。
* **監督式學習（Supervised Learning）：** Agent 從標註過的範例中學習，把輸入對應到期望的輸出，能做決策和模式辨識這類任務。適合分類 email 或預測趨勢的 Agent。
* **非監督式學習（Unsupervised Learning）：** Agent 在未標註的資料中發掘隱藏的關聯和模式，有助於洞察、組織資訊，以及建立對環境的心智地圖。適合在沒有明確指引下探索資料的 Agent。
* **基於 LLM 的 Few-Shot／Zero-Shot 學習：** 利用 LLM 的 Agent 能靠極少的範例或清楚的指示，快速適應新任務，對新指令或新狀況做出即時反應。
* **線上學習（Online Learning）：** Agent 持續用新資料更新知識，這對動態環境中的即時反應和持續適應不可或缺。對處理連續資料流的 Agent 尤其關鍵。
* **基於記憶的學習（Memory-Based Learning）：** Agent 回想過去的經驗，在類似情境下調整當前的行動，強化情境感知和決策品質。對具備記憶回想能力的 Agent 很有效。

Agent 的適應，就是根據學到的東西改變策略、理解或目標。這對身處不可預測、多變或陌生環境的 Agent 至關重要。

**近端策略最佳化（Proximal Policy Optimization，PPO）** 是一種強化學習演算法，用來訓練「動作空間連續」的 Agent，例如控制機器人的關節或遊戲裡的角色。它的主要目標，是可靠且穩定地改進 Agent 的決策策略（policy）。

PPO 的核心概念是對 Agent 的策略做小幅、謹慎的更新，避免劇烈變動導致表現崩盤。運作方式如下：

1. 蒐集資料：Agent 用當前的策略與環境互動（例如玩遊戲），蒐集一批經驗（狀態、動作、獎勵）。
2. 評估「替代」目標：PPO 計算某個策略更新會如何改變預期獎勵。但它不是單純最大化獎勵，而是使用一個特殊的「截斷式」（clipped）目標函數。
3. 「截斷」機制：這是 PPO 穩定性的關鍵。它在當前策略周圍劃出一個「信任區域」（trust region），也就是安全區：演算法不能做出偏離當前策略太多的更新。這個截斷像一道保險，確保 Agent 不會踏出一大步冒險、把學到的東西全毀了。

簡而言之，PPO 在「提升表現」和「不偏離已知可行的策略太遠」之間取得平衡，避免訓練過程中的災難性失敗，讓學習更穩定。

**直接偏好最佳化（Direct Preference Optimization，DPO）** 是較新的方法，專為讓大型語言模型（LLM）對齊人類偏好而設計。相較於用 PPO 做這件事，它提供了更簡單、更直接的替代方案。

要理解 DPO，先理解傳統基於 PPO 的對齊方法會有幫助：

* PPO 做法（兩步驟流程）：
  1. 訓練獎勵模型：先蒐集人類回饋資料──由人來評分或比較不同的 LLM 回應（例如「回應 A 比回應 B 好」）。用這些資料訓練一個獨立的 AI 模型，稱為獎勵模型（reward model），它的工作是預測人類會給任何新回應打幾分。
  2. 用 PPO 微調：接著用 PPO 微調 LLM。LLM 的目標是生成能從獎勵模型拿到最高分的回應；獎勵模型在這場訓練賽局中扮演「裁判」。

這個兩步驟流程可能又複雜又不穩定。例如 LLM 可能找到漏洞，學會「駭」獎勵模型：用爛回應騙到高分。

* DPO 做法（直接流程）：DPO 完全跳過獎勵模型。它不把人類偏好先轉成獎勵分數再去最佳化，而是直接用偏好資料更新 LLM 的策略。
* 它的原理是一個直接連結「偏好資料」與「最佳策略」的數學關係。本質上是在教模型：「提高生成『被偏好的』那類回應的機率，降低生成『不被偏好的』那類回應的機率。」

本質上，DPO 直接在人類偏好資料上最佳化語言模型，簡化了對齊流程：省去訓練和使用獨立獎勵模型的複雜度和潛在不穩定性，讓對齊更有效率、更穩健。

## 實際應用與使用情境

有適應力的 Agent 靠經驗資料驅動的迭代更新，在多變的環境中展現更好的表現。

* **個人化助理 Agent** 透過長期分析個別使用者的行為來打磨互動方式，讓回應高度貼合需求。
* **交易機器人 Agent** 根據高解析度的即時市場資料動態調整模型參數，最佳化決策演算法，追求報酬最大化、風險最小化。
* **應用程式 Agent** 根據觀察到的使用者行為動態調整介面和功能，提升使用者參與度和系統的直覺性。
* **機器人與自駕車 Agent** 整合感測器資料和歷史行動分析，強化導航和反應能力，在各種環境條件下安全、有效率地運作。
* **詐欺偵測 Agent** 用新發現的詐騙模式打磨預測模型，提升異常偵測能力，強化系統安全、減少金錢損失。
* **推薦 Agent** 運用使用者偏好學習演算法，提升內容挑選的精準度，提供高度個人化、切合情境的推薦。
* **遊戲 AI Agent** 動態調整策略演算法，增加遊戲的複雜度和挑戰性，提升玩家的參與感。
* **知識庫學習 Agent：** Agent 可以利用檢索增強生成（RAG）維護一個動態知識庫，收錄問題描述和驗證過的解法（見第 14 章）。把成功的策略和遇過的難題存起來，Agent 在決策時就能參考這些資料：套用過去成功的模式、避開已知的坑，更有效地適應新狀況。

## 案例研究：自我改進的 Coding Agent（SICA）

自我改進的 Coding Agent（Self-Improving Coding Agent，SICA）由 Maxime Robeyns、Laurence Aitchison 和 Martin Szummer 開發，代表了 Agent 學習的一項進展：Agent 能修改自己的原始碼。這與「一個 Agent 訓練另一個 Agent」的傳統做法不同──SICA 既是修改者，也是被修改的對象，靠迭代地打磨自己的程式碼庫，在各種程式挑戰上提升表現。

SICA 的自我改進以迭代循環運作（見圖 1）。一開始，SICA 檢視自己過去版本的檔案庫，以及它們在基準測試上的表現，選出表現分數最高的版本（分數由成功率、時間和計算成本的加權公式算出）。被選中的版本接手下一輪自我修改：分析檔案庫找出可以改進的地方，然後直接修改自己的程式碼庫。修改後的 Agent 再跑基準測試，結果記回檔案庫。這個過程不斷重複，直接從過去的表現中學習。這個自我改進機制讓 SICA 不需要傳統的訓練典範，也能演化自己的能力。

![SICA 的自我改進：根據過去版本學習與適應](/assets/agentic-design-patterns/SICAs_self_improvement_learning_and_adapting_based_on_its_past_versions.png)

圖 1：SICA 的自我改進，根據自己的過去版本學習與適應。

SICA 經歷了多輪顯著的自我改進，在程式碼編輯和導覽上都有進展。最初，SICA 改程式碼用的是簡單的整檔覆寫；後來它發展出能做更聰明、更貼合上下文編輯的「Smart Editor」。這又演化成「Diff-Enhanced Smart Editor」，引入 diff 來做精準修改和基於模式的編輯，以及一個降低處理負擔的「Quick Overwrite Tool」。

SICA 進一步實作了「Minimal Diff Output Optimization」和「Context-Sensitive Diff Minimization」，利用抽象語法樹（Abstract Syntax Tree，AST）解析來提升效率，另外還加了「SmartEditor Input Normalizer」。在導覽方面，SICA 自主打造了「AST Symbol Locator」，利用程式碼的結構地圖（AST）在程式碼庫中定位定義。之後又開發出「Hybrid Symbol Locator」，結合快速搜尋和 AST 檢查，再透過「Optimized AST Parsing in Hybrid Symbol Locator」聚焦相關的程式碼區段，提升搜尋速度（見圖 2）。

![跨迭代的表現](/assets/agentic-design-patterns/Performance_across_Iterations.png)

圖 2：跨迭代的表現。關鍵改進標註了對應的工具或 Agent 修改。（由 Maxime Robeyns、Martin Szummer、Laurence Aitchison 提供）

SICA 的架構包含一套基礎工具箱，負責基本的檔案操作、指令執行和算術運算，也包含提交結果的機制，以及呼叫專門子 Agent（coding、問題解決、推理）的機制。這些子 Agent 負責分解複雜任務、管理 LLM 的上下文長度，在長時間的改進循環中尤其重要。

一個非同步的監督者（overseer）──另一個 LLM──監控 SICA 的行為，找出迴圈或停滯這類潛在問題。它能與 SICA 溝通，必要時介入中止執行。監督者會收到 SICA 行動的詳細報告，包括呼叫圖（callgraph）和訊息與工具動作的記錄，用來辨識模式和低效之處。

SICA 的 LLM 以結構化的方式組織上下文視窗（它的短期記憶）中的資訊，這對它的運作至關重要。這個結構包括：System Prompt，定義 Agent 目標、工具與子 Agent 的文件、系統指令；Core Prompt，包含問題陳述或指示、開啟中的檔案內容、目錄地圖；Assistant Messages，記錄 Agent 一步步的推理、工具與子 Agent 的呼叫記錄和結果，以及監督者的通訊。這種組織方式讓資訊流動更有效率，提升 LLM 的運作、降低處理時間和成本。最初，檔案變更以 diff 記錄，只顯示修改的部分，並定期整併。

**SICA：看看程式碼。** 深入 SICA 的實作，可以看到幾個支撐其能力的關鍵設計決策。如前所述，系統採模組化架構，包含多個子 Agent：coding Agent、問題解決 Agent、推理 Agent。這些子 Agent 由主 Agent 以類似工具呼叫的方式喚起，負責分解複雜任務、有效管理上下文長度，在漫長的「後設改進」迭代中尤其重要。

這個專案持續開發中，目標是為想在工具使用等 Agentic 任務上對 LLM 做後訓練（post-training）的人提供一個穩固的框架。完整程式碼在 GitHub：[https://github.com/MaximeRobeyns/self_improving_coding_agent/](https://github.com/MaximeRobeyns/self_improving_coding_agent/)，歡迎進一步探索和貢獻。

在安全方面，專案非常強調 Docker 容器化：Agent 在專屬的 Docker 容器中執行。這是關鍵措施──考慮到 Agent 能執行 shell 指令，容器提供了與主機的隔離，降低誤動檔案系統之類的風險。

為了透明度和可控性，系統提供了完善的可觀測性：一個互動式網頁，把事件匯流排（event bus）上的事件和 Agent 的呼叫圖視覺化。它讓你全面掌握 Agent 的行動：檢視個別事件、閱讀監督者的訊息、收合子 Agent 的執行軌跡，看得更清楚。

在核心智慧方面，這個 Agent 框架支援多家供應商的 LLM 整合，方便實驗不同模型、為特定任務找出最合適的那一個。最後，一個關鍵元件是非同步監督者：與主 Agent 並行運作的 LLM，定期評估 Agent 的行為有沒有病態偏差或停滯，必要時介入──發通知，甚至取消 Agent 的執行。它收到的是系統狀態的詳細文字表示，包括呼叫圖，以及 LLM 訊息、工具呼叫和回應的事件流，藉此偵測低效的模式或重複的工作。

SICA 初期實作的一個明顯挑戰：如何用 Prompt 讓基於 LLM 的 Agent 在每輪後設改進迭代中，自主提出新穎、有創意、可行又有意思的修改。這個限制──特別是在培養 LLM Agent 的開放式學習和真正的創造力方面──仍是當前研究的重點課題。

## AlphaEvolve 與 OpenEvolve

**AlphaEvolve** 是 Google 開發的 AI Agent，用途是發現和最佳化演算法。它結合了 LLM（具體是 Gemini 系列的 Flash 和 Pro）、自動化評估系統，以及演化演算法框架，目標是同時推進理論數學和實務計算應用。

AlphaEvolve 使用一組 Gemini 模型：Flash 負責大量生成初始的演算法提案，Pro 提供更深入的分析和打磨。提出的演算法接著依預先定義的準則自動評估和打分。這些評估回饋用於迭代改進解法，最終得到最佳化的、新穎的演算法。

在實務計算方面，AlphaEvolve 已部署在 Google 的基礎設施中。它改進了資料中心的排程，讓全球計算資源用量減少 0.7%；也對硬體設計有貢獻──為即將推出的 Tensor Processing Unit（TPU）的 Verilog 程式碼提出最佳化建議。此外，AlphaEvolve 加速了 AI 本身的效能：Gemini 架構的一個核心 kernel 提速 23%，FlashAttention 的低階 GPU 指令最佳化幅度最高達 32.5%。

在基礎研究領域，AlphaEvolve 為矩陣乘法發現了新演算法，包括一個 4x4 複數矩陣的乘法只需 48 次純量乘法的方法，超越了先前已知的解。在更廣泛的數學研究中，面對 50 多個開放問題，它在 75% 的情況下重新發現了現有的最先進解法，在 20% 的情況下更進一步改進了現有解，例子包括 kissing number 問題上的進展。

**OpenEvolve** 是一個利用 LLM 的演化式 coding Agent（見圖 3），迭代地最佳化程式碼。它調度一條「LLM 驅動的程式碼生成 → 評估 → 篩選」的 pipeline，針對各式各樣的任務持續強化程式。OpenEvolve 的一個重點能力是演化整個程式碼檔案，而不限於單一函式。這個 Agent 的設計講求通用性：支援多種程式語言、相容於任何提供 OpenAI 相容 API 的 LLM。此外，它還納入多目標最佳化、支援彈性的 Prompt Engineering，並能做分散式評估，有效率地應付複雜的程式挑戰。

![OpenEvolve 架構](/assets/agentic-design-patterns/OpenEvolve_Architecture.png)

圖 3：OpenEvolve 的內部架構由一個 controller 管理。這個 controller 調度幾個關鍵元件：program sampler、Program Database、Evaluator Pool 和 LLM Ensembles。它的主要功能是促進這些元件的學習與適應過程，提升程式碼品質。

下面的程式碼片段用 OpenEvolve 函式庫對程式做演化式最佳化。它以初始程式、評估檔和設定檔的路徑初始化 OpenEvolve 系統。evolve.run(iterations=1000) 這行啟動演化流程，跑 1000 輪迭代來找出程式的改良版本。最後印出演化過程中找到的最佳程式的各項指標，格式化到小數點後四位。

```python
from openevolve import OpenEvolve


# Initialize the system
evolve = OpenEvolve(
    initial_program_path="path/to/initial_program.py",
    evaluation_file="path/to/evaluator.py",
    config_path="path/to/config.yaml",
)

# Run the evolution
best_program = await evolve.run(iterations=1000)

print("Best program metrics:")
for name, value in best_program.metrics.items():
    print(f"  {name}: {value:.4f}")
```

## 速覽

**問題：** AI Agent 常常在動態、不可預測的環境中運作，預先寫死的邏輯不夠用。面對初始設計沒料到的新狀況，表現可能一路下滑。沒有從經驗中學習的能力，Agent 就無法隨時間最佳化策略或提供個人化互動。這種僵硬限制了它們的效果，也讓它們在複雜的真實場景中無法達到真正的自主。

**解法：** 標準化的解法是整合學習與適應機制，把靜態的 Agent 轉變成動態、會演化的系統。這讓 Agent 能根據新資料和互動，自主地打磨知識和行為。Agentic 系統可以採用多種方法：從強化學習，到更進階的自我修改──像自我改進的 Coding Agent（SICA）那樣。Google 的 AlphaEvolve 這類先進系統，則利用 LLM 和演化演算法，為複雜問題發現全新、更有效率的解法。透過持續學習，Agent 能掌握新任務、提升表現、適應變化的環境，不需要不斷的人工重新設定。

**經驗法則：** 打造必須在動態、不確定或持續演變環境中運作的 Agent 時，就用這個模式。需要個人化、持續改善表現、能自主應付新狀況的應用，都少不了它。

**圖解：**

![Learning and Adapting 模式](/assets/agentic-design-patterns/Learning_and_Adapting_Pattern.png)

圖 4：Learning and Adapting 模式。

## 重點回顧

* 學習與適應，就是 Agent 利用經驗把事情做得更好、應付新狀況。
* 「適應」是學習帶來的、可觀察到的行為或知識變化。
* SICA（自我改進的 Coding Agent）根據過去的表現修改自己的程式碼來自我改進，因此誕生了 Smart Editor 和 AST Symbol Locator 這些工具。
* 專門的「子 Agent」加上一個「監督者」，幫助這類自我改進系統管理大型任務、不偏離軌道。
* LLM 上下文視窗的安排方式（system prompt、core prompt、assistant messages）對 Agent 的運作效率非常重要。
* 對於必須在多變、不確定、或需要個人化的環境中運作的 Agent，這個模式不可或缺。
* 打造會學習的 Agent，通常意味著接上機器學習工具、管理資料的流動。
* 一個配備基本程式工具的 Agent 系統，能自主編輯自己，從而提升在基準任務上的表現。
* AlphaEvolve 是 Google 的 AI Agent，利用 LLM 和演化框架自主發現並最佳化演算法，大幅推進了基礎研究和實務計算應用。

## 結語

本章檢視了學習與適應在人工智慧中的關鍵角色。AI Agent 透過持續的資料取得和經驗累積來提升表現。自我改進的 Coding Agent（SICA）就是例證：靠修改程式碼自主提升自己的能力。

我們已經回顧了 Agentic AI 的基本組成：架構、應用、規劃、Multi-Agent 協作、記憶管理，以及學習與適應。學習原則對 Multi-Agent 系統的協同改進特別重要。要做到這一點，調校資料必須準確反映完整的互動軌跡，捕捉每個參與 Agent 各自的輸入和輸出。

這些要素共同促成了重大的進展，例如 Google 的 AlphaEvolve。這個 AI 系統靠 LLM、自動化評估和演化方法，獨立發現並改良演算法，推動科學研究和計算技術的進步。這些模式可以組合起來，建構精密的 AI 系統。AlphaEvolve 這樣的發展證明：由 AI Agent 自主發現和最佳化演算法，是做得到的。

## 參考資料

1. Sutton, R. S., & Barto, A. G. (2018). *Reinforcement Learning: An Introduction*. MIT Press.
2. Goodfellow, I., Bengio, Y., & Courville, A. (2016). *Deep Learning*. MIT Press.
3. Mitchell, T. M. (1997). *Machine Learning*. McGraw-Hill.
4. **Proximal Policy Optimization Algorithms** by John Schulman, Filip Wolski, Prafulla Dhariwal, Alec Radford, and Oleg Klimov. You can find it on arXiv: [https://arxiv.org/abs/1707.06347](https://arxiv.org/abs/1707.06347)
5. Robeyns, M., Aitchison, L., & Szummer, M. (2025). *A Self-Improving Coding Agent*. arXiv:2504.15228v2. [https://arxiv.org/pdf/2504.15228](https://arxiv.org/pdf/2504.15228)  [https://github.com/MaximeRobeyns/self_improving_coding_agent](https://github.com/MaximeRobeyns/self_improving_coding_agent)
6. AlphaEvolve blog, [https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/](https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/)
7. OpenEvolve, [https://github.com/codelion/openevolve](https://github.com/codelion/openevolve)
