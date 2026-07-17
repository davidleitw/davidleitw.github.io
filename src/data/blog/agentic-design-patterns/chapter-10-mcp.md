---
title: "Agentic Design Patterns 第 10 章：Model Context Protocol（MCP）"
description: "用開放協定讓 LLM 以統一介面連接外部工具與資料。《Agentic Design Patterns》第 10 章繁體中文翻譯，含程式碼範例。"
pubDatetime: 2026-07-18T20:50:00+08:00
tags:
  - agentic-design-patterns
  - ai
  - agent
  - llm
draft: false
---

要讓 LLM 有效地扮演 Agent，它的能力不能只停留在多模態生成。與外部環境的互動是必要的：存取最新資料、使用外部軟體、執行特定的操作任務。Model Context Protocol（MCP，模型上下文協定）就是為了這個需求而生：它為 LLM 對接外部資源提供了標準化的介面。這個協定是實現一致、可預測整合的關鍵機制。

## 模式概觀

想像一個萬用轉接頭，讓任何 LLM 都能接上任何外部系統、資料庫或工具，不必為每一個做客製整合──這基本上就是 Model Context Protocol（MCP）。它是一個開放標準，目標是把 Gemini、OpenAI 的 GPT 系列、Mixtral、Claude 這些 LLM 與外部應用、資料來源和工具之間的溝通方式標準化。可以把它想成一種通用的連接機制，簡化 LLM 取得上下文、執行動作、與各種系統互動的方式。

MCP 採用客戶端─伺服器（client-server）架構。它定義了 MCP server 如何對外提供幾類元素：資料（稱為 resources）、互動模板（本質上是 prompts），以及可執行的功能（稱為 tools）。這些元素由 MCP client 使用──client 可以是 LLM 的宿主應用，也可以是 AI Agent 本身。這種標準化做法大幅降低了把 LLM 整合進各種運作環境的複雜度。

不過，MCP 是一份「Agentic 介面」的合約，效果好不好，很大程度取決於它底下所包裝的 API 設計。有一個風險是：開發者直接把既有的老舊 API 原封不動包起來，對 Agent 來說可能很難用。例如，如果某個工單系統的 API 只能一張一張撈完整的工單細節，那麼被要求「摘要優先順序較高的工單」的 Agent，在量大時就會又慢又不準。要真正有效，底層的 API 應該補上過濾、排序這類確定性的功能，幫助非確定性的 Agent 有效率地工作。這說明了一件事：Agent 並不會神奇地取代確定性的工作流程；它們反而常常需要更強的確定性支援才能成功。

再者，MCP 包裝的 API，其輸入或輸出可能仍然不是 Agent 天生看得懂的。API 只有在資料格式對 Agent 友善時才有用，而這一點 MCP 本身並不保證。比方說，為一個文件庫建 MCP server，但它回傳的檔案是 PDF──如果使用它的 Agent 解析不了 PDF 內容，這個 server 幾乎沒用。更好的做法是先做一個回傳文件文字版（例如 Markdown）的 API，讓 Agent 真的能讀、能處理。這說明開發者要考慮的不只是「接得上」，還有交換資料的性質，才能確保真正的相容。

## MCP vs. 工具的 Function Calling

Model Context Protocol（MCP）和工具的 Function Calling 是兩種不同的機制，都讓 LLM 能與外部能力（包括工具）互動、執行動作。兩者都是為了把 LLM 的能力延伸到文字生成之外，但做法和抽象層次不同。

工具的 Function Calling 可以想成 LLM 對某個特定、預先定義的工具或函式發出的直接請求。（注意：這裡的「工具」和「函式」兩個詞可以互換。）這種互動是一對一的通訊模型：LLM 根據它對使用者意圖的理解，判斷需要外部動作，於是組出一個請求；應用程式碼執行這個請求，再把結果回傳給 LLM。這個流程通常是各家專有的，不同 LLM 供應商的做法各異。

