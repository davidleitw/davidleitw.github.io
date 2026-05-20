---
title: "Day 02:Agent 的「最小心臟」長什麼樣"
description: "核心迴圈、兩層巢狀、迭代預算,以及最該偷的設計:每個結束點都有名字。"
pubDatetime: 2026-05-06T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

第一個讓我決定認真讀 Hermes 的東西,不是 README、不是架構圖,是這條命令:

```bash
$ wc -l agent/conversation_loop.py
    4099 agent/conversation_loop.py
```

一個 .py 檔 4,099 行。我以為自己看錯,又 `grep -n "^def "` 一次——top-level function 沒幾個,而 `def run_conversation(` 從 line 187 開始。也就是說,**一個函式吞掉檔案 95%**。

這個函式就是整個 agent 的心臟。我盯著螢幕想了一下,決定先把它拆開來讀——這也是這篇要做的事:把這個 3,900 行的怪物分層解釋。讀完你會知道為什麼它這麼大、哪些是真的必要、哪些是 Day 14 會被批的「抽取程式碼不等於分解系統」。

但在拆它之前,得先回到更基本的問題:**一個 agent 的核心迴圈,最小到底是什麼樣子?**

想像幾個會發生的情境:模型呼叫了一個你 dispatcher 不認識的工具名(可能多了個 s,可能少了底線),你的 dispatcher 沒攔到,就把「unknown function」當 tool result 塞回去——模型看了看,又呼叫一次一模一樣的工具,然後再一次。或者它陷進「讀檔 → 想 → 改檔(失敗)→ 讀檔 → 想 → 改檔(失敗)」的迴圈,跑了很多輪,最後輸出「我已經把所有檔案都改好了」——其實一個都沒成。等你打開 API 用量 dashboard,你才知道那個 `while True` 跑得有多遠。

這個 naive 版本,是每個寫 agent 的人都會先寫一次的版本。寫完第二週你就會知道,為什麼它不能上線。

昨天講完為什麼我想拆 Hermes。今天直接從心臟開始拆——一個能上線的 agent,最小是什麼樣子?

---

## 一、ReAct:agent 的骨架就這麼點東西

所有 tool-using agent 的骨架,長得都一樣:

```
呼叫模型 → 模型決定動作 → 執行 → 觀察結果 → 再呼叫模型
```

學界有個名字叫 ReAct(Reasoning + Acting),Princeton 跟 Google 在 2022 年那篇 paper 弄出來的。但你不用記名字。你要記得的是這個迴圈——agent 跟 chatbot 的差別,就在這個迴圈跑不跑得起來。

如果把上面那個 naive 版本壓到大約 30 行,大概長這樣:

```python
def run_agent(user_msg, tools):
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]
    while True:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
        )
        msg = resp.choices[0].message
        messages.append(msg)

        if not msg.tool_calls:
            return msg.content   # 沒有要呼叫工具了,完工

        for call in msg.tool_calls:
            result = dispatch(call.function.name, call.function.arguments)
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": result,
            })
```

看起來很乾淨,對吧?如果你還沒寫過 agent,你會覺得「咦,真的就這樣?」對,真的就這樣。

那這個會在哪裡爆?**全部地方都會爆**。你來找:

- `dispatch()` 收到不存在的工具名怎麼辦?剛剛那個「拼錯工具名」的情境就是這個。
- 模型一直呼叫同一個失敗的工具,要跑幾次才停?上面這版答案是「永遠」。
- API 回 429、500、context overflow、`thinking_signature` 錯誤怎麼處理?整段噴掉。
- 一輪呼叫到第 200 次了,還沒結束,你要繼續燒錢嗎?
- 串流連線斷了、provider 那邊心跳吊著但永遠不送內容,你會傻等 30 分鐘。
- 模型在最後一段謊稱「所有檔案都改好了」,你怎麼知道?

