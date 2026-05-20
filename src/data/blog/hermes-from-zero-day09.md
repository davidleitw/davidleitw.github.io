---
title: "Day 09:Gateway — 一個 agent 接全世界"
description: "Slack / Discord / cron / 自己當 OpenAI API,所有 channel 都是 adapter。"
pubDatetime: 2026-05-20T19:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

第一次想把自己寫的 chatbot 從 terminal「搬出去」給朋友用的時候,我選了 Slack。

照著文件申請 app、設 OAuth scope、設 event subscriptions、用 ngrok 把 webhook 接回 localhost、處理 `url_verification` 那個 handshake、處理 retry header(因為 Slack 三秒沒回就重送)、處理 thread vs DM vs channel mention 三種訊息來源,把那一坨 payload 翻成自己的 `messages` array,跑完 agent 再用 `chat.postMessage` 送回去——光這一個 channel 就花了我兩個晚上。

然後想說「不錯耶,接下來接 Discord 吧」。Discord 是 websocket gateway 不是 webhook,要長連線、要處理 heartbeat、session 概念跟 Slack 完全不同——人家用 `channel_id + user_id`,Discord 還有 guild,thread 又是另一套 API。我硬著頭皮接完。

第三個是 cron job:「每天早上 9 點讓 agent 自己跑一次,把產出 email 給我」。email 又是另一個世界,SMTP 不是 webhook 不是 websocket,而且這個情境**根本沒有「使用者訊息進來」這件事**,是 agent 自己先動。

第四個我本來想接 webhook,寫到一半放棄。我那個 agent 核心已經被三套不同的 session 物件、三套不同的訊息格式、三套不同的 rate limit 處理污染到不像樣。**核心邏輯只有 200 行,周邊膠水兩千行**。

---

昨天我們講到 MCP 跟 ACP——那是「協定」層的「一個核心,多種驅動」:agent 不在乎工具實際長怎樣,只要有 adapter 翻譯成統一形狀就好。今天的 gateway 是**同一個故事,但發生在「部署 / 通道」這一層**。差別在於:昨天是 agent **往外打**(call tool、call sub-agent),今天是外面**往內打**(訊息從各種 channel 進來 agent)。

進來的方向也需要同一套抽象,理由我前面那三個踩坑的晚上已經幫你示範過了。

## 一、Gateway 是核心 agent 跟外部世界之間的翻譯層

Hermes 的 `gateway/` 目錄,職責就一句話:**把外部世界各種奇形怪狀的 channel 翻譯成一個統一形狀,餵給 `AIAgent`**。然後再把 agent 吐出來的訊息,翻回各個 channel 的原生格式送出去。

每個 channel(Telegram、Discord、Slack、Signal、email、SMS、Matrix、Feishu …Hermes 內建大約 25 個平台)是一個 **adapter**。所有 adapter 都繼承自 `gateway/platforms/base.py` 的 `BasePlatformAdapter`,這是一個 ABC——抽象基底類別,定義一個**很窄**的契約。

窄到什麼程度?強制必須實作的方法只有大概五個:`connect`、`disconnect`、`send`、`send_typing`、`get_chat_info`。其他更花俏的東西——送圖片、送語音、編輯訊息、送草稿、開分流 thread——基底類別都有**會優雅降級的預設實作**。

一個不能送原生圖片的 adapter,降級成「把 URL 當文字貼上」就好;一個不能編輯訊息的,回傳 `success=False`,呼叫端就改送一則新訊息。**接一個新平台只要實作五個方法就能跑**,進階能力是「選擇性 opt-in」,不是「全部都要做齊」。

進來的訊息會被正規化成單一的 `MessageEvent` dataclass,送出的結果正規化成 `SendResult`。agent 核心**永遠只看到這兩個型別**,看不到任何 Slack 的 `event.message.text`、Discord 的 `Message.content`、Telegram 的 `Update.message.text`。

> **Note**:這個叫**反腐層(anti-corruption layer)**——你的系統和外部系統之間放一個翻譯層,讓外部的怪東西不污染你的核心模型。我自己第一次想到這個抽象是接到第三個 channel 的時候——因為每接一個,就會發現 `if platform == "slack"` 的 if-else 又多了三個分支。把這件事抽象成 `MessageEvent`,核心瞬間乾淨。

## 二、每個 channel adapter 在回答四個問題

寫了幾個 adapter 之後你會發現,所有 adapter 在做的事其實就是回答四個問題:

