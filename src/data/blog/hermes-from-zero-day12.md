---
title: "Day 12:CLI、Web、Cron — 同一個腦袋三張臉"
description: "JSON-RPC、PTY、SessionDB——三個介面共用一份核心,Hermes 是怎麼做到的。"
pubDatetime: 2026-05-16T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

Agent 寫到一個程度,你大概都會撞到三種使用者:terminal 派、瀏覽器派、和「可不可以自動跑」派。三種介面,三種 input 方式、三種 output 處理、三種狀態保存方式。

直覺寫法是各做各的——CLI 一份 codebase 自己 parse argv、自己管 stdin/stdout、自己 print streaming;Web 一份 FastAPI + WebSocket,訊息格式跟 CLI 完全不一樣;cron 又是第三份,定時任務、retry、log 全部自己刻。寫完才會發現一個更頭痛的問題:**session 狀態怎麼同步?** CLI 開的對話,使用者打開瀏覽器要能接著聊;cron 半夜跑的結果,白天要能在 terminal 回看。三套各自 implement 一個 session 概念,改一個 prompt 三邊都要改,修一個 bug 三邊都要驗,bug 也乘以三。

Hermes 的答案很簡潔:**同一個核心,三張臉**——一段 business logic、三個 adapter、共用一顆狀態庫。今天就拆這件事。

> 上一篇我們講 Kanban,那是「agent 跟 agent」之間怎麼分工。今天往另一個方向走——「使用者跟 agent」之間怎麼接。同一個腦袋,要長出三張臉:一張在 terminal、一張在瀏覽器、一張在 cron 排程裡。

---

## 一、三套介面,一個 JSON-RPC server

先講結論,再講為什麼。

Hermes 的 CLI、TUI、Web 三套介面,**全部對著同一個 JSON-RPC server 講話**。那個 server 在 `tui_gateway/server.py` 的 `dispatch()` 裡——所有的指令(`/model`、`/skills`、`/resume` 等等)、所有的事件(message delta、tool start、subagent 開始)都走這個派發器。

差別只在兩件事:**傳輸層**和**渲染面**。

- CLI 是個 subprocess,跟 server 用 stdio 換行 JSON-RPC 講話。
- TUI(`hermes --tui`)也是 subprocess,但渲染面是 Ink fork 寫的終端機 UI。
- Web 兩種模式:聊天頁面其實**就是 TUI 被搬進瀏覽器**(等等講);儀表板頁面用 WebSocket(`/api/ws`)跟同一個 server 講 JSON-RPC。

換句話說,業務邏輯只有一份,「對外的嘴巴」三份。

### 為什麼是 JSON-RPC,不是 REST?

這個選擇我覺得值得停下來想一下。一般做 web service,直覺都是 REST——`GET /sessions`、`POST /messages`、回 JSON 完事。但 agent loop 不適合 REST,有三個原因:

1. **連線是長的**。一次 agent 對話可能跑五分鐘,中間吐 50 個 token chunk、3 個 tool call、2 個 subagent。REST 一個 request 對一個 response,這種型態根本套不上。
2. **方向是雙向的**。server 會主動推 event 給 client(「我剛叫了一個 tool」「subagent 回來了」),client 也會反問 server(「使用者剛剛按 ctrl-c,你要中斷嗎」)。REST 預設是 client 拉、server 推不出來。
3. **streaming 很自然**。JSON-RPC over stdio/WebSocket,每一行就是一個 message,client 端拿到一行就 dispatch 一次,跟 LLM provider 吐 SSE 的節奏天然對上。

REST 不是不能做,是「能做但要硬刻」。JSON-RPC 對 agent 來說是順著紋路長出來的。

> **Note**:JSON-RPC 是個非常小的協定——一個 method name、一包 params、一個 id,回應對著 id 把 result 或 error 丟回去。比起 gRPC 輕、比起 REST 雙向友善,而且因為是純 JSON,在 stdio 上一行一個 message,debug 起來很爽。

---

## 二、CLI 的祕密武器:PTY

如果你只把 CLI 想成「一個會 print 文字的腳本」,你會錯過 Hermes 在 `hermes_cli/pty_bridge.py` 裡藏的一個關鍵技巧——**PTY**(pseudo-terminal,偽終端機)。

先講為什麼這件事重要。

你自己寫過 agent 要呼叫 shell command 嗎?第一版幾乎都長這樣:

```python
result = subprocess.run(["git", "status"], capture_output=True)
agent.observe(result.stdout)
```

`git status` 沒問題。但等到 agent 想跑 `vim`、`less`、`htop`、`ssh`,或者任何會用 escape sequence 畫 UI 的工具,**全部都會壞掉**。為什麼?

