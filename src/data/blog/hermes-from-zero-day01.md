---
title: "Day 01:我為什麼想拆一個 agent framework"
description: "從 chat.completions.create 寫到一個「真正的 agent」中間到底差了什麼——我為什麼想拆一個 agent framework。"
pubDatetime: 2026-05-05T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

## 從 `chat.completions.create` 到 agent,中間隔了一個世界

想像你剛寫完一支最簡單的 chatbot,大概長這樣:

```python
resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "嗨"}],
)
print(resp.choices[0].message.content)
```

跑起來,順得不得了,有種「啊原來就這樣」的快感。然後你開始得寸進尺——想讓它幫你跑一段 Python、想讓它記得你昨天問過什麼、想讓它去抓你的行事曆。直覺上你會想:反正都是 prompt engineering 嘛,加個 system message 寫「你會用工具」、然後在外面包個 while loop 把 user input 一直塞進去就好了吧?

(這聽起來很天真,但坦白說,大部分人第一次想做 agent 的心智模型差不多就是這樣。)

只要你真的動手寫下去,很快就會生出一坨醜東西:一個 while 迴圈、一個越疊越大的 `messages` array、幾個用 regex 從模型輸出裡撈 function name 的醜八怪。然後你會發現模型有時候會亂叫一個你根本沒定義的工具,有時候上下文塞到 token 上限直接 400。第一反應大概會是「那我把舊訊息砍掉就好了嘛」——結果砍完它失憶,連自己上一步呼叫了什麼工具都忘記,直接陷入「我剛剛是不是叫過這個?那我再叫一次好了」的死循環。

更慘的是換個 provider 試試看。從 OpenAI 換到 Claude,幾乎所有東西要重寫:message format 不一樣(`system` 是獨立欄位不是 message)、function calling 的 schema 結構不一樣、tool result 要 nest 在 user message 的 content block 裡而不是 `tool` role、連 streaming 的 SSE event 名稱都不一樣。光是為了讓「同一段話」能在兩家模型上都跑起來,就是一道工程關卡——還沒做任何「真的功能」。

我覺得 chat completion 跟 agent 之間,差的就是這一整層你以為很簡單、實際上有一整本書那麼厚的東西。**chat completion 不是 agent**;從 chatbot 到 agent,看似只差一個 while loop,實際上隔了一個世界。

於是我去拆了 `NousResearch/hermes-agent`——一個 production 級的開源 agent framework——我想搞清楚一個「真的能用」的 agent 到底有什麼。

接下來這 15 天,我會一塊一塊講給你聽。

---

## Agent 跟 chatbot 差在哪?

先停一下,把這個問題講清楚,後面 14 天的內容才有錨點。

一個 chatbot 的生命週期長這樣:你問 → 它答 → 結束。一個 agent 的生命週期長這樣:你給目標 → 它思考 → 它動手 → 它觀察結果 → 它再思考 → ……直到目標達成或它放棄。

聽起來只多了一個迴圈?但這個迴圈會把你拖進五個你原本不用煩惱的問題:

1. Loop 本身——什麼時候停?模型自己說「我做完了」就信嗎?還是要設一個迭代上限?如果它無限呼叫同一個工具呢?(Hermes 的答案叫 `IterationBudget`,父 agent 預設 90 圈,子代理 50 圈,我們 Day 02 會講。)
2. Tool use——模型說「我要呼叫 `read_file`」,你怎麼安全地真的去執行?執行完的結果怎麼塞回對話?它叫了一個不存在的工具怎麼辦?
3. Memory——這個 session 結束,下一個 session 開始,它怎麼記得「你」是誰?
4. Context management——對話越長 token 越多,context window 一定會撐爆,壓縮要怎麼壓才不會把任務狀態壓沒了?
5. Multi-provider——你今天用 OpenAI,明天想換 Claude,後天想用 Gemini,你的程式碼能不能不重寫?

每一項都不是「加一段 if-else 就好」,每一項都需要一套設計。Hermes 把這五件事都正面解過一遍,有些解得漂亮,有些解得很歪——好的壞的我都會講。

> **Note**:你可能聽過 ReAct(Reasoning + Acting)這個學界名詞,本質就是上面講的第 1 條:讓模型在「想」跟「做」之間交替。論文在這:<https://arxiv.org/abs/2210.03629>。Hermes 的核心迴圈是 ReAct 的工業版——多了重試、護欄、串流、子代理隔離、跨 provider 翻譯,以及一堆「論文沒寫但真的跑起來才會遇到」的細節。

