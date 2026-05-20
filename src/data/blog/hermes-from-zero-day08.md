---
title: "Day 08:MCP 是什麼,為什麼大家都在喊"
description: "Anthropic 那個 USB-C-of-tools 規格,Hermes 怎麼接、怎麼自己也當 server。"
pubDatetime: 2026-05-12T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

打開 `acp_adapter/__init__.py`,第一行寫:

```python
"""ACP (Agent Communication Protocol) adapter for hermes-agent."""
```

打開隔壁的 `acp_adapter/server.py`,第一行寫:

```python
"""ACP agent server — exposes Hermes Agent via the Agent Client Protocol."""
```

**同一個資料夾,兩個檔案,ACP 的全名寫成兩種不同東西**——一個說「Communication」,一個說「Client」。這不是 typo,是 Hermes 真的搞混了 IBM Research 的 Agent Communication Protocol 跟 Zed Industries 的 Agent Client Protocol。`acp_adapter/` 從 `acp` 套件 import,實際是 Zed 那個 Agent Client Protocol(編輯器 ↔ agent),但 init 檔卻寫了 IBM 那個名字。

連 Hermes 自己都會把這兩個 ACP 搞混——所以你今天讀 MCP 跟 ACP 這篇時,我會多花一段把這個地雷拆給你看。今天主題:MCP 是什麼、Hermes 怎麼接、Hermes 怎麼自己也當 server,以及 ACP 兩個版本到底差在哪。

想像你同時要讓 agent 接 Google Calendar、Notion、再加上一台自己寫的 LSP server,你就得老老實實寫三套 adapter,每一套都要自己定義「列出可用工具」「呼叫某個工具」「處理錯誤」的格式。寫到第三個你會發現這三套 schema 長得幾乎一模一樣,只是命名不一致——`listTools` vs `list_tools` vs `tools.enumerate`——大家都在重複造同一個輪子,還造得歪七扭八。

MCP 就是要解這件事。

> 上一篇我們聊工具系統,我留下一個鉤子:寫第三個工具時你會想——能不能用別人寫的?今天就來拆這件事,而且會發現它牽出的東西比想像中大。

---

## 一、MCP 到底是什麼

**MCP = Model Context Protocol**,Anthropic 在 2024 年 11 月公布的開放協定。一句話講完它的目的:**讓 tool、resource、prompt 跨 agent framework 可重用**。

你寫一個 MCP server 去包 Google Calendar,Claude Desktop、Cursor、Codex、Hermes 都能直接接上來用——你不用為每個 framework 各寫一份 adapter,各種 agent 框架也不用為每個第三方服務各寫一個 plugin。

它定義三種 primitive(基本單位):

- **tools** — function call,你呼叫他、他回結果。就是 Day 7 講的那種「副作用入口」,只是換成跨程序的形式。
- **resources** — 可以被 attach 到 context 的內容。檔案、網頁、DB 查詢結果之類,語意是「這份資料給你讀」而不是「你去做這件事」。
- **prompts** — 預先定義好的對話起點,等於官方支援的「prompt template 共享」。

> **白話比喻(社群常用)**:MCP 之於 agent tool,像 USB-C 之於充電線。你不用為每台手機買專屬線,也不用每家工具供應商各寫一份 adapter。
>
> (順手澄清一下出處:這個比喻**不是** Anthropic 2024/11 公告原文用的——當時官方寫的是更乾的「universal, open standard for connecting AI systems with data sources」。USB-C 是社群衍生的講法,最早出現在各家技術部落格(我推測),後來被講到爛大街。我這邊保留這個比喻是因為它確實精準,但歸屬要說清楚。)

它跑在 stdio 或 HTTP 上,訊息是 JSON-RPC 2.0。設計刻意樸實——**這個協定的價值不在技術新穎,在於「夠多人同意用同一份規格」**。寫過 LSP 的人應該很熟,LSP 把編輯器跟語言伺服器解耦,讓 VSCode、Neovim、Emacs 不用各寫一遍 Go 的型別檢查;MCP 在 agent ↔ 外部工具這層做了一樣的事。

(對,我也覺得「Model Context Protocol」這名字取得很糟,聽起來像在做 RAG。但這個名字就這樣了。)

---

## 二、Hermes 怎麼接 MCP——當 client