相對地，Model Context Protocol（MCP）是一個標準化的介面，讓 LLM 能發現、溝通、使用外部能力。它是一個開放協定，支援與各式各樣的工具和系統互動，目標是建立一個生態系：任何符合規範的工具，都能被任何符合規範的 LLM 使用。這促進了不同系統和實作之間的互通性、可組合性與可重用性。採用這種聯邦式的模型，能大幅提升互通性、釋放既有資產的價值：只要把分散的、老舊的服務包上一層符合 MCP 的介面，就能把它們帶進現代的生態系。這些服務繼續獨立運作，但現在可以被組合進新的應用和工作流程，由 LLM 調度它們的協作。這帶來敏捷性和可重用性，而不需要花大錢重寫基礎系統。

以下是 MCP 與工具 Function Calling 的根本差異：

| 特性 | 工具 Function Calling | Model Context Protocol（MCP） |
| ----- | ----- | ----- |
| **標準化** | 專有、依供應商而異。格式和實作在不同 LLM 供應商之間各不相同。 | 開放的標準化協定，促進不同 LLM 與工具之間的互通。 |
| **範圍** | LLM 請求執行某個特定、預先定義函式的直接機制。 | 更廣的框架，定義 LLM 與外部工具如何互相發現和溝通。 |
| **架構** | LLM 與應用程式工具處理邏輯之間的一對一互動。 | 客戶端─伺服器架構：LLM 驅動的應用（client）可以連上並使用各種 MCP server（工具）。 |
| **發現機制** | 在特定對話的上下文中，明確告訴 LLM 有哪些工具可用。 | 支援動態發現可用工具。MCP client 可以查詢 server 有哪些能力。 |
| **可重用性** | 工具整合通常與特定的應用和所用的 LLM 緊密耦合。 | 鼓勵開發可重用、獨立的「MCP server」，任何符合規範的應用都能存取。 |

可以這樣比喻：工具的 Function Calling 像是給 AI 一組特製的工具，例如特定的扳手和螺絲起子──對任務固定的工作坊來說很有效率。MCP 則像是打造一套通用的標準化插座系統：它本身不提供工具，但任何廠牌、符合規範的工具都能插上就用，工作坊因此能動態擴充、不斷成長。

簡單說：Function Calling 提供對少數特定函式的直接存取；MCP 則是讓 LLM 能發現並使用大量外部資源的標準化通訊框架。簡單的應用有特定工具就夠了；需要適應能力的複雜互聯 AI 系統，就少不了 MCP 這樣的通用標準。

## MCP 的其他考量

MCP 是一個強大的框架，但完整的評估還需要考慮幾個影響它適不適合特定情境的重要面向。我們細看幾點：

* **Tool vs. Resource vs. Prompt：** 理解這幾個元件各自的角色很重要。Resource 是靜態資料（例如 PDF 檔、資料庫記錄）；tool 是執行動作的可呼叫函式（例如寄 email、查詢 API）；prompt 是引導 LLM 如何與 resource 或 tool 互動的模板，確保互動有結構、有效果。
* **可發現性：** MCP 的一大優勢是 client 能動態查詢 server 提供哪些工具和資源。這種「即時發現」機制，對需要在不重新部署的情況下適應新能力的 Agent 來說非常強大。
* **安全性：** 透過任何協定對外提供工具和資料，都需要嚴謹的安全措施。MCP 的實作必須包含身分驗證（authentication）和授權（authorization），控制哪些 client 能存取哪些 server、被允許執行哪些動作。
* **實作：** MCP 雖然是開放標準，實作起來可能不簡單。不過供應商已開始簡化這個過程：例如 Anthropic 或 FastMCP 這類提供 SDK 的方案，把大量樣板程式碼抽象掉，讓開發者更容易建立和連接 MCP 的 client 與 server。
* **錯誤處理：** 完善的錯誤處理策略很關鍵。協定必須定義錯誤（工具執行失敗、server 連不上、無效請求等）如何回報給 LLM，讓它理解失敗原因、有機會改採替代做法。
* **本機 vs. 遠端 server：** MCP server 可以部署在 Agent 所在的同一台機器（本機），也可以部署在別的伺服器（遠端）。處理敏感資料時，本機 server 有速度和安全上的優勢；遠端架構則能讓整個組織共享、可擴展地存取常用工具。
* **隨需 vs. 批次：** MCP 既支援隨需的互動式 session，也支援較大規模的批次處理。怎麼選取決於應用：即時對話 Agent 需要立刻用到工具，資料分析 pipeline 則是成批處理記錄。
* **傳輸機制：** 協定也定義了底層的通訊傳輸層。本機互動使用走 STDIO（標準輸入輸出）的 JSON-RPC，行程間通訊有效率；遠端連線則利用 Streamable HTTP 和 Server-Sent Events（SSE）這類適合網路的協定，實現持久、高效的 client-server 通訊。

