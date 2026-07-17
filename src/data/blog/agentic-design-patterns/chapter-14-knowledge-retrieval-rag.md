---
title: "Agentic Design Patterns 第 14 章：Knowledge Retrieval（知識檢索，RAG）"
description: "用檢索補足 LLM 的知識：從 RAG、GraphRAG 到 Agentic RAG。《Agentic Design Patterns》第 14 章繁體中文翻譯。"
pubDatetime: 2026-07-18T20:46:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

LLM（大型語言模型）在產生近似人類的文字上能力很強。但它們的知識通常只限於訓練時用過的資料，這讓它們很難取得即時資訊、特定公司的內部資料，或高度專業的細節。Knowledge Retrieval（知識檢索，也就是 RAG，Retrieval Augmented Generation，檢索增強生成）就是為了解決這個限制而生的。RAG 讓 LLM 能夠取用並整合外部的、當下的、特定情境的資訊，藉此提升輸出的準確度、相關性與事實依據。

對 AI Agent 來說，這一點格外重要，因為它讓 Agent 的行動與回應可以建立在即時、可查證的資料上，而不只是仰賴那份靜態的訓練資料。有了這個能力，Agent 就能準確執行複雜任務，例如查詢最新的公司政策來回答某個特定問題，或在下單前先確認目前的庫存。透過整合外部知識，RAG 把 Agent 從單純的對話者，變成能實際完成工作、以資料為依據的有效工具。

## Knowledge Retrieval（RAG）模式概觀

Knowledge Retrieval（RAG）模式的做法是：在產生回應之前，先讓 LLM 能夠存取外部知識庫，藉此大幅擴充它的能力。RAG 不讓 LLM 只靠內部那份預先訓練好的知識，而是讓它可以「查資料」，就像人類會去翻書或上網搜尋一樣。這個過程讓 LLM 能給出更準確、更即時、也更可查證的答案。

當使用者對採用 RAG 的 AI 系統提問或下 Prompt 時，這個查詢不會直接送給 LLM。系統會先在一個龐大的外部知識庫裡搜尋相關資訊，這個知識庫是一批整理得很有條理的文件、資料庫或網頁。這種搜尋不是單純的關鍵字比對，而是一種「語意搜尋（semantic search）」，能理解使用者的意圖以及字句背後的含意。這一步初步搜尋會撈出最相關的資訊片段，也就是所謂的「chunk（區塊）」。接著，這些撈出來的片段會被「增強（augment）」進原始的 Prompt，形成一個內容更豐富、資訊量更足的查詢。最後，這個強化過的 Prompt 才送進 LLM。有了這些額外的上下文，LLM 產生的回應不只流暢自然，在事實上也有檢索到的資料當依據。

RAG 框架帶來好幾項重要好處。它讓 LLM 能取用最新資訊，突破靜態訓練資料的限制。這種做法也把回應建立在可查證的資料上，因此降低了「幻覺（hallucination）」的風險，也就是憑空生出錯誤資訊。此外，LLM 還能運用內部公司文件或 wiki 裡的專業知識。這個過程還有一個關鍵優勢：能提供「引用來源（citation）」，明確指出資訊出自哪裡，讓 AI 回應更可信、也更容易查證。

要徹底理解 RAG 怎麼運作，得先掌握幾個核心概念（見圖 1）：

### Embeddings

在 LLM 的語境裡，embedding（嵌入）是把文字轉成的數值表示，這些文字可以是單字、片語或整份文件。這些表示以向量（vector）的形式存在，也就是一串數字。核心概念是把不同文字片段的語意含義與彼此關係，捕捉到一個數學空間裡。含義相近的單字或片語，在這個向量空間裡的 embedding 會靠得比較近。舉例來說，想像一個簡單的二維座標圖，「cat」這個字可能落在座標 (2, 3)，而「kitten」會非常接近，落在 (2.1, 3.1)。相對地，「car」的座標就會離得很遠，例如 (8, 1)，反映出它意思不同。實際上這些 embedding 位在維度高得多的空間裡，有數百甚至數千個維度，因此能對語言有非常細膩的理解。

### 文字相似度