因為這些工具會去問環境:「我是不是接在 terminal 上?」如果不是(`subprocess.run` 就不是,它接的是 pipe),它們會切換成「dumb mode」:不畫 UI、不上色、有時候直接拒絕跑。`vim` 會抱怨 `Vim: Warning: Output is not to a terminal`;`less` 會直接把全部內容噴到 stdout;`ssh` 會跟你說「pseudo-terminal will not be allocated」。

PTY 解決這件事。你開一個 PTY,subprocess 接到 PTY 的 slave 端,subprocess 一查「我是不是 terminal」會得到 yes。它就會吐真正的 terminal escape sequence、會接受你的 ctrl-c、會跟你正常互動。你的 agent 接 PTY 的 master 端,雙向 read/write,就像你坐在 terminal 前面打字一樣。

**90% 的 agent framework 這件事都做不對**。他們的 sandbox 拿 `subprocess.run` 一接,然後就跟使用者說「我們不支援互動式工具」。Hermes 不是——`hermes --tui` 跑在 PTY 裡,所以它的 slash 指令彈出層、模型選擇器、整套 TUI,都拿得到真實的 termcap 跟 ANSI 處理。同一招在 Web 端被重用得更兇,等等講。

---

## 三、Web 端的偷懶之道:不要 port UI,要 port terminal

來看 Hermes 的 Web 聊天頁怎麼做的。如果是你,你會怎麼做?

直覺:寫一套 React UI,把 CLI 的訊息格式 mapping 到 DOM 上,訊息泡泡、tool call 卡片、streaming 動畫,通通重寫一次。我自己第一次寫 Web 版就是這樣——重寫到一半我就發現我在做「重新實作 CLI 已經有的東西」,只是換個渲染器。

Hermes 的做法讓我笑出來:**Web 的聊天頁面,根本不是原生 web UI**。它是 `@xterm/xterm`(瀏覽器裡的終端機模擬器,用 WebGL 畫)——透過 WebSocket 連到伺服器端的一個 PTY,**那個 PTY 裡跑的是貨真價實的 `node ui-tui/dist/entry.js`,也就是 TUI 本人**。

你在瀏覽器裡看到的「網頁聊天」,實際上是:
1. 鍵盤輸入 → WebSocket → 伺服器 PTY master → PTY slave → TUI 程式。
2. TUI 程式吐出 ANSI escape sequence → PTY → WebSocket → 瀏覽器 xterm.js → WebGL 渲染。

換句話說,網頁聊天跟 `hermes --tui` 在 byte level 完全一樣。

**這招的取捨很有意思**:
- 好處:零聊天邏輯重複。TUI 修一個 bug,Web 自動好。TUI 加一個 slash 指令,Web 自動有。皮膚、Markdown 渲染、模型選擇器——全部免費。
- 壞處:這個「web app」其實是個終端機模擬器。沒有原生 DOM accessibility,訊息不會在小螢幕上 reflow,複製貼上要靠 OSC52(而且為了防 exfiltration,OSC52 read 還故意被關掉)。

我覺得這是一個非常 hacky 但非常聰明的決定。它跟「正確的 web UI 該長什麼樣」的直覺完全反過來——**不要把 UI port 到網頁,要把一個 terminal port 到網頁**。

(儀表板分頁就老實做,FastAPI + REST + 同一套 JSON-RPC over WebSocket。聊天才用 PTY 這招。)

---

## 四、SessionDB:三套介面的單一真相來源

好,現在三套介面的「嘴巴」拆乾淨了。但還有一件事:**它們的記憶要共用**。

「我在 CLI 開的對話,等等到瀏覽器要能接著聊」——這對使用者來說是很基本的期待,但如果你三套介面各自管狀態,就會永遠對不上。

Hermes 的答案在 `hermes_state.py`——一個 138KB 的模組,核心是 `SessionDB` 類別,底下是一顆 SQLite。所有 session、所有 message、所有 metadata,全部寫在這顆 DB 裡。CLI、TUI、Web、cron、kanban dispatcher,**全部讀寫同一個 `state.db`**。

### 為什麼是 SQLite,不是 Postgres?

這也值得停下來想。一般你看到「跨進程共享狀態」會直覺反應「用 Postgres 啊」。但 SQLite 在這個場景剛好兩件事都打中:

1. **Crash safety**。SQLite 開 WAL 模式(write-ahead logging),每次寫都先 append 到 WAL,fsync 過再 commit。即使 CLI 被使用者強制 kill,DB 不會壞。對一個會跑五分鐘 agent loop 的東西來說,這個保證很關鍵。
2. **多進程共享,零維運**。SQLite 的 WAL + file-level lock 就支援多進程同時讀寫,不用裝 server、不用設密碼、不用備份外部服務。`~/.hermes/state.db` 就是一個檔案,扔了就重來。

