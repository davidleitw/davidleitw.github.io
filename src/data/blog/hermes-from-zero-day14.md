---
title: "Day 14:Hermes 哪裡其實做得不夠好"
description: "657KB 的 cli.py、len // 4 的中文災難、24 種英文字串比對——對 Hermes 誠實開砲。"
pubDatetime: 2026-05-18T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

挖 Hermes 的 CLI 指令分派的時候,想知道 `/compress` 是怎麼被路由到對應的 handler。我已經知道 CLI 入口在 `cli.py`,所以就直接打開。打開之前先 `ls -lh` 看一眼:

```
-rw-r--r--  1 me  staff   643K cli.py
```

643KB。一個 Python 檔案 643KB(實際 `wc -c` 出來是 657,883 bytes,14,466 行)。我以為自己看錯了,又敲了一次。沒看錯。

打開來,跳到第一萬行——還是同一個 class,還是 `HermesCLI`。再跳到一萬兩千行,還是。`Cmd-End` 跳到底,14,466 行。同一個檔案、同一個類別、一路到底。

然後事實一直是那個數字。過去兩個禮拜我一直在誇 Hermes:provider 抽象漂亮、prompt cache 鐵律設計得乾淨、MCP adapter 一鍵接、Kanban 那套持久性協調原語簡直藝術品。但這個檔案——這個 14,466 行的 `cli.py`——它在這裡,它真的在這裡,它就是 Hermes 的一部分。

「**架構漂亮 ≠ 實作乾淨**」這句話那一刻直接在我腦子裡浮出來。這份 codebase 的「設計文件」可以拿去教 distributed systems,但「程式碼結構」是另一回事。

過去 13 天我幾乎都在誇 Hermes。今天是欠它的——你看到的所有讚美只是一面。今天我們翻另一面,看看這個 codebase 的傷疤,因為**你要自己刻 agent 的時候,該避開的就是這些坑**。

---

## 一、巨石檔案:抽取程式碼 ≠ 分解系統(暗線 C 正面開砲)

先把數字攤出來,你自己感受一下:

| 檔案 | 大小 | 行數 |
|---|---|---|
| `cli.py` | 657KB | 14,466 行 |
| `gateway/run.py` | 855KB | 18,188 行 |
| `agent/conversation_loop.py` | — | 4,099 行(其中 `run_conversation()` 約 3,900 行,**單一函式**) |
| `hermes_state.py` | 138KB | 一個 3,200 行的 `SessionDB` 類別 |
| `hermes_cli/main.py` | 497KB | `main()` 是 2,800 行,內含 14 個巢狀閉包指令 handler |

這不是一兩個檔案爆掉。這是**整個 codebase 一致的結構性債務**。

但我要先說一件事——這不是「他們不知道要模組化」。Hermes 團隊**知道**。你打開 `agent/` 目錄,裡面有 80+ 個 `.py`:`agent/skill_*.py`、`agent/tool_*.py`、`agent/conversation_*.py`,拆得很細。Transport 抽成了 ABC,provider 變成 plugin,MCP 走 adapter。這些拆得很漂亮。

那為什麼還是長成這樣?

因為他們**拆到一半就停在「搬移程式碼」,沒有走到「定義介面 + 狀態的所有權」**。

最清楚的例子是 `AIAgent` 的 forwarder pattern。`run_agent.py` 裡有幾百個一行的 forwarder method,長這樣:

```python
def some_method(self, *args, **kwargs):
    return agent_some_module.some_method(self, *args, **kwargs)
```

真正的實作被推進 `agent/` 套件,看起來像「模組化了」。但你進去看那些被抽出的函式——**每個都還是吃 `self`、每個都還是伸手進幾十個 `AIAgent` 的屬性**。

> **Note**:檔案邊界是裝飾性的,沒有封裝、沒有介面。你只是把同一坨可變狀態的存取點從一個檔案搬到八十個檔案而已。

我看到那個結構的瞬間突然懂了:**模組化的單位是「有自己狀態的有界 context」,不是「檔案」或「函式」**。把一個 4,000 行的函式拆成「一個檔案放方法簽章、另一個檔案放方法 body、共用一個巨大的可變 `self`」——這只是搬動程式碼,沒有分解這個系統。

這是暗線 C 在這個系列的正面收成。Day 7 我們講工具系統(那個拆得不錯)的時候,Day 12 講三套介面共享狀態的時候,都偷偷鋪過——今天把它講白:**抽取 ≠ 分解**。Hermes 為什麼會變成這樣?因為它是個**快速演進**的活專案,功能一直加、加在最近的位置就是這幾個檔案、檔案越長越不敢動、最後就 657KB。這是任何一個高速迭代的 codebase 的自然結局,不是 Hermes 特有的失敗——但**你自己刻的時候,該意識到這條路通往哪裡**。

