---
title: "Day 05:同一段程式碼,怎麼同時接 OpenAI 和 Claude"
description: "Adapter、registry、credential pool——Hermes 怎麼忍受 LLM 圈每家不同的脾氣。"
pubDatetime: 2026-05-09T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

`wc -l agent/credential_pool.py` 跑下去,1,955 行。再看 `agent/anthropic_adapter.py`,2,220 行。`agent/auxiliary_client.py`,5,286 行。

光是「**接多家 LLM provider**」這件事,Hermes 在三個檔案就燒了 9,461 行。我盯著這幾個數字想了一下——這代表什麼?

代表 provider 抽象不是「換 SDK」這麼簡單。Anthropic 對 thinking 區塊要簽章、Gemini 的 schema 跟 OpenAI 不相容、Bedrock 走 AWS SigV4(AWS 自家那套用 HMAC 簽 HTTP 請求的認證機制,每個 request 都要在 client 側簽一次,不是丟個 bearer token 就好)、Azure 需要 identity refresh、本機 llama.cpp(把 LLaMA 系列模型編譯成 C++ 直接在本機 CPU/GPU 跑的開源 runtime)的 grammar pattern 又是另一套。每一條都是真實的相容性債——要嘛花幾千行 normalize 起來,要嘛讓使用者每換一家就重寫 agent。

Hermes 選了前者。今天這篇拆 adapter / registry / credential pool / transports 這四層抽象——它們之所以厚,是因為下面那個世界本來就是亂的。

先看 tool call。OpenAI 給你的是 `choices[0].message.tool_calls`,每個工具呼叫是個 `function` 物件,裡面有 `name` 跟 `arguments`(字串型 JSON,順帶一提)。Anthropic 給你的是 `content` 陣列裡夾雜的 `tool_use` 區塊,`input` 直接就是 dict。要把兩家的回應壓進同一個資料結構,你就準備寫一堆 `if provider == "anthropic"`。

接下來是 thinking 區塊。Claude 的 extended thinking 回傳的 thinking 區塊**要簽章**——下一輪你必須把那段簽章原封不動再丟回去,不然 API 直接 400。文件不會在你想找的地方告訴你,通常是第二輪請求炸了你才回頭追。

然後 Gemini。Gemini 的 function calling schema **不吃** `additionalProperties`,不吃 `$schema`,某些 integer 欄位上的 `enum` 也會被拒。你以為的 JSON Schema,在 Gemini 眼裡只是 OpenAPI 的一個子集。圖片?各家 base64 規範不同。認證?Anthropic 走 API key,Codex 走 OAuth(讓使用者授權之後拿一組會過期、可刷新的 token,不是長期金鑰),Bedrock 走 AWS IAM,Azure 走 Entra ID 換 JWT(微軟那套企業身份系統,登入後拿到一張短效的 JSON Web Token 才能呼叫 API)。Rate limit 回的錯誤碼一家一個樣,有的給 429,有的給 402,有的乾脆給你一段 free text 要你自己 parse。

把這堆東西全部攤開,你會發現「換 SDK」根本只是入口。看到 hermes-agent 怎麼處理這件事的時候,我才覺得「原來這件事被認真做的話長這樣」。

---

昨天我們講 context 怎麼壓——那是「同一個對話塞不下」這個維度的問題。今天主題換到另一個維度:**同一個 agent 怎麼接不同家的 LLM,而不是把核心迴圈寫成 N 份**。

## 一、adapter pattern 的真實樣貌

Hermes 的 `agent/` 目錄下,你會看到一排 `*_adapter.py`:

```
agent/anthropic_adapter.py        2,220 行
agent/bedrock_adapter.py
agent/codex_responses_adapter.py
agent/gemini_cloudcode_adapter.py
agent/gemini_native_adapter.py
agent/azure_identity_adapter.py
```

一個 provider 一個 adapter。光 `anthropic_adapter.py` 就 2,220 行——你大概可以想像「換個 SDK 而已嘛」這句話有多天真。