Hermes 把 MCP 當成**一個 adapter**接進來。實際路徑上,他既扮演 MCP client(去消費別人的 server),也扮演 MCP server(把自己暴露出去)。先講 client 端。

MCP client 的職責很單純:啟動別人的 MCP server(通常是個子程序,跑在 stdio 上)、問他「你有哪些 tools」、把這些 tools 註冊到 agent 的工具表裡、之後 agent 想呼叫就轉發過去。

先停一下,講一個容易被忽略的細節:MCP server 通常是一個獨立的子程序,跑在 stdio 上。Hermes 啟動的時候要 fork 出去、保持那條管道、處理 server 端 crash、處理 timeout、處理 server 慢吞吞回應的時候 agent 怎麼辦。這些 plumbing 通通封在 client 那一層,**對核心迴圈不可見**。

**重點來了**:MCP server 接進來之後,他暴露出來的工具跟「Hermes 內建工具」**走同一個 dispatch 路徑**。

什麼意思?還記得 Day 7 講的工具系統嗎?核心迴圈拿到 LLM 吐出來的 tool call,丟給 dispatcher,dispatcher 查表、找到對應的 handler、執行、回結果。對核心迴圈來說:

- `terminal`(內建工具)→ 查表 → 跑本機 shell → 回結果
- `gcal.list_events`(MCP 工具)→ 查表 → 透過 stdio JSON-RPC 問 server → 回結果

**核心迴圈不知道它是 MCP 還是 native。** 兩者長得一模一樣,因為他們都實作了同一個工具介面,只是後端不同——一個跑在本機,一個跑在跨程序的 RPC 後面。

這就是「把第三方東西接進來」的乾淨方式。Hermes 沒有為 MCP 開一個分支邏輯,沒有「if tool came from MCP, do something special」。MCP 工具被**翻譯**成 native 工具的形狀,然後就解散了——後面整段流程跟 Day 7 一字不差。

---

## 三、Hermes 也能當 MCP server——協定對稱性

這裡開始變有趣。Hermes 不只能當 MCP client,**自己也能當 MCP server 對外開放**。實作在 `mcp_serve.py`(對,就放在 repo 根目錄,跟 `cli.py` 平輩)。

`create_mcp_server()` 起一個 FastMCP stdio server,暴露大約 10 個工具:`conversations_list`、`messages_read`、`events_poll`、`messages_send`、之類的。任何 MCP client——Claude Desktop、Cursor、另一個 Hermes——把這個 server 加進設定檔,就拿到了一座**通往 Hermes 內部狀態的橋**。你可以從 Cursor 裡面查「我跟某個使用者上週 Slack 上聊過什麼」,因為 Hermes 替你保存了那段對話。

順手補一個容易被忽略的點:**MCP 在規格層就是雙向的**。我前面只列了 server 對 client 暴露的三個 primitive(tools/resources/prompts),但 spec 還定義了 client 對 server 暴露的三個能力——**sampling**(讓 server 反過來請 client 跑 LLM 推論)、**roots**(讓 server 問 client「我可以動哪些檔案 / URI」)、**elicitation**(讓 server 反過來向使用者問問題)。所以「對稱性」不是 Hermes 加的,是**協定本身就長這樣**:兩邊各有自己能讓對方用的東西,誰當 client 誰當 server 只是角色標籤。這也是為什麼 Hermes 能一邊當 client 一邊當 server 而不需要寫兩套核心——協定設計者早就替我們把這條路鋪平了。

> **這就是暗線 A 第二次明顯出現**:核心 agent loop 是 protocol-agnostic 的,而**協定方向也是 symmetric** —— 進來、出去同一套介面。
>
> Day 5 是第一次明顯(provider 抽象:OpenAI、Anthropic、Gemini、本機 model 全是 driver,核心不知道對面是誰)。
> Day 8 是第二次:**MCP 兩個方向都通**。Hermes 既可以消費別人寫的 MCP server,也可以把自己變成別人能消費的 MCP server。

這個對稱性不是運氣。是因為核心迴圈被設計成「我不在乎是誰在跟我講話、我也不在乎我講話的對象是誰」,所以你可以從任一邊接上去——核心都不用改。

---

## 四、對稱性的威力:A 呼叫 B,B 又呼叫 C