文字相似度指的是衡量兩段文字有多像的指標。這可以是表層的比較，看兩者用詞的重疊程度（也就是詞彙相似度，lexical similarity），也可以是更深、以含義為基礎的比較。在 RAG 的語境裡，文字相似度對於在知識庫中找到與使用者查詢最相關的資訊非常關鍵。舉例來說，看看這兩句：「What is the capital of France?」和「Which city is the capital of France?」。用字不一樣，但問的是同一件事。好的文字相似度模型能辨認出這點，就算兩句只共用了幾個字，也會給它們很高的相似度分數。這通常是用文字的 embedding 來計算的。

### 語意相似度與距離

語意相似度（semantic similarity）是文字相似度更進階的形式，它純粹關注文字的含義與上下文，而不只是用了哪些字。它的目標是判斷兩段文字是否表達了相同的概念或想法。語意距離（semantic distance）則是它的反面：語意相似度高，就代表語意距離小，反之亦然。在 RAG 裡，語意搜尋靠的就是找出與使用者查詢語意距離最小的文件。舉例來說，「a furry feline companion」和「a domestic cat」這兩個片語，除了冠詞「a」以外沒有任何共同的字。但懂語意相似度的模型會辨認出它們指的是同一件事，並判定兩者高度相似。這是因為它們的 embedding 在向量空間裡非常接近，代表語意距離很小。這就是那種「聰明的搜尋」，讓 RAG 就算在使用者用字和知識庫裡的文字對不上時，也能找到相關資訊。

![RAG 核心概念：Chunking、Embeddings 與向量資料庫](/assets/agentic-design-patterns/RAG_Core_Concepts_Chunking_Embeddings_and_Vector_Database.png)

圖 1：RAG 核心概念：Chunking、Embeddings 與向量資料庫

### 文件分塊（Chunking）

Chunking（分塊）是把大型文件拆成更小、更好處理的片段，也就是拆成一個個「chunk」的過程。RAG 系統要有效率地運作，不能把整份大文件直接餵給 LLM，而是要處理這些比較小的 chunk。文件怎麼分塊很重要，因為這關係到能不能保住資訊的上下文與含義。舉例來說，與其把一份 50 頁的使用者手冊當成一整塊文字，分塊策略可能會把它拆成章節、段落，甚至句子。這麼一來，「疑難排解」那一段就會和「安裝指南」分成不同的 chunk。當使用者問到某個特定問題時，RAG 系統就能只取出最相關的那一個疑難排解 chunk，而不是整本手冊。這讓檢索更快，餵給 LLM 的資訊也更聚焦、更貼近使用者當下的需求。文件分好塊之後，RAG 系統還得用某種檢索技術，針對某個查詢找出最相關的片段。主要方法是向量搜尋（vector search），它用 embedding 和語意距離，找出概念上與使用者問題相近的 chunk。另一種比較舊、但仍然很有用的技術是 BM25，這是一種以關鍵字為基礎的演算法，依詞頻替 chunk 排名，但不理解語意。為了兼顧兩邊的優點，常會採用混合搜尋（hybrid search），把 BM25 的關鍵字精準度和語意搜尋的上下文理解結合起來。這種融合能帶來更穩健、更準確的檢索，同時抓住字面上的比對和概念上的相關性。

### 向量資料庫

向量資料庫（vector database）是一種專門設計來高效儲存與查詢 embedding 的資料庫。文件被分塊並轉成 embedding 之後，這些高維向量就會存進向量資料庫裡。傳統的檢索技術（例如以關鍵字為基礎的搜尋）很擅長找出含有查詢中確切字詞的文件，但缺乏對語言的深層理解。它們不會知道「furry feline companion」講的就是「cat」。這正是向量資料庫的強項，它們就是專為語意搜尋而打造的。透過把文字存成數值向量，它們能依概念含義來找結果，而不只是看關鍵字有沒有重疊。當使用者的查詢同樣被轉成向量後，資料庫會用高度最佳化的演算法（例如 HNSW，即 Hierarchical Navigable Small World，階層式可導覽小世界）快速掃過數百萬個向量，找出含義上「最接近」的那些。這種做法對 RAG 來說優越太多了，因為就算使用者的措辭和來源文件完全不同，它也能挖出相關的上下文。說到底，其他技術找的是字，向量資料庫找的是含義。這項技術有各種實作形式，從 Pinecone、Weaviate 這類代管資料庫，到 Chroma DB、Milvus、Qdrant 這類開源方案都有。就連既有的資料庫也能加上向量搜尋能力，像 Redis、Elasticsearch，以及 Postgres（透過 pgvector 擴充套件）都是例子。核心的檢索機制通常由 Meta AI 的 FAISS 或 Google Research 的 ScaNN 這類函式庫來驅動，它們是這些系統效率的根本。

