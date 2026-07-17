---
title: "Agentic Design Patterns 術語表"
description: "全書核心術語一次整理。《Agentic Design Patterns》術語表繁體中文翻譯。"
pubDatetime: 2026-07-18T20:29:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## 基礎概念

**Prompt：** Prompt 是使用者提供給 AI 模型、用來引出回應的輸入，通常是一個問題、指令或陳述。Prompt 的品質與結構會大幅影響模型的輸出，因此 Prompt Engineering（設計 Prompt 的技巧）是有效運用 AI 的關鍵能力。

**上下文視窗（Context Window）：** 上下文視窗是 AI 模型一次能處理的最大 token 數量，輸入和它生成的輸出都算在內。這個固定大小是很重要的限制：超出視窗範圍的資訊會被忽略，而更大的視窗則能支撐更複雜的對話和文件分析。

**上下文學習（In-Context Learning）：** 上下文學習是 AI 直接從 Prompt 裡提供的範例學會新任務的能力，不需要重新訓練。有了這個能力，同一個通用模型就能即時適應各式各樣的特定任務。

**零樣本、單樣本與少樣本提示（Zero-Shot, One-Shot, & Few-Shot Prompting）：** 這是一組 Prompting 技巧，分別在 Prompt 裡給模型零個、一個或少數幾個任務範例來引導它的回應。範例給得越多，通常越能幫助模型理解使用者的意圖，也提升它在該任務上的準確度。

**多模態（Multimodality）：** 多模態是 AI 理解並處理多種資料類型（例如文字、影像、音訊）的能力。這讓互動更靈活、更接近人類，例如描述一張圖片，或回答一個用講的問題。

**接地（Grounding）：** 接地是把模型的輸出連結到可查證的真實世界資訊來源的過程，目的是確保內容符合事實、減少幻覺。常見做法是搭配 RAG 這類技術，讓 AI 系統更值得信任。

## 核心 AI 模型架構

**Transformer：** Transformer 是目前多數 LLM 的基礎神經網路架構。它最關鍵的創新是自注意力機制（self-attention），能高效處理長文字序列，並捕捉詞與詞之間的複雜關係。

**循環神經網路（Recurrent Neural Network, RNN）：** 循環神經網路是早於 Transformer 的基礎架構。RNN 以序列方式逐步處理資訊，用迴圈保留對先前輸入的「記憶」，因此適合文字和語音這類處理任務。

**專家混合（Mixture of Experts, MoE）：** 專家混合是一種高效率的模型架構，由一個「路由（router）」網路動態挑選一小部分「專家（expert）」網路來處理當下的輸入。這讓模型能擁有龐大的參數量，同時把運算成本控制在可負擔的範圍。

**擴散模型（Diffusion Models）：** 擴散模型是擅長生成高品質影像的生成式模型。它的做法是先對資料加入隨機雜訊，再訓練模型一步步逆轉這個過程，於是就能從隨機的起點生成全新的資料。

**Mamba：** Mamba 是近期出現的 AI 架構，採用選擇性狀態空間模型（Selective State Space Model, SSM）來高效處理序列，尤其擅長很長的上下文。它的選擇性機制能聚焦在相關資訊、濾掉雜訊，被視為 Transformer 的潛在替代方案。

## LLM 開發生命週期

一個強大的語言模型，開發上會依循一段明確的流程。第一步是預訓練（Pre-training）：用大量的一般網路文字資料訓練，打造出龐大的基礎模型，讓它學會語言、推理和世界知識。接著是微調（Fine-tuning），這個階段用較小、針對特定任務的資料集繼續訓練通用模型，把它的能力調整成適合某個特定用途。最後一步是對齊（Alignment），調整這個已經專門化的模型的行為，確保它的輸出有幫助、無害，並且符合人類價值觀。

