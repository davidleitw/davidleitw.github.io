---
title: "Day 07:讓 agent 真的能動手做事"
description: "工具系統、七種沙箱、guardrail 三計數器、防說謊頁尾——讓謊報完成在結構上不可能。"
pubDatetime: 2026-05-11T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

在 `agent/tool_guardrails.py` line 218 看到這行:

```python
if '"error"' in lower or '"failed"' in lower or result.startswith("Error"):
```

「工具失敗判斷是字串比對。」我第一個反應是「**這也太脆**」——任何 tool 回的 JSON 只要含 `"error"` 欄位都會被誤判失敗,然後餵進 guardrail 計數器,有可能觸發假的 block。

但去翻 git log 跟其他 provider adapter 之後,看法變了——Hermes 接 50+ provider、每家 tool 回應格式不同、想做結構化判斷做不出來,**fragile 是被現實逼出來的工程選擇**。今天這篇拆工具系統:從工具契約、7 種沙箱、guardrail controller(純函式 + 計數器),到我覺得整個系列最該偷的「防說謊頁尾」設計。

---

## 一、工具契約:模型看到什麼、看不到什麼

先把最基礎的講清楚。在 Hermes 裡,一個工具是這樣的一個結構:

```
ToolEntry(name, toolset, schema, handler, check_fn, requires_env, ...)
```

`schema` 是標準的 **OpenAI function-calling schema**,`handler` 的簽章統一是 `handler(args: dict, **kwargs) -> str`,而且**必須回傳 JSON 字串**。

但這裡有個我覺得設計得很乾淨的地方,是分隔模型可見參數和執行期 context。`args` 是模型生成的——它要符合 schema、會被驗證。但 `**kwargs` 裡裝的是 `task_id`、`store`、`parent_agent` 這些東西,是**派發器在執行的當下注入的**。模型永遠看不到 `task_id`,也沒辦法假裝自己是另一個 task 的 parent agent。

> **Note**:這個分隔很重要。如果你讓模型「可以填」任何欄位,那麼模型遲早會 hallucinate 一個 `task_id="root"` 進來。把 runtime context 完全藏在 kwargs 裡,等於從根上斷掉這條攻擊路徑。

工具註冊本身也有一道防線——叫做 **shadowing protection**。如果一個 toolset 註冊了 `read_file`,然後一個 MCP plugin 也想註冊一個叫 `read_file` 的工具,**預設會被拒絕**,除非顯式 `override=True`。這擋的是「供應鏈劫持」:一個惡意 MCP server 偷偷覆蓋掉內建 `read_file`,讓所有讀檔請求都流經它。烤進 registry 這個最底層的元件,而不是事後檢查。

---

## 二、七種沙箱,七種「身體」

整套工具系統最精彩的地方,在 `tools/environments/` 這個目錄。同一個 agent core,它的「手腳」可以放在七種不同的執行環境:

| 後端 | 隔離強度 | 啟動成本 | Latency | 適用場景 |
|---|---|---|---|---|
| `local` | **零隔離** | 0 | 最低 | 開發、自用機 |
| `docker` | 容器級 | 中(秒級) | 低 | CI、單機隔離 |
| `singularity` | 容器級 | 中 | 低 | HPC 環境 |
| `ssh` | 主機級 | 連線成本 | 中 | 跑在遠端 box |
| `modal` | 雲端容器 | 高(冷啟動) | 中高 | 短時爆量 |
| `daytona` | 雲端 dev box | 高 | 中高 | 長住式 workspace |
| `vercel_sandbox` | 雲端容器 | 高 | 中高 | 邊緣執行 |

每種都實作同一個 `BaseEnvironment` ABC,實際上只要實作 `_run_bash()` 和 `cleanup()`,其他都由基底類別提供。trade-off 很直白:`local` 最快但完全沒有隔離,`docker` 隔離夠用但啟動秒級,雲端後端隔離最徹底但每呼叫一次都得付一次 latency。

**Docker 的強化姿態**值得單獨講一下:`--cap-drop ALL` 把所有 capability 砍光,再選擇性加回 `DAC_OVERRIDE / CHOWN / FOWNER`(只有 entrypoint 需要 `gosu` 降權時才加 `SETUID/SETGID`);`--security-opt no-new-privileges`、`--pids-limit 256` 防 fork bomb、tmpfs 暫存目錄掛 `nosuid`、`--init` 收殭屍程序。這是「最小能力 + 防越權」的 textbook 寫法。