代價當然有——多進程同時寫會撞 lock。Day 11 的 Kanban 文章我提過 `BEGIN IMMEDIATE` + 隨機 retry 那一套,就是為了打散「lock convoy」(車隊效應:多個 writer 因為 deterministic backoff 互相同步,集體卡住)。Hermes 把 SQLite 的 busy timeout 設成 1 秒,然後在應用層 retry 最多 15 次、每次隨機睡 20–150ms。**隨機抖動才能打散同步車隊,deterministic 反而讓它們黏在一起。**

### 三套介面如何共享 session?

具體上很樸素:`hermes_state.py` 提供一個 API(`get_session`、`append_message`、`fork_session` 等等),所有介面都呼叫這個 API。

- CLI 啟動:讀 `state.db` 看你上次的 session 是哪一個,要不要 resume。
- TUI 開新對話:在 `sessions` 表 insert 一筆,拿一個 session_id。
- Web 端:同一個 session_id 撈出來,訊息一條條 replay 回畫面。
- Cron 排程:每次跑出一個新的 child session,但 `parent_session_id` 指回你定義的「standing goal」session(那是 `hermes_cli/goals.py` 的 Ralph loop),讓歷史可以追溯。

**沒有奇蹟,只有一張表**。但是這張表是設計過的——`sessions` 有 `parent_session_id` 自我外鍵,讓 session 可以分叉(context 壓縮會分叉、cron 每次跑會分叉);`messages` 表用 FTS5 建全文索引,而且為了 CJK 還特別維護了一張 trigram FTS5 表(預設的 unicode61 tokenizer 會把中文切成單字,搜尋會誤判一堆)。

---

## 五、收成一條暗線:「一個核心,多種驅動」走到這裡

我必須停下來把這件事講白。

從 Day 5 開始我就在埋一條主線——**Hermes 的核心(`AIAgent`)是 protocol-agnostic 的,後面可以接任何東西**。每一篇都長出來一點:

- **Day 5** 換 LLM:同一個 `AIAgent`,後面可以接 OpenAI、Claude、DeepSeek、Copilot,靠 provider 抽象。
- **Day 8** 換協定方向:`AIAgent` 既可以**呼叫** MCP tool,也可以**被當成** MCP server 給別人呼叫——同一段核心,protocol direction 可以反過來。
- **Day 9** 換 channel:gateway 讓 `AIAgent` 接 Slack、Discord、Telegram、cron,業務邏輯零改動。
- **Day 12 今天** 換使用者介面:同一個 `AIAgent`,前面可以接 CLI、TUI、Web。

**這是一個核心,四種驅動**。LLM 換得了、協定方向換得了、外部 channel 換得了、使用者介面換得了。中間那顆 `AIAgent` 沒動。

我覺得這個架構選擇是 Hermes 最值得偷的東西。它不是某一段很炫的程式碼,是一個「**business logic 跟 transport/UI/protocol 嚴格分離**」的紀律。寫 agent 一開始很容易把這四件事黏在一起——你的 streaming 邏輯混進 print 語句,你的 session state 混進 CLI argv parsing,你的 prompt 組裝混進 WebSocket 訊息格式。Hermes 從 v0.2 開始就在拉這個分離,拉了十幾個版本拉到現在這樣。

值不值得?看你的 agent 會不會長大。如果你只想做一個 demo,REST + 一份 codebase 就夠了。但如果你想做的東西「以後要在 terminal、瀏覽器、cron、Slack、IDE 都能用」,那這個分離就是你的本錢。

---

## 六、兩個層級的狀態:hot vs long-term

還有一個細節我覺得很多人會混淆,先講清楚。

`hermes_state.py`(SessionDB)存的是「**hot session state**」——這個對話的 messages、目前用的 model、剛剛開了哪個 tool。**每一輪都寫**,寫滿了 append-only 一直長下去。

但 Day 6 我們講過記憶——那個是「**long-term memory**」,跨 session 的事實庫,在 `memory_provider.py`。**週期性整理**,不是每輪寫,通常是 session 結束後 curator 跑一次,把這次學到的東西整進長期記憶。

這兩個分開很重要。如果你把它們混在一起:
- 把長期記憶寫進每一輪,DB 馬上爆炸(而且大部分是重複資訊)。
- 把 hot session state 當長期記憶讀,你的 system prompt 每次都不一樣,prompt cache 直接報廢(回去看 Day 3)。

簡單的記法:**SessionDB 是 transactional 的(機械式記錄一切),memory 是 curated 的(整理過的精華)**。一個像會議的逐字稿,一個像會議結束後的紀要。兩個都要,但角色不同。

---

