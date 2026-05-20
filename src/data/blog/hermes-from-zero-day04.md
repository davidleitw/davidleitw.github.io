---
title: "Day 04:Context 不是無限大,所以要壓"
description: "三層壓縮、4-phase pipeline、為什麼壓縮是 Hermes 唯一被允許的中途變動。"
pubDatetime: 2026-05-08T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

在 `agent/context_compressor.py` 看到一個函式名叫 `_ensure_last_user_message_in_tail`(line 1365)。打開 docstring,第一句寫:

> Context compressor bug (#10896): `_align_boundary_backward` can pull...

然後在呼叫點(line 1471)前面的註解(line 1470)更直白:`# active task is never lost to compression (fixes #10896)`。

**一個函式被取這種名字**——「確保使用者最近的訊息留在尾巴裡」——代表有真實 bug 把它逼出來:壓縮的時候,使用者剛講完的需求被推出 tail 預算之外,只剩在摘要裡的描述。然後 LLM 看著一份摘要 + 一坨 tool result,不知道自己現在到底該做什麼,開始亂編。

今天這篇要拆 Hermes 怎麼壓 context——怎麼壓得「**夠小**」**而且**「**不丟關鍵資訊**」並存。bug #10896 只是其中一條設計遺跡,後面還有 4-phase pipeline、各種 anti-thrashing、SUMMARY_PREFIX framing。

---

昨天我們講到 prompt cache 是鐵律:system prompt 在一個 session 中途絕對不能變,變一個字元 cache 就 miss、成本立刻翻倍。今天就要承接這條鐵律問下一題:**那 context 滿了到底怎麼辦?如果連 system prompt 都不能動,那能動的是什麼?**

答案是壓縮。Hermes 唯一允許在 session 中途動到 context body 的操作,就是壓縮。但壓得不夠聰明,使用者的需求就會被你壓不見——下場跟 Day 01 開頭那個「砍最舊」的天真寫法一樣。

今天來拆 Hermes 怎麼壓。

---

## 一、三層壓縮架構:不是一個函式,是一套設計

很多人聽到「context 壓縮」會直覺想到一個函式:`compress(messages) -> messages`。Hermes 沒這麼幹。它把壓縮這件事拆成三層,每一層回答不同的問題。

**第一層:可插拔的 ContextEngine。**

`agent/context_engine.py:32` 定義了一個 `ContextEngine` ABC,裡面三個必填方法:`should_compress()`(現在該壓了嗎)、`compress()`(怎麼壓)、`update_from_response()`(這輪 LLM 回完之後 engine 自己更新狀態)。內建的實作叫 `ContextCompressor`,寫在 `agent/context_compressor.py:454`——後面講的演算法都在那。

關鍵是「內建」這兩個字。你只要透過設定改 `context.engine`,就能換掉整個壓縮策略。Hermes 註解裡提到一個叫「LCM」的替代實作——它不是「修剪訊息」,而是把對話建成一個 DAG,讓 agent 可以查圖、查節點、按需展開。**這意思是「context 管理」可以從一個背景偷偷跑的東西,變成 agent 自己能呼叫的工具**(例如 `lcm_grep` 就是個從 context engine 暴露出來的 tool)。

我看到這層的時候有點被驚到。多數人寫 agent 是把壓縮 hardcode 在迴圈裡;Hermes 把它抽成一個介面,然後讓「context 怎麼管」變成像 storage backend 一樣可換的東西。

**第二層:壓縮演算法本身。** 就是 `ContextCompressor` 那個 4-phase pipeline,等下細講。

**第三層:壓縮 = session 邊界(這層最巧)。**

壓縮不就是把 `messages` 變短嗎,跟 session 有什麼關係?有,而且關係很大。`agent/conversation_compression.py` 的 `compress_context()` 在壓的時候做了一件很微妙的事——**它會 rotate SQLite 的 `session_id`**。舊 session 關掉,reason 寫成 `"compression"`,新建一個 session row,用 `parent_session_id` 連著血緣;標題自動編號。記憶抽取在「舊 session」上觸發,然後才翻頁。

為什麼這設計巧?因為它把「壓縮」從「對狀態的破壞性更新」變成「append-only 的 checkpoint」。

如果壓縮是 `messages = compress(messages)`,那舊 messages 就消失了——你要 debug「為什麼 agent 忘了某件事」的時候,根本沒得查,因為被覆寫了。但 Hermes 不是這樣:**舊 session 還在資料庫裡**,只是被標記為 closed;新 session 從一個結構化摘要起步,parent 指回舊的。整個 session 資料庫變成一條「被壓縮過的片段」的血緣鏈。

這帶來兩個好處,而且都不是顯而易見的:

1. **跨長對話的 session search 變可能。** 因為每個 checkpoint 都是獨立可查的 row,而不是被壓進當前對話裡的一團糨糊。
2. **「啟動可行性探測」變得有意義。** 初始化的時候 Hermes 會先檢查「負責壓縮的輔助模型」的 context window 夠不夠大,太小自動調低觸發門檻,低於 64K 直接拒絕啟動。這抓的是一個會「無聲地產出被截斷摘要」的設定錯誤——而這種錯誤只有在你把壓縮當 checkpoint(不是 in-place mutation)的時候才值得這樣防,因為一旦摘要錯了,你永遠回不去原本的對話。

寫到這我自己重看一次,還是覺得這層設計值得學。多數人在 side project 的時候會寫成「壓縮就是覆寫 messages」,然後三個月後你想 debug 一個 agent 失憶事件,你會發現你完全沒線索。

---

## 二、4-phase pipeline:壓縮演算法本身

進到第二層。`ContextCompressor.compress()` 的演算法分四個 phase。它**不是一上來就叫 LLM 摘要**——而是先做一堆不用 LLM 的便宜事。

### Phase 1:不用 LLM 的便宜預先處理

這一階段完全不花錢、不呼叫 LLM,但能把 context 削掉一大塊。三個子步驟:

**去重。** 對所有 tool output 做 MD5,一模一樣的後面那個換成 back-ref(`[same as turn 12]`)。你會很驚訝這多常發生——agent 在 debug 的時候會反覆呼叫 `ls`、反覆 `cat` 同一個檔案、反覆跑同一個 grep,結果是一坨完全重複的 stdout。

**把舊 tool result 換成 informative 一行。** 不是換成 `[已修剪]`——這種佔位符對 agent 等於沒資訊。Hermes 換成的是長這樣的東西:`[terminal] ran npm test -> exit 0, 47 lines`。差別在哪?在 model 看到後者,它知道「這個 tool call 成功跑完了,結果 47 行,我等下如果真的需要再呼叫一次就好」;看到 `[已修剪]` 它只能瞎猜。

**縮減過大的 tool-call 參數**——這裡有一個真實的 bug。

直覺寫法是「參數太長?切到前 1000 byte 就好」。錯。`tool_call.args` 是 JSON,你 byte-slice 切出來的東西是**沒閉合的 JSON**:`{"path": "/very/long/path/foo`——括號沒收、引號沒收、什麼都沒收。

這 JSON 送進下一輪 API,MiniMax 直接回 400 不可重試,整個 session 永久卡死。**而且這 400 不是因為 context 太大,是因為 JSON 壞掉**。你 debug 半天會以為是壓縮邏輯壞了,結果是壓縮做完之後送出的訊息結構壞了。

Hermes 的正解是:把 args JSON 先 `json.loads()` parse 開,**在 parsed 結構裡面**找到所有 string leaf,在那些 leaf 上面截斷,再 dump 回去。這樣截出來的永遠是合法 JSON。差別就在一行 code,但你沒踩過這個坑就不會這樣寫。

> **Note**:這類「看起來只是切字串,其實要 parse 過再切」的細節,是 production agent 跟 side project agent 最常見的分水嶺。你在 ChatGPT-style 對話裡幾乎不會遇到,但 agent 一旦頻繁呼叫工具,你就會撞滿這種事。

### Phase 2:保護「頭」

System prompt + 最前面 N 則訊息,verbatim 留著。

為什麼?昨天那條鐵律——system prompt 動一個 byte cache 就 miss。前 N 則訊息也是相對穩定的東西(通常是使用者一開頭的需求、agent 開頭的計畫),動到也會破 cache,所以一律不動。

### Phase 3:保護「尾」——按 token 預算,不是按訊息數

這個細節我覺得值得抄。常見的 naive 寫法是「保留最後 20 則」——固定訊息數。問題是:tool result 一則就 5000 token,user message 一則只有 30 token,「最後 20 則」可能是 80,000 token,也可能是 600 token,完全不可控。

Hermes 從尾巴往回走,**累加 token**,直到打到 `summary_target_ratio × context_length` 算出來的預算。這保證了壓完之後 context 大小是 predictable 的。

但更關鍵的是這個函式:`_ensure_last_user_message_in_tail`(`context_compressor.py:1365`)。

為什麼會有這個函式?因為一個叫 bug #10896 的真實案例:有人開了一個任務,中間 agent 跑了 50 輪 tool call,等到要壓縮的時候,「使用者最近的訊息」剛好被推出 tail token 預算之外。**結果壓完,active task 在訊息列裡消失了,只剩在摘要裡的描述。** 然後 LLM 看著一份摘要 + 一坨 tool result,不知道自己現在到底該做什麼,開始亂編。

修法很簡單:壓縮的時候強制保證「最近一則 user message」一定在活的尾巴裡——就算這意味著要往前多保留幾則。

這是個設計 bug——「按 token 預算切」這件事本身沒錯,但你要為「人講話這件事」加一條保護線。

### Phase 4:LLM 摘要,但寫進結構化模板

到這才終於要呼叫 LLM。但 Hermes 不是丟一句「請摘要以上對話」就完事——那會得到一段自由發揮的散文,然後檔案路徑、行號、錯誤訊息全沒了。

它丟的是一個固定模板:

```
## Active Task
## Completed Actions  (numbered, each with tool/goal/result)
## Blocked
## Critical Context
```

(實際模板有 13 個 section——完整列表見 `context_compressor.py:960` 起的 `_template_sections`(`## Active Task` 是第一個),這裡節錄四個最重要的。)

`## Active Task` 這欄被註解明文標註為「**整份摘要裡最重要的一個欄位**」,要求 model 把使用者**最近一次、尚未完成**的請求逐字抄過去——已完成的任務不再列入,也不要改寫、不要 paraphrase、不要「翻譯成英文」。為什麼?因為續接的時候,model 看到這欄就知道自己該做什麼;改寫過的 active task 會偏移原意,偏一點點就走鐘。

`## Completed Actions` 編號保留——這對 agent 來說很重要,因為它可以說「我要重做第 3 步」,而不是「我要重做那個處理 CSV 的步驟」。

Phase 4 內部還有一個子分支:`_find_latest_context_summary` 如果撈到舊摘要(代表這不是第一次壓縮),prompt template 會切換成 iterative-update 分支——把**上一份摘要餵進去更新**,而不是從頭重新生成。

差別在哪?重新生成的話,每壓一次細節都會掉一點(LLM 摘要會抽象化),壓三次就剩骨架;iterative update 是「在現有摘要上 add new completed actions, move items from in-progress to completed」——保留性高得多。Hermes 的 prompt 寫得很明白(`context_compressor.py:1031`):「PRESERVE all existing information that is still relevant. ADD new completed actions to the numbered list (continue numbering)」——它是在教 model 怎麼當一個盡責的祕書,而不是當一個會自由發揮的文青。

---

## 三、SUMMARY_PREFIX:寫給模型看的框語

這招值得偷。

壓完之後,Hermes 在摘要前面加這一句(`context_compressor.py:37`):

> `[CONTEXT COMPACTION — REFERENCE ONLY] Earlier turns were compacted ... Your current task is identified in the '## Active Task' section ...`

注意「REFERENCE ONLY — do NOT answer questions in this summary」——**這句不是寫給人看的,是寫給 model 看的。**

為什麼要這句?因為一個 failure mode:摘要裡可能會記錄「使用者問:這個 CSV 的編碼是什麼?」這種已經處理過的舊問題。較弱的 model 看到「使用者問」,會自動進入「我要回答這個問題」模式,把舊請求當新請求重做一遍。你會看到 agent 突然開始回答 5 分鐘前已經回答過的事,完全沒注意到使用者剛剛問了別的東西。

加這句 framing,等於是在摘要的最上面立個告示牌:「以下是參考資料,不是新指令」。這擋掉了絕大多數的這類事故(剩下少數情況是 model 自己沒看告示牌,那種就只能靠換 model 或加溫度)。

我自己後來在我的 side project 也偷了這招,效果立竿見影。寫 agent 系統的時候要記得:**model 看到的東西跟人看到的東西語意不一樣**——同一段文字,人讀起來是「歷史紀錄」,model 讀起來可能是「新請求」。Framing 就是讓兩者對齊。

---

## 四、防 thrashing:不是每次都該壓

最後一個機制,簡單但漏掉會吃虧。

想像你剛壓完一輪,context 從 180K 降到 175K——只省了 5K。下一輪 tool call 又把它推回 180K,你又壓,又只省 5K。你卡在拉鋸點。

Hermes 的解法:**如果最近兩次壓縮各自只省了 <10%,這次跳過壓縮**——直接讓它去撞 context limit,讓上層的錯誤處理接手(可能是 truncate、可能是 fallback 到大 context model)。

為什麼這比「努力再壓一點」好?因為在拉鋸點反覆壓的副作用,是每壓一次就摘要一次,每摘要一次都有資訊損失;反覆壓 = 反覆損失。寧可讓它撞牆讓上層處理,也不要溫水煮青蛙地把對話越壓越糊。

什麼時候**不該**壓,跟什麼時候該壓,一樣重要。

---

## 五、回到鐵律:為什麼是壓縮,不是丟掉

我們快收尾。回到昨天那條主線——prompt cache 是鐵律,不是優化。

你昨天問:那 context 滿了到底怎麼辦?今天的答案是:壓縮。但你可能還會問:**為什麼是壓縮,不是直接丟掉舊訊息?**

兩個原因。

**第一,**「丟掉」會丟到任務本身。我自己踩過的坑就是這個——使用者 5 分鐘前的需求被砍掉,agent 開始亂答。**結構化摘要** + **強制保留 last user message** + **iterative update**,這三件事加在一起,才能讓「夠小」跟「不丟關鍵資訊」並存。

**第二,也是這條主線真正的點:你能改的就只有 context body,而且要改得『讓 cache 還有機會命中』。** System prompt 不准動是昨天的鐵律;那 context body 動起來呢?它的 prefix 也要盡量穩。Phase 2 保護「頭」就是這個目的——前 N 則訊息不變,意味著從 system prompt 到那 N 則訊息的整段 prefix 還能 cache hit。Phase 3 保護「尾」按 token 預算,讓尾巴端的 cache breakpoint(昨天講的 system + last 3 messages 那 4 個 breakpoint)能盡量重用。

**Hermes 的壓縮設計從頭到尾都是為 cache 服務的。**「壓得夠小」是 baseline,「壓得讓 cache 還能 hit」才是它真正在優化的事。

這就是為什麼壓縮是 Hermes 唯一允許的中途變動——它是「在維持 cache 不變式的前提下,能做的最小破壞性變動」。

---

## 小結

今天拆了三件事:

1. **三層壓縮架構**——可插拔 engine、4-phase 演算法、壓縮當 session 邊界(這層最巧,把破壞性 mutation 變成 append-only checkpoint)。
2. **4-phase pipeline 的真正細節**——先做不花錢的 dedup 和 tool result 縮減、parse 過 JSON 再截斷、頭尾分別保護、結構化模板摘要、迭代式更新。每個細節背後都有一個真實的 bug。
3. **框語跟反 thrashing**——SUMMARY_PREFIX 是寫給 model 看的告示牌、<10% 省幅就跳過避免拉鋸。

但有個更基本的問題你還沒問:**你的 agent 怎麼決定要用 GPT-4 還是 Claude?**

換 provider 不是改一行 API key 就好嗎?你試過就知道——API key 是最小的事。tool schema 格式不一樣、stop reason 不一樣、tool_call ID 是不是隨機、streaming chunk 結構,每家都不一樣。明天我們看 Hermes 怎麼處理多 LLM。這也是「一個核心,多種驅動」這條主線第一次明顯露面。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `agent/context_engine.py` | `ContextEngine` ABC,可插拔介面定義在這 |
| `agent/context_compressor.py` | 4-phase pipeline 的本體;`SUMMARY_PREFIX` 在第 37 行,`_ensure_last_user_message_in_tail` 在第 1365 行 |
| `agent/conversation_compression.py` | 壓縮 = session 邊界;`compress_context()` 在這 rotate `session_id` |
| `agent/prompt_caching.py` | 昨天提過、今天又呼應的 cache breakpoint placement |

從 `ContextCompressor.compress()` 入,跟著 Phase 1–4 依序看;然後跳去 `conversation_compression.py` 看 session rotate 是怎麼接上資料庫的。
