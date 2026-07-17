---
title: "Agentic Design Patterns 第 1 章：Prompt Chaining（提示鏈）"
description: "把複雜任務拆成一連串 Prompt，前一步的輸出餵給下一步。《Agentic Design Patterns》第 1 章繁體中文翻譯，含程式碼範例。"
pubDatetime: 2026-07-18T20:59:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## 模式概觀

Prompt Chaining（提示鏈），有時也叫 Pipeline 模式，是用大型語言模型（LLM）處理複雜任務的一種強大做法。與其期待 LLM 在單一一個龐大的步驟裡解決複雜問題，Prompt Chaining 主張分而治之：把原本讓人卻步的問題，拆解成一連串更小、更好處理的子問題。每個子問題由一個專門設計的 Prompt 個別處理，而前一個 Prompt 產生的輸出，會有策略地作為輸入餵給鏈中的下一個 Prompt。

這種循序處理的技術，天生就為與 LLM 的互動帶來模組化和清晰度。把複雜任務拆開之後，每個單獨的步驟都更容易理解和除錯，整個流程也就更穩健、更容易解讀。鏈中的每一步都可以精心設計和調校，專注在大問題的某個特定面向，產出也就更準確、更聚焦。

「一步的輸出作為下一步的輸入」是關鍵。這種資訊傳遞建立起一條依賴鏈（名字就是這麼來的）：前面操作的上下文和結果，引導著後續的處理。這讓 LLM 能站在自己先前的工作上繼續累積、修正理解，一步步逼近想要的解答。

此外，Prompt Chaining 不只是拆解問題，它還能整合外部知識和工具。在每一步，都可以指示 LLM 與外部系統、API 或資料庫互動，讓它的知識和能力超出內部訓練資料的範圍。這大幅擴展了 LLM 的潛力：它們不再是孤立的模型，而是更大、更聰明的系統裡的一個組成部分。

Prompt Chaining 的意義不止於解決單一問題。它是打造精密 AI Agent 的基礎技術：Agent 可以利用 Prompt 鏈，在動態環境中自主地規劃、推理和行動。透過有策略地安排 Prompt 的順序，Agent 能承接需要多步推理、規劃和決策的任務。這樣的 Agent 工作流程更貼近人類的思考過程，與複雜領域和系統的互動也就更自然、更有效。

**單一 Prompt 的限制：** 面對多面向的任務，用單一一個複雜的 Prompt 常常效率不佳。模型可能被一堆約束和指令搞得手忙腳亂，衍生出幾種問題：指令忽略（instruction neglect），Prompt 的某些部分被跳過；上下文偏移（contextual drift），模型跟丟了最初的上下文；錯誤傳播（error propagation），早期的錯誤被逐步放大；上下文視窗不夠長，模型拿不到足夠的資訊來回應；還有幻覺（hallucination），認知負荷一高，生成錯誤資訊的機率就跟著上升。舉例來說，一個要求「分析市場研究報告、摘要發現、找出趨勢與佐證數據、再起草一封 email」的查詢就很容易失敗：模型也許摘要做得不錯，卻沒能好好抽出數據，或把 email 寫壞了。

**用循序拆解提高可靠性：** Prompt Chaining 的解法，是把複雜任務拆成一條聚焦的、循序的工作流程，可靠性和可控性都會顯著提升。以上面的例子來說，pipeline（鏈式）做法長這樣：

1. 第一個 Prompt（摘要）：「摘要以下市場研究報告的主要發現：\[文本\]。」模型只需要專心做摘要這一件事，這個起始步驟的準確度自然提高。
2. 第二個 Prompt（趨勢辨識）：「根據這份摘要，找出前三大新興趨勢，並抽出支持每個趨勢的具體數據點：\[步驟 1 的輸出\]。」這個 Prompt 的範圍更收斂，而且直接建立在已驗證的輸出之上。
3. 第三個 Prompt（撰寫 email）：「起草一封給行銷團隊的簡短 email，說明以下趨勢及其佐證數據：\[步驟 2 的輸出\]。」

