---
title: "Agentic Design Patterns 附錄 A：進階 Prompt 技巧"
description: "從 System Prompt、CoT 到 ReAct，進階 Prompt 技巧總整理。《Agentic Design Patterns》附錄 A 繁體中文翻譯。"
pubDatetime: 2026-07-18T20:38:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

## Prompt 簡介

Prompt 是我們跟語言模型互動的主要介面，簡單說就是「設計輸入，引導模型產生我們想要的輸出」的過程。這裡面包含幾件事：把請求組織好、提供相關的上下文、指定輸出格式，以及示範我們期待的回應類型。設計得好的 Prompt 能把語言模型的潛力發揮到極致，讓它給出準確、切題又有創意的回應。反過來說，設計不良的 Prompt 就容易得到模糊、不相關甚至錯誤的輸出。

Prompt Engineering（提示工程）的目標，是讓語言模型能穩定地產出高品質回應。這需要你了解模型的能力與限制在哪裡，並且能把想達成的目標清楚傳達出去。換句話說，就是透過學習「怎麼最好地指揮 AI」，培養出跟 AI 溝通的專業能力。

這篇附錄會詳細介紹一系列超越基本互動方式的 Prompt 技巧，涵蓋如何組織複雜的請求、強化模型的推理能力、控制輸出格式，以及整合外部資訊。這些技巧適用於各種應用，從簡單的聊天機器人到複雜的 Multi-Agent 系統都用得上，能提升 Agentic 應用的效能與可靠度。

Agentic 模式是建構智慧系統的架構，本書正文有詳細說明。這些模式定義了 Agent 如何規劃、如何使用工具、如何管理記憶、如何協作。而這些 Agentic 系統能不能發揮效果，關鍵在於它們能不能跟語言模型做出有意義的互動。

## 核心 Prompt 原則

有效 Prompt 語言模型的核心原則：

有效的 Prompt 建立在幾個跟語言模型溝通的基本原則上，這些原則適用於各種模型、各種任務複雜度。把這些原則掌握好，才能穩定地產出有用又準確的回應。

**清楚且具體**：指令要明確、精準，不要有歧義。語言模型是靠解讀模式運作的；一句話如果有多種解釋，就可能導致預期外的回應。你要把任務、想要的輸出格式，以及任何限制或要求都定義清楚，避免模糊的措辭或未言明的假設。Prompt 寫得不夠充分，就會得到模糊、不準確的回應，讓有意義的輸出變得很難產生。

**精簡**：具體固然重要，但不能因此犧牲精簡。指令要直接了當。多餘的字句或複雜的句構會讓模型搞混，或是把主要指令淹沒掉。Prompt 要簡單：讓使用者看了都覺得困惑的東西，模型多半也會困惑。避免拐彎抹角的語言和多餘的資訊，用直接的措辭和主動動詞把想要的動作講清楚。好用的動詞包括：執行、分析、分類、歸類、對比、比較、建立、描述、定義、評估、提取、尋找、生成、辨識、列出、測量、組織、解析、挑選、預測、提供、排序、推薦、返回、檢索、重寫、選擇、顯示、整理、摘要、翻譯、撰寫。

**善用動詞：** 動詞的選擇是 Prompt 的一大工具。動作動詞能明確指出你期待的操作。與其說「想想看怎麼摘要這段」，不如直接下指令「摘要以下文字」來得有效。精準的動詞能引導模型去啟動跟該任務相關的訓練資料與處理流程。

**用指令，別用限制：** 正面的指令通常比負面的限制有效。與其列出「不要做什麼」，不如直接指定「要做什麼」。限制當然有它的用處，例如安全考量或嚴格的格式要求；但過度依賴限制，會讓模型把注意力放在「避免踩雷」而不是達成目標上。所以要用正面引導的方式來寫 Prompt。正面指令也比較符合人類接受指導的習慣，能減少混淆。

**實驗與迭代：** Prompt Engineering 是一個反覆迭代的過程。要找到最有效的 Prompt，往往得試好幾次。先寫個初稿，測測看，分析輸出，找出不足，再回頭修改。換不同模型、調不同設定（例如 temperature 或 top-p）、甚至只是措辭微調，都可能得到不同結果。把每次嘗試記錄下來，對學習和改進非常重要。想達到理想的效果，實驗和迭代是免不了的。

這些原則構成了跟語言模型有效溝通的基礎。把清楚、精簡、動作動詞、正面指令和迭代這幾件事放在優先位置，就等於打好了地基，可以進一步套用更進階的 Prompt 技巧。

## 基礎 Prompt 技巧

在核心原則之上，有幾個基礎技巧會提供語言模型不同程度的資訊或範例，用來引導它的回應。這些方法算是 Prompt Engineering 的入門階段，對很多應用都很有效。

### Zero-Shot Prompting（零樣本）

Zero-shot prompting 是最基本的 Prompt 形式：你只給模型指令和輸入資料，完全不提供任何「輸入對應輸出」的範例。它完全靠模型預訓練學到的東西來理解任務、產生相關回應。本質上，一個 zero-shot 的 Prompt 就是「一段任務描述」加上「一段開頭的文字」。

* **什麼時候用：** 如果任務是模型在訓練時很可能大量接觸過的，例如簡單的問答、文字補完、或直白文字的基本摘要，zero-shot 通常就夠了。它也是最快能先試一輪的做法。
* **範例：**
  Translate the following English sentence to French: 'Hello, how are you?'

### One-Shot Prompting（單樣本）

One-shot prompting 是在丟出實際任務之前，先給模型看一個「輸入以及對應的期望輸出」的範例。這個範例當作一次示範，讓模型知道它該複製的是什麼模式。目的是給模型一個具體的樣本當範本，好讓它把任務執行得更到位。

* **什麼時候用：** 當你想要的輸出格式或風格比較特殊、比較少見時，one-shot 就很有用。它給了模型一個具體可學的樣本。對於需要特定結構或語氣的任務，它的表現通常會比 zero-shot 好。
* **範例：**
  Translate the following English sentences to Spanish:
  English: 'Thank you.'
  Spanish: 'Gracias.'

  English: 'Please.'
  Spanish:

### Few-Shot Prompting（少樣本）

Few-shot prompting 是 one-shot 的加強版，一次提供好幾個（通常三到五個）「輸入對應輸出」的範例。這樣做能把期待的回應模式呈現得更清楚，提高模型在面對新輸入時複製這個模式的機率。簡單說，就是用多個範例引導模型去遵循某個特定的輸出模式。

