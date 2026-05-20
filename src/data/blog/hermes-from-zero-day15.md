---
title: "Day 15:如果是我會怎麼寫一個 agent framework"
description: "14 天的收成:會保留的、會修掉的、會新加的——如果是我會怎麼寫一個 agent framework。"
pubDatetime: 2026-05-19T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

14 天前,你打開一個空白檔案,寫下 `from openai import OpenAI`,然後想「我要做一個 agent」。你的腦袋裡裝的東西是這樣的:`client.chat.completions.create(messages=[...])`、`tools=[...]`、一個 while loop、收到 `finish_reason='tool_calls'` 就執行工具、塞回去、再呼叫一次。聽起來很簡單。

然後你開始踩坑。換 model 換到崩潰、token 帳單翻三倍、tool call 開始 hallucinate 假的函式名、想接 Slack 跟 cron 結果寫了三套狀態管理、想加新功能但動到 core 就什麼都壞掉。你開始想——「應該有人解過這些問題吧?」於是你 clone 了 `NousResearch/hermes-agent`,打開 README,看了三分鐘,完全不知道在幹嘛。那是第一天。

第三天,你讀到 `system_prompt_session` 不准動那條鐵律,腦袋裡突然「啊!」了一聲——原來那不是性能優化,是整個 API 的形狀都被這條不變式長出來的。第七天,你看到 `tool_guardrails.py` 用三個純函式計數器擋住假完成,你心裡冒出「這個我可以偷」的興奮。第十四天,你看到 `cli.py` 657KB、`run_conversation()` 4,099 行的單一函式,你開始懂為什麼那個系列的最後一篇叫做「自己刻會更好」。

這 14 天讓你學到的不是「Hermes 怎麼做」。是「**一個 agent framework 該長什麼樣**」。

---

昨天我們把 Hermes 所有的瑕疵攤開來——巨石檔案、字串比對、token 估算對 CJK 完全錯誤、沒有 agent eval、安全預設不安全、自我改進迴圈的振盪、cron 的無聲資料流失。今天不是再批一次。今天是把這 14 天看到的東西收成一份「**如果是我,我會怎麼做**」。

這篇沒有可以 copy-paste 的程式碼。它是一份**架構選擇的清單**——哪些是 Hermes 做對而你該偷、哪些是 Hermes 做錯而你該避、哪些是 Hermes 沒做但你該補。如果你撐到了 Day 15,這份清單就是你接下來開那個空白檔案時,腦袋裡可以靠的東西。

---

## 一、我會保留 Hermes 的這些設計

先聲明立場:Hermes 是一個跑在真實生產環境的 agent,90% 的東西它都做對了。下面這些是我這 14 天讀下來,**會原封不動偷走**的設計決定。

### 1. 核心迴圈是 protocol-agnostic 的

這條是整個系列**最重要的一個架構選擇**,也是暗線 A 在 Day 2、5、8、9、12 反覆出現的東西。`AIAgent` 不知道是誰在呼叫它。它接受 user input、跑迴圈、產 output、把事件 yield 出來——至於呼叫它的是 CLI、是 gateway HTTP、是 MCP server、是 ACP adapter、還是 cron scheduler,它都不在乎。

這件事聽起來很基本,但你自己刻 agent 第一版的時候,**99% 的人都會把終端機輸出寫死進迴圈裡**——`print(token)` 就在 `for token in stream:` 那一行旁邊。等你想接 Web 介面的時候,你會發現你要重寫迴圈。等你想接 Slack 的時候,你又要重寫一次。

Hermes 把所有外部介面都做成 adapter——CLI 是一個 adapter、gateway 是一個 adapter、MCP server 是一個 adapter。核心只 yield 事件,adapter 自己決定怎麼渲染。這條原則你必須從第一行就寫對,因為事後重構幾乎不會發生。

### 2. Prompt cache 是鐵律,不是優化

這是暗線 B——Day 3 主角登場、Day 4 解釋為什麼壓縮是唯一被允許的中途變動、Day 6 記憶為什麼不能塞 system prompt、Day 10 技能注入為什麼走 user message。

**System prompt 在一個 session 中途絕對不能動。** 一個字都不行。動了你就失去 cache、帳單就翻三倍、延遲就從 200ms 變 2s。所有需要中途改變的東西——記憶、新技能、reminder、被注入的 context——一律走 user message,當成「使用者剛剛說了一句話」插進去。

這條規則塑造了 Hermes 整個 API 的形狀。你刻自己的 framework,這條從第一天就要立。立了之後,你會發現很多看起來奇怪的設計(為什麼技能是 user message 注入而不是改 system prompt?為什麼壓縮要產一個新的 assistant message?)突然全部變得理所當然。

### 3. 每個結束點都有名字