### RAG 的挑戰

RAG 模式雖然強大，卻不是沒有挑戰。一個主要問題出現在：回答查詢所需的資訊並不集中在單一 chunk，而是分散在一份文件的多個部分、甚至好幾份文件裡。這種情況下，檢索器可能沒辦法把所有必要的上下文都收齊，導致答案不完整或不準確。系統的成效也高度取決於分塊與檢索過程的品質；如果撈到的是不相關的 chunk，就可能引入雜訊，把 LLM 搞混。此外，要有效整合來自彼此可能矛盾的來源的資訊，對這些系統來說仍是一大難關。除此之外，還有一個挑戰是：RAG 需要把整個知識庫預先處理好，並存進向量資料庫或圖資料庫這類專用資料庫，這是相當可觀的工程。也因此，這些知識需要定期校正才能保持最新，在面對像公司 wiki 這種會不斷變動的來源時，這是件關鍵工作。整個過程可能對效能造成明顯影響，拉高延遲、營運成本，以及最終 Prompt 用掉的 token 數量。

總結來說，Retrieval-Augmented Generation（RAG）模式在讓 AI 更有知識、更可靠這件事上，是一次重大的躍進。透過把外部知識檢索這一步無縫嵌進生成流程，RAG 解決了獨立 LLM 的一些核心限制。embedding 與語意相似度這些基礎概念，加上關鍵字搜尋、混合搜尋等檢索技術，讓系統能聰明地找到相關資訊，而策略性的分塊則讓這件事變得可控。整個檢索過程由專門的向量資料庫驅動，這些資料庫就是為了大規模儲存並高效查詢數百萬個 embedding 而設計的。雖然檢索破碎或矛盾資訊的挑戰依然存在，RAG 讓 LLM 能產生不只切合上下文、還能扎根在可查證事實上的答案，因而在 AI 上建立起更多信任與實用性。

### Graph RAG

GraphRAG 是 Retrieval-Augmented Generation 的一種進階形式，它用知識圖譜（knowledge graph）而非單純的向量資料庫來做資訊檢索。它靠著在這個結構化知識庫裡，沿著資料實體（節點，node）之間明確的關係（邊，edge）來導覽，藉此回答複雜的查詢。它的一大優勢是能把散落在多份文件裡的破碎資訊整合成答案，而這正是傳統 RAG 常見的弱點。透過理解這些連結，GraphRAG 能給出更貼合上下文、也更細膩的回應。

它的使用情境包括複雜的財務分析（把公司與市場事件連結起來），以及發掘基因與疾病之間關係的科學研究。不過它的主要缺點是：要建立並維護一個高品質的知識圖譜，需要相當高的複雜度、成本與專業知識。這種架構的彈性也比較差，而且相較於較單純的向量搜尋系統，可能帶來更高的延遲。系統的成效完全取決於底層圖結構的品質與完整度。因此，GraphRAG 在處理錯綜複雜的問題時能提供更出色的上下文推理，但實作與維護成本高出許多。總結來說，當深入、相互關聯的洞見比標準 RAG 的速度與簡潔更重要時，它就特別出色。

### Agentic RAG

這個模式有一種演進形式，稱為 **Agentic RAG**（見圖 2），它引入一個推理與決策層，大幅提升資訊萃取的可靠度。它不再只是檢索加增強，而是讓一個「Agent」（一個專門的 AI 元件）來扮演知識的關鍵把關者與精煉者。這個 Agent 不會被動接受最初檢索到的資料，而是主動去質問這些資料的品質、相關性與完整性，就像下面幾個情境所示範的那樣。