換個角度看:chatbot 是一個 request/response 函式,你給它什麼就給你什麼;agent 是一個有狀態、會自己再呼叫自己、會跟外面世界打交道的小程式。當你開始把它當「程式」而不是「對話」來看,前面那五個問題就會自然冒出來——因為它們本來就是寫程式都會遇到的問題,只是這個程式的某幾步是 LLM 在決定。

---

### 為什麼是 Hermes 不是別的 framework?

我自己手上就有一個 personal AI assistant 在做——**OpenClaw**,Node + TypeScript 路線,目標是「你已經在用的訊息平台都能用同一個助理」:WhatsApp、Telegram、Slack、Discord、Google Chat、iMessage 都接,OAuth 主要綁 Anthropic Pro/Max + OpenAI ChatGPT/Codex。Gateway 是 control plane,product 是 assistant 本身。

所以這系列**不是「找一個 framework 來用」**,是「看一個跟我目標相近、但完全不同技術路線的人怎麼解問題」。Hermes 是 Python,我是 Node;Hermes 主推 framework + plugin 生態,我主推 personal assistant + channel coverage。語言、敘事路線都不同,但設計層面可以互學。

三個我特別想偷的:

1. **多 provider 三層抽象做得徹底**——Hermes 有 6 個 explicit adapter(`agent/*_adapter.py`:Anthropic、Bedrock、Azure Identity、Codex Responses、Gemini Cloud Code、Gemini Native),再用 `credential_pool.py`(1,955 行)管同家內多 key rotation、用 `agent/transports/` 處理 streaming / proxy / 重連。對外失敗時走 OpenRouter → Nous Portal → Custom endpoint(本機 llama.cpp / vLLM 走這條)→ Native Anthropic 五段橫向 fallback。OpenClaw 走 OAuth Pro/Max + API key fallback,沒這麼多層,這套抽象細節值得抄。
2. **prompt cache 當鐵律設計**——OpenClaw 我有做 cache 友善但沒做到「把 system prompt 鎖到禁止中途變動」的紀律。Hermes 把它變成整個 API 形狀(`stable / context / volatile` 三層、DATE-only 時間戳、deterministic tool_call_id fallback、JSON sort_keys)。Day 03 會看到細節。
3. **觀測性紀律**——每個結束點都有名字(`_turn_exit_reason`)、防說謊頁尾、純函式 guardrail controller。這些不依賴語言,任何 framework 都能照搬。

反過來 OpenClaw 比 Hermes 強的地方(channel coverage、wizard onboarding、OAuth 工程化)是 OpenClaw 自己 docs 的事,這系列只講從 Hermes 偷得到、跨語言通用的設計層。

---

## 這 15 天會有三條暗線

我寫這個系列的時候,腦中一直有三條主線在跑。你讀的時候如果能感受到這三條線在不同篇章重複浮出來,那就抓到精髓了。

**第一條:「一個核心,多種驅動」。** Hermes 最重要的設計決定,就是把 `AIAgent` 寫成一個跟「誰來呼叫它」完全無關的核心。CLI 是一個 adapter、gateway 是一個 adapter、MCP server 是一個 adapter(MCP = Model Context Protocol,Anthropic 推的「讓外部工具能被任何 agent 接上」的標準協定,Day 08 細講)、ACP 是一個 adapter(Hermes 接的是 Zed Industries 的 Agent **Client** Protocol,讓編輯器這類 client 能驅動 agent——這縮寫地雷比較多,Day 08 拆給你看)、batch runner 是一個 adapter、cron 是一個 adapter——同一顆心臟,六種身體。Day 02 我會第一次埋下種子,Day 05 你會在 provider 抽象看到它,Day 08(MCP)、Day 09(gateway)、Day 12(三套介面)會一次比一次明顯。

**第二條:「prompt cache 是鐵律,不是優化」。** 這個你可能完全沒想過。Anthropic 跟 OpenAI 都提供 prompt caching——你重複送一樣的開頭可以打折——但 Hermes 把這件事從「省錢小技巧」升級成「整個 API 設計的不變式」:**system prompt 在 session 中途絕對不准變**。為什麼?因為一變,快取就失效,成本直接拉高,延遲也飆上去。(Anthropic 的 cache breakpoint 上限是 4 個——你只有 4 個機會說「這之前的東西請幫我快取」,所以怎麼擺、擺在哪,直接決定整個 session 的成本曲線。)這條鐵律塑造了一堆你乍看不直覺的設計選擇:壓縮為什麼是唯一被允許的中途變動?slash command 為什麼塞 user message 而不是改系統提示?記憶為什麼不能直接 append 到 system prompt?Day 03 主角登場,然後 Day 04、Day 06、Day 10 會反覆呼應。