對使用者實際的影響是什麼?三件事:第一,**新人完全進不來**——一個新貢獻者想加個 slash 指令,他得先在 14,466 行裡找到 dispatch 點;光是讀懂上下文就要兩天。第二,**改一個地方要動全身**——`HermesCLI` 的方法之間靠 `self.xxx` 互相依賴,你改一個屬性的型別,得手動掃 190 個方法看誰用它。第三,**測試蓋不上來**——一個吃 60 個 `self` 屬性的方法,你要 mock 60 個東西才能單元測試,結果就是整個 `cli.py` 幾乎沒單元測試,只有 end-to-end 走過去碰一下。這三件事加起來,**團隊內部也在慢下來**,只是外人看不到。

---

## 二、24 種 fallback 都是英文字串比對

Day 7 我們講過 tool 失敗分類用 `'"error"' in result[:500].lower()` 這種 substring match。當下我覺得「OK 這是 LLM-aware 的 trade-off」。但你把整個 codebase 掃過一遍會發現——這不是孤例。

- **Tool 失敗判定**:`'"error"' in result[:500]`
- **Provider 錯誤分類**:`'rate limit' in str(exc).lower()`、`'context length' in str(exc).lower()`、`'safety' in str(exc).lower()`——一整排英文片語比對,大約 24 個 fallback string match 分散在不同地方
- **圖片拒絕偵測**:寫死的英文(和少數中文)子字串
- **Context 溢位**:同樣是英文片語

程式碼自己在註解裡承認:「這是 best-effort 的英文片語比對——一個被在地化翻譯或大幅改寫的上游錯誤會繞過這個守衛」。

這代表什麼?**任何一個 provider 改個錯誤訊息的措辭、任何一個 tool 回的 JSON 內容剛好含有 `"error"` 字樣,都會被誤判**。誤判會餵進護欄計數器,可能觸發假的 block/halt。你可能某天升級了 SDK,所有 rate limit 突然全部被分類成 generic failure——不是 bug 是「上游改了訊息字串」。

該怎麼做?其實 Hermes 自己也示範了——`file_mutation_result_landed` 有明確的 `bytes_written` / `success: true` 結構化欄位。對的做法就是**強制每個 tool 回一個 `{ok: bool, data: ..., error: ...}` 的 envelope**,失敗分類變成讀一個 bool。

但這件事沒有貫徹到全系統。為什麼?因為要貫徹意味著要動所有 tool definition、所有 provider error parser、所有 MCP 接點——這是一個大手術,沒人有時間做。於是這個技術債就一直擱著,新工具一個一個加上來、新的 substring match 一條一條疊上去,雪球只會越滾越大。

我自己刻的話,**第一個 commit 就會把 envelope 訂死**:tool 不回 `{ok, data, error}` 就拒絕註冊。這個成本一開始花掉一點點時間,但**它能消滅整個一類 bug**——provider 改措辭、tool 回的 JSON 巧合含 "error"、在地化翻譯繞過守衛,這些全都消失。這就是「介面定義在前」跟「事後拼貼」的差別。

---

## 三、沒有 agent eval 層——最深的那道缺口

這是 Day 13 鋪墊過的,今天正面講。

Hermes 的 test suite 很厚。串流解析、tool call repair、provider failover、context 壓縮觸發——這些「水管」測得很扎實。但你把測試目錄翻過一遍,會發現一件事:

**沒有任何測試在問「這個 agent 做的決定好不好」**。

沒有 golden trajectory,沒有 task pass rate benchmark,沒有 multi-turn completion 評分,沒有 regression detection on actual agent behavior。LLM 在測試裡被完全 fake 成 `SimpleNamespace`,所以你測的永遠是「假設 LLM 回了 X,我們的程式碼會做 Y 嗎」,不是「真實 LLM 在這個 prompt 下會做什麼」。

這代表 Hermes 的測試**證明了它的程式碼很穩健,但沒有證明它是一個好 agent**。

你把它升級到下一版 Claude,沒有任何自動化能告訴你「task completion rate 從 78% 掉到 65%」。你重寫了 context 壓縮策略,沒有任何自動化能告訴你「agent 現在第 20 輪會忘掉自己的初始目標」。這些都是 agent 產品**最終的品質訊號**,而它們都在系統的雷達之外。

這也是 Hermes 最該被批評的一條,因為它不是「沒做好」——它是「整個維度沒被測過」。