* **什麼時候用：** Few-shot 特別適合那些輸出需要遵循特定格式、風格，或帶有細微變化的任務。像是分類、要照特定 schema 的資料抽取、或用某種風格生成文字，都很適合；尤其是當 zero-shot 或 one-shot 給不出穩定結果的時候。一般的經驗法則是至少用三到五個範例，再依任務複雜度和模型的 token 上限去調整。
* **範例的品質與多樣性很重要：** Few-shot 有沒有效，很大程度取決於你給的範例品質和多樣性。範例要準確、要能代表這個任務，而且要涵蓋模型可能遇到的各種變化或邊界情況。高品質、寫得好的範例非常關鍵；哪怕只是一個小錯誤，都可能把模型帶偏、產出不理想的結果。範例夠多樣，也能幫助模型更好地推廣到沒見過的輸入上。
* **分類任務的範例要把類別打散：** 如果你是用 few-shot 做分類任務（也就是要把輸入歸到預先定好的類別），最佳實踐是把不同類別的範例順序打散混合。這能避免模型過度擬合到某個特定的範例排列順序，確保它學到的是「每個類別各自的關鍵特徵」，這樣在沒見過的資料上才會更穩健、更能推廣。
* **邁向「Many-Shot」學習：** 隨著 Gemini 這類現代 LLM（大型語言模型）在長上下文建模上愈來愈強，它們在運用「many-shot（多樣本）」學習方面也變得非常有效。這意味著現在對於複雜任務，你可以直接在 Prompt 裡塞進更大量的範例（有時甚至上百個）來達到最佳效果，讓模型學到更精細的模式。
* **範例：**
  Classify the sentiment of the following movie reviews as POSITIVE, NEUTRAL, or NEGATIVE:

  Review: "The acting was superb and the story was engaging."
  Sentiment: POSITIVE

  Review: "It was okay, nothing special."
  Sentiment: NEUTRAL

  Review: "I found the plot confusing and the characters unlikable."
  Sentiment: NEGATIVE

  Review: "The visuals were stunning, but the dialogue was weak."
  Sentiment:

搞懂什麼時候該用 zero-shot、one-shot、few-shot，並且用心設計、編排你的範例，是提升 Agentic 系統效能的關鍵。這些基礎方法是各種 Prompt 策略的地基。

## Prompt 的結構設計

除了「提供範例」這類基礎技巧之外，你怎麼安排 Prompt 的結構，對引導語言模型也扮演關鍵角色。所謂結構化，就是在 Prompt 裡用不同的區塊或元素，清楚有序地放進不同類型的資訊，例如指令、上下文、範例。這能幫助模型正確解析 Prompt，弄清楚每段文字各自扮演什麼角色。

### System Prompting（系統提示）

System prompting 為語言模型設定整體的上下文與目的，界定它在一次互動或一段對話中該有的行為。做法是提供一些指令或背景資訊，用來建立規則、人設，或整體的行為方針。跟具體的使用者提問不同，system prompt 提供的是模型回應時的基礎準則。它會影響模型在整段互動裡的語氣、風格和整體取向。舉例來說，system prompt 可以要求模型一律簡潔又有幫助地回應，或確保輸出適合一般大眾。System prompt 也常被拿來做安全與內容控管，例如加入「保持用語得體」這類準則。

此外，為了讓效果最大化，system prompt 還可以透過「以 LLM 進行迭代精修」的方式做自動最佳化。像 Vertex AI Prompt Optimizer 這類服務，就是根據使用者定義的指標和目標資料，有系統地改進 Prompt，確保在特定任務上達到最好的表現。

* **範例：**
  You are a helpful and harmless AI assistant. Respond to all queries in a polite and informative manner. Do not generate content that is harmful, biased, or inappropriate

### Role Prompting（角色提示）

Role prompting 是給語言模型指派一個特定的角色、人設或身分，通常會搭配 system 或上下文提示一起用。做法是指示模型採用跟那個角色相關的知識、語氣和溝通風格。例如「扮演一位旅遊嚮導」或「你是一位資深資料分析師」這類 Prompt，就能引導模型呈現出該角色的視角與專業。定義好角色，等於為語氣、風格和專業聚焦提供了一個框架，目的是提升輸出的品質與相關性。你甚至可以指定角色底下的風格，例如「幽默又激勵人心的風格」。

* **範例：**
  Act as a seasoned travel blogger. Write a short, engaging paragraph about the best hidden gem in Rome.

### 使用分隔符（Delimiters）