比喻一下:prompt cache 像便利商店的熟客折扣,你每次拿一樣的會員卡才有折,中途把卡換掉就重新算原價。Hermes 整套設計就是「不准你中途換卡」。

**第三條:「抽取程式碼 ≠ 分解系統」。** 這條是我從 Hermes 學到最深的一課,而且是從它「沒做好」的地方學的。前面提的那些巨石檔案——`cli.py` 那個 11,600 行的 `HermesCLI` class、`run_agent.py` 那個 64 kwargs 的 `AIAgent` 建構子、`hermes_state.py` 那個 ~3,200 行的單檔(`SessionDB` class 從 line 309 開始)——團隊明明知道要模組化,所以把 method 搬進 `agent/` 底下的 80 多個 submodule。但每個搬出去的 function 都還要靠 `self` 拿回 `AIAgent` 上幾十個屬性。搬移程式碼做了,定義介面 + 切割狀態所有權沒做。Day 07 偷偷鋪墊,Day 12 提一下,Day 14 我會正面開砲。

如果你之後想自己刻一個 agent framework,這三條線——一個成功(主線 A)、一個鐵律(主線 B)、一個前車之鑑(主線 C)——是我覺得最值得帶走的三樣東西。

---

## 接下來會發生什麼

我不想直接貼一個 15 列的清單,那很突兀。所以讓我用故事的方式講一遍。

明天(Day 02)我會帶你看 agent 的「最小心臟」——那個 while 迴圈長什麼樣子、什麼時候停、為什麼 Hermes 用一個叫 `IterationBudget` 的東西當煞車。看完那篇你會覺得「啊,原來 agent loop 就這樣」。

然後 Day 03 我們進 prompt caching 的鐵律,Day 04 講 context 撐爆怎麼壓——這兩篇是 context 工程的核心,看完你會理解為什麼「對話開太久變慢」這件事其實是 agent 工程的頭號難題。

接下來幾天會橫向擴張:Day 05 講 provider 抽象(怎麼一份程式碼接 OpenAI 又接 Claude),Day 06 講 agent 怎麼真的「記住」你(Hermes 有一套會主動 nudge 自己存知識的記憶系統,我覺得是它的招牌),Day 07 講工具系統怎麼安全執行,Day 08 講 MCP 是什麼為什麼大家在喊。

中段(Day 09–11)會打開 Hermes 的「外殼」:gateway 怎麼讓一個 agent 同時接 Telegram/Discord/Slack、技能跟外掛跟 MCP 的差別在哪、多個 agent 怎麼用 Kanban 協作不打架。

後段(Day 12–14)是收成:三套介面共享一顆腦袋的取捨、會講話的東西怎麼測試、Hermes 哪裡長歪了。最後 Day 15 是我自己的反思——如果今天要從零刻一個 agent framework,我會怎麼做、哪些坑會刻意繞開。

每一篇我都會在文末留一個「想自己翻原始碼?」區,把那一篇對應的關鍵檔案跟函式直接列出來,你想跟讀 source 隨時可以。

---

## 小結

Chat completion 是「我問一句它答一句」,agent 是「我給一個目標它跑一個閉環」。中間差了 loop、tool use、memory、context、provider 抽象這五道牆——你自己刻會撞,Hermes 已經幫你撞過了,有的撞得漂亮,有的撞得很痛。接下來 15 天,我帶你逐道牆拆。

但講完這些,你心裡應該會冒出一個更基本的問題:**一個 agent 最小到底是什麼樣子?** 那個 while 迴圈裡到底要寫什麼,才算「夠」?明天我們來看 Hermes 的「核心心臟」——那顆藏在 `agent/conversation_loop.py` 裡、約 3,900 行的單一函式。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `https://github.com/NousResearch/hermes-agent` | repo 入口 |
| `AGENTS.md` | 專案自己給 agent contributor 看的指南,讀懂 repo 結構最快的方式 |
| `README.md` | 官方的功能宣傳,有 quick install 跟主要 feature 列表 |
| `run_agent.py` | `AIAgent` orchestrator 本體,約 179KB,64 kwargs 的建構子在這 |
| `agent/agent_init.py` | `AIAgent.__init__` 真正把 64 個 kwargs 攤開組裝起來的地方 |
| `agent/conversation_loop.py` | 核心 while 迴圈,`run_conversation()` 進去看 |

從 `run_agent.py` 的 `AIAgent` 進去,跟著 `run_conversation()` 一路追下去就會走到 Day 02 的主菜。