但有一件事必須老實說。**`LocalEnvironment` 完全沒有隔離。** 整套沙箱安全模型假設你用容器或遠端後端,可是 `local` 是預設值。也就是說,從 source clone 下來、一句 config 都沒改的人,模型寫的 bash 是**直接在你的主機上 eval**。唯一的圍欄是「危險指令需要核可」那一層字串比對。

(這點 Day 14 會正面開砲,先記住。)

---

## 三、無狀態 shell 的假象

這是我第一眼看到、心裡默默說「靠這招漂亮」的設計。

如果你寫過 shell 整合,你會知道兩條路都會痛:

- **持久 shell**(開一個 `bash` 子程序、用 stdin 餵指令):state 留得住,但程序會卡死、會 hang 在子 process、重連之後狀態整個飄走、跨進程同步像在拆炸彈。
- **每次 spawn 新的 `bash -c`**:乾淨,但**每一次**都是新環境——你 `export FOO=bar`,下一條指令就忘了;你 `cd /tmp`,下一條指令還在原本的 CWD。

Hermes 兩個都不要,它做了第三條路——**session snapshot**。

`init_session()` 在 session 開始時,把當前的環境變數、函式、別名 dump 到一個 `/tmp/hermes-snap-*.sh` 檔。之後**每一條**指令在跑之前,`_wrap_command()` 會 prepend 一句 `source /tmp/hermes-snap-XXX.sh`,把那份 snapshot 重新載入。指令跑完之後,如果環境有變,再把新狀態寫回 snapshot 檔。

CWD 怎麼辦?本機後端用一個暫存檔記 CWD;遠端後端因為沒有可共享的檔案系統,改用 **in-band 的 stdout 標記**——指令結尾印一個 `printf '\n__HERMES_CWD_<session_id>__/some/path__HERMES_CWD_<session_id>__\n'`(其中 `<session_id>` 是運行期值,不是字面字串 `session`),母程序在 stdout 裡 grep 那個標記抓出 CWD。

> 用生活比喻:這就像每次你進辦公室,門口都重新發一張一模一樣的識別證、座位也重新指給你;但因為內容一致,你感覺自己「上次留下的東西都還在」。其實每一次都是新的進程,只是裝得很像。

**有一個漏洞要特別處理**:如果模型寫 `cd /foo && ls`,中間的 `&&` 串接讓 `cd` 跟 `ls` 在同一個 `bash -c` 裡跑,CWD 標記能抓到結束時的目錄,沒問題。但如果它寫成兩個獨立的 tool call(一個 `cd`、一個 `ls`),`cd` 的效果其實會被 snapshot 接住——前提是 wrap 過的指令在結束時把 `pwd` 寫回去。Hermes 確實這樣做了,所以這個假象大部分時候撐得起來。

為什麼這個假象重要?**prompt cache**。如果模型在 turn 1 看到 `pwd=/home/x`,turn 3 又看到 `pwd=/home/x`,中間沒有「我現在的環境是新的」這種莫名其妙的飄移,模型生成的 reasoning 就會穩,context 也比較容易命中 cache。**這是把 Day 03 的 prompt cache 鐵律延伸到工具層的一個應用**。

---

## 四、三層結果預算:不讓一個 `cat` 撐爆 context

`cat` 一個 200MB 的 log 檔——你的 context window 瞬間爆炸。Hermes 三層防禦:

1. **每個工具自己截斷**:工具內部先做一次 truncation,通常是「保留前 N 行 + 後 M 行」這種。
2. **每個結果的持久化**:超過某個門檻的輸出,被寫進**沙箱的暫存目錄**;context 裡留下一個 `<persisted-output>` 預覽片段 + 一個檔案路徑,模型可以用 `read_file` 去翻原本的完整內容。**用持久化取代純截斷——資料沒丟,模型能分頁讀。**
3. **每一輪的總預算**:一輪裡所有工具結果加起來超過 200K 字元,把最大的那幾個溢寫到磁碟。

兩個漂亮的小細節:

- `read_file` 自己的門檻被釘成 `inf`(無限大)。為什麼?因為如果 `read_file` 也會觸發持久化,那「持久化 → 模型 `read_file` 它的預覽 → 又持久化 → 又 `read_file`」會無限循環。把 loop-breaker 釘進門檻設定裡,而不是寫一個分支判斷,這種防呆我很欣賞。
- 持久化用 **stdin 管道**把內容餵進指令,而不是塞進命令字串。為什麼?Linux 有個 `MAX_ARG_STRLEN` 限制是 128KB——而持久化要處理的本來就是大檔。把它走 stdin 是刻意閃避這個系統限制。

**有個契約面的關鍵**:`tool_result_classification.py` 裡有一個 `file_mutation_result_landed(tool_name, result)`。對於 `write_file` / `patch` 這類「會改檔案」的工具,**它的 result 必須是結構化的**——`write_file` 要回 `bytes_written` 欄位;`patch` 要回 `success: true`(兩個工具用不同欄位,各自由 `tool_result_classification.py` 判斷)。不可以只回一個字串「OK」。原因下個小節說。

---

## 五、誠實一點:錯誤分類其實是字串比對

我讀到這段的時候皺了一下眉。

`classify_tool_failure` 對「generic」類別的工具,失敗判定是這樣寫的(`tool_guardrails.py:217–218`,完整條件):

```python
lower = result[:500].lower()
'"error"' in lower or '"failed"' in lower or result.startswith("Error")
```

三條 OR——也就是說,**任何工具回的 JSON 字串裡只要包含 `"error"` 或 `"failed"` 這兩個 token,或回應以 `Error` 開頭,就會被判定為失敗**。

這意味著什麼?舉個例子:你寫了一個 lint 工具,正常情況回 `{"errors_found": 0, "issues": []}`。它**沒失敗**,但 `'"error"'` 在前 500 字內,classifier 直接判它失敗。然後這個誤判會餵進**下一節要講的工具迴圈護欄**,讓計數器加一。連續幾次「成功但被誤判」之後,模型會被「擋住」,被告知不要再呼叫這個工具。

這就是為什麼 `file_mutation_result_landed` 要走「結構化欄位」那條路而不是字串比對——對 file write 這種事情,Hermes 老老實實 parse JSON、檢查 `bytes_written`、檢查 `success: true`。但對「generic」這層,它退化成 `'"error"' in result[:500]`。

**這是一個結構性的技術債**。正解應該是讓所有工具都回一個 `{ok: bool, ...}` 的 envelope,Hermes 沒做到。Day 14 會回來算這筆帳——現在先把它記在心上,因為這條串著好幾個下游問題。

---

## 六、並行 vs 序列:由「安全證明」決定,不是由「希望」

`tool_executor.py` 用一個 `ThreadPoolExecutor(max_workers=8)` 跑並行工具呼叫。但**不是每次都並行**——`_should_parallelize_tool_batch` 會先檢查整批 tool call,只有在能「證明安全」時才並行。

證明標準很嚴:

1. 批次裡每個工具都在 `_PARALLEL_SAFE_TOOLS` 這個 frozenset 裡(它是 **read-only 工具白名單**——`read_file`、`list_files`、`grep` 這類)。
2. **或者**,是 path-scoped 的 file tool 且 **路徑不重疊**(用 `Path.parts` 做 prefix 比對)。
3. **任何 parse 失敗 / 解不出來路徑** → 整批退回**序列**執行。

> 重點來了:這是 **opt-in by safety proof**,不是 **opt-in by hope**。

差別在哪?多數系統的並行邏輯是「除非我知道你不安全,否則就並行」(opt-out by detection)。Hermes 反過來,「除非我能證明你安全,否則就序列」。在一個你完全不信任輸入的場景(模型生成的 tool call),這個方向的選擇正確得多。

實作上還有兩個小巧思:`contextvars.copy_context()` 複製到每個 worker,讓 thread-local 的 `task_id`、`approval_callback` 都跟著走;每 5 秒 heartbeat 一次去敲 gateway 的活性監視器,免得長時間跑的工具被誤判 idle 砍掉。worker 進去之前還要把 approval callback 裝好(否則子代理 prompt 會 deadlock 在 `input()`)——這種細節是踩過坑才會寫的。