Day 2 提過 `_turn_exit_reason` 這個小東西——一個 enum,記錄這一輪迴圈是怎麼結束的:`natural_stop`、`tool_call_requested`、`iteration_budget_exhausted`、`compaction_triggered`、`error_recovery_restart`……

這看起來只是個 logging 細節。**它不是**。它是可觀測性的紀律——當你的 agent 在生產環境跑了一個月,使用者抱怨「它有時候會卡住」,你打開 log,你立刻知道每一次卡住是哪一種卡住。沒有這個 enum,你就在大海撈針。

每個結束點都要有名字。這條跟「每個錯誤都要有 enum」(Hermes 的 `FailoverReason` 17 種值)是同一條紀律。

### 4. 委派 = context 防火牆

Day 11 講子代理委派。表面上看,子代理是「叫人幫忙」——「你去幫我搜尋一下這個」、「你去幫我讀那個檔案」。但 Hermes 的設計暗示了一個更深的東西:**子代理的本質不是「分工」,是「建立一道 context 邊界」**。

父代理把一個任務丟給子代理,子代理在自己乾淨的 context 裡跑、產出結果、回傳一個摘要。父代理只看到摘要,看不到子代理過程中讀了 50 個檔案、試了 3 個錯的工具呼叫。這道防火牆讓父代理的 context 不會被噪音污染。

這件事你自己刻的時候很容易做反——把子代理當成「同一個 context 裡的另一段邏輯」。錯。子代理就是要有自己的 context。

### 5. 防說謊頁尾

Day 7 講 `tool_guardrails.py`。當一個 agent 連續 N 次說「我已經改好了」但檔案沒動,系統會在下一輪的 prompt 結尾追加一段「**你聲稱完成但工具沒執行,請停止聲稱完成**」。

這個設計的精妙在於——它**讓謊報完成在結構上不可能**。不是用更聰明的 prompt 去說服 model 不要說謊,是用一個外部計數器+結構性追加,讓謊報這件事在下一輪就被打臉。Model 看到自己上一輪的承諾跟現在的計數器衝突,自然就轉向。

你自己刻 agent 一定會遇到 hallucination。靠 prompt engineering 解是徒勞的。**用結構去解**。

### 6. 純函式控制器 / 有副作用 runtime 分離

也是 Day 7 鋪墊的。`tool_guardrails.py` 是一個純函式的控制器——給它「目前的計數器狀態 + 這一輪發生的事」,它回傳「下一個狀態 + 該不該觸發護欄」。它不執行工具、不發 HTTP、不寫檔案。執行那些事的是 runtime 那一層。

這個分離是好測試的根源。你要測「連續 3 次 same-tool-failure 會不會觸發 warning」?直接呼叫純函式,塞假狀態進去,assert 回傳值。不用 mock 一整個 agent。

你自己刻的時候,**把所有「決定要做什麼」的邏輯都做成純函式**——回傳一個 action 物件,讓另一層去執行那個 action。這條紀律會讓你的測試套件薄一個量級。

### 7. 「漸進揭露」的 skill 機制

Day 10 講技能系統。Hermes 的技能不是一次全塞進 system prompt。它先給 model 看一份**技能清單(只有名字+一行描述)**;當 model 表達「我需要 X 技能」的時候,才把 X 技能的完整 prompt 注入。

這個「漸進揭露」(progressive disclosure)的設計擋住了一個很實際的問題——你的技能庫長到 50 個的時候,如果一開始就全塞,token 預算就爆了。Hermes 用一個兩段式查找解掉這件事。

你自己刻 framework,**永遠不要一次塞所有 context**。永遠先給索引、再給內容。

### 8. 壓縮當作 session 邊界

Day 4 講 context 壓縮。直覺的做法是「把舊訊息覆寫成摘要」——這是一個破壞性更新。Hermes 不這樣做。它把壓縮當成一個 **session 邊界事件**:產一個新的 assistant message「以下是我對前面對話的摘要……」,然後 append 進去,舊訊息標記為「不再餵給 LLM」但保留在儲存裡。

差別在哪?**append-only 永遠可復原**。你想 debug、想回放、想看「壓縮之前發生了什麼」——資料還在。破壞性覆寫就什麼都沒了。

這條原則延伸到很多地方——記憶、技能更新、狀態變更,能 append-only 就 append-only。

---

## 二、我會修掉 Hermes 的這些

下面是 Day 14 攤開來的問題,我自己刻的時候會刻意修掉的東西。

### 1. 抽到底——不要停在「搬移程式碼」

Day 14 講過 Hermes 最深的結構性債務:`run_conversation()` 是一個 4,099 行的單一函式。團隊**知道**模組化重要,他們把方法 body 推進了 `agent/` 套件——但他們**停在「搬移程式碼」,沒有走到「定義介面 + 狀態所有權」**。