這樣拆解之後，你對流程的控制粒度更細。每一步都更簡單、更不模糊，模型的認知負荷降低，最終輸出也更準確可靠。這種模組化很像計算上的 pipeline：每個函式做完自己的特定操作，再把結果傳給下一個。為了讓每個任務都答得準，還可以在每個階段給模型指定不同的角色，例如：第一個 Prompt 設定為「市場分析師」，第二個設定為「貿易分析師」，第三個設定為「專業文件撰稿人」，依此類推。

**結構化輸出的角色：** Prompt 鏈的可靠性，高度取決於步驟之間傳遞的資料是否完整無誤。如果某個 Prompt 的輸出含糊或格式不佳，下一個 Prompt 就可能因為輸入有問題而失敗。要降低這種風險，指定結構化的輸出格式（例如 JSON 或 XML）非常重要。

舉例來說，趨勢辨識那一步的輸出可以格式化成一個 JSON 物件：

```json
{  "trends": [    
        {      
            "trend_name": "AI-Powered Personalization",      
            "supporting_data": "73% of consumers prefer to do business with brands that use personal information to make their shopping experiences more relevant."    
        },    
        {      
            "trend_name": "Sustainable and Ethical Brands",      
            "supporting_data": "Sales of products with ESG-related claims grew 28% over the last five years, compared to 20% for products without."    
        } 
    ] 
}
```

結構化格式確保資料是機器可讀的，能被精確解析、毫無歧義地塞進下一個 Prompt。這個做法把「解讀自然語言」可能產生的錯誤降到最低，是打造穩健的多步驟 LLM 系統的關鍵一環。

## 實際應用與使用情境

Prompt Chaining 是個用途很廣的模式，在打造 Agentic 系統時適用於許多場景。它的核心價值就在於把複雜問題拆成循序、可掌控的步驟。以下是幾個實際應用和使用情境：

### 1. 資訊處理工作流程

很多任務需要對原始資訊做多次轉換。例如：先摘要一份文件、抽出關鍵實體，再用這些實體查資料庫或產生報告。Prompt 鏈可能長這樣：

* Prompt 1：從給定的 URL 或文件中抽取文字內容。
* Prompt 2：摘要清理過的文字。
* Prompt 3：從摘要或原文中抽取特定實體（例如人名、日期、地點）。
* Prompt 4：用這些實體搜尋內部知識庫。
* Prompt 5：整合摘要、實體和搜尋結果，產生最終報告。

這套方法應用在自動化內容分析、AI 研究助理的開發、複雜報告生成等領域。

### 2. 複雜問題回答

回答需要多步推理或多次檢索的複雜問題，是 Prompt Chaining 的典型使用情境。例如：「1929 年股市崩盤的主因是什麼？政府政策又是如何應對的？」

* Prompt 1：辨識使用者問題裡的核心子問題（崩盤原因、政府應對）。
* Prompt 2：專門研究或檢索 1929 年崩盤原因的資訊。
* Prompt 3：專門研究或檢索政府對 1929 年股災政策應對的資訊。
* Prompt 4：把步驟 2 和 3 的資訊整合成一個連貫的答案，回應原始問題。

這種循序處理方法，是開發「能做多步推論與資訊整合的 AI 系統」不可或缺的一環。當一個問題無法靠單一資料點回答，而需要一連串邏輯步驟、或整合多個來源的資訊時，就需要這樣的系統。

舉例來說，一個負責就特定主題產出完整報告的自動化研究 Agent，執行的其實是混合式的計算流程。一開始，系統會檢索大量相關文章。接下來「從每篇文章抽取關鍵資訊」這件事，每個來源可以同時進行──這個階段很適合平行處理，讓彼此獨立的子任務同時跑，把效率拉到最高。