**(a) 怎麼接收訊息?** Slack/Discord/Telegram 走 webhook 或 websocket,IMAP 走 long-poll,cron 根本沒有「進來的訊息」這回事——是「時間到了 agent 自己醒過來」。

**(b) 怎麼識別 session?** 同一個使用者在群組裡發言、在私訊發言、在某個 thread 裡發言,要不要算同一個 session?群組裡多個人講話,那是一個共享 session 還是每人一個?(這個是大題,等等專門講。)

**(c) 怎麼回傳?** 同步回(HTTP request/response 那種立刻回 body)?非同步推(用 channel API 主動 push 一則訊息)?還是串流回(SSE、Telegram 的「正在輸入」)?

**(d) 怎麼處理該平台的特殊內容?** Slack 的 thread reply、Discord 的 embed、Telegram 的 inline keyboard、IRC 的 `/me`——這些是 platform-native 的東西,核心不該知道,但 adapter 要會處理。

Hermes 把這四題的答案都關在 adapter 自己的檔案裡。`AIAgent` 從頭到尾只跟 `MessageEvent` 對話。

## 三、Session key:讓「一個 agent 同時服務全世界」成立的純函式

這題我覺得是 gateway 最漂亮的設計,值得花一個小節。

問題場景:一個 agent 同時服務私訊、群組、論壇 thread、多個使用者。每個對話需要**隔離的 context**(你跟我的對話 agent 不能看到他跟別人的對話),但 thread 應該在參與者間**共享**(三個人在同一個 thread 討論,agent 應該知道前面誰說了什麼)、群組裡的私訊應該**每人一個**(雖然在同一個 chat ID,但 A 和 B 對 bot 講的話是兩條獨立脈絡)。

Hermes 用 `gateway/session.py` 裡的 `build_session_key()` 解決——一個**確定性、無狀態**的純函式。它建一個像這樣的字串:

```
agent:main:telegram:dm:12345
agent:main:slack:group:C0123:thread789
agent:main:discord:guild:GUILD_X:channel:CHAN_Y:user:USER_Z
```

隔離規則寫死在這個函式裡:

- **私訊**永遠隔離(每個 user 一個 session)
- **非 thread 的群組訊息**預設每人一個 session(避免多人對話互相污染)
- **thread** 預設**共享**(所有參與者一個 session),除非設了 `thread_sessions_per_user`

為什麼好?因為**沒有中央 session 路由表**。沒有一張「Slack channel 123 的 user 456 對應到 session ID xyz」的 hash map 要維護、要 lock、要過期。**只有一個從「來源資訊」到「key string」的純函式**。任何時候要找 session,你重算一次 key 就好。任何時候要新增一個平台,你只要決定該平台的命名規則丟進這個函式裡。

「thread 共享 vs 每人隔離」這個區分,編碼了真實的 UX 直覺:一個論壇主題是大家共享的對話;兩個人各自私訊 bot 不該被混在一起。這不是技術選擇,**是 product 選擇被寫進函式**。

> **Note**:WhatsApp 有個特殊處理——同一個人在 WhatsApp 上有可能用 LID(Linked ID)或 phone JID 出現,session key 函式裡會 canonicalize,讓「同一個人類」對應到同一個 key。`whatsapp_identity.py` 專門處理這件事。這種「平台髒東西不要外洩」的精神,就是反腐層的實踐。

## 四、並行控制:同一個人連發兩則訊息怎麼辦?

這題我最早做 chatbot 的時候完全沒想過,因為單人開發測試永遠是「我講一句、bot 回一句」順順順。直到上線給朋友用,有人連發三則訊息,有人邊聽語音邊打字、語音 transcript 跟文字訊息打架——我才發現:**訊息會並行進來**。

具體會出什麼事?agent 在處理 message A 的中途——已經呼叫了 LLM、可能呼叫了工具、但**還沒寫回 session DB**——message B 就到了。如果你直接生第二個任務處理 B,它會讀到**還沒被 A 更新的舊狀態**。然後兩個任務各自處理,各自寫回——後寫的覆蓋前寫的——B 的 context 裡完全沒有 A 的存在。

這是經典 race condition。

Hermes 在 `gateway/platforms/base.py` 裡用三個協調的 dict 處理:

- `_active_sessions`:session → 一個中斷 `Event` 守衛
- `_session_tasks`:session → 擁有它的 `asyncio.Task`
- `_pending_messages`:session → 排隊的事件

幾個關鍵設計:

**守衛在「任務生出來之前」就同步設定**。如果你「先 spawn task,task 進去之後再設 lock」,那 task spawn 跟 lock 設好之間有個空檔,第二則訊息可能擠進來——這是經典 **TOCTOU(time-of-check to time-of-use)** 問題。Hermes 同步設好再 spawn,關掉這個窗口。