Model Context Protocol 用 client-server 模型把資訊流標準化。理解各元件的互動，是掌握 MCP 進階 Agentic 行為的關鍵：

1. **大型語言模型（LLM）：** 核心智慧。它處理使用者請求、擬定計畫，並決定何時需要存取外部資訊或執行動作。
2. **MCP Client：** LLM 的應用或包裝層。它是中介者，把 LLM 的意圖轉譯成符合 MCP 標準的正式請求，負責發現、連接、與 MCP Server 溝通。
3. **MCP Server：** 通往外部世界的閘道。它向任何獲授權的 MCP Client 提供一組 tools、resources 和 prompts。每個 server 通常負責一個特定領域，例如公司內部資料庫的連線、email 服務，或某個公開 API。
4. **選配的第三方（3P）服務：** 這是 MCP Server 所管理並對外提供的實際外部工具、應用或資料來源──真正執行請求動作的終點，例如查詢專有資料庫、與 SaaS 平台互動、呼叫公開的天氣 API。

互動流程如下：

1. **發現：** MCP Client 代表 LLM 向 MCP Server 查詢它提供哪些能力。Server 回覆一份清單（manifest），列出可用的 tools（例如 send_email）、resources（例如 customer_database）和 prompts。
2. **組出請求：** LLM 判斷需要使用某個發現到的工具，比方說決定寄一封 email。它組出請求：指定要用的工具（send_email）和必要的參數（收件人、主旨、內文）。
3. **Client 通訊：** MCP Client 接過 LLM 組好的請求，以標準化的呼叫送到對應的 MCP Server。
4. **Server 執行：** MCP Server 收到請求後，驗證 client 身分、檢查請求有效性，然後對接底層軟體執行指定的動作（例如呼叫 email API 的 send() 函式）。
5. **回應與上下文更新：** 執行完畢後，MCP Server 把標準化的回應送回 MCP Client，說明動作是否成功、附上相關輸出（例如已寄出 email 的確認 ID）。Client 再把結果傳回 LLM，更新它的上下文，讓它能繼續任務的下一步。

## 實際應用與使用情境

MCP 大幅拓寬了 AI／LLM 的能力，讓它們更全能、更強大。以下是九個關鍵情境：