那這些 adapter 在幹嘛?說穿了就兩件事:

**第一件:規格轉換。** 核心迴圈(`run_agent.py`)是針對 OpenAI Chat Completions 的形狀寫的——`messages[]`、`tools[]`、`choices[0].message.tool_calls`。所有 provider 都得把自己原生的形狀翻譯成這個。Anthropic 的 `content` block 陣列要被攤平成 OpenAI 的 `tool_calls` 結構;Bedrock Converse 的 `toolUse` / `toolResult` 要對齊;Gemini 的 `functionCall` 要塞進來。每個 adapter 大概都有一對 `convert_messages_to_X` / `normalize_X_response` 的函式,進去是「Hermes 內部的通用格式」,出來是「那家 API 真正吃得下的東西」,或反過來。

**第二件:錯誤翻譯。** 這個常被低估。Anthropic 的 rate limit 是一種格式,OpenAI 是另一種,Gemini 又不一樣,llama.cpp 連 HTTP status 都可能對不上。Hermes 內部用一組 `FailoverReason`(枚舉)當共通語言——`rate_limit`、`billing`、`auth`、`context_overflow`……不管哪家 provider 出包,adapter 都得把它正規化成這幾個值之一,核心迴圈才有辦法統一決策。

> **Note**:adapter pattern 學術定義是「把一個介面包裝成另一個介面」,但實務上 80% 的工作量根本不在「轉換」,而在「翻譯這家 provider 的脾氣」——它什麼時候鬧、鬧的時候訊息長什麼樣、復原條件是什麼。這才是 adapter 的全部工作量。

Hermes 還有更極端的:`copilot_acp_client.py`(GitHub Copilot 的 Agent Client Protocol)整個是 JSON-RPC over stdio 子程序協定,根本沒有結構化的工具呼叫通道,Hermes 硬是從自由文字裡用正則把 `<tool_call>{...}</tool_call>` 剝出來,假裝它是個 ChatCompletion。**核心迴圈完全分不出它不是在跟 OpenAI 講話。** 這就是 duck typing(動態語言裡的「會嘎嘎叫的就是鴨子」——只看物件實際提供的方法,不看它的型別宣告)的暴力美學——只要長得像 ChatCompletion,我就把你當 ChatCompletion 用。

## 二、registry — 一個核心,多種驅動

寫完 adapter 還沒完。adapter 寫好要怎麼被選用?

Hermes 用 registry 模式(中央註冊表的設計手法:模組啟動時自我登記名字 → 實作,使用者用名字查、不直接 import 實作)。adapter 在程式啟動時把自己註冊到一張表上,核心迴圈不知道「現在到底是誰在跑」,只知道「我要 provider 是 `anthropic` 的那個 client,給我」。

**這就是這個系列三條暗線的第一條——「一個核心,多種驅動」——第一次明顯登場。**

Day 2 我講核心迴圈的時候埋了個種子:`AIAgent` 是 protocol-agnostic 的,它不關心訊息怎麼來、怎麼出去。今天你看到的是這條設計選擇的第一個直接收益:**核心迴圈一行 provider-specific 的程式碼都沒寫**,你卻有 7、8 家 provider 能切。

要把這件事內化的話,記住這個畫面:核心迴圈在跑 ReAct loop(Reason + Act 的縮寫,經典 agent 迴圈架構:模型先推理 → 呼叫工具 → 把結果讀進 context → 再推理,直到任務結束),它從 registry 拿到一個「看起來像 OpenAI client」的東西,呼叫 `.chat.completions.create(...)`,拿到一個「看起來像 ChatCompletion」的物件。它**真的不在乎**底下是 Anthropic 的 Messages API、是 Bedrock 的 Converse、還是一個 JSON-RPC 子程序。對齊規格是 adapter 的事,跑邏輯是核心的事。