**擁有者-任務對應表**讓守衛的釋放是確定性的。一個舊任務的 `finally` 不能清掉一個更新任務的守衛——透過守衛身分比對。

**過時鎖會自癒**。進入時如果守衛存在但它的擁有者 task 已經 `done()`,代表這個 session 「腦裂」了(可能 worker 崩過),直接清掉——避免 chat 被困在一個死掉的守衛後面。

**特殊指令繞道**。`/stop`、`/new` 這種要打斷正在跑的 agent 的指令,如果走一般排隊就永遠輪不到——它們走 `_dispatch_active_session_command` 直接派發。`/approve`(用來放行 human-in-the-loop 閘門)甚至是 inline 派發,才能傳達到一個阻塞在 `Event.wait` 上的 agent。

**堆疊安全**。排隊訊息排空時是「生出一個全新 task」而不是遞迴呼叫——原始碼註解有寫:遞迴版本曾經在約 2000 層的時候把 C 堆疊耗盡、SIGSEGV。

這就是真正困難的並行工程。代價是巨大的複雜度——光是 `_process_message_background` 這個函式就大約 490 行,正確,但幾乎無法維護。每個 tricky 分支邊上都引了 GitHub issue 編號——讀就會發現這些不是憑空想的,**每個修法都是某個半夜炸過一次換來的**。

## 五、OpenAI 相容 API:暗線 A 第三次,而且這次是「對外」也偽裝

到這裡 adapter 都是「外部 channel → agent」。但 gateway 還有一個我覺得最有趣的設計:`gateway/platforms/api_server.py` 裡的 `APIServerAdapter`。

它跑一個 `aiohttp` server,**但它繼承 `BasePlatformAdapter`**——HTTP API 被建模成「又一個平台 adapter」。它對外開放三個端點:

- **`/v1/chat/completions`**:無狀態的 OpenAI Chat Completions 形狀。透過 `X-Hermes-Session-Id` header 可以選擇性 opt-in 連續性。
- **`/v1/responses`**:有狀態的 OpenAI Responses API 形狀,用 `previous_response_id` 串接。
- **`/v1/runs`**:非同步執行提交,立刻回 `run_id`(HTTP 202),搭配 `/events` 的 SSE 串流、`/approval` 解 HITL 閘門、`/stop` 中斷。

**這代表什麼?這代表你可以把 Hermes 偽裝成 OpenAI 模型**——只要把 base URL 指到你的 Hermes server,任何支援 OpenAI API 的 client(Cursor、Claude Desktop、Open WebUI、LiteLLM、任何照著 OpenAI SDK 寫的東西)都可以直接接上去用。對 client 來說,它就是在跟 GPT-4 講話;實際上後面是一整個 agent loop、會 call tool、會去 MCP、會吃技能。

重點來了:這是暗線 A「一個核心,多種驅動」的**第三次大型登場**,而且這次是反過來的——前兩次都是「核心去適應外部」,這次是**核心對外也偽裝成另一個系統**。

讓我把這條暗線到目前為止的軌跡攤開:

| Day | 抽象方向 | 一句話 |
|---|---|---|
| Day 5 | agent ← LLM provider | agent 不在乎背後是 OpenAI 還是 Anthropic |
| Day 8 | agent ↔ tool / sub-agent | agent 不在乎工具是本地 function、是 MCP server、還是另一個 agent |
| **Day 9** | channel → agent / agent → OpenAI 形狀 | agent 不在乎訊息從哪個 channel 來,client 也不在乎背後是不是 OpenAI |

**三個方向、同一個架構選擇**——窄契約、預設降級、確定性無狀態的入口函式。Hermes 整個系統的形狀就是這個 pattern 反覆出現。讀到這你應該開始有感覺:這不是巧合,是有人決定整個系統都用這個方式組裝。

> **Note**:`APIServerAdapter` 把 HTTP API 當成 platform adapter,意味著它**免費繼承**了 session 管理、toolset 解析、provider fallback、streaming 消費者——沒有平行的執行期。`_derive_chat_session_id()` 把(system prompt + 第一則 user 訊息)雜湊起來,給無狀態的 OpenAI client 一個「黏著的 session」——你連續呼叫兩次同樣 system prompt + 同一段開頭,自動續上同一個 session。