**預訓練技術（Pre-training Techniques）：** 預訓練是模型從大量資料中學到通用知識的第一個階段。這個階段的主要技術，差別在於讓模型學習的目標不同。最常見的是因果語言建模（Causal Language Modeling, CLM），讓模型預測句子裡的下一個詞。另一種是遮罩語言建模（Masked Language Modeling, MLM），讓模型填回文字中被刻意遮住的詞。其他重要方法還包括：去雜訊目標（Denoising Objectives），讓模型學會把被破壞的輸入還原成原樣；對比學習（Contrastive Learning），讓模型學會分辨相似和不相似的資料；以及下一句預測（Next Sentence Prediction, NSP），讓模型判斷兩個句子在邏輯上是不是前後相接。

**微調技術（Fine-tuning Techniques）：** 微調是用較小的專門資料集，把通用的預訓練模型調整成適合特定任務的過程。最常見的做法是監督式微調（Supervised Fine-Tuning, SFT），用標註好的正確「輸入-輸出」配對來訓練模型。一個流行的變體是指令微調（Instruction Tuning），重點在訓練模型更好地遵循使用者的指令。為了讓這個過程更有效率，會採用參數高效微調（Parameter-Efficient Fine-Tuning, PEFT）方法，其中代表性技術包括 LoRA（Low-Rank Adaptation，低秩適應），它只更新少量參數，以及它記憶體最佳化的版本 QLoRA。另一項技術檢索增強生成（Retrieval-Augmented Generation, RAG），則是在微調或推論階段把模型連上外部知識來源，藉此強化模型。

**對齊與安全技術（Alignment & Safety Techniques）：** 對齊是確保 AI 模型的行為符合人類價值觀與期待、讓它有幫助又無害的過程。最主要的技術是基於人類回饋的強化學習（Reinforcement Learning from Human Feedback, RLHF），用一個依人類偏好訓練出來的「獎勵模型」來引導 AI 的學習過程，並常搭配近端策略最佳化（Proximal Policy Optimization, PPO）這類演算法來維持訓練穩定。後來也出現了比較簡單的替代方案，例如直接偏好最佳化（Direct Preference Optimization, DPO），它省去了另外訓練獎勵模型的需求；還有卡尼曼-特沃斯基最佳化（Kahneman-Tversky Optimization, KTO），進一步簡化了資料收集。為了確保部署安全，會加上 Guardrails（護欄）作為最後一道安全防線，即時過濾輸出、擋下有害的行為。

## 增強 AI Agent 的能力

AI Agent 是能感知所處環境、並自主採取行動來達成目標的系統。有了穩健的推理框架，它們會更有效。

**Chain of Thought（CoT）：** 這種 Prompting 技巧會鼓勵模型在給出最終答案前，先一步步說明自己的推理。這種「把思路講出來」的過程，往往能在複雜的推理任務上得到更準確的結果。

**Tree of Thoughts（ToT）：** Tree of Thoughts 是一種進階的推理框架，Agent 會像樹的分枝一樣，同時探索多條推理路徑。它讓 Agent 能自我評估不同的思路，挑出最有希望的一條繼續往下走，因此更擅長解決複雜問題。

**ReAct（Reason and Act）：** ReAct 是一種把推理和行動放進迴圈裡的 Agent 框架。Agent 先「思考」要做什麼，再用工具採取「行動」，然後用得到的觀察結果來決定下一步的想法，因此非常擅長解決複雜任務。

**規劃（Planning）：** 這是 Agent 把一個高層次目標拆解成一連串較小、好處理的子任務的能力。Agent 接著會擬定計畫，依序執行這些步驟，於是就能應付複雜的多步驟工作。

**深度研究（Deep Research）：** 深度研究是指 Agent 能自主地深入探究一個主題：反覆搜尋資訊、整合發現、並找出新的問題。這讓 Agent 對一個主題建立起全面的理解，遠遠超過單次搜尋查詢所能做到的。

**評判模型（Critique Model）：** 評判模型是一種專門訓練來審查、評估另一個 AI 模型輸出、並提供回饋的 AI 模型。它扮演自動化評審的角色，幫忙找出錯誤、改善推理，並確保最終輸出達到期望的品質標準。