有效的 Prompt 需要把指令、上下文、範例和輸入清楚區分開來給模型看。你可以用分隔符來做這件事，例如三個反引號（```）、XML 標籤（<instruction>、<context>）或標記符號（---），在視覺上和程式處理上把這些區塊分開。這在 Prompt Engineering 裡是很常見的做法，能降低模型誤解的機率，讓它清楚知道 Prompt 各部分各自的角色。

* **範例：**
  <instruction>Summarize the following article, focusing on the main arguments presented by the author.</instruction>
  <article>
  [Insert the full text of the article here]
  </article>

## 上下文工程（Context Engineering）

上下文工程跟靜態的 system prompt 不一樣，它會動態地提供對任務和對話至關重要的背景資訊。這種會不斷變動的資訊，能幫助模型抓住細微差異、回想起先前的互動、整合相關細節，進而產出有依據的回應、讓交流更順暢。這類資訊包括先前的對話、相關文件（例如 Retrieval Augmented Generation 中用到的），或特定的操作參數。舉個例子，當你在聊去日本旅行時，可以接著問「東京有哪三個適合全家的活動」，這就利用了既有的對話上下文。在 Agentic 系統裡，上下文工程是 Agent 核心行為的根本，例如記憶的持續、決策，以及跨子任務的協調。有動態上下文管線的 Agent，能夠長時間維持目標、隨時調整策略，並與其他 Agent 或工具無縫協作——這些正是長期自主運作所需要的特質。這套方法論主張：模型輸出的品質，更多取決於所提供上下文的豐富程度，而不是模型架構本身。它代表了從傳統 Prompt Engineering 的一次重大演進：傳統做法主要在優化眼前這句使用者提問的措辭，而上下文工程把範圍擴大到多個層次的資訊。

這些層次包括：

* **System prompt：** 界定 AI 運作參數的基礎指令（例如「你是一位技術文件作者；語氣必須正式且精確」）。
* **外部資料：**
  * **檢索到的文件：** 從知識庫主動抓取、用來輔助回應的資訊（例如拉出技術規格）。
  * **工具輸出：** AI 呼叫外部 API 取得即時資料的結果（例如查詢行事曆有沒有空檔）。
* **隱含資料：** 一些關鍵資訊，例如使用者身分、互動歷史、環境狀態。把隱含上下文納進來會帶出隱私和資料倫理管理的挑戰。因此，穩固的治理機制對上下文工程來說很重要，尤其在企業、醫療、金融這些領域。

核心原則是：就算是很先進的模型，如果對它所處的運作環境只有片面或建構不當的認知，表現一樣會打折扣。這種做法把任務從「單純回答一個問題」重新定義成「為 Agent 建立一幅完整的運作全貌」。舉例來說，一個經過上下文工程設計的 Agent，在回應查詢之前，會先整合使用者行事曆的空檔（工具輸出）、與收件者之間的專業關係（隱含資料），以及先前會議的筆記（檢索到的文件）。這讓模型能產出高度相關、個人化、而且實際好用的輸出。這裡的「工程」成分，在於建立穩固的管線，在執行時去抓取並轉換這些資料，同時建立回饋迴路來持續提升上下文的品質。

要落實這件事，可以用專門的調校系統，例如 Google 的 Vertex AI prompt optimizer，把改進過程大規模自動化。這類工具會拿樣本輸入配上預先定義的指標，有系統地評估回應，藉此提升模型表現，並在不同模型之間調整 Prompt 和系統指令，不用大量手動重寫。你只要給最佳化工具一些樣本 Prompt、系統指令和一個範本，它就能程式化地精修上下文輸入，為複雜的上下文工程提供一套有結構的方式來實作所需的回饋迴路。

這種有結構的做法，正是把陽春的 AI 工具跟更成熟、有情境意識的系統區分開來的關鍵。它把上下文當成第一級的組成要素，強調 Agent 知道什麼、什麼時候知道、以及怎麼運用這些資訊。這樣做能確保模型對使用者的意圖、歷史和當前環境有全面的理解。歸根結柢，上下文工程是把無狀態的聊天機器人，轉變成高能力、有情境意識系統的關鍵方法論。

## 結構化輸出

很多時候，Prompt 的目標不只是拿到一段自由格式的文字回應，而是要用某種特定、機器可讀的格式把資訊抽取或生成出來。要求結構化輸出（例如 JSON、XML、CSV 或 Markdown 表格）是一項重要的結構化技巧。你明確要求某種格式的輸出，並且盡量提供期望結構的 schema 或範例，就能引導模型把回應組織成「其他系統或應用元件容易解析、容易使用」的樣子。要求模型回傳 JSON 物件來做資料抽取有個好處：它會逼模型去建立一個結構，也能減少幻覺（hallucination）。建議多實驗不同的輸出格式，尤其是抽取或分類資料這種非創意類的任務。

* **範例：**
  Extract the following information from the text below and return it as a JSON object with keys `name`, `address`, and `phone.number`.

  Text: "Contact John Smith at 123 Main St, Anytown, CA or call (555) 123-4567."

善用 system prompt、角色指派、上下文資訊、分隔符和結構化輸出，能大幅提升跟語言模型互動時的清晰度、可控性和實用性，為打造可靠的 Agentic 系統打下扎實基礎。當你要建立「語言模型的輸出會成為後續系統或處理步驟輸入」的管線時，要求結構化輸出更是關鍵。

**用 Pydantic 做物件導向的門面：** 有一個很強的技巧能兼顧「強制結構化輸出」和「提升互通性」，那就是把 LLM 生成的資料拿去填進 Pydantic 物件的實例。Pydantic 是一個 Python 函式庫，用 Python 型別註記來做資料驗證與設定管理。你只要定義一個 Pydantic 模型，就等於為你想要的資料結構建立了一個清楚、可強制執行的 schema。這種做法等於為 Prompt 的輸出加上一層物件導向的門面，把原始文字或半結構化資料轉成經過驗證、帶型別提示的 Python 物件。

你可以用 `model.validate.json` 方法，直接把 LLM 給的 JSON 字串解析成 Pydantic 物件。這特別實用，因為它把「解析」和「驗證」合併成一個步驟。

```python
from pydantic import BaseModel, EmailStr, Field, ValidationError
from typing import List, Optional
from datetime import date


# --- Pydantic Model Definition (from above) ---
class User(BaseModel):
    name: str = Field(..., description="The full name of the user.")
    email: EmailStr = Field(..., description="The user's email address.")
    date_of_birth: Optional[date] = Field(None, description="The user's date of birth.")
    interests: List[str] = Field(default_factory=list, description="A list of the user's interests.")


# --- Hypothetical LLM Output ---
llm_output_json = """
{
    "name": "Alice Wonderland",
    "email": "alice.w@example.com",
    "date_of_birth": "1995-07-21",
    "interests": [
        "Natural Language Processing",
        "Python Programming",
        "Gardening"
    ]
}
"""


# --- Parsing and Validation ---
try:
    # Use the model_validate_json class method to parse the JSON string.
    # This single step parses the JSON and validates the data against the User model.
    user_object = User.model_validate_json(llm_output_json)

    # Now you can work with a clean, type-safe Python object.
    print("Successfully created User object!")
    print(f"Name: {user_object.name}")
    print(f"Email: {user_object.email}")
    print(f"Date of Birth: {user_object.date_of_birth}")
    print(f"First Interest: {user_object.interests[0]}")

    # You can access the data like any other Python object attribute.
    # Pydantic has already converted the 'date_of_birth' string to a datetime.date object.
    print(f"Type of date_of_birth: {type(user_object.date_of_birth)}")
except ValidationError as e:
    # If the JSON is malformed or the data doesn't match the model's types,
    # Pydantic will raise a ValidationError.
    print("Failed to validate JSON from LLM.")
    print(e)