但等到各篇的抽取都完成後，流程就變成本質上循序的了：系統必須先彙整抽出的資料，接著把它綜合成一份連貫的草稿，最後審閱並修飾這份草稿，產出最終報告。後面這幾個階段，每一步在邏輯上都依賴前一步的完成。這就是 Prompt Chaining 上場的地方：彙整好的資料作為「綜合」Prompt 的輸入，綜合出來的文字再作為最後「審閱」Prompt 的輸入。所以複雜的操作常常是兩者並用：獨立的資料蒐集用平行處理，有依賴關係的綜合與修飾步驟用 Prompt Chaining。

### 3. 資料抽取與轉換

把非結構化文字轉成結構化格式，通常是個迭代的過程，需要一輪一輪地修正，才能把輸出的準確度和完整度拉上來。

* Prompt 1：嘗試從發票文件中抽取特定欄位（例如名稱、地址、金額）。
* 處理：檢查必要欄位是否都抽到了、格式是否符合要求。
* Prompt 2（條件式）：如果有欄位缺漏或格式錯誤，就發一個新的 Prompt，要求模型專門去找那些缺漏或錯誤的資訊，也許附上前一次失敗嘗試的上下文。
* 處理：再次驗證結果，必要時重複。
* 輸出：交出抽取完成、驗證過的結構化資料。

這種循序處理方法特別適合從表單、發票、email 這類非結構化來源做資料抽取和分析。例如，處理 PDF 表單這種複雜的光學字元辨識（OCR）問題，用拆解過的多步驟做法會有效得多。

首先，用 LLM 對文件影像做主要的文字抽取。接著，模型處理原始輸出、把資料正規化，例如把「一千零五十」這樣的數字文字轉成數值 1050。精確的數學計算對 LLM 來說是個大罩門，所以在後續步驟中，系統可以把需要的算術運算委託給外部的計算機工具：LLM 負責認出需要算什麼，把正規化後的數字餵給工具，再把精確的結果接回來。這條「文字抽取 → 資料正規化 → 外部工具運算」的鏈，能得到單一一次 LLM 查詢往往很難穩定拿到的準確結果。

### 4. 內容生成工作流程

複雜內容的寫作是一個程序性的任務，通常會拆成幾個明確的階段：發想、擬大綱、起草、修改。

* Prompt 1：根據使用者的大方向興趣，生成 5 個主題點子。
* 處理：讓使用者挑一個，或自動選出最好的一個。
* Prompt 2：根據選定的主題，生成詳細大綱。
* Prompt 3：根據大綱的第一點寫一段草稿。
* Prompt 4：根據大綱的第二點寫下一段草稿，並附上前一段作為上下文。照這樣把大綱各點寫完。
* Prompt 5：審閱並修飾完整草稿，顧好連貫性、語氣和文法。

這套方法可以用在各種自然語言生成任務上，包括自動撰寫創意故事、技術文件，以及其他有結構的文字內容。

### 5. 有狀態的對話 Agent

完整的狀態管理架構會用到比循序串接更複雜的方法，但 Prompt Chaining 提供了維持對話連續性的基礎機制：把每一輪對話都建構成一個新的 Prompt，並有系統地把先前互動中的資訊或抽取出的實體帶進來。

* Prompt 1：處理使用者的第一句話，辨識意圖和關鍵實體。
* 處理：用意圖和實體更新對話狀態。
* Prompt 2：根據目前狀態，生成回應，以及／或辨識下一個需要的資訊。
* 後續每一輪都重複這個流程：每句新的使用者發言都啟動一條鏈，而這條鏈利用的是不斷累積的對話歷史（狀態）。

這個原則是開發對話 Agent 的根基，讓它們能在長串、多輪的對話中維持上下文和連貫性。保留了對話歷史，系統才能理解並恰當回應那些依賴先前資訊的使用者輸入。

### 6. 程式碼生成與修正

生成能動的程式碼通常是多階段的過程，需要把問題拆成一連串分立的邏輯步驟，逐步執行。