我自己刻的話,從第一天就照 `RecoveryHandler dispatch` 的形狀做:

- 分類器產一個 `FailoverReason` enum(Hermes 已經有了)。
- 一個 dispatch table:`{FailoverReason.X: RecoveryHandler.x_handler}`。
- 每個 handler 是純函式,回傳 `RecoveryAction`。
- Runtime 那層執行 `RecoveryAction`。

這樣 `run_conversation()` 就是一個 50 行的迴圈,不是 4,000 行的怪物。Hermes 的研究員自己也承認這條路——分類法已經產出了,只是迴圈沒乾淨 dispatch。

### 2. 結構化 tool result envelope

Day 14 砲過的字串比對——`'"error"' in result[:500].lower()`。任何工具輸出剛好含 "error" 字樣就被誤判失敗,餵進護欄計數器,觸發假的 block。

我會強制每個工具回傳一個結構化信封:

```python
{
    "ok": bool,
    "payload": ...,
    "errors": [...]  # 結構化的錯誤物件
}
```

失敗分類變成讀一個 bool。這一個決定就消滅了 Day 14 砲過的「字串比對地基」一大半。Hermes 的 `file_mutation_result_landed` 已經示範了對的做法,只是沒有強制全工具用。

### 3. Agent eval 層

Day 14 最重的一刀:Hermes 的測試套件**徹底測了水管,完全沒測 agent 的決定好不好**。串流解析器、工具修復、後備機制——全測爆。Agent 在多輪任務裡的完成率?零測試。

我自己刻的話,從第一天就建一個 eval suite:

- 一組 **golden trajectory**——固定任務 + 已知的好軌跡。
- 每次 PR 跑通過率對比。
- 多輪任務完成評分,不只是 smoke test。
- 對「真實 SDK 回應形狀」的契約測試——把 `SimpleNamespace` fake 釘到真實型別。

一個 agent 產品最終的品質是「它做的決定好不好」。Hermes 的測試證明了它的程式碼穩健,沒證明它是一個好 agent。

### 4. 正確的 tokenizer——尤其對 CJK

`字元數 // 4` 對英文勉強,對中文錯三倍。壓縮觸發、tail-cut、`@`-reference 上限這些攸關正確性的決定,踩在一個對中文錯三倍的估算上。

把 `tiktoken` 或 provider 的 tokenizer 接進來。沒有理由不接。

### 5. Plugin health tracking + circuit breaker

Hermes 的 plugin 是 fire-and-forget——一個壞掉的 plugin 可以持續產 exception,系統沒有任何整體健康度的紀錄。

我會給每個 plugin 一個健康度計數器:連續失敗 N 次就 trip 一個 circuit breaker,接下來 M 分鐘不再呼叫它,並且把這個狀態暴露到一個 `/health` 端點。

### 6. Mechanical compression fallback

Day 14 提過——Hermes 壓縮失敗的預設行為是「丟掉中間那段 context」,無聲、不可復原。Aux LLM 掛了你就無聲資料流失。

我會做一個 mechanical fallback——LLM 壓縮失敗,fallback 到「取頭 N 條 + 取尾 M 條 + 中間夾一個 placeholder」的純機械壓縮。不漂亮,但不會無聲資料流失。

---

## 三、我會新加的東西

這些是 Hermes 沒做、但我覺得該做的。

### 1. 明確的擴充機制決策樹

Day 10 鋪過——Skill、Plugin、MCP 三個聽起來都像擴充的東西。Hermes 沒給官方建議,使用者要自己琢磨。

我會在文件第一頁放一個決策樹:

> **要加新功能?**
> - 純 prompt(沒新程式碼)→ **Skill**
> - 要呼叫 Python 函式、跑本機程式 → **Plugin**
> - 要接外部服務、想被別的 agent 也能用 → **MCP**

這種決策樹是新使用者最需要、但最常被省略的東西。

### 2. 更明確的「state ownership」

Day 14 提過 Hermes 的「forwarder 模式」——`run_agent.py` 有幾百個 forwarder 方法,真正的實作在 `agent/` 模組裡,但每個被抽出的函式還是吃 `self`、還是伸手進幾十個 `AIAgent` 的屬性。「模組」邊界是裝飾性的。

我會把每塊 state 的所有權寫進架構文件——`StreamingState` 屬於誰、誰能寫;`ProviderRuntime` 屬於誰、誰能寫;`SessionPersistence` 屬於誰、誰能寫。**不是憑感覺**。寫進文件,違反就 PR review 退回。

模組化的單位是「有自己狀態的有界 context」,不是檔案,也不是函式。這條 Day 14 講過,值得再講一遍。

### 3. CJK-first 的考量