```

這段 Python 程式碼示範了怎麼用 Pydantic 函式庫定義資料模型並驗證 JSON 資料。它定義了一個 User 模型，包含 name、email、出生日期和 interests 幾個欄位，附上型別提示和說明。接著程式用 User 模型的 `model.validate.json` 方法，去解析一段假想的 LLM（大型語言模型）JSON 輸出。這個方法會依照模型的結構和型別，一併處理 JSON 解析和資料驗證。最後，程式從解析出來的 Python 物件讀取已驗證的資料，並針對「JSON 無效」的情況加上 ValidationError 的錯誤處理。

如果是 XML 資料，可以用 xmltodict 函式庫把 XML 轉成 dictionary，再把它傳給 Pydantic 模型去解析。透過在 Pydantic 模型裡使用 Field 別名（alias），你就能把 XML 那種往往冗長、屬性一堆的結構，順順地對應到物件的欄位上。

這套方法論對於確保「以 LLM 為基礎的元件」能跟大系統其他部分互通，價值非常高。當一個 LLM 的輸出被封裝在 Pydantic 物件裡，你就能放心地把它傳給其他函式、API 或資料處理管線，因為資料已經保證符合預期的結構與型別。在系統元件的邊界上實踐這種「parse, don't validate（解析，而非驗證）」的原則，能讓應用更穩健、更好維護。

善用 system prompt、角色指派、上下文資訊、分隔符和結構化輸出，能大幅提升跟語言模型互動時的清晰度、可控性和實用性，為打造可靠的 Agentic 系統打下扎實基礎。當你要建立「語言模型的輸出會成為後續系統或處理步驟輸入」的管線時，要求結構化輸出更是關鍵。

Prompt 的結構設計：除了「提供範例」這類基礎技巧之外，你怎麼安排 Prompt 的結構，對引導語言模型也扮演關鍵角色。所謂結構化，就是在 Prompt 裡用不同的區塊或元素，清楚有序地放進不同類型的資訊，例如指令、上下文、範例。這能幫助模型正確解析 Prompt，弄清楚每段文字各自扮演什麼角色。

# 推理與思考流程技巧

大型語言模型很擅長辨識模式和生成文字，但碰到需要複雜、多步驟推理的任務時，常常會卡關。這一節聚焦在一些技巧，透過鼓勵模型把內部的思考過程攤開來，強化它的推理能力。具體來說，會談到怎麼改善邏輯推演、數學運算和規劃。

## Chain of Thought（CoT，思維鏈）

Chain of Thought（CoT）是提升語言模型推理能力的一個強大方法，做法是明確要求模型在給出最終答案之前，先產生中間的推理步驟。你不是只要它給結果，而是指示它「一步一步想（think step by step）」。這個過程模擬了人在解題時，會把問題拆成更小、更好處理的部分，再一步步依序解決。

CoT 能幫 LLM 給出更準確的答案，特別是那種需要某種計算或邏輯推演的任務——這類任務模型本來很容易卡住、產出錯誤結果。透過生成這些中間步驟，模型比較能一路保持在正確軌道上，把該做的運算正確做完。

CoT 主要有兩種變體：

* **Zero-Shot CoT：** 就是在 Prompt 裡簡單加上「Let's think step by step（讓我們一步一步想）」（或類似的措辭），完全不提供任何推理過程的範例。令人意外的是，對很多任務來說，光是加這一句就能大幅提升模型表現，因為它觸發了模型「把內部推理軌跡攤開來」的能力。
  * **範例（Zero-Shot CoT）：**
    If a train travels at 60 miles per hour and covers a distance of 240 miles, how long did the journey take? Let's think step by step.

* **Few-Shot CoT：** 這是把 CoT 跟 few-shot 結合起來。你給模型好幾個範例，範例裡同時呈現輸入、逐步推理過程和最終輸出。這給了模型一個更清楚的範本，示範怎麼推理、怎麼組織回應，在比較複雜的任務上，結果往往比 zero-shot CoT 還要好。
  * **範例（Few-Shot CoT）：**
    Q: The sum of three consecutive integers is 36. What are the integers?
    A: Let the first integer be x. The next consecutive integer is x+1, and the third is x+2. The sum is x + (x+1) + (x+2) = 3x + 3. We know the sum is 36, so 3x + 3 = 36. Subtract 3 from both sides: 3x = 33. Divide by 3: x = 11. The integers are 11, 11+1=12, and 11+2=13. The integers are 11, 12, and 13.

    Q: Sarah has 5 apples, and she buys 8 more. She eats 3 apples. How many apples does she have left? Let's think step by step.
    A: Let's think step by step. Sarah starts with 5 apples. She buys 8 more, so she adds 8 to her initial amount: 5 + 8 = 13 apples. Then, she eats 3 apples, so we subtract 3 from the total: 13 - 3 = 10. Sarah has 10 apples left. The answer is 10.

CoT 有幾個好處。它實作起來相對省事，而且不用微調（fine-tuning），拿現成的 LLM 就能很有效。一個重要的好處是模型輸出的可解釋性變高了；你看得到它走過的推理步驟，這有助於理解它為什麼得出某個答案，出問題時也比較好除錯。另外，CoT 似乎能提升 Prompt 在不同版本語言模型之間的穩健性，也就是說模型更新後，表現比較不容易退步。主要缺點是生成推理步驟會拉長輸出，導致 token 用量變多，可能增加成本和回應時間。

CoT 的最佳實踐包括：確保最終答案放在推理步驟*之後*，因為推理的生成會影響後面答案 token 的預測。另外，對於只有單一正確答案的任務（例如數學題），用 CoT 時建議把模型的 temperature 設成 0（貪婪解碼），讓它在每一步都確定性地選出機率最高的下一個 token。

## Self-Consistency（自我一致性）

Self-Consistency 建立在 Chain of Thought 的基礎上，目標是利用語言模型的機率特性來提升推理的可靠度。它不像基本 CoT 那樣只靠單一條貪婪的推理路徑，而是針對同一個問題生成多條不同的推理路徑，再從中挑出最一致的答案。

Self-Consistency 主要有三個步驟：

1. **生成多樣的推理路徑：** 把同一個 Prompt（通常是 CoT Prompt）送給 LLM 好幾次。透過調高 temperature，鼓勵模型去探索不同的推理取向，生成各式各樣的逐步說明。
2. **抽取答案：** 從每一條生成的推理路徑裡，把最終答案抽出來。
3. **選出最常出現的答案：** 對抽出來的答案做多數決。在這些不同推理路徑中出現最頻繁的那個答案，就被選為最終、最一致的答案。

這種做法能提升回應的準確度和連貫性，特別適合那種可能存在多條有效推理路徑、或模型單次嘗試容易出錯的任務。好處是它給出了答案為正確的「類機率」估計，整體準確度因此提高。但代價也很明顯：同一個查詢要跑模型很多次，計算量和花費都會大幅增加。

* **範例（概念示意）：**
  * *Prompt：*「'All birds can fly' 這句話是對還是錯？請解釋你的推理。」
  * *模型第 1 次執行（高 temperature）：* 推理大多數鳥都會飛，結論是「對」。
  * *模型第 2 次執行（高 temperature）：* 推理企鵝、鴕鳥等例外，結論是「錯」。
  * *模型第 3 次執行（高 temperature）：* 就鳥類*整體而言*來推理，簡短提及例外，結論是「對」。
  * *Self-Consistency 結果：* 依多數決（「對」出現兩次），最終答案是「對」。（註：更精細的做法會把推理品質也納入權衡。）

## Step-Back Prompting（後退提示）

Step-back prompting 強化推理的方式，是先請語言模型思考一個跟任務相關的一般性原則或概念，之後再去處理具體細節。對這個較廣泛問題的回應，接著會被拿來當作解決原始問題的上下文。

這個過程讓語言模型能啟動相關的背景知識和更宏觀的推理策略。藉由聚焦在底層原則或更高層次的抽象，模型能給出更準確、更有洞見的答案，比較不會被表面的枝節帶著走。先考慮一般性的因素，也能為後續生成具體的創意輸出打下更穩的基礎。Step-back prompting 鼓勵批判性思考和知識的運用，並可能因為強調一般性原則而減輕偏見。

* **範例：**
  * *Prompt 1（後退）：*「一個好的偵探故事，關鍵要素有哪些？」
  * *模型回應 1：*（列出諸如故弄玄虛的假線索、令人信服的動機、有缺陷的主角、合乎邏輯的線索、令人滿意的收尾等要素。）
  * *Prompt 2（原始任務＋後退得到的上下文）：*「運用一個好偵探故事的這些關鍵要素 [insert Model Response 1 here]，為一部設定在小鎮的新推理小說寫一段簡短的情節大綱。」

## Tree of Thoughts（ToT，思維樹）

Tree of Thoughts（ToT）是一種進階推理技巧，把 Chain of Thought 方法再往前擴展。它讓語言模型能同時探索多條推理路徑，而不是只沿著單一條線性路徑走下去。這個技巧用的是樹狀結構，每個節點代表一個「思維（thought）」——一段連貫的語言序列，充當中間步驟。從每個節點出發，模型都可以分岔出去，探索不同的推理路線。

ToT 特別適合那種需要探索、回溯，或在得出解答前評估多種可能性的複雜問題。雖然它比線性的 Chain of Thought 計算量更大、實作也更複雜，但在需要深思熟慮、探索式解題的任務上，ToT 能拿到更好的結果。它讓 Agent 能考量不同的視角，並在「思維樹」裡調查其他分支，藉此從一開始的錯誤中恢復過來。

* **範例（概念示意）：** 對於「根據這些情節點，為一個故事發展出三種不同的可能結局」這類複雜的創意寫作任務，ToT 會讓模型從某個關鍵轉折點探索不同的敘事分支，而不是只生成一條線性的延續。

這些推理與思考流程技巧，對於打造「能處理超越單純資訊檢索或文字生成之任務」的 Agent 很關鍵。透過提示模型攤開推理、考量多重視角、或後退到一般性原則，我們能大幅強化它在 Agentic 系統裡執行複雜認知任務的能力。

# 行動與互動技巧

智慧型 Agent 不只會生成文字，還具備主動與環境互動的能力。這包括使用工具、執行外部函式，以及參與「觀察、推理、行動」的反覆迴圈。這一節會探討讓這些主動行為得以實現的 Prompt 技巧。

## Tool Use / Function Calling（工具使用／函式呼叫）

Agent 有一個關鍵能力，就是使用外部工具或呼叫函式，去執行它內部做不到的動作。這些動作可能包括網路搜尋、存取資料庫、寄送電子郵件、進行計算，或與外部 API 互動。要為工具使用寫出有效的 Prompt，重點是設計出「能告訴模型在什麼時機、用什麼方式使用工具」的指令。

現代語言模型通常會針對「function calling」或「tool use」做過微調。這讓它們能讀懂可用工具的描述，包括工具的用途和參數。收到使用者請求後，模型能判斷是否需要用工具、辨識出合適的工具，並把呼叫所需的引數格式化好。模型本身不會直接執行工具，而是生成一段結構化輸出（通常是 JSON 格式），指明要用哪個工具以及它的參數。接著由 Agentic 系統處理這段輸出、實際執行工具，再把工具的結果回傳給模型，整合進正在進行的互動裡。

* **範例：**
  You have access to a weather tool that can get the current weather for a specified city. The tool is called '`get.current.weather`' and takes a '`city`' parameter (string).

  User: What's the weather like in London right now?

  * *預期的模型輸出（函式呼叫）：*
    {
      "tool.code": "get.current.weather",
      "tool.name": "get.current.weather",
      "parameters": {
        "city": "London"
      }
    }

## ReAct（推理與行動）

ReAct 是「Reason and Act（推理與行動）」的縮寫，是一種把 Chain of Thought 式的推理，跟「用工具執行動作」交錯結合起來的 Prompt 範式。ReAct 模仿人類的運作方式——我們會用語言推理，也會採取行動去蒐集更多資訊或朝目標前進。

ReAct 模式包含一個迴圈：

1. **Thought（思考）：** 模型產生一段思考過程，說明它目前的理解和計畫。
2. **Action（行動）：** 根據思考，模型決定執行一個動作，通常是使用某個工具（例如搜尋、計算機、API 呼叫）。它會輸出工具的名稱和所需的輸入。
3. **Observation（觀察）：** Agentic 系統執行工具，把結果（Observation）回傳給模型。
4. 迴圈接著繼續：模型根據最新的「Observation」產生新的「Thought」，引出後續的「Action」和「Observation」，直到任務完成、模型輸出「Final Answer（最終答案）」為止。

這種「思考」與「行動」交錯進行的過程，讓 Agent 能動態地蒐集資訊、對工具輸出做出反應、調整自己的做法，因此特別適合那些需要跟動態環境或外部知識源互動的任務。

* **範例（ReAct 軌跡示意）：**
  User: What is the capital of France and its current population?

  Thought: The user is asking for two pieces of information: the capital of France and its population. I can use a search tool to find this information. I will start by confirming the capital, although I am likely to know it.
  Action: Search({"query": "capital of France"})
  Observation: Paris

  Thought: Okay, the capital is Paris. Now I need to find the population of Paris.
  Action: Search({"query": "current population of Paris"})
  Observation: The population of Paris was estimated to be around 2.1 million people in 2023.

  Thought: I have found both pieces of information. I can now provide the final answer to the user.
  Final Answer: The capital of France is Paris, and its estimated population in 2023 was around 2.1 million people.

這些技巧對於打造「能主動與世界互動、檢索即時資訊、執行需要跟外部系統互動之任務」的 Agent 很關鍵。

## 進階技巧

除了基礎、結構和推理這幾類模式之外，還有好幾個 Prompt 技巧能進一步提升 Agentic 系統的能力與效率。這些技巧從「用 AI 來最佳化 Prompt」，到「整合外部知識」，再到「依使用者特性量身調整回應」都有。

### Automatic Prompt Engineering（APE，自動 Prompt 工程）

因為寫出有效的 Prompt 本身就是個複雜又反覆的過程，Automatic Prompt Engineering（APE）便探索「用語言模型自己來生成、評估、精修 Prompt」的可能。這個方法想把寫 Prompt 的過程自動化，有機會在不需大量人力投入設計的情況下提升模型表現。

大致的想法是：搞一個「元模型（meta-model）」或一套流程，讓它接收一段任務描述，然後生成多個候選 Prompt。接著根據這些 Prompt 在一組給定輸入上產生的輸出品質來評估它們（也許用 BLEU 或 ROUGE 這類指標，或人工評估）。表現最好的 Prompt 就被選出來，可能再進一步精修，然後用在目標任務上。用 LLM 生成使用者查詢的各種變體來訓練聊天機器人，就是這類做法的一個例子。

* **範例（概念示意）：** 開發者給出一段描述：「我需要一個能從電子郵件裡抽出日期和寄件者的 Prompt。」APE 系統生成好幾個候選 Prompt，拿去在樣本郵件上測試，最後選出那個能穩定抽出正確資訊的 Prompt。

還有一種很強的 Prompt 最佳化技巧，DSPy 框架特別大力推廣，它的做法是不把 Prompt 當成靜態文字，而是當成「可以自動最佳化的程式化模組」。這種取向擺脫了手動試錯，走向更有系統、更資料驅動的方法論。

這項技巧的核心倚賴兩個關鍵元件：

1. **Goldset（黃金標準集，或高品質資料集）：** 這是一組有代表性的高品質「輸入對應輸出」配對。它扮演「ground truth（真實基準）」的角色，定義了在某個任務上，成功的回應該長什麼樣。
2. **目標函式（Objective Function，或評分指標）：** 這是一個函式，會自動拿 LLM 的輸出去比對資料集裡對應的「黃金」輸出，回傳一個分數，代表回應的品質、準確度或正確性。

有了這兩個元件，就能用一個最佳化工具（例如貝氏最佳化器）來有系統地精修 Prompt。這個過程通常涉及兩種主要策略，可以單獨用，也可以搭配著用：

* **Few-Shot 範例最佳化：** 不再由開發者手動挑選 few-shot Prompt 的範例，而是由最佳化工具從 Goldset 裡程式化地取樣不同的範例組合，然後測試這些組合，找出「最能有效引導模型產生理想輸出」的那組特定範例。

* **指令式 Prompt 最佳化：** 在這種做法裡，最佳化工具會自動精修 Prompt 的核心指令。它把一個 LLM 當成「元模型」，反覆地變異、改寫 Prompt 的文字——調整措辭、語氣或結構——去找出哪種寫法能從目標函式拿到最高分。

這兩種策略的最終目標，都是讓目標函式的分數最大化，實質上就是在「訓練」這個 Prompt，讓它產出的結果持續更貼近高品質的 Goldset。把這兩種做法結合起來，系統就能同時最佳化「要給模型什麼指令」和「要給模型看哪些範例」，得到一個為特定任務做過機器最佳化、既有效又穩健的 Prompt。

### 迭代式 Prompt 與精修

這個技巧是先從一個簡單、基本的 Prompt 開始，然後根據模型最初的回應反覆精修。如果模型的輸出不太對，你就分析哪裡不足，再修改 Prompt 去改善它。這比較不是自動化流程（那是 APE 在做的），而是一個由人主導的迭代設計迴圈。

* **範例：**
  * *嘗試 1：*「Write a product description for a new type of coffee maker.」（結果太籠統。）
  * *嘗試 2：*「Write a product description for a new type of coffee maker. Highlight its speed and ease of cleaning.」（好一些了，但細節不夠。）
  * *嘗試 3：*「Write a product description for the 'SpeedClean Coffee Pro'. Emphasize its ability to brew a pot in under 2 minutes and its self-cleaning cycle. Target busy professionals.」（結果就很接近想要的了。）

### 提供負面範例

雖然「用指令，別用限制」這個原則大致成立，但有些情況下，謹慎地提供負面範例會有幫助。所謂負面範例，就是給模型看一個輸入配上一個*不想要的*輸出，或是一個*不該被生成*的輸出。這能幫忙釐清邊界，或防止某些特定類型的錯誤回應。

* **範例：**
  Generate a list of popular tourist attractions in Paris. Do NOT include the Eiffel Tower.

  Example of what NOT to do:
  Input: List popular landmarks in Paris.
  Output: The Eiffel Tower, The Louvre, Notre Dame Cathedral.

### 使用類比

用類比來框定一個任務，有時能把它跟某個熟悉的東西連結起來，幫助模型理解你想要的輸出或流程。這對創意任務，或解釋複雜角色時特別有用。

* **範例：**
  Act as a "data chef". Take the raw ingredients (data points) and prepare a "summary dish" (report) that highlights the key flavors (trends) for a business audience.

### Factored Cognition / 問題分解

對於非常複雜的任務，一個有效的做法是把整體目標拆成更小、更好處理的子任務，針對每個子任務分別去 Prompt 模型，再把各子任務的結果組合起來，得到最終成果。這跟 Prompt Chaining 和規劃有關，但它強調的是「刻意地把問題分解」。

* **範例：** 要寫一篇研究報告：
  * Prompt 1：「Generate a detailed outline for a paper on the impact of AI on the job market.」
  * Prompt 2：「Write the introduction section based on this outline: [insert outline intro].」
  * Prompt 3：「Write the section on 'Impact on White-Collar Jobs' based on this outline: [insert outline section].」（其他章節依此類推。）
  * Prompt N：「Combine these sections and write a conclusion.」

### Retrieval Augmented Generation（RAG，檢索增強生成）

RAG 是一種很強的技巧，它在 Prompt 的過程中讓語言模型能取用外部的、最新的、或特定領域的資訊。當使用者提問時，系統會先從知識庫（例如資料庫、一批文件、網路）檢索出相關的文件或資料，再把這些檢索到的資訊當成上下文放進 Prompt，讓語言模型能根據這些外部知識來生成回應。這能緩解幻覺之類的問題，也讓模型能取得它訓練時沒學過、或非常新的資訊。對於需要處理動態或專有資訊的 Agentic 系統來說，這是一個關鍵模式。

* **範例：**
  * *使用者查詢：*「Python 函式庫 'X' 的最新版本有哪些新功能？」
  * *系統動作：* 到文件資料庫搜尋「Python library X latest features」。
  * *給 LLM 的 Prompt：*「Based on the following documentation snippets: [insert retrieved text], explain the new features in the latest version of Python library 'X'.」

### Persona Pattern（使用者畫像模式）

Role prompting 是給*模型*指派一個人設，而 Persona Pattern 則是描述使用者、或模型輸出的目標受眾。這能幫助模型在語言、複雜度、語氣，以及提供什麼樣的資訊上，量身調整它的回應。

* **範例：**
  You are explaining quantum physics. The target audience is a high school student with no prior knowledge of the subject. Explain it simply and use analogies they might understand.

  Explain quantum physics: [Insert basic explanation request]

這些進階與補充技巧，為 Prompt 工程師提供了更多工具，用來最佳化模型行為、整合外部資訊，並在 Agentic 工作流程中為特定使用者和任務量身調整互動。

## 使用 Google Gems

Google 的 AI「Gems」（見圖 1）是它大型語言模型架構裡一個可由使用者自行設定的功能。每個「Gem」都是核心 Gemini AI 的一個特化實例，為特定、可重複的任務量身打造。使用者建立一個 Gem 的方式，是給它一組明確的指令，這組指令確立了它的運作參數。這組初始指令定義了這個 Gem 的指定用途、回應風格和知識領域。底層模型被設計成在整段對話中都一致地遵守這些預先定好的指示。

這讓你能為聚焦的應用建立高度特化的 AI Agent。舉例來說，你可以把一個 Gem 設定成「只參考特定程式函式庫的程式碼解讀器」，另一個可以被指示去分析資料集、生成摘要而不加入臆測性的評論，還有一個 Gem 可以當「遵循某套正式風格指南的翻譯器」。這個過程為 AI 建立了一個持久、且針對特定任務的上下文。

如此一來，使用者就不必在每次新查詢時重新交代同樣的上下文資訊。這種做法減少了對話中的重複，提升了任務執行的效率。產生的互動更聚焦，輸出也持續貼合使用者一開始的要求。這個框架讓你能對一個通用型 AI 模型，施加細緻、持久的使用者指示。歸根結柢，Gems 讓互動能從「通用型」轉向「特化、預先定義好的 AI 功能」。

![Google Gem 使用範例](/assets/agentic-design-patterns/Example_of_Google_Gem_Usage.png)

圖 1：Google Gem 使用範例。

## 用 LLM 精修 Prompt（Meta 手法）

我們已經探討過許多寫出有效 Prompt 的技巧，強調清晰、結構，以及提供上下文或範例。不過這個過程可能很反覆，有時也頗有挑戰。如果我們能反過來借用大型語言模型（例如 Gemini）本身的力量，來幫我們*改進*Prompt 呢？這正是「用 LLM 精修 Prompt」的核心概念——一種「Meta（元層次）」的應用，讓 AI 協助我們最佳化那些下給 AI 的指令。

這種能力特別「酷」，因為它代表了某種形式的 AI 自我改進，或至少是「AI 輔助人類，讓人類更會跟 AI 互動」。我們不再只靠人的直覺和試錯，而是能借用 LLM 對語言、模式、甚至常見 Prompt 陷阱的理解，得到把 Prompt 寫得更好的建議。它把 LLM 變成了 Prompt Engineering 過程中的協作夥伴。

實際上怎麼做？你可以給語言模型一個你正想改進的現有 Prompt，連同你想達成的任務，甚至再附上你目前拿到的輸出範例（以及它為什麼不符合你的期待）。然後你請 LLM 分析這個 Prompt，並提出改進建議。

像 Gemini 這種推理和語言生成能力都很強的模型，能分析你現有的 Prompt，找出可能有歧義、不夠具體、或措辭沒效率的地方。它能建議你套用我們前面討論過的技巧，例如加上分隔符、把想要的輸出格式講清楚、換一個更有效的人設，或建議加入 few-shot 範例。

這種 Meta-prompting（元層次提示）手法的好處包括：

* **加速迭代：** 比起純手動試錯，能更快拿到改進建議。
* **找出盲點：** LLM 可能會發現你 Prompt 裡自己沒注意到的歧義或潛在誤解。
* **學習機會：** 透過觀察 LLM 提出哪些建議，你能更了解「什麼樣的 Prompt 才有效」，進而提升自己的 Prompt Engineering 功力。
* **可擴展性：** 有機會把部分 Prompt 最佳化流程自動化，尤其是在要處理大量 Prompt 的時候。

要注意的是，LLM 的建議並非總是完美，還是得像對待任何手工設計的 Prompt 一樣去評估和測試。不過它提供了一個很好的起點，能大幅簡化精修的過程。

* **用來精修的 Prompt 範例：**
  Analyze the following prompt for a language model and suggest ways to improve it to consistently extract the main topic and key entities (people, organizations, locations) from news articles. The current prompt sometimes misses entities or gets the main topic wrong.

  Existing Prompt:
  "Summarize the main points and list important names and places from this article: [insert article text]"

  Suggestions for Improvement:

在這個例子裡，我們用 LLM 來評論並強化另一個 Prompt。這種元層次的互動展現了這些模型的靈活與強大：我們可以先最佳化那些下給 Agent 的基礎指令，藉此打造更有效的 Agentic 系統。這是一個很有意思的迴圈——AI 幫我們更會跟 AI 對話。

## 針對特定任務的 Prompt

前面談的技巧大致上都通用，但有些任務會因為特定的 Prompt 考量而受益。這在程式碼和多模態輸入的領域特別明顯。

### 程式碼 Prompt

語言模型，尤其是那些在大量程式碼資料集上訓練過的，能成為開發者的強力幫手。程式碼 Prompt 指的是用 LLM 來生成、解釋、翻譯或除錯程式碼。常見的用途有好幾種：

* **用來寫程式的 Prompt：** 請模型根據對某個功能的描述，生成程式碼片段或函式。
  * **範例：**「Write a Python function that takes a list of numbers and returns the average.」
* **用來解釋程式的 Prompt：** 給一段程式碼片段，請模型逐行或整體解釋它在做什麼。
  * **範例：**「Explain the following JavaScript code snippet: [insert code].」
* **用來翻譯程式的 Prompt：** 請模型把程式碼從一種程式語言轉成另一種。
  * **範例：**「Translate the following Java code to C++: [insert code].」
* **用來除錯與審查程式的 Prompt：** 給一段有錯誤或可以改進的程式碼，請模型找出問題、建議修正，或提供重構建議。
  * **範例：**「The following Python code is giving a 'NameError'. What is wrong and how can I fix it? [insert code and traceback].」

有效的程式碼 Prompt，通常需要提供足夠的上下文、指定想要的語言和版本，並把功能或問題講清楚。

### 多模態 Prompt

雖然這篇附錄、以及目前多數的 LLM 互動都以文字為主，但這個領域正快速朝多模態模型發展——這類模型能跨不同模態（文字、圖像、音訊、影片等）處理和生成資訊。多模態 Prompt 指的是用多種輸入的組合來引導模型，也就是採用多種輸入格式，而不只是文字。

* **範例：** 提供一張流程圖的圖像，請模型解釋圖中呈現的流程（圖像輸入＋文字 Prompt）。或是提供一張圖像，請模型生成一段描述性的圖說（圖像輸入＋文字 Prompt → 文字輸出）。

隨著多模態能力愈來愈成熟，Prompt 技巧也會跟著演進，好有效運用這些結合起來的輸入與輸出。

## 最佳實踐與實驗

要成為熟練的 Prompt 工程師，是一個需要持續學習和實驗的迭代過程。有幾個很有價值的最佳實踐，值得再強調一次：

* **提供範例：** 給一個或幾個 few-shot 範例，是引導模型最有效的方法之一。
* **設計力求簡單：** 讓 Prompt 精簡、清楚、好懂，避免不必要的術語或過度複雜的措辭。
* **對輸出要具體：** 清楚定義你想要的回應格式、長度、風格和內容。
* **用指令，別用限制：** 重點放在告訴模型「要做什麼」，而不是「不要做什麼」。
* **控制最大 token 長度：** 用模型設定或明確的 Prompt 指令，來管理生成輸出的長度。
* **在 Prompt 裡用變數：** 對於應用中會用到的 Prompt，用變數讓它動態、可重用，避免把特定值寫死。
* **實驗不同的輸入格式和寫作風格：** 試試不同的措辭方式（問句、陳述句、指令句），也試試不同的語氣或風格，看哪種效果最好。
* **做分類任務的 few-shot 時，把類別打散：** 隨機化不同類別範例的順序，避免過度擬合。
* **適應模型更新：** 語言模型一直在更新。要有準備，在新版模型上測試你既有的 Prompt，並調整它們，好利用新能力或維持表現。
* **實驗不同的輸出格式：** 尤其是非創意類的任務，試著要求 JSON 或 XML 這類結構化輸出。
* **和其他 Prompt 工程師一起實驗：** 跟別人協作能帶來不同視角，有機會發現更有效的 Prompt。
* **CoT 的最佳實踐：** 記得 Chain of Thought 的一些特定做法，例如把答案放在推理之後，以及對只有單一正確答案的任務把 temperature 設成 0。
* **記錄各種 Prompt 嘗試：** 這對追蹤「什麼有效、什麼沒效、為什麼」很關鍵。把你的 Prompt、設定和結果都有條理地記錄下來。
* **把 Prompt 存進程式碼庫：** 當你把 Prompt 整合進應用時，把它們存放在獨立、組織良好的檔案裡，方便維護和版本控制。
* **依靠自動化測試與評估：** 對於正式環境的系統，建立自動化測試和評估流程，來監控 Prompt 的表現，並確保它能推廣到新資料上。

Prompt Engineering 是一項愈練愈熟的技能。只要套用這些原則和技巧，並對實驗和記錄保持有系統的態度，你打造有效 Agentic 系統的能力就能大幅提升。

## 結語

這篇附錄對 Prompt 做了全面的概覽，把它重新定位成一項有紀律的工程實踐，而不只是「問問題」這麼簡單。它的核心目的，是展示如何把通用型語言模型，轉化成針對特定任務、可靠又高能力的專門工具。這趟旅程始於幾個不容妥協的核心原則：清楚、精簡、以及反覆實驗，這些是跟 AI 有效溝通的基石。這些原則之所以關鍵，是因為它們降低了自然語言本身固有的歧義，幫忙把模型的機率性輸出引導向單一、正確的意圖。在這個基礎之上，zero-shot、one-shot、few-shot 這類基礎技巧，是透過範例來示範預期行為的主要方法。它們提供不同程度的上下文引導，強力地形塑模型回應的風格、語氣和格式。而在範例之外，用明確的角色、系統層級的指令和清楚的分隔符來組織 Prompt，則提供了一個必要的架構層，讓我們能對模型做細緻的控制。

在打造自主 Agent 的脈絡下，這些技巧的重要性更是被推到頂點，因為它們為複雜、多步驟的操作提供了必要的控制與可靠性。一個 Agent 要能有效地制定並執行計畫，就得運用 Chain of Thought、Tree of Thoughts 這類進階推理模式。這些精細的方法逼著模型把它的邏輯步驟外顯出來，有系統地把複雜目標拆解成一連串可處理的子任務。整個 Agentic 系統的運作可靠度，取決於每個元件輸出的可預測性。這正是為什麼「要求 JSON 這類結構化資料，並用 Pydantic 之類的工具程式化地驗證它」不只是圖個方便，而是穩健自動化的絕對必要。少了這份紀律，Agent 內部的認知元件之間就無法可靠地溝通，會在自動化工作流程裡導致災難性的失敗。歸根結柢，正是這些結構化與推理技巧，成功地把模型的機率性文字生成，轉化成 Agent 那個確定、可信賴的認知引擎。

再者，這些 Prompt 賦予了 Agent 一項關鍵能力：感知環境並對它採取行動，在數位思考與真實世界互動之間搭起橋樑。ReAct 和原生的 function calling 這類以行動為導向的框架，是充當 Agent「雙手」的關鍵機制，讓它能使用工具、查詢 API、操作資料。與此同時，Retrieval Augmented Generation（RAG）以及更廣義的上下文工程，則充當 Agent 的「感官」。它們主動從外部知識庫檢索相關的即時資訊，確保 Agent 的決策是奠基在當前、符合事實的現實之上。這項關鍵能力，讓 Agent 不至於在真空中運作、被侷限在它靜態且可能過時的訓練資料裡。因此，掌握這整套完整的 Prompt 技巧，正是把通用型語言模型從一個單純的文字生成器，提升為真正成熟 Agent 的決定性技能——一個能自主、有情境意識、有智慧地執行複雜任務的 Agent。

## 參考資料

以下列出一些延伸閱讀資源，供你更深入探索 Prompt Engineering 的各種技巧：

1. Prompt Engineering, [https://www.kaggle.com/whitepaper-prompt-engineering](https://www.kaggle.com/whitepaper-prompt-engineering)
2. Chain-of-Thought Prompting Elicits Reasoning in Large Language Models, [https://arxiv.org/abs/2201.11903](https://arxiv.org/abs/2201.11903)
3. Self-Consistency Improves Chain of Thought Reasoning in Language Models,  [https://arxiv.org/pdf/2203.11171](https://arxiv.org/pdf/2203.11171)
4. ReAct: Synergizing Reasoning and Acting in Language Models, [https://arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629)
5. Tree of Thoughts: Deliberate Problem Solving with Large Language Models,  [https://arxiv.org/pdf/2305.10601](https://arxiv.org/pdf/2305.10601)
6. Take a Step Back: Evoking Reasoning via Abstraction in Large Language Models, [https://arxiv.org/abs/2310.06117](https://arxiv.org/abs/2310.06117)
7. DSPy: Programming—not prompting—Foundation Models [https://github.com/stanfordnlp/dspy](https://github.com/stanfordnlp/dspy)