---

## 七、工具迴圈護欄:讓模型不要鬼打牆

agent 最常見的失敗模式之一,是**鬼打牆**。同一個工具用同樣的參數連 call 八次,每次失敗、每次又改一點點細節重試,token 燒光。

`agent/tool_guardrails.py` 處理這件事。它有三個計數器,key 全部用 `ToolCallSignature`——也就是 `tool name + SHA-256(canonical-JSON args)`(注意是雜湊,不是把原始 args 寫進去,免得敏感資訊洩漏到日誌):

| 計數器 | 警告閾值 | 硬阻擋閾值 | 意思 |
|---|---|---|---|
| `exact_failure` | 2 | 5 | 完全一樣的 call 連續失敗 |
| `same_tool_failure` | 3 | 8 | 同一個工具(任意參數)連續失敗 |
| `idempotent_no_progress` | 2 | 5 | 冪等工具呼叫了但 state 沒前進 |

實作上有一個我特別欣賞的設計選擇:**`ToolCallGuardrailController` 是純函式式的——它只回傳決定**(`allow` / `warn` / `block` / `halt`),**自己不動手**。要不要真的把 warning 塞進 prompt、要不要 break 出 loop,**全部由 runtime 決定**。

為什麼這個分離很好?

- **可測試**:整個 controller 沒有 side effect,你可以用一連串 fake `ToolCallSignature` 餵進去,assert 回傳的決定。寫單元測試完全不用 mock。
- **runtime 可以政策化**:同樣一個 `halt` 決定,在 CLI 裡可能是「印警告然後讓 user 拍板」,在 gateway 裡可能是「自動結束 session 並回 client」。decision 和 action 解耦。
- **這是個值得偷的 pattern**。如果你也在寫類似的東西——任何需要「規則引擎 + 副作用執行」的場景——把「規則」做成純函式,讓「執行」住在 runtime,你會省下後來自己改不動的痛。

> **Note**:順帶一提,「純函式 controller + 有副作用 runtime 分離」這個拆法**不是我自創**——它是 FP / classical AI agent 教科書(Russell & Norvig)的標準模式。但在 LLM agent 圈,主流寫法是 graph / orchestrator(LangGraph、AutoGen),很少這樣明確分離。Hermes 把 FP 視角搬進來這件事本身比較少見,值得指出來。

預設 warning 永遠開,但 hard stop 是 opt-in 的——這個保守是對的,因為前一小節講過,**錯誤判定本身有字串比對的偽陽性**,你不會想預設就讓「正常但被誤判失敗」的工具直接觸發 halt。

---

## 八、防說謊頁尾:讓「謊報完成」在結構上不可能

> **Note**:「防說謊頁尾」這個名字是我自己取的——業界目標一致但沒有統一命名(Cleanlab 叫「trustworthiness scoring」、Anthropic constitutional AI 走訓練層、有些人在 model-level 做 internal representation detection)。**Hermes 的做法是 prompt-level footer**:純工程選擇,不依賴模型訓練,任何 framework 都能照抄,這也是我覺得它值得推廣的原因。

這是我看完全身起雞皮疙瘩的設計。

問題是這樣的:模型很愛**過度宣稱**。你叫它「改三個檔案」,它在 final response 裡寫「我已經把三個檔案都改好了」——但實際上 `write_file` 對第二個檔案回了 error、它沒注意到,還是寫了那句話。使用者讀到那句話,以為事情做完了,結果出 bug 才發現第二個檔案根本沒動。

Hermes 怎麼解這個?在 `conversation_loop` 裡有一個 per-turn 的 dict 叫 `_turn_failed_file_mutations`。每次 `write_file` / `patch` 跑完,如果 `file_mutation_result_landed` 判定**沒成功落地**(記得,這裡用結構化欄位判,不是字串),就把 `(tool_name, path)` 記進去。如果同一個 path 之後**有**一次成功的 mutation,就把它從 dict 裡刪掉。

turn 結束、要把 final response 回給使用者之前,看那個 dict 裡還剩什麼。如果還有東西沒被後續成功覆蓋,**直接把警示頁尾附在 response 後面**:

```
⚠️ The following file mutations failed this turn and were not retried:
- write_file: /path/to/foo.py
- patch: /path/to/bar.py
```