* Prompt 1：理解使用者對某個函式的需求，生成虛擬碼或大綱。
* Prompt 2：根據大綱寫出第一版程式碼。
* Prompt 3：找出程式碼中潛在的錯誤或可改進之處（可以借助靜態分析工具，或再呼叫一次 LLM）。
* Prompt 4：根據找到的問題重寫或修正程式碼。
* Prompt 5：補上文件或測試案例。

在 AI 輔助軟體開發這類應用中，Prompt Chaining 的價值來自它能把複雜的寫程式任務拆成一串可掌控的子問題。這種模組化結構降低了 LLM 在每一步的操作複雜度。更關鍵的是，這種做法允許你在模型呼叫之間插入確定性的邏輯：中間資料處理、輸出驗證、工作流程裡的條件分支。透過這個方法，一個原本可能產出不可靠或不完整結果的多面向請求，被轉換成一連串由底層執行框架管理的結構化操作。

### 7. 多模態與多步驟推理

分析包含多種模態的資料集，必須把問題拆成較小的、以 Prompt 為單位的任務。例如，要解讀一張圖，圖裡有一張帶內嵌文字的圖片、幾個標示特定文字片段的標籤，還有一張解釋各標籤的表格──這就需要這樣的做法：

* Prompt 1：從使用者的圖片請求中抽取並理解文字。
* Prompt 2：把抽出來的圖片文字與對應的標籤連結起來。
* Prompt 3：借助表格解讀蒐集到的資訊，得出需要的輸出。

# 實作範例

實作 Prompt Chaining 的方式，從在腳本裡直接循序呼叫函式，到使用專門管理控制流程、狀態與元件整合的框架都有。LangChain、LangGraph、CrewAI、Google Agent Development Kit（ADK）這些框架，為建構和執行多步驟流程提供了結構化的環境，對複雜的架構特別有幫助。

作為示範，LangChain 和 LangGraph 是合適的選擇，因為它們的核心 API 就是為了組合操作的鏈（chain）和圖（graph）而設計的。LangChain 為線性序列提供基礎抽象，LangGraph 則進一步支援有狀態和循環式的計算，這是實作更精密的 Agentic 行為所必需的。這個範例聚焦在基本的線性序列。

下面的程式碼實作了一條兩步驟的 Prompt 鏈，功能像一條資料處理的 pipeline：第一階段負責解析非結構化文字、抽取特定資訊；第二階段接收抽取出的結果，把它轉換成結構化的資料格式。

要重現這個流程，先安裝需要的函式庫：

```bash
pip install langchain langchain-community langchain-openai langgraph
```

注意，如果你用別家的模型供應商，把 langchain-openai 換成對應的套件即可。接著要在執行環境設定好所選語言模型供應商（例如 OpenAI、Google Gemini 或 Anthropic）的 API 憑證。

```python
import os 
from langchain_openai import ChatOpenAI 
from langchain_core.prompts import ChatPromptTemplate 
from langchain_core.output_parsers import StrOutputParser 

# For better security, load environment variables from a .env file 
# from dotenv import load_dotenv 
# load_dotenv() 
# Make sure your OPENAI_API_KEY is set in the .env file 

# Initialize the Language Model (using ChatOpenAI is recommended) 

llm = ChatOpenAI(temperature=0) 

# --- Prompt 1: Extract Information ---

prompt_extract = ChatPromptTemplate.from_template(
    "Extract the technical specifications from the following text:\n\n{text_input}" 
) 

# --- Prompt 2: Transform to JSON --- 

prompt_transform = ChatPromptTemplate.from_template(
    "Transform the following specifications into a JSON object with 'cpu', 'memory', and 'storage' as keys:\n\n{specifications}" 
) 

# --- Build the Chain using LCEL --- 
# The StrOutputParser() converts the LLM's message output to a simple string. 
extraction_chain = prompt_extract | llm | StrOutputParser() 

# The full chain passes the output of the extraction chain into the 'specifications' 
# variable for the transformation prompt. 
full_chain = (    
    {"specifications": extraction_chain}
        | 
    prompt_transform
        | 
    llm
        | 
    StrOutputParser() 
) 

# --- Run the Chain --- 

input_text = "The new laptop model features a 3.5 GHz octa-core processor, 16GB of RAM, and a 1TB NVMe SSD." 

# Execute the chain with the input text dictionary. 
final_result = full_chain.invoke({"text_input": input_text})
print("\n--- Final JSON Output ---")
print(final_result)
```