* **資料庫整合：** MCP 讓 LLM 和 Agent 能順暢地存取資料庫中的結構化資料。例如透過 MCP Toolbox for Databases，Agent 能查詢 Google BigQuery 的資料集，取得即時資訊、產生報表、更新記錄，全部由自然語言指令驅動。
* **生成式媒體調度：** MCP 讓 Agent 能整合先進的生成式媒體服務。透過 MCP Tools for Genmedia Services，Agent 可以調度包含 Google Imagen（圖片生成）、Google Veo（影片生成）、Google Chirp 3 HD（擬真語音）、Google Lyria（音樂創作）的工作流程，在 AI 應用中動態產出內容。
* **外部 API 互動：** MCP 為 LLM 呼叫任何外部 API 並接收回應提供了標準化的方式。Agent 因此能抓即時天氣、查股價、寄 email、操作 CRM 系統，能力遠超核心語言模型本身。
* **基於推理的資訊萃取：** 藉助 LLM 強大的推理能力，MCP 支援依查詢而定的高效資訊萃取，超越傳統的搜尋與檢索系統。傳統搜尋工具回傳整份文件；Agent 則能分析文本，精準抽出直接回答使用者複雜問題的那個條款、數字或陳述。
* **自訂工具開發：** 開發者可以打造自訂工具，透過 MCP server 對外提供（例如用 FastMCP）。這讓專門的內部功能或專有系統能以標準化、易於使用的格式提供給 LLM 和其他 Agent，不需要直接改動 LLM。
* **標準化的 LLM 對應用通訊：** MCP 確保 LLM 與其互動的應用之間有一致的通訊層。這降低整合成本、促進不同 LLM 供應商與宿主應用之間的互通，也簡化複雜 Agentic 系統的開發。
* **複雜工作流程調度：** 組合多個透過 MCP 提供的工具和資料來源，Agent 能調度高度複雜的多步驟工作流程。例如：從資料庫撈客戶資料、生成個人化的行銷圖片、起草客製的 email、然後寄出──全靠與不同 MCP 服務的互動完成。
* **IoT 裝置控制：** MCP 能讓 LLM 與物聯網（IoT）裝置互動。Agent 可以透過 MCP 對智慧家電、工業感測器或機器人下指令，用自然語言控制和自動化實體系統。
* **金融服務自動化：** 在金融領域，MCP 能讓 LLM 對接各種金融資料來源、交易平台或法遵系統。Agent 可以分析市場資料、執行交易、生成個人化理財建議、自動化法規申報，全程維持安全且標準化的通訊。

簡而言之，Model Context Protocol（MCP）讓 Agent 能從資料庫、API 和網路資源取得即時資訊，也能執行動作：寄 email、更新記錄、控制裝置，並整合處理多個來源的資料來完成複雜任務。此外，MCP 也支援 AI 應用的媒體生成工具。

## 實作範例（ADK）

本節說明如何連接一個提供檔案系統操作的本機 MCP server，讓 ADK Agent 能與本機檔案系統互動。

### 用 MCPToolset 設定 Agent

要讓 Agent 能操作檔案系統，需要建立一個 `agent.py` 檔（例如放在 `./adk_agent_samples/mcp_agent/agent.py`）。`MCPToolset` 實例化在 `LlmAgent` 物件的 `tools` 清單裡。務必把 `args` 清單中的 `"/path/to/your/folder"` 換成本機上一個 MCP server 可存取目錄的絕對路徑；這個目錄會是 Agent 檔案操作的根目錄。

```python
import os

from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters


# Create a reliable absolute path to a folder named 'mcp_managed_files'
# within the same directory as this agent script.
# This ensures the agent works out-of-the-box for demonstration.
# For production, you would point this to a more persistent and secure location.
TARGET_FOLDER_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "mcp_managed_files",
)

# Ensure the target directory exists before the agent needs it.
os.makedirs(TARGET_FOLDER_PATH, exist_ok=True)

root_agent = LlmAgent(
    model="gemini-2.0-flash",
    name="filesystem_assistant_agent",
    instruction=(
        "Help the user manage their files. You can list files, read files, and write files. "
        f"You are operating in the following directory: {TARGET_FOLDER_PATH}"
    ),
    tools=[
        MCPToolset(
            connection_params=StdioServerParameters(
                command="npx",
                args=[
                    "-y",  # Argument for npx to auto-confirm install
                    "@modelcontextprotocol/server-filesystem",
                    # This MUST be an absolute path to a folder.
                    TARGET_FOLDER_PATH,
                ],
            ),
            # Optional: You can filter which tools from the MCP server are exposed.
            # For example, to only allow reading:
            # tool_filter=['list_directory', 'read_file']
        )
    ],
)
```