這個分工 Day 8 你會在 MCP(Anthropic 的 Model Context Protocol)看到一模一樣的——MCP 也是一個「不知道是誰在執行」的核心,加上一堆 adapter。Day 9 在 gateway 又一次——同一個 agent 接 Slack、接 Discord、接 cron,核心依然不知道。**「一個核心、多種驅動」這條線,從今天開始你會反覆看到。** 看到第三次的時候你會自己會心一笑。

> 比喻:adapter + registry 像國際機場的轉接頭區。核心迴圈是你那台只有 type-C 插頭的筆電,registry 是櫃台上一排轉接頭(英規、美規、歐規、日規),你只要告訴櫃台「我要日規」,接上去就用。筆電不需要重新出廠。

## 三、credential pool — 用分散式系統的思路管一個檔案

選好 provider 之後,你還有一個問題:**憑證**。

實務上一個 heavy user 不會只有一把 Anthropic key。可能 5 把(個人 + Pro + 公司 + side project + 朋友送的)。或是 2 個 Codex OAuth 帳號交替用。為什麼?因為**一把 key 被 rate limit 的時候,你不希望整個 agent 在那邊乾等**。另一把可以接手。

Hermes 把這件事抽出來叫 `credential_pool.py`,1,955 行。你乍看會覺得「不就是個 key 的 list 嗎,幹嘛這麼複雜?」——直到你開始想下面這些問題:

- 一把 key 被限流了,什麼時候該重試?5 分鐘?1 小時?
- 重試的等待時間,**該不該根據錯誤類型不同?**(spoiler:該)
- CLI 跑、gateway 也在跑、cron 也排了一個,**它們共用同一份 `auth.json` 嗎?**
- OAuth 的 refresh token 是**單次性的**(每次刷新就輪換掉),兩個程序同時刷新,誰贏?

Hermes 的答案:

- 每把憑證一個 `PooledCredential` dataclass,記錄 `last_status`、`last_error_code`、`last_error_reset_at`、`request_count`。
- **冷卻時間依錯誤原因決定**:`credential_pool.py` 只 case 401(認證打嗝)→ 5 分鐘、case 429(rate limit)→ 1 小時、其餘(含 402 billing)→ `EXHAUSTED_TTL_DEFAULT_SECONDS` 1 小時(跟 429 結果相同,但走的是 default 分支不是專屬分支)。如果 provider 自己回了一個 `reset_at`,那個值優先。**這個細節多數重試系統會漏掉**——把 401 跟 429 用同一條退避策略,你就會在認證短暫抽風的時候被罰坐一小時冷板凳。
- **選擇策略**可設定:`fill_first`(打到死再換)、`round_robin`(輪流)、`random`、`least_used`。
- **soft lease**:`acquire_lease` / `release_lease` 讓並行的子代理(Day 11 會講)自動分散到不同憑證上,而不是全部擠同一把。

最有意思的是 OAuth 那段。OAuth refresh token 是單次性的——你用一次,server 給你一個新的,舊的作廢。問題來了:CLI 跟 gateway 同時在跑,兩邊都在記憶體裡握著「上一次讀到的 refresh token」。CLI 先刷新,把 token 輪換成新的寫進 `auth.json`;這時候 gateway 拿著它記憶體裡那個**舊的**去刷新——直接死掉。

Hermes 的處理方式我看到的當下覺得很漂亮:刷新之前,**先重讀 `auth.json`**(可能別的程序已經寫了更新的 token 進去),採納那個比較新的;刷新完寫回檔案,但是**標記 `set_active=False`**——token 輪換不該翻動使用者「現在選的 provider」這件事;遇到終局性的失敗(token 死透了)就**隔離**,把它從 `auth.json` 清掉,免得下個 session 又把屍體載回來。

這完全是分散式系統的思路:**讀-改-寫、衝突採納、失敗隔離**。只是這個「分散式系統」是同一台機器上跑著的幾個程序、共用一個檔案。

## 四、transports 層 — 更下面那一層

往下還有一層,叫 `agent/transports/`。你 `ls` 一下會看到:

```
anthropic.py    bedrock.py    chat_completions.py
codex.py        codex_app_server.py    codex_event_projector.py
codex_app_server_session.py    hermes_tools_mcp_server.py
base.py    types.py
```

這是 v0.11 才抽出來的更乾淨的下一代抽象。`ProviderTransport`(在 `base.py`)是個 ABC,它**只**管「資料路徑」——`convert_messages` / `convert_tools` / `build_kwargs` / `normalize_response` 這幾個東西。它**明確不管** client 建構、串流、憑證刷新、prompt caching、重試。

那些被刻意排除的東西去哪了?留在 `AIAgent` 上。為什麼這樣切?因為**串流、重試、cache 這些跨 provider 通用的事,讓 adapter 各自重寫一遍是浪費**。你要的是讓 adapter 只專注在「我這家 API 的訊息長什麼樣」,而不是又要去處理斷線重連這種跟商業邏輯無關的雞毛蒜皮。

`types.py` 裡的 `NormalizedResponse` 跟 `ToolCall` 是這層最強的部分。它只把「**真正跨 provider 的欄位**」攤平——`content`、`tool_calls`、`finish_reason`、`usage`。其他 provider-specific 的狀態被丟進一個叫 `provider_data` 的 dict。Codex 有它的 `call_id`,Gemini 有它的 `thought_signature`(**這個你下一輪必須原封不動丟回去,不然 API 回 400**——對,就是開頭提到的那個坑),這些都塞 `provider_data` 裡,不污染共通介面。

## 五、那些「翻譯這家脾氣」的雞毛蒜皮

我想用一段篇幅特別講這個,因為這才是 adapter 的全部工作量。

**Anthropic 的 thinking 簽章。** Claude 開了 extended thinking 之後,回傳的 thinking block 帶簽章。下一輪你**必須**把簽章重播回去,不然會收到 `thinking_signature` error。Hermes 看到這種錯誤的時候會去 strip 掉一個叫 `reasoning_details` 的東西重試——這是個寫死的特例,不是泛型解法,因為你只能對著 Anthropic 的行為寫。

**Gemini 的 schema 方言。** `gemini_schema.py` 是個遞迴 schema 改寫器,99 行,用 allowlist(22 個 key)+ 一條 enum-vs-integer 例外規則處理 Gemini schema 方言。它做的事大概像這樣:遍歷工具的 JSON Schema,allowlist 一組 Gemini 真的吃得下的 key,把 `$schema`、`additionalProperties` 砍掉,在 integer 欄位上的 `enum` 也得刪。

**llama.cpp 的 grammar pattern。** 它的 grammar 約束格式跟其他家不相容,有個 `should_fallback` 判斷會在偵測到某些情境時走特殊路徑——本地推論的世界,規範常常是 LLM runtime 自己定的,跟 cloud API 不是同一套生態。

寫完這節我想表達的是:**這些細節才是 adapter 的全部工作量**。名詞上是 adapter pattern,實際上是一堆「翻譯這家的脾氣」的特例處理。如果你以為照書上把 adapter pattern 套上去就能解決,你大概會在每家 provider 的脾氣裡反覆繞圈。

## 六、failover — 橫向切換,不是縱向重試

最後一塊是 failover 路徑,我想特別點出來,因為這跟一般人寫重試的直覺不一樣。

一般 SDK 給你的退避重試,是**縱向的**:同一個 endpoint、同一把 key,等久一點再試一次。Hermes 的 provider 切換是**橫向的**:同一個 request,**換一家 provider 跑**。

什麼時候橫切?`FailoverReason` 是 `rate_limit` 或 `billing` 的時候——你這把 key 在這家被限流,等不會更快;**換家機率還比較高**。auxiliary client(`auxiliary_client.py`,5,286 行,是這個子系統最大的檔案)專門做副任務(context 壓縮、網頁摘要、視覺分析等等,Day 4 你看到的那些),它有條 `_get_provider_chain()` 後備鏈:主 provider → OpenRouter → Nous Portal → Custom endpoint → Native Anthropic → 直連 API key providers(z.ai/GLM、Kimi/Moonshot、MiniMax 等)。遇到 HTTP 402(額度耗盡),沿著鏈往下推。