你可能會想:eval 不是很難做嗎?要 LLM-as-judge、要設計 task、要維護 golden trajectory。對,是難。但**「難」不是不做的理由,是「該被認真投入」的訊號**。你自己刻的話,從第一天就建一個小小的 eval 層——哪怕只有 5 個 task、用 LLM-as-judge 簡單打分——也比完全沒有強百倍。一旦那個基礎結構在那裡,後面要往上疊都容易。Hermes 沒有那塊基礎結構,所以**未來任何時候想做 eval,都要從零開始**——這就是「沒在第一天種下種子」的代價。

---

## 四、`len(content) // 4` 全程一致地錯

Token 估算到處用 `字元數 // 4`。對英文勉強堪用——英文一個 token 大概 4 個 character,誤差不大。對中文是錯的。

CJK 字元大約 **1–1.5 字元/token**,也就是「100 個中文字大概 70–100 個 token」。但 Hermes 全程用 `100 // 4 = 25 tokens` 來估。差 3–4 倍。

這個錯誤一致地出現在:壓縮觸發、tail-cut、`@`-reference 上限、context budget 計算。對中文 session 而言,**壓縮永遠在錯的點觸發**——通常是太晚,因為 Hermes 以為 context 還很寬鬆,實際上已經爆了。

最氣的是:`tiktoken` 在那裡、Anthropic 的 tokenizer 在那裡,接進來大概是一天的工作。但沒人接。為什麼?我猜是因為「先做 demo,中文化以後再說」——然後「以後」永遠沒到。對英文使用者來說這個 bug 永遠不會浮上來,所以它不會進到 issue tracker、不會有人寫 PR;**它就是個只對非英文使用者存在的隱形錯誤**。這也是開源 agent 框架很常見的一種文化盲點。

---

## 五、重試計數器混亂——同一個變數兼任兩個概念

Day 2 我們講過那個 `restart_with_compressed_messages` 旗標。當主 loop 偵測到 context 太長時,會把 messages 壓縮、設這個旗標、然後 restart——順便會增加 `retry_count`。

問題是,`retry_count` 同時也被「API 失敗重試」用。所以同一個變數**兼任兩個語意上完全不同的概念**:「我剛剛做了一次壓縮重啟」跟「我這個 API call 失敗了 N 次」。

整個 `AIAgent` instance 上大概有 **10 個各自定義的計數器**,在不同的點被 reset(有的是新 user turn reset、有的是新 tool call reset、有的是 session 開始才 reset)。worst-case 一個 user turn 會打幾次 API,**很難算清楚**——你必須把這 10 個計數器在腦中模擬一遍。

這對使用者實際影響是什麼?帳單上會出現你解釋不了的 API call 數,debug context loss 的時候你不知道是壓縮觸發兩次還是 API 重試兩次。**觀測性的缺口**比一個明顯的 bug 更討厭,因為它讓你無法快速判斷出問題的根因。要修這個其實不難——把「壓縮重啟」跟「API 重試」變成兩個獨立的 counter,各自有自己的 reset 規則,在 logs 裡分開印——一個下午的工作。但沒人做,因為它不會「壞掉」,只是讓人看不清楚。

---

## 六、Concurrent tool execution 不擋 implicit shared state

Day 7 我們講過 `_PARALLEL_SAFE_TOOLS` 白名單跟 pre-flight path overlap check——`read_file("a.py")` 跟 `read_file("b.py")` 可以並行,`write_file("a.py")` 跟 `read_file("a.py")` 會被擋。

但這個檢查**只看 path 字串**。它不擋:

- 兩個 MCP tool 連到同一個 PostgreSQL,改同一個 row
- 兩個 plugin tool 寫同一個外部 API 的同一個 endpoint
- 兩個 shell command 修改同一個全域狀態(`PATH`、`pip install` 改同一個 venv)

**implicit shared state 完全沒有保護**。pre-flight check 只能擋掉「同個檔案路徑」這種顯式衝突,擋不了真正會在生產環境炸開的隱式衝突。沒有 per-resource 鎖、沒有 transaction boundary、沒有「這兩個 tool 用同一個 backing service」的元資料。

該怎麼做?讓 tool definition 自己宣告它觸碰哪些 resource(可以是 abstract resource ID),scheduler 根據宣告做 per-resource 鎖。Hermes 沒做到這一步——但它至少把「並行安全」的概念明確化了,你自己刻的時候有個起點。

---

## 七、Plugin hook = fire-and-forget + blanket `except Exception: pass`

Hermes 的 plugin 系統(Day 10 講過)用 hook 機制——`on_message`、`on_tool_call`、`on_error`。漂亮。但你去看 hook 被觸發的程式碼:

```python
for plugin in self.plugins:
    try:
        plugin.on_message(msg)
    except Exception:
        pass  # plugin shouldn't break the agent
```

立意是好的——壞掉的 plugin 不該整個拖垮 agent。但這個保護的代價是:

- **沒有 health 追蹤**——一個 plugin 連續 100 次拋 exception,系統沒有任何訊號
- **沒有 circuit breaker**——壞掉的 plugin 會一直被叫,一直在背景吃 CPU、一直在拋 exception(只是被吞掉)
- **沒有 telemetry**——使用者完全不知道他裝的某個 plugin 已經默默死了三個禮拜

對使用者實際的影響是:**agent 默默劣化**。你裝了一個 plugin 想加強記憶,它今天壞了,你完全不知道,只覺得 agent 怎麼最近忘性變差了。除錯路徑被切斷,因為錯誤被吞掉了。

該怎麼做?保留 isolation,但加 telemetry——拋 exception 的時候記一筆 metric,連續 N 次失敗就 disable 並通知使用者。這不難做,只是 Hermes 還沒做。

---

## 八、背景複查的 silent data loss

Day 6 我們講過 Curator 的自我改進迴圈——背景複查器寫技能、Curator 整併。漂亮的設計。

但底層依賴一個 **auxiliary LLM**(通常是更便宜的模型,跑 background 任務)。aux LLM 一旦掛掉——rate limit、provider down、API key 過期——fallback 行為是什麼?

**直接丟掉中間那段 context,換成一個靜態 placeholder**。

「中間那段 context」可能是壓縮過程中暫存的 working memory,可能是 Curator 還沒寫回去的 skill draft,可能是子代理回報的中間結果。這些東西**靜默地消失**,主 loop 繼續跑、使用者不會收到任何訊號。

更糟的場景:你的主 model 跟 aux model 是同一個 provider(很常見,你用 Anthropic 跑主 model、用 Haiku 跑 aux)。Anthropic 一個 region down,**兩個一起掛**。主 model 還在 retry,aux model 已經默默走 fallback 把 context 丟了。等主 model 恢復,context 已經是一個被閹割的版本。

這是 silent data loss——最難 debug 的那種錯誤,因為它不報錯。你看到的只是 agent 突然變笨。

該怎麼做?**fallback 要有明確的訊號分層**:aux 掛掉時,要嘛把錯誤往上拋讓主 loop 自己決定怎麼辦(可能是降級到不做壓縮、可能是直接停下來告訴使用者),要嘛至少在訊息流裡塞一個顯眼的 marker(`[aux LLM unavailable, context may be incomplete]`)。**靜默 fallback 是反模式**——任何時候系統做了一個會影響正確性的退路選擇,使用者都該被告知。Hermes 沒做到,所以它的「自我改進」在 aux 不穩的時候會變成「自我劣化」,而且你不會收到通知。

---

## 小結:設計水準 > 實作水準

把上面這 8 條收一收,我想講的不是「Hermes 不好」。

Hermes 是個**「設計水準 > 實作水準」的 codebase**。它的架構選擇(provider 抽象、prompt cache 鐵律、MCP adapter、Kanban 持久性協調)都是教科書級別。但它的**程式碼結構**——657KB 的單檔、4000 行的單函式、英文字串比對的失敗分類、混亂的計數器、沒有 eval 層——是另一個故事。

這代表它**值得讀架構、值得偷設計**,但**不值得直接照抄程式碼結構**。

對讀者(也就是你)而言,最大的學習其實在這篇:看著 Hermes 的傷疤,你知道「啊,我自己刻的時候要避開這條路」。架構上的好決定可以模仿,結構性的債務不要繼承。一份 657KB 的 `cli.py` 不是某一個人的失敗——它是「快速迭代 + 沒有定義介面就先抽程式碼」這條路徑的必然結局。**意識到這一點,你就有機會走另一條路**。

明天最後一天——把這 14 天所有東西收起來:**如果是我,我會怎麼寫一個 agent framework**?哪些 Hermes 的點子直接偷、哪些坑要從第一行 commit 就刻意避開、什麼樣的人不該自己刻 agent。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `cli.py` | 657KB / 14,466 行的單一 `HermesCLI` 類別,看一眼感受一下 |
| `gateway/run.py` | 855KB / 18,188 行,`GatewayRunner` god object |
| `agent/conversation_loop.py` | 4,099 行,`run_conversation()` 是約 3,900 行的單一函式 |
| `agent/tool_executor.py` | 並行工具的 `_PARALLEL_SAFE_TOOLS` 白名單跟 path overlap check |
| `agent/auxiliary_client.py` | aux LLM 客戶端,看背景複查的 fallback 路徑 |
| `run_agent.py` | `AIAgent` god object 跟 forwarder pattern |

從 `cli.py` 隨便挑一行下 `Ctrl-G` 跳行號,跳到第 8000 行——你會看到還是同一個 class。這就是今天這篇的起點。