`npx`（Node Package Execute）隨 npm（Node Package Manager）5.2.0 以上版本附帶，是一個能直接執行 npm registry 上 Node.js 套件的工具，省去全域安裝的需要。本質上，`npx` 是一個 npm 套件執行器；許多社群 MCP server 以 Node.js 套件的形式發佈，常用它來執行。

建立一個 `__init__.py` 是必要的，這樣 agent.py 才會被 Agent Development Kit（ADK）視為可發現的 Python 套件的一部分。這個檔案要跟 `agent.py` 放在同一個目錄。

```python
# ./adk_agent_samples/mcp_agent/__init__.py 
from . import agent
```

當然，其他支援的指令也可以用。例如連接 python3 可以這樣做：

```python
connection_params = StdioConnectionParams(
    server_params={
        "command": "python3",
        "args": ["./agent/mcp_server.py"],
        "env": {
            "SERVICE_ACCOUNT_PATH": SERVICE_ACCOUNT_PATH,
            "DRIVE_FOLDER_ID": DRIVE_FOLDER_ID,
        },
    }
)
```

在 Python 的語境中，UVX 指的是一個利用 uv、在暫時性隔離 Python 環境中執行指令的命令列工具。簡單說，它讓你不必把 Python 工具和套件安裝到全域或專案環境裡就能執行。你可以透過 MCP server 執行它。

```python
connection_params = StdioConnectionParams(
    server_params={
        "command": "uvx",
        "args": ["mcp-google-sheets@latest"],
        "env": {
            "SERVICE_ACCOUNT_PATH": SERVICE_ACCOUNT_PATH,
            "DRIVE_FOLDER_ID": DRIVE_FOLDER_ID,
        },
    }
)
```

MCP Server 建好之後，下一步就是連上它。

## 用 ADK Web 連接 MCP Server

首先執行 'adk web'：在終端機切換到 mcp_agent 的上層目錄（例如 adk_agent_samples），然後執行：

```python
cd ./adk_agent_samples # Or your equivalent parent directory 
adk web
```

ADK Web UI 在瀏覽器載入後，從 Agent 選單選擇 `filesystem_assistant_agent`，接著試試這些 Prompt：

* 「Show me the contents of this folder.」
* 「Read the `sample.txt` file.」（假設 `sample.txt` 位於 `TARGET_FOLDER_PATH`。）
* 「What's in `another_file.md`?」

## 用 FastMCP 建立 MCP Server

FastMCP 是一個高階的 Python 框架，專門簡化 MCP server 的開發。它提供一層抽象，把協定的複雜細節藏起來，讓開發者專注在核心邏輯上。

這個函式庫讓你用簡單的 Python 裝飾器快速定義 tools、resources 和 prompts。一大優勢是自動的 schema 生成：它會聰明地解讀 Python 函式的簽章、型別提示（type hints）和文件字串（docstring），組出 AI 模型所需的介面規格。這種自動化減少了手動設定，也降低了人為錯誤。

除了基本的工具建立，FastMCP 還支援進階的架構模式，例如 server 組合（composition）和代理（proxying）。這讓複雜的多元件系統能模組化開發，也讓既有服務能無縫整合進 AI 可存取的框架。此外，FastMCP 針對高效、分散式、可擴展的 AI 應用做了最佳化。

## 用 FastMCP 架設 server

舉例來說，考慮 server 提供的一個基本 "greet" 工具。它啟動之後，ADK Agent 和其他 MCP client 就能透過 HTTP 與這個工具互動。

```python
# fastmcp_server.py
# This script demonstrates how to create a simple MCP server using FastMCP.
# It exposes a single tool that generates a greeting.
# 1. Make sure you have FastMCP installed:
# pip install fastmcp

from fastmcp import FastMCP, Client


# Initialize the FastMCP server.
mcp_server = FastMCP()


# Define a simple tool function.
# The `@mcp_server.tool` decorator registers this Python function as an MCP tool.
# The docstring becomes the tool's description for the LLM.
@mcp_server.tool
def greet(name: str) -> str:
    """
    Generates a personalized greeting.

    Args:
        name: The name of the person to greet.

    Returns:
        A greeting string.
    """
    return f"Hello, {name}! Nice to meet you."


# Or if you want to run it from the script:
if __name__ == "__main__":
    mcp_server.run(
        transport="http",
        host="127.0.0.1",
        port=8000,
    )
```