## 七、然後,我要鋪一個梗

到這裡我已經把 Hermes 介面層講漂亮了。一個 JSON-RPC server,三套 adapter,一顆 SQLite 收狀態,PTY 把 TUI 重用到 Web——這架構乾淨得像教科書。

然後我去 `wc -c` 了一下 `cli.py`。

```
657883 cli.py
```

**657KB,一個 `.py` 檔**。同一個 repo 裡 `gateway/run.py` 是 855KB。一個 CLI 入口檔半 MB,一個 gateway runtime 接近 1MB,而且都是單一檔案、單一 class。

我把 `cli.py` 打開往下捲——它是一個 `HermesCLI` 類別,大概一萬一千多行、約 190 個 method。`run()` 一個 method 就兩千三百多行。所有的 slash 指令(`/model`、`/skills`、`/resume`、`/voice`、`/codex-runtime`……六十幾個)不是註冊成獨立的 `Command` 物件,是 `run()` 裡面一條巨大的 `if/elif` 鏈。

這就是我前面 Day 7 偷偷鋪過、要在 Day 14 正面開砲的暗線 C:**抽取程式碼 ≠ 分解系統**。

Hermes 的架構**選擇**是漂亮的——一個核心,多種驅動。但 Hermes 的**實作**有一個反覆出現的結構性債務:**檔案肥大、單一 class 包山包海**。`AIAgent` 至少還把 method body 推進了 `agent/` 子模組;`HermesCLI` 把一萬多行全部留在 `cli.py` inline。`hermes_cli/main.py` 也是,12,939 行,`main()` 函式本身 2,800 行,十幾個 `cmd_*` 命令處理器寫成 `main()` 裡面的 nested closure——根本沒辦法 import、沒辦法單元測試。

我不是要說這團隊不行——他們做了非常多其他做得好的事(Day 1 到今天一路講過)。我想說的是:**架構選擇和實作組織是兩個獨立的東西**。你可以架構乾淨但實作糊在一起,反之也可以。Hermes 是前者。

這個批判 Day 14 會完整展開——657KB 跟 855KB 後面到底發生了什麼、為什麼會這樣長、要怎麼救。今天先在這裡留個記號。

---

## 小結

今天拆三件事。

第一,Hermes 的 CLI / TUI / Web 三套介面共用一個 JSON-RPC server,差別只在傳輸層跟渲染面;JSON-RPC 是個對 agent loop 友善的選擇,因為 agent 的對話本來就是長連線、雙向、streaming-friendly。

第二,PTY 是個被 90% framework 忽略的細節——它讓 agent 能跑真實的互動式工具,還讓 Web 端可以用「把 terminal 搬進瀏覽器」這招重用整套 TUI。

第三,SessionDB 用 SQLite 當「唯一狀態真相」,CLI、Web、cron 全部讀寫同一張表,所以三套介面之間天然共享 session;搭配 long-term memory 各司其職,hot state 跟 curated knowledge 分開。

收成的暗線 A:**一個核心、四種驅動**——provider、protocol direction、channel、UI 都換得了,中間 `AIAgent` 沒動。同時鋪好暗線 C 的爆點:架構漂亮,實作肥大。

---

但講完全部架構,你應該會冒出一個非常實際的問題:**Hermes 怎麼測試?** 一個會講話、行為不確定、後面接的是「可能隨時 hallucinate 的 LLM」的東西,你要怎麼寫單元測試?明天看他們的測試策略——你會發現他們測了非常多東西,但也漏了一個非常重要的東西。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `tui_gateway/server.py` | 三套介面共用的 JSON-RPC 派發器 |
| `hermes_state.py` | SessionDB,138KB 單一檔,所有 session 狀態 |
| `hermes_cli/pty_bridge.py` | 把 `hermes --tui` 透過 PTY 搬進瀏覽器 |
| `hermes_cli/goals.py` | Ralph loop,cron 排程跑 agent 的核心邏輯 |
| `hermes_cli/main.py` | CLI 入口,12,939 行,看 `_apply_profile_override` 跟那 14 個 nested `cmd_*` closure |
| `cli.py` | 657KB 的 `HermesCLI`,所有 slash 指令、TUI 互動邏輯 |
| `ui-tui/` | TUI 的 React renderer,內含 fork 過的 Ink |
| `web/` | Vite + React SPA,聊天頁是 xterm.js + PTY |

入口建議:從 `tui_gateway/server.py` 的 `dispatch()` 看一個 JSON-RPC method 怎麼跑——你會看到傳輸層怎麼透過 `contextvars` 抽象、慢方法怎麼丟到 thread pool。然後跟著 `SessionDB` 的呼叫鏈,看 message 從 dispatch 進來怎麼一路寫到 SQLite。