把這個對稱性推到極致,會看到一個很漂亮的構圖。

你可以把一個 Hermes(叫他 A 好了)當成**另一個 Hermes**(B)的工具。B 的 agent loop 看到一個叫做 `ask_hermes_a` 的 MCP 工具,呼叫它——對 B 來說這跟呼叫 `terminal` 沒有兩樣。但 A 收到請求之後,他自己也是個完整的 agent,他可以再去呼叫第三方的 MCP server(姑且叫 C)。

```
B ──MCP──> A ──MCP──> C
```

整個鏈裡面,**沒有任何一段需要知道全圖**。B 只知道「我有個 tool 叫 A」;A 只知道「我有個 tool 叫 C」;C 完全不知道有人是透過 A 在叫他。這跟 HTTP 的 proxy chain、Unix 的 pipe、function call 的 call stack 是同一種美學——**每一段只負責自己那一節,組合性從協定的對稱性自然長出來**。

我第一次想清楚這件事的時候,真心覺得「啊,難怪這個設計值得學」。不是因為 MCP 多了不起,而是因為**把 agent 設計成 protocol-agnostic 的核心,讓「組合」變成幾乎免費**。

順著這個構圖往下推會更有趣:你可以讓 A 變成一個專門做研究的 agent、B 是一個專門寫程式的 agent、C 是一個專門查公司內部資料的 MCP server。B 寫程式遇到要查資料時,呼叫 A;A 回去查 C,把結果整理好回給 B。整條鏈完全沒有任何一個 framework 在中心調度——**這個拓樸是從 MCP 的對稱性自然長出來的,不需要額外蓋一層 orchestrator**。

(這也是為什麼最近一年「multi-agent」這個詞變得這麼熱——不是因為大家發明了什麼新東西,而是因為 MCP 把「agent 之間能不能對話」這個問題的協定地基終於鋪好了。)

---

## 五、不只 MCP — 同一個核心,還有 batch 和 cron

順著這條線往下看,你會發現 MCP 只是這個對稱性的其中一個出口。repo 根目錄翻一翻:

- `mcp_serve.py` — 把自己當 MCP server 對外
- `batch_runner.py` — 批次跑分,把 agent 灌一千個 prompt 來生訓練軌跡
- `mini_swe_runner.py` — 一個 SWE-bench 風格的迷你 agent 跑分器
- `cron/jobs.py`、`cron/scheduler.py` — 定時任務的排程器
- `acp_adapter/` — 等下會講

這每一個都是一個 **driver(驅動者)**。他們的差別在「trigger 從哪來」:

| Driver | Trigger 從哪來 |
|---|---|
| CLI | 你在 terminal 打字 |
| Gateway(明天的主題) | Slack/Discord/HTTP webhook |
| MCP server | 另一個 agent 透過 JSON-RPC 戳進來 |
| Batch runner | 一個 dataset 的下一筆 prompt |
| Cron | 時間到了 |
| Zed ACP | 編輯器(Zed 等)透過 stdio 發 prompt |

**但所有這些 trigger 最後都跑同一段 `AIAgent.run_conversation()`。** 每個 driver 就只負責:把外部的觸發訊號翻譯成「一段對話的開頭」,然後把後續事件翻譯成 driver 自己的協定。中間那段——LLM 對話、工具呼叫、context 壓縮、provider failover——全是同一段程式碼。

這就是 Day 2 那個鉤子的回收:「核心迴圈是個 protocol」——是的,他不只是個 protocol,他還是個**會被六七種不同情境驅動的 protocol**。一個 bug 修一次到處生效;一個新功能加一次到處可用。

當然這個設計也有代價:`AIAgent.__init__` 要吃六七十個關鍵字參數(因為要服務所有 driver 的需求),而 `run_agent.py` 大到誇張。這個結構性債務 Day 14 會正面開砲,先在這裡記一筆。

> **Note**:你如果翻過 `cron/scheduler.py`,會看到一堆很奇怪的硬化設計:`tick()` 在跑任何 job 之前先 pre-advance(把下次執行時間往前推);`wakeAgent` 閘門用一個便宜的腳本決定要不要叫醒昂貴的 agent;`_scan_assembled_cron_prompt` 掃描「組裝後」的 prompt 而不只是使用者輸入。這些每一個都是被坑過之後留下的疤——但底層永遠是同一句話:**trigger 不一樣,核心同一段**。cron driver 多的不是 agent 邏輯,是「怎麼可靠地、安全地、在沒有人盯著的情況下,把 trigger 送進核心」的硬化。