這段 Python 程式碼示範了如何用 LangChain 處理文字。它用了兩個獨立的 Prompt：一個從輸入字串中抽取技術規格，另一個把這些規格整理成 JSON 物件。與語言模型的互動透過 ChatOpenAI 模型進行，StrOutputParser 則確保輸出是可直接使用的字串格式。兩個 Prompt 和語言模型之間，用 LangChain Expression Language（LCEL）優雅地串接起來。第一條鏈 `extraction_chain` 負責抽取規格；`full_chain` 再接手抽取的輸出，把它作為轉換 Prompt 的輸入。範例提供了一段描述筆電的輸入文字，用它呼叫 `full_chain`，讓文字走完兩個步驟。最後印出的結果，是一個包含抽取並格式化後規格的 JSON 字串。

## Context Engineering 與 Prompt Engineering

Context Engineering（上下文工程，見圖 1）是一門有系統的學問：在 AI 模型開始生成 token 之前，為它設計、建構並交付一個完整的資訊環境。這套方法的主張是：模型輸出的品質，與其說取決於模型架構本身，不如說取決於所提供上下文的豐富程度。

![Context Engineering](/assets/agentic-design-patterns/Context_Engineering.png)

圖 1：Context Engineering 是為 AI 建構豐富、完整資訊環境的學問；上下文的品質，是讓 Agent 發揮進階能力的首要因素。

它是傳統 Prompt Engineering 的一次重要升級。傳統 Prompt Engineering 主要在琢磨使用者當下那句查詢的措辭；Context Engineering 把範圍擴大到好幾層資訊。其中包括**系統 Prompt（system prompt）**，也就是定義 AI 運作參數的基礎指令集，例如「你是一位技術文件寫手，語氣必須正式且精確」。上下文還會再加入外部資料：包括檢索來的文件（AI 主動從知識庫撈資訊來支撐回應，例如調出某專案的技術規格），也包括工具輸出（AI 呼叫外部 API 拿到的即時資料，例如查行事曆確認使用者何時有空）。這些明確的資料，再跟關鍵的隱含資料結合：使用者身分、互動歷史、環境狀態。核心原則是：就算是最先進的模型，如果拿到的是殘缺或拼裝得很差的環境視圖，表現一樣會掉下來。

因此，這個實踐把任務重新定義了：不再只是回答一個問題，而是為 Agent 建立一幅完整的運作全貌。舉例來說，一個做過 Context Engineering 的 Agent 不會只是回應查詢，而是會先整合使用者的行事曆空檔（工具輸出）、與 email 收件人的職場關係（隱含資料）、之前會議的筆記（檢索來的文件）。這讓模型能生成高度相關、個人化、真正有用的輸出。「工程」的部分則在於：建立穩固的 pipeline，在執行期抓取並轉換這些資料，並建立回饋循環來持續改善上下文品質。

實作上，可以用專門的調校系統來大規模自動化這個改善過程。例如 Google 的 Vertex AI prompt optimizer 這類工具，能拿一組樣本輸入和預先定義的評估指標，有系統地評估模型的回應，藉此提升表現。這種做法能讓 Prompt 和系統指令跨不同模型調整，不需要大量人工重寫。只要提供這種最佳化工具樣本 Prompt、系統指令和一個模板，它就能用程式化的方式改進上下文輸入，為精密的 Context Engineering 所需的回饋循環提供一套有結構的實作方法。

這種結構化的做法，正是「陽春的 AI 工具」和「更精密、有情境感知能力的系統」之間的分野。它把上下文本身當成第一級的元件來對待：Agent 知道什麼、什麼時候知道、怎麼使用這些資訊，都至關重要。這個實踐確保模型對使用者的意圖、歷史和當前環境有全面的理解。歸結起來，Context Engineering 是把無狀態的聊天機器人，升級成有高度能力、能感知情境的系統的關鍵方法。