每一條都是真實會發生的事。Hermes 的核心迴圈為什麼那麼大?因為以上每一條,它都有對應的處理。我們今天先看最骨幹的兩件事:迴圈的形狀,跟一個叫「迭代預算」的小元件。

---

## 二、Hermes 的迴圈:兩層巢狀,用旗標溝通

Hermes 的核心迴圈寫在 `agent/conversation_loop.py` 的 `run_conversation()` 裡。

我一開始 clone 下來打開這個檔案,VS Code 卡了一下——`wc -l` 出來是 **4,099 行**——其中 `run_conversation()` 函式從 line 187 開始,函式本體大約 3,900 行。我以為自己看錯了。(老實說這本身是個問題,Day 14 會正面開砲。但今天先放下這個審美問題,看它在做什麼。)

剝掉所有恢復邏輯之後,它的形狀是兩層巢狀迴圈:

```
外層迴圈:每呼叫一次 LLM 算「一輪」
  條件:api_call_count < max_iterations
       且 iteration_budget 還有餘額
  │
  └─ 內層迴圈:對「同一次邏輯呼叫」的重試
       條件:retry_count < max_retries
       │
       └─ 送請求 → 拿回應 → 出錯了就決定怎麼救
            │
            └─ 想用「修改過的狀態」重跑時:
                  設定 restart_with_XXX 旗標
                  break 出內層,讓外層決定要不要 continue
```

外層管的是「這一輪有沒有進展」——每呼叫一次模型就 +1。內層管的是「這次呼叫本身失不失敗」——壓縮過 context、調高輸出預算、換 provider 之後,要不要再試一次。

兩層之間的溝通方式很土法——用 `restart_with_compressed_messages`、`restart_with_length_continuation` 這種布林旗標,內層設了旗標就 `break` 出去,外層讀旗標決定 `continue`。是用 Python 手刻的狀態機,囉嗦,但它把兩個概念分得很乾淨:**「重試什麼」是內層的事,「這一輪有沒有真的前進」是外層的記帳**。

為什麼要分這麼開?因為不分的話,你會寫出那種——每次 retry 都當成「新一輪」記帳。於是 `max_iterations` 那個保險絲根本沒在保:一輪呼叫失敗 10 次,就燒掉你 10 個迭代額度,而模型其實還沒前進半步。

> **Note**:旗標 + `break` 是一種很手工的控制流,放在約 3,900 行的函式裡讓人很痛苦。但「retry 跟 iteration 是兩個獨立概念」這個拆分,本身是對的。你自己寫 agent 的時候,即使不模仿這個檔案結構,也要把這兩個計數器分開。

### 走一遍 context_overflow recovery 的真實時序

抽象說「外層管進展、內層管重試」聽起來簡單,把場景跑成一段偽碼才看得清楚。情境:第 8 圈,model 想送 streaming,但 input 已經滿——

```python
# ── 外層 while(conversation_loop.py:598)──────────────
while api_call_count < max_iterations and budget.remaining > 0:
    api_call_count += 1                              # 8
    restart_with_compressed_messages = False

    # ── 內層 retry,第 1 次 ─────────────────────────
    for retry in range(max_retries):
        try:
            response = client.messages.create(...)
            break
        except APIError as e:
            err = classify_api_error(e)
            # ClassifiedError(reason=context_overflow,
            #                 retryable=True,
            #                 should_compress=True)

            if err.should_compress:
                compress(messages)                   # 187K → 42K tokens (~2s)
                restart_with_compressed_messages = True   # ← line 2317
                break                                 # 跳出內層 retry

    # ── 外層尾端(對應 conversation_loop.py 約 line 2900 的真實邏輯)──
    if restart_with_compressed_messages:
        api_call_count -= 1                          # 退費,回到 7
        agent.iteration_budget.refund()              # budget 也退
        retry_count += 1                             # 但算進 retry 限制
        restart_with_compressed_messages = False
        continue                                      # 跳回 while 頂

# ── 再進 while 一圈 ─────────────────────────────────
# api_call_count 又從 7 變 8 — 跟剛剛同一號,
# 因為壓縮這一輪在外層眼裡「沒發生過」
while ...:
    api_call_count += 1                              # 8
    for retry in ...:
        response = client.messages.create(...)       # 這次過了
```