Hermes 是英文世界的產物。壓縮、token 估算、prompt 模板、錯誤偵測——全部默認英文。`'"error"' in result[:500].lower()` 這種判斷對中文錯誤訊息直接失效。

我自己刻的話,從第一天就用中文 session 當測試對象。Tokenizer 對 CJK 友善、prompt 模板有中文版、錯誤偵測不靠英文子字串。中文使用者用起來不會像在租英文人寫的東西。

---

## 四、總結:這 14 天到底教了你什麼

這 14 天,**不是教你 Hermes 怎麼用**。是讓你看見一個 production agent framework 的全貌——包含它的優雅、它的疤痕、它的歷史包袱。

看了全貌之後,你自己刻會更知道哪些是真的問題、哪些只是過早優化、哪些是傷疤、哪些是 sapphire(藍寶石——值得偷的設計)。你不再會在第一版就把終端機輸出寫死進迴圈;你會從第一天就立「system prompt 不准動」這條鐵律;你會給每個結束點一個名字;你會把護欄做成純函式。

**寫 agent 的人很多,讀 framework 的人很少**。如果你撐到了 Day 15,你已經跟大部分 agent 開發者不一樣了——你不是「會用 LangChain 拼一個 demo」,你是「看得懂一個 agent framework 為什麼長這樣、哪裡長歪了」。這個能力比任何一個框架都活得久。

---

## 接下來呢?

如果你還想繼續挖,有三條路:

1. **去看隔壁的實用指南**——`hermes-agent-research/` 是更偏「怎麼用」的方向,跟這套「怎麼長出來的」互補。
2. **去 fork hermes-agent,改一塊你不滿意的**——Day 14 砲過的那些缺陷,挑一個你最在意的,實際動手修。fork + 改 > 從零重做。
3. **自己刻一個玩具版**——只刻核心迴圈 + 一個 provider + 一個工具。重點不是做出能用的東西,是把上面那些原則親手寫一次。寫過你才會真的記住。

寫 agent 這件事還在很早期。Hermes 是其中一個答案,不是唯一的答案。你看完這 14 天,有資格參與寫下接下來的答案。

---

## 想自己翻原始碼?跨檔案總索引

這次列出整個系列每天對應的 source code 入口,當作「想跟讀 Hermes」的人的入口頁。

| Day | 主題 | 主要原始碼入口 |
|---|---|---|
| 02 | 核心迴圈 | `agent/conversation_loop.py` 的 `run_conversation()`(約 4,099 行)|
| 02 | 結束點 enum | `agent/conversation_loop.py` 找 `_turn_exit_reason` |
| 03 | Prompt cache 規則 | `agent/system_prompt_builder.py`、`agent/cache_breakpoints.py` |
| 04 | Context 壓縮 | `agent/compaction.py`、`agent/context_assembly.py` |
| 05 | Provider 抽象 | `providers/`(每個 provider 一個檔案)、`providers/base.py` 的 ABC |
| 06 | 記憶系統 | `agent/memory/`、`memory_curator.py` |
| 07 | 工具系統 | `agent/tool_executor.py`、`agent/tool_guardrails.py`、`tools/` |
| 07 | 並行工具白名單 | `agent/tool_executor.py` 找 `_PARALLEL_SAFE_TOOLS` |
| 08 | MCP adapter | `mcp_serve.py`、`mcp_adapter/` |
| 09 | Gateway | `gateway/run.py`(約 855KB,`GatewayRunner` god object)|
| 09 | ACP adapter | `acp_adapter/server.py` |
| 10 | 技能系統 | `agent/skills/`、`agent/skill_loader.py` |
| 10 | Plugin 系統 | `plugins/`、`plugin_loader.py` |
| 11 | 子代理委派 | `agent/subagent.py`、`agent/kanban/` |
| 12 | CLI / Web / Cron | `cli.py`(657KB)、`hermes_cli/main.py`、`cron/scheduler.py` |
| 12 | 狀態持久化 | `hermes_state.py` 的 `SessionDB`(約 3,200 行)|
| 13 | 測試套件 | `tests/`(看 `tests/conftest.py` 的 fake LLM 設計)|
| 14 | 巨石檔案盤點 | 跑 `find . -name "*.py" | xargs wc -l | sort -rn | head -20` |

**從哪裡開始?** 從 `agent/conversation_loop.py` 的 `run_conversation()` 進入,跟著 `restart_with_*` 旗標看分支,你就會走遍 Hermes 的核心。然後從 `cli.py` 的 `HermesCLI` 開頭找 `def run` 看 CLI adapter 怎麼接核心。最後讀 `gateway/run.py` 的 `GatewayRunner` 看 HTTP adapter 怎麼接同一個核心——你會親眼看見暗線 A「一個核心,多種驅動」是怎麼長出來的。

15 天到此為止。打開那個空白檔案吧。