---

## 六、ACP 又是什麼(以及為什麼這三個字母會讓人崩潰)

講完 MCP,要順手提一個更新一點的標準:**ACP**。但在動手之前先打預防針——**ACP 這縮寫有兩個完全不同的協定共用**,而且都跟 agent 有關,標題黨成這樣不是我能力範圍內可以救的:

1. **IBM Research 的 Agent Communication Protocol**(2025/03 公布)——解的是 **agent-to-agent** 通訊,HTTP-native、async、SSE streaming(Server-Sent Events,讓 server 透過一條長連線單向把訊息一段一段推給 client,是 HTTP 上做即時 streaming 的標準做法)。2025/08 已併入 Google 的 **A2A** 協定、由 Linux Foundation 託管。換句話說,**這個 ACP 已經不獨立存在了**,要講 agent 之間怎麼對話現在請改稱 A2A。
2. **Zed Industries 的 Agent Client Protocol**——解的是 **editor / client ↔ agent**,JSON-RPC 2.0 over stdio,目的是讓 Zed(以及 JetBrains、Neovim 等任何 ACP-compatible editor)把一個 AI agent 當子程序驅動。

**Hermes 的 `acp_adapter/` 接的是第二個——Zed Industries 的 Agent Client Protocol**。從 `server.py` 開頭 docstring 寫的「exposes Hermes Agent via the Agent Client Protocol」、以及 import 的 `acp` 套件(這是 Zed 維護的 Python schema)都可以確認。

但這裡有個非常坦白的尷尬:**Hermes 自己 `acp_adapter/__init__.py` 第一行就寫錯成「Agent Communication Protocol」(IBM 那個名字)**。實際 import、實際跑的協定是 Zed 那個 Agent Client Protocol——**內部命名跟實際實作打架**。我把這個小笑話直接寫進來不是要黑自己,是因為它正好證明這個縮寫已經混亂到連寫實作的人都會搞混。(這個 typo 我得開個 issue 修。)

回到正題。Zed ACP 是個 JSON-RPC 2.0 over stdio 的協定,寫過 LSP 的人應該秒懂——**這就是「LSP 的 agent 版」**。編輯器是 client,agent 是 server,生命週期方法叫 `initialize`、`new_session`、`prompt`、`cancel`、`set_session_model`。`acp_adapter/` 目錄下整整 10 個檔案,從 `auth.py`、`edit_approval.py`、`events.py` 到 81KB 的 `server.py`,全是為這個協定服務的。

修正一下方向對比(我之前的版本講錯了):

> **MCP 解的是「agent ↔ tool」**(agent 怎麼用外部工具)
> **Zed ACP 解的是「editor/client ↔ agent」**(編輯器怎麼驅動一個 agent)
> **A2A(前 IBM ACP)解的是「agent ↔ agent」**(agent 之間怎麼對話)——這個 Hermes 目前沒接,Day 11 講 multi-agent 時會再回來。
>
> 三個協定方向、層次都不同,但對 Hermes 來說都是同一件事:**driver,接到同一個核心上**。

Hermes 同時支援前兩個。他可以是 MCP client、MCP server、Zed ACP server(編輯器透過 stdio 把他當子程序驅動)——**同一個專案,在兩個協定上扮演三種角色**。這個事實本身就是「一個核心多種驅動」最濃縮的證明。

(誠實標一下:Zed ACP 比 MCP 更新、生態更小,目前主要是 Zed 在推,JetBrains、Neovim、Toad 之類的 ACP 客戶端都還很早期。我沒親自部署過 Zed editor 接 Hermes 的完整流程,以官方文件為準。)

---

## 七、為什麼大家都在喊 MCP

繞回標題的問題。為什麼 2024 年底開始 MCP 突然到處都是?

不是因為他技術上多神奇。**是因為他剛好是這個生態系第一個夠多人同意的協定。** 在他之前,每個 agent framework 都在自己造「我這邊的 plugin 怎麼寫」的輪子:LangChain 有 LangChain 的、AutoGen 有 AutoGen 的、各家 agentic IDE 也都自己一套。每個 plugin 作者只能挑陣營,沒辦法寫一份服務全部。