模型蓋不掉這個頁尾——它是在 final response 生成**之後**才被 append 上去的,不在模型可控的 token 流裡。

> 一句話:**讓謊報完成在結構上不可能。**

這是我覺得整個 Hermes 裡最有「品味」的一個設計。不是「教模型不要說謊」(prompt engineering 的死胡同),而是**把信任的真相源(`file_mutation_result_landed` 的結構化判定)直接拼到輸出層**,讓模型的自白和系統的事實並列在使用者眼前。

---

## 暗線 C:模組分得開的部分,跟分不開的部分

我想在這裡稍微岔題。

如果你跟著我們從 Day 01 讀到這裡,你會發現一個有意思的對照:**工具系統本身做得相當乾淨**。`tool_executor.py`、`tool_dispatch_helpers.py`、`tool_guardrails.py`、`tool_result_classification.py`——每個檔案職責清楚、彼此邊界明確、可以獨立讀懂。連 `tools/environments/` 都是一個漂亮的 ABC + 多後端的展開,新增一個後端只要實作兩個方法。

但這跟我們 Day 12 / Day 14 會看到的**巨石檔案**形成強烈對比——`browser_tool.py` 160KB、`mcp_tool.py` 147KB、`skills_hub.py` 120KB、`delegate_tool.py` 118KB、`conversation_loop.py` 的 `run_conversation()` 接近 3,900 行……這些檔案各自做太多事,模組邊界已經糊掉。

**記住這個對照**。Hermes 不是「整套都好」或「整套都爛」,它是有些子系統的抽象做得很漂亮、有些子系統長到塞不進腦袋裡。後面我們會回來看,為什麼有些地方守得住、有些地方守不住——而那個分界本身,就是讀這個 codebase 最有營養的地方。

(這是我們的主線 C:**抽取程式碼 ≠ 分解系統**。)

---

## 小結

讓 agent 真的動手做事,要過八關:契約、沙箱、無狀態 shell 假象、結果預算、錯誤分類、並行安全證明、迴圈護欄、防說謊頁尾。其中三個設計我覺得是任何 agent framework 都該偷的:**ToolCallGuardrailController 的純函式式決定**、**file_mutation 結構化驗證 + 防說謊頁尾**、**並行 by safety proof 而不是 by hope**。一個技術債也老實寫出來:**錯誤分類退化成字串比對**,Day 14 會回來算帳。

但你寫到第三個工具就會冒出一個想法:「天啊,我能不能用別人已經寫好的工具?搜尋、地圖、Notion、GitHub、自家公司的內部 API——我不想每一個都自己包。」

2024 年 11 月,Anthropic 推出 **MCP**(Model Context Protocol),就是要解這個問題。明天的主題就是 MCP——它怎麼設計、Hermes 怎麼同時當 MCP 的 client 和 server,還有一個 MCP server 死掉時 Hermes 怎麼讓**模型本身**停止重試。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `agent/tool_executor.py` | 並行工具執行、`ThreadPoolExecutor`、context 複製 |
| `agent/tool_dispatch_helpers.py` | `_PARALLEL_SAFE_TOOLS`、`_should_parallelize_tool_batch` |
| `agent/tool_guardrails.py` | `ToolCallGuardrailController`、三個計數器、`ToolCallSignature` |
| `agent/tool_result_classification.py` | `file_mutation_result_landed`、`classify_tool_failure`(就是那段字串比對) |
| `tools/registry.py` | 工具自我註冊、AST 把關、shadowing protection |
| `tools/schema_sanitizer.py` | 對不同 provider 做 schema 消毒 |
| `tools/environments/base.py` | 無狀態 shell + session snapshot、CWD 標記 |
| `tools/environments/local.py` | 預設後端(零隔離,Day 14 要罵的就是它) |
| `tools/environments/docker.py` | 強化過的容器設定 |

入口建議:從 `agent/tool_executor.py` 進去,看一次 `execute_tool_calls` 怎麼把一批 tool call 餵給 dispatch helper 判斷並行性,再追到 `tool_guardrails.py` 看 controller 怎麼回 decision,最後翻到 `tools/environments/base.py` 看 `_wrap_command` 那段 session snapshot 怎麼撐起無狀態 shell 的假象。