關鍵在外層尾端那 5 行——`api_call_count -= 1` 把外層進度**退費**、`budget.refund()` 把預算**退費**、但 `retry_count += 1` 卻**累積**。三個計數器在這個交叉點被刻意推往不同方向:

1. **進度退費**:壓縮這一輪不算外層進展。你 90 個 iteration 用完之前,壓縮的次數不該被算成「你做了一輪正事」。
2. **budget 退費**:同上邏輯。
3. **retry +1**:但壓縮會吃 retry slot——擋住「壓了又壓還是塞不下」的無限壓縮迴圈。`conversation_loop.py:2902–2904` 的註解直接寫:「Count compression restarts toward the retry limit to prevent infinite loops when compression reduces messages but not enough to fit the context window」。

**這就是兩個計數器分開的用途**——「進展」跟「重試」是兩個維度。compression 是「失敗的重試」(吃 retry),不是「成功的進展」(不吃 budget)。如果你只有一個計數器,沒辦法做這種非對稱退費:一次壓縮要嘛全燒、要嘛全免,沒中間值。

**為什麼不能合併成一層?**

想像你寫的是這樣:`for i in range(max_iterations): try: ... except: retry()`——retry 跟 iteration 用同一個計數器。結果:一次呼叫被 503 打中 5 次,你燒掉 5 個 iteration 額度,但模型其實還沒做半步進展。沒有「退費」這個選項,因為計數器只有一個維度。

`restart_with_compressed_messages` 在 `conversation_loop.py` 裡被設成 True 的地方有 **4 個**(line 2317、2481、2550、2639)——壓縮可以從多條恢復路徑觸發(context_overflow、payload_too_large、長對話自動壓縮、image_too_large 等),但每一條都共用同一套「退費 + 算 retry」邏輯。**寫迴圈的人決定『哪些事該算進展、哪些事該算重試』**,這是這個系列裡我最希望你帶走的觀念。

---

## 三、迭代預算 IterationBudget:不讓 agent 無限燒錢

剛剛說外層條件之一是「iteration_budget 還有餘額」。這個 budget 寫在 `agent/iteration_budget.py`——剛好 62 行的小檔案,跟它隔壁那個 4,099 行的怪物完全不同氣質。

它的本體就是一個有鎖保護的計數器:`max_total`、`_used`、`consume()`、`refund()`。看完原始碼大概一分鐘。但這裡面藏了三個很有趣的設計選擇,值得記下來。

### 設計 1:`execute_code` 會退費

如果某一輪 agent 只呼叫了 `execute_code`(這是 Hermes 一個「用程式碼批次呼叫工具」的機制,Day 7 會講),這一輪的迭代會被退費——不算進預算。

為什麼?因為程式化的工具呼叫是 RPC 風格的,本質上是一段 deterministic 的程式碼跑完一批操作,不該跟「agent 自己一步步想」算同一種成本。一個是 LLM 在燒 token 思考,一個是 Python 直譯器在循序執行。把它們合進同一個計數器,就會出現「agent 明明還沒做什麼決策,額度就被一段 batch script 燒光」這種荒謬狀況。

(想像你為了讓 agent 一次抓 10 個檔案,寫了個批次工具——如果這算一輪 iteration,那很合理;但如果這 10 次工具呼叫各算一輪,你的預算就在一瞬間蒸發了。一輪燒掉 10 個 iteration,你會以為是 LLM 不聰明,其實是 cost model 一開始就被擺錯。)

### 設計 2:每個 subagent 各自一個預算,故意讓全樹超標

先插一個 forward reference:Hermes 允許一個 agent **委派任務給另一個 agent**(像主管把工作分派給組員,Day 11 會深拆)。被叫出來處理子任務的那一個叫 **subagent**,父子之間的呼叫關係形成一棵「**委派樹**」——父代理是樹根,subagent 是分支,subagent 還可以再委派出去。