第一，Agent 很擅長反思與來源查證。如果使用者問：「我們公司的遠距工作政策是什麼？」標準的 RAG 可能會同時撈出一篇 2020 年的部落格文章和一份官方的 2025 年政策文件。但 Agent 會分析這些文件的中繼資料（metadata），辨認出 2025 年的政策才是最新、最權威的來源，並在把正確的上下文送給 LLM 以求得精準答案之前，先把那篇過時的部落格文章丟掉。

![Agentic RAG 引入推理 Agent](/assets/agentic-design-patterns/Agentic_RAG_Introduces_Reasoning_Agent.png)

圖 2：Agentic RAG 引入一個推理 Agent，主動評估、調和並精煉檢索到的資訊，以確保最終回應更準確、更值得信賴。

第二，Agent 很擅長調和知識衝突。想像一位財務分析師問：「Project Alpha 的第一季預算是多少？」系統檢索到兩份文件：一份初始提案寫著預算為 50,000 歐元，另一份定案的財務報告則列為 65,000 歐元。Agentic RAG 會辨認出這個矛盾，把財務報告當成較可靠的來源優先採用，並把經過查證的數字提供給 LLM，確保最終答案是根據最準確的資料而來。

第三，Agent 能做多步推理，把複雜的答案整合出來。如果使用者問：「我們產品的功能和定價，跟競爭對手 X 相比如何？」Agent 會把這題拆成好幾個獨立的子查詢。它會分別去搜尋自家產品的功能、自家的定價、競爭對手 X 的功能，以及競爭對手 X 的定價。收齊這些個別資訊之後，Agent 會把它們整合成一個結構化的比較上下文，再餵給 LLM，這樣就能給出單純檢索做不到的完整回應。

第四，Agent 能辨認出知識缺口，並動用外部工具。假設使用者問：「市場對我們昨天推出的新產品，第一時間的反應如何？」Agent 去搜尋每週才更新一次的內部知識庫，卻找不到相關資訊。它辨認出這個缺口後，就能啟用某個工具（例如即時的網路搜尋 API）去找最近的新聞報導和社群媒體上的風向。接著 Agent 用這些剛蒐集到的外部資訊，給出最即時的答案，突破自家靜態內部資料庫的限制。

### Agentic RAG 的挑戰

Agentic 這一層雖然強大，卻也帶來它自己的一整套挑戰。主要缺點是複雜度與成本明顯上升。設計、實作並維護 Agent 的決策邏輯與工具整合，需要投入大量工程心力，也墊高了運算開銷。這種複雜度還可能拉高延遲，因為 Agent 反思、用工具、做多步推理這些循環，比標準的直接檢索過程花更多時間。此外，Agent 本身也可能變成新的錯誤來源；有瑕疵的推理過程可能讓它卡在無用的迴圈裡、誤解任務，或不當地把相關資訊丟掉，最終反而拉低了回應的品質。

### 小結

Agentic RAG 是標準檢索模式一次精巧的演進，把它從一條被動的資料管線，變成一個主動、能解決問題的框架。透過嵌入一個能評估來源、調和衝突、拆解複雜問題並運用外部工具的推理層，Agent 大幅提升了生成答案的可靠度與深度。這項進步讓 AI 更值得信賴、也更有能力，不過代價是系統複雜度、延遲與成本上的重要取捨，必須小心拿捏。

## 實際應用與使用情境

Knowledge Retrieval（RAG）正在改變各行各業運用 LLM 的方式，讓它們更能給出準確、貼合上下文的回應。

應用包括：

* **企業搜尋與問答：** 組織可以打造內部聊天機器人，運用 HR 政策、技術手冊、產品規格等內部文件來回答員工的提問。RAG 系統會從這些文件裡抽出相關段落，作為 LLM 回應的依據。
* **客戶支援與服務台：** 以 RAG 為基礎的系統能透過取用產品手冊、常見問題（FAQ）與支援工單裡的資訊，替客戶的提問提供精準、一致的回應。這能減少例行問題還得由真人直接介入的需求。
* **個人化內容推薦：** RAG 不只是做基本的關鍵字比對，而是能找出並取回在語意上與使用者偏好或過往互動相關的內容（文章、商品），帶來更貼切的推薦。
* **新聞與時事摘要：** LLM 可以和即時新聞來源整合。當被問到某個時事時，RAG 系統會取回最近的文章，讓 LLM 產生一份最新的摘要。