MCP 解的是「Schelling point」問題(賽局論裡的「謝林點」:多方在沒有溝通的情況下,會自然地聚到某個顯眼、夠樸實的選項上)——當大家都需要一份共同的協定來協調,**誰先公布、夠簡單、夠開放,誰就贏**。Anthropic 公布、規格夠樸實、reference implementation 又有,就成了。

把 2025 一整年的時間軸串起來看會更清楚這事多誇張:**2024/11/25** Anthropic 公布 MCP → **2025/03** OpenAI 官方宣布支援 MCP(這是它從「Anthropic 提案」變「跨家共識」的決定性時刻)→ **2025/08** IBM 那個 Agent Communication Protocol 併入 Google A2A、交給 Linux Foundation 託管。從廠商協定一路被各家擁抱、又陸續被中立基金會接手,這個速度本身就是 Schelling point 成立的證據——MCP 確實已經在成為事實標準。

跟 Hermes 的「一個核心多種驅動」對照來看,這兩件事其實是同一個道理在不同尺度上發生:

- **專案內部**:把核心做成 protocol-agnostic,讓 CLI/Web/Cron/MCP 都接得上。
- **生態系層級**:把「agent ↔ tool」做成 protocol-agnostic,讓任何 framework 都接得上同一個 tool server。

**好的協定設計,本質都是在切耦合。**

值得記在筆記本裡的一條:**當你發現自己在不同地方寫同一種 adapter 第三次,該停下來問的不是「怎麼重構這三份程式碼」,而是「這條邊界值不值得抽出一個協定」**。前者是內部重構,後者是讓整個生態系都能受益。MCP 是後者最近一個成功的例子,Hermes 的「一個核心多種驅動」是前者在單一專案內的版本——兩者其實是同一個直覺,只是規模不同。

---

## 小結

Hermes 把 MCP 當成又一個 adapter 接進來,**MCP 工具跟內建工具走同一條 dispatch 路徑**——核心迴圈分不出差別。更狠的是,Hermes 自己也能當 MCP server 對外,讓另一個 agent 把他當工具用。批次跑分、cron、Zed ACP 全是同一回事:driver 不同,核心同一段。今天我們看到了暗線 A 第二次明顯出現:**核心 protocol-agnostic,連協定方向都對稱**。

但講完 MCP 跟 Zed ACP,你應該會冒出一個問題:那 Hermes 怎麼接 Slack、Discord、X、cron job、HTTP webhook?他不可能每種都重寫一遍吧?明天 **gateway 登場**——一個 agent 接全世界,是怎麼做到的。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `mcp_serve.py` | Hermes 當 MCP server,暴露 ~10 個 messaging 工具給外部 client |
| `acp_adapter/server.py` | Hermes 當 Zed ACP(Agent Client Protocol)server,把編輯器的協定翻譯成對 `AIAgent` 的操作(81KB,巨石檔案候選) |
| `acp_adapter/entry.py` | Zed ACP 進入點,`acp.run_agent(use_unstable_protocol=True)` 跑 stdio |
| `acp_adapter/events.py` | callback 工廠,把 `AIAgent` 事件翻譯成 Zed ACP `session_update` |
| `acp_adapter/permissions.py` + `edit_approval.py` | 兩層核可橋接:危險指令、編輯前 diff 預覽 |
| `batch_runner.py` | 批次跑分 driver,內容定址續跑 |
| `mini_swe_runner.py` | 最小 single-tool agent 迴圈(刻意不用完整 `AIAgent`) |
| `cron/scheduler.py` | cron driver 主體,`tick()` pre-advance、`wakeAgent` 閘門、`_scan_assembled_cron_prompt` 都在這 |
| `cron/jobs.py` | cron job 的資料結構與序列化 |
| `providers/` | provider profile 的宣告式 registry,Day 5 的延伸 |

切入點建議:從 `mcp_serve.py` 看一次「Hermes 怎麼把自己變成 MCP server」,再翻 `acp_adapter/entry.py` 看一次「外部協定怎麼接到 `AIAgent`」,你就會看到那個「每個 driver 都長一樣的形狀」的模式。