知道這個之後,`iteration_budget.py` 的 docstring 就讀得懂了:

> 「The parent's budget is capped at `max_iterations` (default 90). Each subagent gets an independent budget capped at `delegation.max_iterations` (default 50) — this means total iterations across parent + subagents **can exceed the parent's cap**.」

翻譯:父代理 90,每個子代理 50,整棵委派樹加起來會超過父代理的上限。而且文件直接寫「**這是故意的**」。

為什麼?如果你把預算當成「全域共用的池子」,父代理一委派出去,子代理一動,池子就在掉——這違反了委派的本意。委派是「我把一個獨立的子任務交給另一個 agent 處理」,那個子任務本身就是有自己尺度的工作量。如果你硬要全域共用,結果就是「我委派得越多,自己能做的事越少」——根本相反的方向。

每個 agent 一個獨立 budget,代價就是「全樹的總成本沒有硬上限」——這得交給呼叫端(像 gateway、cron)在外面加一層保護。但這個設計選擇本身是清楚的:budget 不是全域成本控制器,而是「保護單一 agent 不卡死」的工具。

### 設計 3:寬限呼叫 `_budget_grace_call`

預算用完之後,Hermes 還會再給一次呼叫。

聽起來很怪,「不是用完就用完嗎?」但你想想實際情境:agent 已經跑了 90 輪,做了一堆工作,現在預算耗盡——這時候如果硬生生截斷,模型最後那一段「我要告訴使用者結果」根本沒機會輸出。使用者看到的會是:跑了五分鐘,terminal 卡死,什麼都沒回。

所以 Hermes 的做法是:預算用完時,給一次寬限呼叫,讓模型有機會產出最終答案。如果還是不行(模型不肯停、繼續想呼叫工具),就走 `_handle_max_iterations()`——做一次完全不帶任何工具的呼叫,訊息大概是「請把目前進度總結給使用者」。

這就是用優雅降級取代粗暴截斷。naive 版本通常沒這個——預算撞牆就 raise 出去,使用者看到一個堆疊追蹤,以為 agent 壞了。其實 agent 是做完了,只是還沒講話。

> **Note**:三個設計——退費、樹狀獨立、寬限呼叫——它們的共同點是什麼?都是在處理「計數器跟現實成本之間的失真」。一個全域 +1 的計數器太粗,真實世界裡每種呼叫的成本、每個 agent 的工作邊界、每個迴圈的結尾體驗,都不該被同一條規則粗暴打平。

---

## 四、最值得學的細節:每個結束點都有名字

如果整篇文章你只記得一件事,記這個就好。

`run_conversation()` 不管怎麼結束——正常返回、被使用者打斷、預算耗盡、撞到無限重試上限、context overflow 救不回來——每一條結束路徑都會先寫一個 `_turn_exit_reason` 診斷紀錄。

特別有趣的是這條 rule:**如果輪結束時最後一則訊息是「工具結果」,而且這一輪又不是被使用者打斷的——就用 WARNING 等級記 log**。

為什麼這條這麼重要?因為「agent 做到一半就不動了」是使用者最常抱怨的 bug,而它是 agent 工程師最難 debug 的東西。你問使用者「它停在哪?」——使用者只會跟你說「它就停了啊」。你看 log,只看到一堆 tool call 跟 tool result,然後沒了。最後一則訊息是 tool result,意思是模型拿到了工具結果,卻沒有針對這個結果說話——它就這樣不見了。

你不知道是模型輸出了空字串、還是串流斷掉、還是 provider 心跳吊著、還是哪個 retry 被某個旗標跳掉。

Hermes 的解法不是去消滅這個 bug——很多時候你消滅不了(provider 那邊在抖,你能怎樣)。Hermes 的解法是:**讓每一條結束路徑都先報出自己的名字**,而且這條「最後一則是 tool result 又沒被打斷」的尷尬情境,直接拉警報。