透過納入外部知識，RAG 把 LLM 的能力從單純的溝通，延伸成一個知識處理系統。

## 實作範例（ADK）

為了說明 Knowledge Retrieval（RAG）模式，我們來看三個範例。

第一個，是如何用 Google Search 來做 RAG，把 LLM 的回答扎根在搜尋結果上。既然 RAG 就是要取用外部資訊，Google Search 工具正好是一個內建檢索機制的直接例子，能替 LLM 的知識做增強。

```python
from google.adk.tools import google_search
from google.adk.agents import Agent


search_agent = Agent(
    name="research_assistant",
    model="gemini-2.0-flash-exp",
    instruction="You help users research topics. When asked, use the Google Search tool",
    tools=[google_search],
)
```

第二個，這一節說明如何在 Google ADK 裡運用 Vertex AI 的 RAG 能力。以下這段程式碼示範了如何從 ADK 初始化 VertexAiRagMemoryService，藉此建立與 Google Cloud Vertex AI RAG Corpus 的連線。這個服務的設定方式，是指定 corpus 的資源名稱，以及 `SIMILARITY_TOP_K`、`VECTOR_DISTANCE_THRESHOLD` 等選用參數。這些參數會影響檢索過程。`SIMILARITY_TOP_K` 定義要取回多少個最相似的結果。`VECTOR_DISTANCE_THRESHOLD` 則替取回結果的語意距離設下上限。這樣的設定讓 Agent 能夠從指定的 RAG Corpus 進行可擴充、可持久保存的語意知識檢索。這個過程把 Google Cloud 的 RAG 功能有效地整合進 ADK Agent，因而能支援打造以事實資料為依據的回應。

```python
# Import the necessary VertexAiRagMemoryService class from the google.adk.memory module.
from google.adk.memory import VertexAiRagMemoryService


RAG_CORPUS_RESOURCE_NAME = "projects/your-gcp-project-id/locations/us-central1/ragCorpora/your-corpus-id"

# Define an optional parameter for the number of top similar results to retrieve.
# This controls how many relevant document chunks the RAG service will return.
SIMILARITY_TOP_K = 5

# Define an optional parameter for the vector distance threshold.
# This threshold determines the maximum semantic distance allowed for retrieved results;
# results with a distance greater than this value might be filtered out.
VECTOR_DISTANCE_THRESHOLD = 0.7

# Initialize an instance of VertexAiRagMemoryService.
# This sets up the connection to your Vertex AI RAG Corpus.
# - rag_corpus: Specifies the unique identifier for your RAG Corpus.
# - similarity_top_k: Sets the maximum number of similar results to fetch.
# - vector_distance_threshold: Defines the similarity threshold for filtering results.
memory_service = VertexAiRagMemoryService(
    rag_corpus=RAG_CORPUS_RESOURCE_NAME,
    similarity_top_k=SIMILARITY_TOP_K,
    vector_distance_threshold=VECTOR_DISTANCE_THRESHOLD,
)
```

## 實作範例（LangChain）

第三個，我們用 LangChain 走一遍完整的範例。