這個 Python 腳本定義了一個名為 greet 的函式：接收一個人名、回傳個人化的問候語。函式上方的 @tool() 裝飾器自動把它註冊成 AI 或其他程式可用的工具。FastMCP 會利用函式的文件字串和型別提示告訴 Agent 這個工具怎麼用、需要什麼輸入、會回傳什麼。

腳本執行時會啟動 FastMCP server，在 localhost:8000 監聽請求，讓 greet 函式變成一個網路服務。Agent 可以設定成連上這個 server，在更大的任務中用 greet 工具產生問候語。server 會一直執行，直到手動停止。

## 用 ADK Agent 使用 FastMCP Server

ADK Agent 可以設定成 MCP client，使用執行中的 FastMCP server。這需要用 FastMCP server 的網路位址（通常是 <http://localhost:8000>）設定 HttpServerParameters。

可以加上 `tool_filter` 參數，把 Agent 能用的工具限縮在 server 提供的特定工具上，例如 'greet'。當收到「Greet John Doe」這樣的請求時，Agent 內嵌的 LLM 會辨識出 MCP 上可用的 'greet' 工具，帶著引數 "John Doe" 呼叫它，回傳 server 的回應。這個流程展示了「使用者自訂、透過 MCP 提供的工具」與 ADK Agent 的整合。

要完成這個設定，需要一個 agent 檔案（例如放在 ./adk_agent_samples/fastmcp_client_agent/ 的 agent.py）。這個檔案會實例化一個 ADK Agent，用 HttpServerParameters 與運作中的 FastMCP server 建立連線。

```python
# ./adk_agent_samples/fastmcp_client_agent/agent.py
import os

from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, HttpServerParameters


# Define the FastMCP server's address.
# Make sure your fastmcp_server.py (defined previously) is running on this port.
FASTMCP_SERVER_URL = "http://localhost:8000"

root_agent = LlmAgent(
    model="gemini-2.0-flash",  # Or your preferred model
    name="fastmcp_greeter_agent",
    instruction='You are a friendly assistant that can greet people by their name. Use the "greet" tool.',
    tools=[
        MCPToolset(
            connection_params=HttpServerParameters(
                url=FASTMCP_SERVER_URL,
            ),
            # Optional: Filter which tools from the MCP server are exposed
            # For this example, we're expecting only 'greet'
            tool_filter=["greet"],
        )
    ],
)
```

這個腳本定義了一個名為 `fastmcp_greeter_agent` 的 Agent，使用 Gemini 語言模型。它收到明確的指示：扮演友善的助理，任務是跟人打招呼。關鍵在於，程式碼給了這個 Agent 完成任務的工具：它設定一個 MCPToolset 連到 localhost:8000 上的另一個 server──也就是前一個範例的 FastMCP server──並明確授權 Agent 使用該 server 上的 greet 工具。本質上，這段程式碼架好了系統的 client 端：一個知道自己的目標是問候別人、也確切知道該用哪個外部工具來完成它的智慧 Agent。

在 `fastmcp_client_agent` 目錄裡建立 `__init__.py` 是必要的，這樣 ADK 才能把這個 Agent 辨識為可發現的 Python 套件。

開始前，先開一個新終端機執行 `python fastmcp_server.py` 啟動 FastMCP server。接著在終端機切換到 `fastmcp_client_agent` 的上層目錄（例如 `adk_agent_samples`），執行 `adk web`。ADK Web UI 在瀏覽器載入後，從 Agent 選單選擇 `fastmcp_greeter_agent`，然後輸入「Greet John Doe」之類的 Prompt 測試。Agent 會使用你 FastMCP server 上的 `greet` 工具來組出回應。