我第一次讀到這段的時候,愣了三十秒。

因為 naive 版本通常是怎麼處理結束的?——`return msg.content`,完。沒有 log、沒有原因、沒有任何 debug 線索。想像 agent 跑到一半安靜地停下,你打開 log 想知道它停在哪——沒留下任何訊息。你只能手動翻整段對話歷史,猜它停在哪。

Hermes 教我的事是這樣:寫 agent 的時候,不要讓任何一條 return 或 break 是匿名的。每條路徑離開 loop 之前,都該先用一行 log 說「我是因為 `budget_exhausted` 才停的」「我是因為 `tool_result_without_response` 才停的」。這條紀律比任何高大上的觀測平台都有用。

> **Note**:Observability 本身不新——LangSmith、AutoGen、各家 framework 都做。Hermes 的紀律不在於「有 observability」,而在於**把「為什麼結束」提升為一等公民欄位**:不是事後從 log 推測,而是每條 return 之前就帶上一個 enum 標籤(原始碼裡叫 `_turn_exit_reason`)。這條紀律本身比變數叫什麼更有感——**可以直接搬到你自己的 agent**。

這個設計你今天讀完馬上能搬去自己的 code,而且馬上會回本。

---

## 五、暗線埋一個種子

最後留一句你今天看完先放著、後面幾天會慢慢回收的。

Hermes 這整個 `AIAgent` 跟 `run_conversation()` 核心迴圈,是 protocol-agnostic 的——它不在意「誰」在呼叫它。CLI 在呼叫?可以。HTTP gateway 在呼叫?可以。MCP server?cron job?Slack adapter?全部可以。核心迴圈本身對「我活在哪個世界裡」毫無假設。

這件事的威力,從 Day 5 換 provider 開始你會慢慢看到——同一段迴圈程式碼,接 OpenAI、接 Claude、接本機 llama.cpp,完全不用改 loop;Day 8 講 MCP 的時候會再清楚一次——別人寫的工具能無縫接進來;Day 9 講 gateway、Day 12 講 CLI/Web/Cron 三套介面共享一個腦袋,也是同一條線在收成。

這條暗線的名字我自己叫它「一個核心,多種驅動」。今天先記得這個設計選擇——`run_conversation()` 不在意是誰呼叫它——後面幾天它會反覆出現。

---

## 小結

agent 的最小心臟,概念上就一個迴圈:呼叫模型 → 執行動作 → 觀察 → 再呼叫。但能上線的版本,得把「重試 vs 進展」這兩個概念拆乾淨(兩層巢狀迴圈),得有一個計數器避免無限燒錢(IterationBudget),而且每一條結束路徑都得先報出自己的名字(`_turn_exit_reason`)——尤其那個「最後一則是 tool result 又沒被打斷」的 WARNING,是我從 Hermes 偷到最有感觸的一個觀測紀律。

但這個 loop 跑著跑著,你會撞到一個非常具體的牆——錢。

明天我們講 Hermes 為什麼把 system prompt 鎖死、不准你在 session 中途動它半個字。這是從成本與穩定性壓力中得出的設計選擇。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `agent/conversation_loop.py` | 核心迴圈 `run_conversation()`,整檔 4,099 行,`run_conversation()` 函式本體約 3,900 行;兩層巢狀迴圈、所有恢復邏輯、`_turn_exit_reason` 都在這 |
| `agent/iteration_budget.py` | `IterationBudget` 計數器,62 行;`consume()` / `refund()` / 寬限呼叫的源頭 |
| `run_agent.py`(repo 根目錄) | `AIAgent` 主類別,核心迴圈的「驅動者」;protocol-agnostic 的設計就在這 |

從 `run_conversation()` 進入,跟著 `restart_with_*` 旗標看分支,你就會看到那 ~25 個 inline 的恢復路徑(然後你會跟我一樣,想把它重構成 `RecoveryHandler`——但那是 Day 14 的事)。