```python
import os
import requests
from typing import List, Dict, Any, TypedDict

from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import Weaviate
from langchain_openai import ChatOpenAI
from langchain.text_splitter import CharacterTextSplitter
from langchain.schema.runnable import RunnablePassthrough
from langgraph.graph import StateGraph, END

import weaviate
from weaviate.embedded import EmbeddedOptions
import dotenv


# Load environment variables (e.g., OPENAI_API_KEY)
dotenv.load_dotenv()

# Set your OpenAI API key (ensure it's loaded from .env or set here)
# os.environ["OPENAI_API_KEY"] = "YOUR_OPENAI_API_KEY"


# --- 1. Data Preparation (Preprocessing) ---

# Load data
url = "https://github.com/langchain-ai/langchain/blob/master/docs/docs/how_to/state_of_the_union.txt"
res = requests.get(url)
with open("state_of_the_union.txt", "w") as f:
    f.write(res.text)

loader = TextLoader("./state_of_the_union.txt")
documents = loader.load()

# Chunk documents
text_splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
chunks = text_splitter.split_documents(documents)

# Embed and store chunks in Weaviate
client = weaviate.Client(embedded_options=EmbeddedOptions())

vectorstore = Weaviate.from_documents(
    client=client,
    documents=chunks,
    embedding=OpenAIEmbeddings(),
    by_text=False,
)

# Define the retriever
retriever = vectorstore.as_retriever()

# Initialize LLM
llm = ChatOpenAI(model_name="gpt-3.5-turbo", temperature=0)


# --- 2. Define the State for LangGraph ---
class RAGGraphState(TypedDict):
    question: str
    documents: List[Document]
    generation: str


# --- 3. Define the Nodes (Functions) ---
def retrieve_documents_node(state: RAGGraphState) -> RAGGraphState:
    """Retrieves documents based on the user's question."""
    question = state["question"]
    documents = retriever.invoke(question)
    return {"documents": documents, "question": question, "generation": ""}


def generate_response_node(state: RAGGraphState) -> RAGGraphState:
    """Generates a response using the LLM based on retrieved documents."""
    question = state["question"]
    documents = state["documents"]

    # Prompt template from the PDF
    template = """You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.
Question: {question}
Context: {context}
Answer: """
    prompt = ChatPromptTemplate.from_template(template)

    # Format the context from the documents
    context = "\n\n".join([doc.page_content for doc in documents])

    # Create the RAG chain
    rag_chain = prompt | llm | StrOutputParser()

    # Invoke the chain
    generation = rag_chain.invoke({"context": context, "question": question})

    return {"question": question, "documents": documents, "generation": generation}


# --- 4. Build the LangGraph Graph ---
workflow = StateGraph(RAGGraphState)

# Add nodes
workflow.add_node("retrieve", retrieve_documents_node)
workflow.add_node("generate", generate_response_node)

# Set the entry point
workflow.set_entry_point("retrieve")

# Add edges (transitions)
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

# Compile the graph
app = workflow.compile()


# --- 5. Run the RAG Application ---
if __name__ == "__main__":
    print("\n--- Running RAG Query ---")
    query = "What did the president say about Justice Breyer"
    inputs = {"question": query}
    for s in app.stream(inputs):
        print(s)

    print("\n--- Running another RAG Query ---")
    query_2 = "What did the president say about the economy?"
    inputs_2 = {"question": query_2}
    for s in app.stream(inputs_2):
        print(s)
```

這段 Python 程式碼示範了一條用 LangChain 與 LangGraph 實作的 Retrieval-Augmented Generation（RAG）管線。整個流程從建立知識庫開始：由一份文字文件而來，先切成一個個 chunk，再轉換成 embedding。這些 embedding 接著存進 Weaviate 向量儲存，方便高效檢索資訊。程式用 LangGraph 裡的 StateGraph 來管理兩個關鍵函式之間的工作流程：`retrieve_documents_node` 與 `generate_response_node`。`retrieve_documents_node` 函式會查詢向量儲存，根據使用者輸入找出相關的文件 chunk。接著，`generate_response_node` 函式運用檢索到的資訊，搭配一份預先定義好的 Prompt 範本，用一個 OpenAI 的 LLM 產生回應。`app.stream` 方法讓查詢得以在這條 RAG 管線裡執行，展現出這套系統能產生切合上下文的輸出。

## 速覽

**問題：** LLM 的文字生成能力令人印象深刻，但根本上受限於它的訓練資料。這份知識是靜態的，意味著它不含即時資訊，也不含私有的、特定領域的資料。因此，它的回應可能過時、不準確，或缺乏專業任務所需的特定上下文。這道落差限制了它在那些要求最新、以事實為準的答案的應用上的可靠度。

**解法：** Retrieval-Augmented Generation（RAG）模式提供了一套標準化的解方，把 LLM 連上外部知識來源。當收到查詢時，系統會先從指定的知識庫裡取回相關的資訊片段。這些片段接著會附加到原始的 Prompt 上，替它注入即時、具體的上下文。這個增強過的 Prompt 再送進 LLM，讓它能產生準確、可查證、並以外部資料為依據的回應。這個過程有效地把 LLM 從一個「閉卷」的推理者，變成一個「開卷」的推理者，大幅提升了它的實用性與可信度。