這跟「同一家裡換另一把 key」(credential pool 的工作)是兩層不同的失敗處理:

| 層級 | 觸發 | 動作 |
|---|---|---|
| credential pool | 單把 key 限流 | 同 provider 內換 key |
| failover chain | 整家 provider 沒救 | 跨 provider 切換 |

合起來才是完整的「**讓 agent 不要因為單點問題卡死**」的故事。

> 順帶一提一個有意思的判斷:Codex OAuth **被故意排除在自動 failover 鏈外**。原因是 OpenAI 用一個「會變動的模型白名單」擋著它,Hermes 寫死的後備路徑會自己爛掉——所以乾脆不自動選用。這種「承認不是每個 provider 都適合自動 fallback」的成熟度,我覺得很值得偷學。

## 小結

寫到這你應該能看出 Hermes 的策略:**核心迴圈一個,adapter 一排,credential pool + transports 撐底層**。OpenAI 跟 Claude 共存的代價,不在核心,而在 adapter 的 2,220 行 + credential pool 的 1,955 行 + auxiliary client 的 5,286 行。

這也是我想留給你的一句話:**provider 抽象不是「把 SDK 換掉」,是「把每家 API 的脾氣全部承擔下來,讓核心迴圈相信全世界都是 OpenAI 形狀」。** 願意吃下這個代價,你就能換一行設定切 model;不願意吃,你就會在每次新增 provider 的時候,從頭再被同一批坑教訓一次。

---

今天你看到「一個核心、多種驅動」第一次明顯登場——核心迴圈完全不知道誰在跑,adapter 負責對齊規格。但你應該還沒問一個更殘酷的問題:agent 怎麼「記住」昨天聊過什麼?LLM 本身是失憶的——每次 API 呼叫都是一張白紙。明天我們拆 Hermes 怎麼處理記憶,以及為什麼記憶**不能**塞到 system prompt 裡(這條線會接回 Day 3 的 prompt cache 鐵律)。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `agent/anthropic_adapter.py` | Claude 的訊息轉換、thinking 簽章處理、錯誤翻譯(2,220 行) |
| `agent/bedrock_adapter.py` | Bedrock Converse 規格轉換 |
| `agent/gemini_native_adapter.py` | Gemini 原生 API,搭配 `gemini_schema.py` 的 schema 方言修復 |
| `agent/codex_responses_adapter.py` | OpenAI Responses API(Codex) |
| `agent/copilot_acp_client.py` | 把 JSON-RPC over stdio 偽裝成 ChatCompletion 的極端示範 |
| `agent/credential_pool.py` | 多憑證池、OAuth refresh token 跨程序協調(1,955 行) |
| `agent/credential_sources.py` | Strategy pattern 的乾淨範本(對照組) |
| `agent/auxiliary_client.py` | 副任務用的便宜模型路由 + failover 鏈(5,286 行) |
| `agent/transports/` | v0.11 抽出來的下一代 transport 抽象,`types.py` 是精華 |
| `agent/gemini_schema.py` | Gemini schema 方言的遞迴修復器 |
| `agent/nous_rate_guard.py` | 跨 session 限流斷路器 |

從 `agent/anthropic_adapter.py` 進去,先看 `convert_messages_to_anthropic` 怎麼把訊息翻譯成 Anthropic 形狀;normalize 的對應方向則住在 `agent/transports/anthropic.py` 的 `normalize_response`。再去 `credential_pool.py` 看 `PooledCredential` 跟 `_exhausted_ttl()`(401 vs 429 不同冷卻);最後去 `agent/transports/types.py` 看 `NormalizedResponse` 跟 `ToolCall`——那是這個子系統設計最乾淨的部分。