安全方面也做得很細:沒設 `API_SERVER_KEY` 就拒絕對外可達(`is_network_accessible()` 解析主機名,fail closed,只允許 loopback);拒絕佔位符 key;比對 key 用 `hmac.compare_digest` 做計時安全比對;CORS 白名單沒有隱式的 `*`。

## 六、`run.py` 855KB——架構漂亮、實作卻是巨石

寫到這裡你可能覺得 gateway 設計得很好——對,設計詞彙是好的。adapter 抽象、能力降級、registry、確定性 session key、每 session 的並行模型——**全是對的點子**。

但這裡有個坑:`gateway/run.py` 是 **18,188 行、855KB 的單一檔案**。

對,855KB。一個 .py 檔。我第一次 `ls -lh` 看到的時候以為是工具壞了。

裡面有個叫 `GatewayRunner` 的 god object,大約 150 個方法,擁有 adapter 生命週期、約 50 個 slash 指令、6 個以上的背景 watcher、語音、Telegram 討論串管理、kanban、目標續接、agent 快取、重啟、關機排空。光是 `_run_agent` 一個方法就大約 2,240 行。

更荒謬的是,`gateway/` 裡其實有個 `ADDING_A_PLATFORM.md` 文件——它是個「**16 步驟、要碰約 13 個檔案**的檢查清單」。驗證步驟字面上寫著:「grep 其他平台的名字——如果某個檔案提到它們卻沒提到你的,你就漏了。」

讓我們停一下感受一下。**這是一個被升格成「文件化流程」的程式碼壞味道**。「想加新平台?好的,先把這 16 步做完,還有那個 `if/elif` 鏈記得也加,然後在五個其他檔案裡 grep 看看有沒有漏。」這不是文件,這是控訴狀。

這也是這篇要鋪的批判:**這是一個 architecture 與 implementation 拉開差距的活範例**。架構上,gateway 是漂亮的 adapter pattern;實作上,它的入口檔案是一個塞了 150 個方法的 god object。每一個 hard-won 的修法(自癒鎖、TOCTOU 關閉、stack-safe drain)都附了 issue 編號——知識是有的,但被擠在一個 18k 行的檔案裡,沒有模組邊界。

這就是暗線 C(抽取程式碼 ≠ 分解系統)的最大一次預告。Day 14 會正面開砲。

---

## 小結

Gateway 是 Hermes 的「對外殼層」。核心 agent 一個,外殼把每個 channel 翻譯成統一的 `MessageEvent`。session key 是個純函式、不需要中央路由表;並行控制是每 session 一個 task 跟一個守衛,每個 tricky 分支都用真實 bug 換來;OpenAI 相容 API 把 HTTP 也建模成一個 adapter,讓 Hermes 對外也能偽裝成 OpenAI——暗線 A 的第三次,也最完整的一次登場。

**但** `run.py` 855KB,設計詞彙跟程式碼組織完全不在同一個量級。架構是健全的,程式碼沒跟上。

讀到這你應該有個問題:既然 gateway 把「對外通道」抽象掉了,那 Hermes 怎麼讓使用者「**加新東西**」而不用碰 core?技能?外掛?MCP?到底哪個用在哪、什麼時候該用哪個?明天我們釐清這三套(其實四套)互相重疊的擴充機制。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `gateway/platforms/base.py` | `BasePlatformAdapter` ABC、能力降級的預設實作、並行控制三個 dict 都在這 |
| `gateway/platform_registry.py` | `PlatformRegistry` 單例;plugin 註冊新平台的入口 |
| `gateway/session.py` | `build_session_key()`、session 生命週期、reset policy |
| `gateway/platforms/api_server.py` | OpenAI 相容 API server,subclass `BasePlatformAdapter` 那個 |
| `gateway/delivery.py`、`gateway/mirror.py` | 投遞路由 DSL、跨 session 鏡像 |
| `gateway/pairing.py` | 8 碼私訊配對、OWASP/NIST 強化 |
| `gateway/hooks.py` | 事件 hook 系統(`~/.hermes/hooks/*/`) |
| `gateway/run.py` | 那個 855KB 的怪物。`GatewayRunner`、`_run_agent`、所有 slash 指令、所有 watcher |
| `gateway/ADDING_A_PLATFORM.md` | 自我控訴的 16 步驟清單 |

從 `BasePlatformAdapter` 開始讀,搞清楚契約有多窄;接著看 `session.py` 的 `build_session_key()`(很短、很值得抄);然後跳到 `platforms/api_server.py` 體會「HTTP 也只是一個 platform」的乾淨。最後再點開 `run.py`——當作對「架構不等於程式碼組織」的當頭棒喝。