**經驗法則：** 當你需要 LLM 根據特定的、最新的，或專有的資訊（這些都不在它原本的訓練資料裡）來回答問題或生成內容時，就用這個模式。它非常適合用來在內部文件上打造問答系統、客服機器人，以及那些需要可查證、以事實為準、附帶引用來源的回應的應用。

**圖解：**

![知識檢索模式：資料庫](/assets/agentic-design-patterns/Knowledge_Retrieval_Pattern_Database.png)

知識檢索模式：由一個 AI Agent 向結構化資料庫查詢並取回資訊

![知識檢索模式：搜尋](/assets/agentic-design-patterns/Knowledge_Retrieval_Pattern_Search.png)

圖 3：知識檢索模式：由一個 AI Agent 回應使用者查詢，從公開的網際網路上找出並整合資訊。

## 重點回顧

* Knowledge Retrieval（RAG）讓 LLM 能取用外部的、最新的、特定的資訊，藉此擴充它的能力。
* 這個過程包含檢索（Retrieval，在知識庫裡搜尋相關片段）與增強（Augmentation，把這些片段加進 LLM 的 Prompt）。
* RAG 幫助 LLM 克服訓練資料過時等限制，降低「幻覺」，並讓特定領域的知識得以整合進來。
* RAG 能提供可歸屬來源的答案，因為 LLM 的回應是以檢索到的來源為依據。
* GraphRAG 運用知識圖譜來理解不同資訊片段之間的關係，讓它能回答那些需要整合多個來源資料的複雜問題。
* Agentic RAG 不只做單純的資訊檢索，而是用一個聰明的 Agent 主動去推理、查證並精煉外部知識，確保答案更準確、更可靠。
* 實際應用橫跨企業搜尋、客戶支援、法律研究，以及個人化推薦。

## 結語

總結來說，Retrieval-Augmented Generation（RAG）把 LLM 連上外部、最新的資料來源，藉此解決了它靜態知識這個核心限制。它的運作方式是：先取回相關的資訊片段，再增強使用者的 Prompt，讓 LLM 能產生更準確、更能感知上下文的回應。這一切之所以可行，靠的是 embedding、語意搜尋、向量資料庫這些基礎技術，它們是依含義而非只靠關鍵字來找資訊的。透過把輸出扎根在可查證的資料上，RAG 大幅減少了事實錯誤，也讓專有資訊得以派上用場，並藉由引用來源提升可信度。

它有一種進階的演進形式——Agentic RAG，引入一個推理層，主動查證、調和並整合檢索到的知識，以求更高的可靠度。同樣地，GraphRAG 這類專門的做法則運用知識圖譜來沿著明確的資料關係導覽，讓系統能整合出高度複雜、相互關聯的查詢的答案。這樣的 Agent 能化解彼此衝突的資訊、執行多步查詢，並運用外部工具去找出缺漏的資料。這些進階方法雖然增加了複雜度與延遲，卻也大幅提升了最終回應的深度與可信度。這些模式的實際應用已經在改變各行各業，從企業搜尋、客戶支援到個人化內容遞送都是。儘管挑戰仍在，RAG 依然是讓 AI 更有知識、更可靠、更實用的關鍵模式。歸根究柢，它把 LLM 從「閉卷」的對話者，變成強大的「開卷」推理工具。

## 參考資料

1. Lewis, P., et al. (2020). *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*. [https://arxiv.org/abs/2005.11401](https://arxiv.org/abs/2005.11401)
2. Google AI for Developers Documentation.  *Retrieval Augmented Generation - [https://cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-overview](https://cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-overview)*
3. Retrieval-Augmented Generation with Graphs (GraphRAG), [https://arxiv.org/abs/2501.00309](https://arxiv.org/abs/2501.00309)
4. LangChain and LangGraph: Leonie Monigatti, "Retrieval-Augmented Generation (RAG): From Theory to LangChain Implementation,"  [*https://medium.com/data-science/retrieval-augmented-generation-rag-from-theory-to-langchain-implementation-4e9bd5f6a4f2*](https://medium.com/data-science/retrieval-augmented-generation-rag-from-theory-to-langchain-implementation-4e9bd5f6a4f2)
5. Google Cloud Vertex AI RAG Corpus [*https://cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/manage-your-rag-corpus#corpus-management*](https://cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/manage-your-rag-corpus#corpus-management)