## 速覽

**問題：** 複雜任務塞進單一 Prompt 裡，常常會壓垮 LLM，導致明顯的表現問題。模型的認知負荷一高，各種錯誤的機率就上升：漏看指令、跟丟上下文、生成錯誤資訊。一個龐大的單體 Prompt 很難同時管好多重約束和循序的推理步驟，結果就是輸出不可靠、不準確，因為 LLM 沒辦法照顧到多面向請求的每一個環節。

**解法：** Prompt Chaining 提供了一個標準化的解法：把複雜問題拆成一串更小、環環相扣的子任務。鏈中的每一步都用一個聚焦的 Prompt 執行特定操作，可靠性和可控性都大幅提升。一個 Prompt 的輸出作為下一個的輸入，形成一條逐步逼近最終解答的邏輯工作流程。這種模組化、分而治之的策略讓流程更好掌控、更容易除錯，也允許在步驟之間整合外部工具或結構化資料格式。這個模式是打造精密多步驟 Agentic 系統的基礎──讓系統能規劃、推理、執行複雜的工作流程。

**經驗法則：** 當任務對單一 Prompt 來說太複雜、包含多個明確的處理階段、步驟之間需要跟外部工具互動，或者你在打造需要多步推理和狀態維護的 Agentic 系統時，就用這個模式。

**圖解：**

![Prompt Chaining 模式](/assets/agentic-design-patterns/Prompt_Chaining_Pattern.png)

圖 2：Prompt Chaining 模式──Agent 接收使用者的一系列 Prompt，每個 Agent 的輸出作為鏈中下一個的輸入。

## 重點回顧

幾個重點：

* Prompt Chaining 把複雜任務拆成一連串更小、更聚焦的步驟，有時也稱為 Pipeline 模式。
* 鏈中的每一步是一次 LLM 呼叫或一段處理邏輯，以前一步的輸出作為輸入。
* 這個模式提升了與語言模型複雜互動的可靠性和可管理性。
* LangChain／LangGraph、Google ADK 這些框架，為定義、管理和執行這些多步驟序列提供了穩固的工具。

## 結語

透過把複雜問題拆解成一連串更簡單、更好處理的子任務，Prompt Chaining 為引導大型語言模型提供了一個穩健的框架。這種分而治之的策略讓模型一次只專注一件事，輸出的可靠性和可控性都顯著提升。作為一個基礎模式，它讓我們能開發出具備多步推理、工具整合與狀態管理能力的精密 AI Agent。說到底，掌握 Prompt Chaining，是打造穩健、有情境感知能力、能執行遠超單一 Prompt 能力範圍的複雜工作流程系統的關鍵。

## 參考資料

1. LangChain Documentation on LCEL: [https://python.langchain.com/v0.2/docs/core_modules/expression_language/](https://python.langchain.com/v0.2/docs/core_modules/expression_language/)
2. LangGraph Documentation: [https://langchain-ai.github.io/langgraph/](https://langchain-ai.github.io/langgraph/)
3. Prompt Engineering Guide - Chaining Prompts: [https://www.promptingguide.ai/techniques/chaining](https://www.promptingguide.ai/techniques/chaining)
4. OpenAI API Documentation (General Prompting Concepts): [https://platform.openai.com/docs/guides/gpt/prompting](https://platform.openai.com/docs/guides/gpt/prompting)
5. Crew AI Documentation (Tasks and Processes): [https://docs.crewai.com/](https://docs.crewai.com/)
6. Google AI for Developers (Prompting Guides): [https://cloud.google.com/discover/what-is-prompt-engineering?hl=en](https://cloud.google.com/discover/what-is-prompt-engineering?hl=en)
7. Vertex Prompt Optimizer: [https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-optimizer](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-optimizer)