## 速覽

**問題：** 要成為有效的 Agent，LLM 必須超越單純的文字生成：它們需要與外部環境互動，存取最新資料、使用外部軟體。沒有標準化的溝通方式，LLM 與每一個外部工具或資料來源的整合，都是一次客製、複雜、無法重用的工程。這種土法煉鋼的做法阻礙擴展，讓打造複雜、互聯的 AI 系統又難又沒效率。

**解法：** Model Context Protocol（MCP）的標準化解法，是充當 LLM 與外部系統之間的通用介面。它建立了一個開放的標準化協定，定義外部能力如何被發現和使用。MCP 以 client-server 模型運作：server 向任何符合規範的 client 提供 tools、資料 resources 和互動式 prompts；LLM 驅動的應用作為 client，以可預測的方式動態發現並使用這些資源。這種標準化做法培養出一個由可互通、可重用元件組成的生態系，大幅簡化複雜 Agentic 工作流程的開發。

**經驗法則：** 打造需要對接多樣且持續演變的外部工具、資料來源和 API 的複雜、可擴展或企業級 Agentic 系統時，就用 MCP。當「不同 LLM 與工具之間的互通性」是優先考量、或 Agent 需要不重新部署就動態發現新能力時，它是首選。至於功能固定、數量有限的簡單應用，直接用工具的 Function Calling 可能就夠了。

**圖解：**

![Model Context Protocol](/assets/agentic-design-patterns/Model_Context_Protocol.png)

圖 1：Model Context Protocol。

## 重點回顧

幾個重點：

* Model Context Protocol（MCP）是開放標準，讓 LLM 與外部應用、資料來源和工具之間的溝通標準化。
* 它採用 client-server 架構，定義 resources、prompts 和 tools 的提供與使用方式。
* Agent Development Kit（ADK）既支援使用現成的 MCP server，也支援把 ADK 工具透過 MCP server 對外提供。
* FastMCP 簡化了 MCP server 的開發與管理，特別適合把 Python 實作的工具對外提供。
* MCP Tools for Genmedia Services 讓 Agent 能整合 Google Cloud 的生成式媒體能力（Imagen、Veo、Chirp 3 HD、Lyria）。
* MCP 讓 LLM 和 Agent 能與真實世界的系統互動、取得動態資訊、執行文字生成之外的動作。

## 結語

Model Context Protocol（MCP）是促進大型語言模型（LLM）與外部系統溝通的開放標準。它採用 client-server 架構，讓 LLM 能存取 resources、使用 prompts，並透過標準化的 tools 執行動作。MCP 讓 LLM 能操作資料庫、管理生成式媒體工作流程、控制 IoT 裝置、自動化金融服務。實作範例示範了如何設定 Agent 與 MCP server 溝通，包括檔案系統 server 和用 FastMCP 打造的 server，展示它與 Agent Development Kit（ADK）的整合。MCP 是開發「超越基本語言能力的互動式 AI Agent」的關鍵元件。

## 參考資料

1. Model Context Protocol (MCP) Documentation. (Latest). *Model Context Protocol (MCP)*. [https://google.github.io/adk-docs/mcp/](https://google.github.io/adk-docs/mcp/)
2. FastMCP Documentation. FastMCP. [https://github.com/jlowin/fastmcp](https://github.com/jlowin/fastmcp)
3. MCP Tools for Genmedia Services. *MCP Tools for Genmedia Services*. [https://google.github.io/adk-docs/mcp/#mcp-servers-for-google-cloud-genmedia](https://google.github.io/adk-docs/mcp/#mcp-servers-for-google-cloud-genmedia)
4. MCP Toolbox for Databases Documentation. (Latest). *MCP Toolbox for Databases*. [https://google.github.io/adk-docs/mcp/databases/](https://google.github.io/adk-docs/mcp/databases/)
