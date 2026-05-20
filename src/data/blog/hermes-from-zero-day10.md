---
title: "Day 10:技能、外掛、MCP — 三個聽起來都像擴充的東西到底差在哪"
description: "Skill、Plugin、MCP——三個聽起來都像擴充的東西,到底差在哪、什麼時候用哪個。"
pubDatetime: 2026-05-14T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

打開 `plugins/spotify/__init__.py`,docstring 第二段寫了這樣的東西:

```
Why a plugin instead of a top-level ``tools/`` file?

- ``plugins/`` is where third-party service integrations live...
- ``tools/`` is reserved for foundational capabilities (terminal,
  read_file, web_search, etc.).
- Mirroring the image_gen plugin layout makes new service
  integrations a pattern contributors can copy.
```

**Spotify 整合的 docstring,花了一整段在解釋「我為什麼是 plugin 不是 `tools/` 檔案」**。一個內建檔案要寫一整段話來辯護自己存在的位置——當這種情況發生,代表 **classification 本身在漏水**。

Hermes 加東西進來的方式有三套:Skill、Plugin、MCP server。Anthropic 自己也有 Skill(2025/10/16 釋出)。但這三套職責有重疊,連 Hermes 自己內部都會在某個邊界上猶豫。今天這篇拆三套機制各自是什麼、什麼時候用哪個、以及為什麼 `plugins/spotify` 會自我辯護。

---

昨天看完 gateway 怎麼把 agent 接到 Slack、Discord、那些 cron job 跟自己寫的服務——那是「外面世界怎麼進來」。今天的問題剛好反過來:**你**(寫程式的你)要怎麼加東西進這個 agent?

那就拆開講。

## 一、三套機制各自是什麼

先給結論,再展開。Hermes 加東西有三條路:

1. **Skill(技能)**:給「模型」看的一包文字 + 腳本。
2. **Plugin(外掛)**:給「host(也就是 Hermes 主程序)」看的一段 Python。
3. **MCP server**:Day 8 講過的,**一個獨立的外部進程**。

它們做的事不一樣的點在「**誰載入它、何時載入、跑在哪個程序裡**」。命名沒有把這件事傳達出來,所以你會混亂。

### Skill 是「一個資料夾,一個 Markdown 檔」

這裡要先把兩件事分清楚——**Anthropic 官方的 Skill 規格**,跟 **Hermes 自己怎麼實作 Skill** 是兩回事。先講 Anthropic 官方。

Agent Skills 在 **2025 年 10 月 16 日** 由 Anthropic 釋出,官方規格的目錄結構非常單純:

```
<skill-name>/
  SKILL.md          ← 進入點,YAML frontmatter + 散文 body
  scripts/          ← 可以執行的 Python / shell(可選)
  REFERENCE.md, FORMS.md, ...  ← 補充文件(可選,檔名沒規定)
```

**官方規格沒有「分類」層**。`references/`、`templates/` 都是社群慣例,不是官方規格。

純文字、沒有編譯步驟、沒有 plugin API、沒有 DSL。可 diff、可 review、可 grep。**人跟 agent 用同一套 `Edit` / `Write` 工具就能編輯它**——這是 Anthropic 在 Agent Skills 公告與工程部落格反覆強調的洞見:「With bash and filesystem tools, agents can perform actions just as humans would.」

**接下來講 Hermes 怎麼接這套規格**。

Hermes 在官方規格上加了**一層自己的分類目錄**(`skills/<分類>/<名稱>/SKILL.md`)——你可以從 `agent/prompt_builder.py` 裡的 `skills_by_category` / `category_descriptions` 看到。這是 Hermes 自己的設計,不在 Anthropic 規格裡。

Hermes 的驗證器(`tools/skill_manager_tool.py::_validate_frontmatter`)強制 4–5 條硬規則:檔案開頭必須是 `---`、結尾要有對應的 `---`、`name` 必填、`description` 必填且 ≤1024 字元;另外 `_validate_content_size` 限制整個檔案 ≤100,000 字元。**這是 Hermes 自己加的保護網**,Anthropic 官方並沒有這個硬上限,官方建議是「body 控制在 5k tokens / 500 行以內,超出就拆到補充 `.md`」。其他像 `version`、`author`、`license` 都是慣例,**不強制**。

Hermes 的程式碼進入點在 `agent/skill_bundles.py`、`agent/skill_commands.py`、`agent/skill_preprocessing.py`、`agent/skill_utils.py` 這四個檔。`skill_bundles.py` 處理「技能包」——一個 YAML 就能把多個技能組成一個 `/<bundle-name>` 指令,一次載入多個 SKILL.md。技能包也是 Hermes 自己的擴充,不是 Anthropic 規格的一部分。

### Plugin 是 host 端的 Python 擴充點

Plugin 不一樣。Plugin 是**真正的 Python 程式碼**,在 Hermes 啟動時就接進主程序裡。

Hermes 的 plugin 有**兩種 manifest 格式並存**(對,光是 plugin 內部就有兩種):

- **`plugin.yaml`** ── 後端 / 執行期 plugin(repo 裡約 62 個)。關鍵欄位是 `kind`,把 plugin 路由到一個擴充點:
  - `kind: platform` ── gateway 的聊天 adapter(Slack、Discord、IRC 那種)
  - `kind: backend` ── 工具 / provider 後端,自動載入
  - `kind: model-provider` ── 改寫 wire 格式接新模型
  - 沒 kind 但有 `hooks` ── 生命週期 hook plugin(例如「LLM call 前後攔截」「session 開始時注入」「post_tool_call」)
- **`manifest.json`** ── 儀表板分頁 plugin。是一個全端的微前端契約:`entry` / `css`(預先建好的 JS bundle 注入成一個分頁)、`api`(一個匯出 FastAPI `APIRouter` 的 Python 檔)、`tab.position: "after:skills"`(相對錨點的版面)。

Plugin 的入口 API 長這樣:每個 backend plugin 暴露一個 `register(ctx)` 函式——`ctx` 是 host 提供的能力 registry,plugin 從不 import host 內部去改它,只接收 context 然後呼叫 `ctx.register_web_search_provider(...)`、`ctx.register_tool(...)` 之類的方法。這是 registrar 模式 / 依賴注入。跟 VS Code extension 的 `contributes` 區塊是同一個 idea。

`agent/plugin_llm.py` 是個有趣的細節——它是給 plugin 用的「host 託管 LLM 通道」。Plugin 想自己叫 LLM 不需要重新處理 provider、auth、token,直接拿 `ctx.llm.complete(...)` 就好。**Plugin 看不到原始的 OAuth token 或 API key**,host 拿著鑰匙。

### MCP server 是外部進程

Day 8 拆過了。MCP server 跑在**另一個進程**裡,Hermes 透過 stdio(standard input/output,父程序跟子程序用標準輸入輸出對接,訊息一行一個 JSON)或 SSE(server-sent events,長連線串流推送)跟它講話,用的是 Anthropic 推的標準協定。最大的特點:**程序隔離**。你的 Heptabase MCP server 跑爆了,Hermes 不會跟著倒。

> **Note**:Hermes 其實不只有這三套。內部還有一個叫 `context_engine` 的第四套 plugin 系統,原始碼自己明說「跟一般 plugin 系統分開……一次只能有一個 active」。今天先不展開,你只要知道「**重疊的擴充機制比你想像中還多**」。

---

## 二、攤開來看 — 一張比較表

文字看完還是有點霧。我把它畫成表:

| | Skill | Plugin | MCP server |
|---|---|---|---|
| **形式** | 一個資料夾 + SKILL.md(Markdown) | Python 程式碼 + manifest | 獨立外部進程 |
| **註冊方式** | filesystem 掃描(`skills/` 目錄) | `plugin.yaml` 的 `kind` 或 `hooks` 欄位 | `config.yaml` 指向 server 進程 |
| **觸發時機** | slash 指令 / 漸進揭露動態載入 | host 啟動時接線 / hook callback | 模型呼叫 tool |
| **跑在誰的程序** | host 程序內(被 `exec` / 讀檔注入 context) | host 程序內 | 獨立進程 |
| **隔離強度** | 弱 — body 直接進 prompt | 無 — 完全信任,跑任意 Python | 強 — 程序邊界 |
| **跨 framework?** | Hermes only | Hermes only | 標準協定,任何 client 都能接 |
| **誰決定要不要用** | 模型(看 description 自己選) | host 啟動時就決定 | 模型(看 tool list 自己選) |
| **生命週期** | 按需注入、用完就走 | session 全程在線 | 長連線 |

看到「**隔離強度**」那一欄了嗎?MCP 是強隔離,plugin 是**零隔離**。一個被 clone 進來的惡意 plugin 會在儀表板程序裡跑任意 Python,握有完整的 session token 存取權。所以 Hermes 的 `SECURITY.md` 裡有一句很誠實的話:「**plugin 跟 skill 都跑在完整 agent 權限下**,boundary 是 operator 安裝前的人工 review。」(我覺得這句話翻譯成白話就是「沒有 boundary,自求多福」。)

---

## 三、漸進揭露 — skill 系統值得學的設計

技能 body 動輒幾千 token,你應該會冒出一個問題:**那如果有 89 個技能,全塞進 context 不就爆了?**

對,所以 skill 系統的關鍵設計是**漸進揭露(progressive disclosure)**——這個詞源自 UI/UX 領域(Nielsen Norman Group 1980s 的經典定義:把次要 / 進階資訊延後揭露,降低初始認知負擔)。Anthropic 在 docs 與 engineering blog 把這個概念遷移到 agent context 管理,套到 context window 上。

**Anthropic 官方分三層**(用「Level」,不是「Tier」):

```
Level 1:Metadata(name + description)     ── 永遠載入,~100 tokens per skill
Level 2:SKILL.md body                     ── 觸發後才讀,建議 <5k tokens
Level 3:scripts / 補充 .md / 資源檔        ── 透過 bash 執行/讀取,不必整包進 context
```

官方工程部落格的類比很傳神:「像一本有條理的手冊——先是**目錄**,然後是某幾個具體**章節**,最後才是詳細的**附錄**。」

**Level 1 是這套設計的關鍵**。每個技能的 `description` 永遠都在,字元上限 1024(典型約 100 tokens,寫滿 1024 字元時上界約 250–300 tokens)——它的工作是當「路由訊號」,讓模型知道「**喔,有這個技能存在,而且它是處理 X 場景的**」。當使用者的 prompt 真的觸發到某個技能(例如使用者打 `/godmode`,或是模型自己判斷「該叫 systematic-debugging 出來」),才把 Level 2 的完整 body 載入。

這就讓「一個技能在被呼叫之前只花約 100 token」變成可能。Anthropic 官方建議:body 超過 5k tokens / 500 行,就拆到補充 `.md`。

**Hermes 在官方三層之上又疊了一層自己的東西**:在組 system prompt 的 skill index 時,每個分類附上一行 `category_description`。這是 Hermes 為了處理 89 個技能而加的二級路由訊號,你可以把它視為「Hermes 自己的 Level 0.5」,跟 Anthropic 官方規格無關。

打個比方:這就像 IDE 的 LSP(Language Server Protocol,編輯器跟語言伺服器之間的標準協定,管補完、跳轉、診斷)——你的編輯器不會把整個 stdlib 的 source 都載進來,只在你打 `os.` 然後按 Tab 的那一刻才去拉 `os` module 的補完資訊。其他時候那 100 萬行的標準函式庫只是一個「我知道你存在」的索引條目。Skill 系統做的事一模一樣,只是把 IDE 換成 LLM、把 stdlib 換成你的 89 個技能。

這套設計還有個比較少人講的副作用:**它讓「技能爆炸」變成不是問題**。你 repo 裡塞 500 個技能跟塞 5 個,平常的 context 開銷幾乎一樣——多出來那 495 個就是 495 條 ~100 token 的 metadata,加總大概也才幾萬 token,對 200k context window 來說根本沒感覺。真的塞爆是不可能的,被選中的最多就那兩三個。

### 暗線 B 第四次出現:skill index 進 system prompt 的 stable 區段,動態 body 走別處

但這裡有件事要提一下——這是我們從 Day 3 開始追的那條主線(我們的暗線 B)第四次冒出來。

回顧一下:

- **Day 3** 講了 prompt caching 的鐵律:**system prompt 在 session 中途絕不能變**,改了就洗光 cache、成本翻幾倍。
- **Day 4** 看 context 壓縮:壓縮是唯一被允許的「中途變動」,而且還小心翼翼地處理。
- **Day 6** 講記憶:為什麼「記住昨天」不能用「把使用者的記憶塞進 system prompt」這種看似最直覺的做法。

**今天第四次出現**,而且方向比較幽微——這次不是「禁止某件事」,而是「把擴充機制**分成兩條路**,讓 stable 區段不被動到」。

你想啊:你有 89 個技能的 metadata 索引(這部分**永遠存在、永遠不變**),還有「某個技能被觸發後要載入的完整 body」(這部分**動態**——剛剛沒有,使用者打 `/godmode` 之後就要進來 8k 字元)。這兩種東西性質完全不同,塞進同一個位置就會打架。

所以 Hermes 是怎麼切的?

1. **永遠不變的 skill index** → 進 **system prompt 的 stable 區段**。`agent/prompt_builder.py:997` 的 `build_skills_system_prompt()` docstring 直接寫「**a compact skill index for the system prompt**」;`agent/system_prompt.py:178–185` 把這份 index `append` 進 `stable_parts`,跟 system prompt 其他穩定段並排,**永遠固定、永遠在最前面**——這是 prompt cache 最歡迎的形狀。
2. **動態載入的 skill body** → 透過 `/skill-name` 觸發後組成 **user message**(`agent/skill_commands.py::build_skill_invocation_message` 明寫 "Build the user message content for a skill slash command invocation");Anthropic 官方版本則是讓模型透過 bash 讀檔、以 **tool_result** 進入 context。**兩條路都不碰 system prompt**。

`reload_skills()` 跑完之後 **system prompt 動都沒動**——因為被動到的是 stable 區段以外的東西。Prompt cache 完全有效。

注意因果方向:**不是「因為 cache 鐵律,所以 skill 一律走 user message」**——而是「**stable 區段必須穩定**,所以(a) 永遠存在的 index 放進 stable 區段一次到位,(b) 動態變動的 body 走別的訊息類型」。Prompt cache 友善是 stable 區段穩定設計的**副效益**,不是 skill 注入機制的因。

但結論一樣:這條鐵律默默塑造了整個架構——從 Day 3 講的 prompt cache 鐵律,一路到 Day 4 的壓縮、Day 6 的記憶、再到今天的 skill 注入分流。它是個**結構性的約束**,所有的擴充機制都必須圍著它設計。

---

## 四、誠實批判 — 這三套職責有重疊

好,讚美完漸進揭露,該講壞話了。**Hermes 自己的這三套機制職責是有重疊的**。

假設你回到開頭那個情境——想加 Heptabase 整合。**三條路都走得通**:

1. **寫成 MCP server**:跑個獨立進程,把 Heptabase API 包成 MCP tool。優點:強隔離、其他 client(Claude Desktop、自己寫的 agent)也能接。缺點:多開一個進程,debug 比較煩。
2. **寫成 Hermes plugin**:`plugin.yaml` 設 `kind: backend`,在 `register(ctx)` 裡 `ctx.register_tool(...)`。優點:跟 Hermes 共用 auth、跑得快、可以攔截 hook。缺點:**只能 Hermes 用**,而且零沙箱。
3. **寫成 skill**:做一個 `skills/integrations/heptabase/` 目錄,SKILL.md 裡寫流程,`scripts/` 裡放實際打 API 的 Python。優點:漸進揭露,只有需要時才載入。缺點:模型要自己 follow 步驟,沒有真正的 tool 抽象。

**選哪條?Hermes docs 裡沒有清楚的決策樹。** 沒有任何一份文件告訴你「要加 X?用機制 Y」。

我給你看一個更荒謬的證據:Hermes 自己的 `plugins/spotify/__init__.py` 裡有一段**長 docstring 在為自己「是 plugin 而不是頂層 `tools/` 檔案」辯護**。

> 當一個 plugin 需要寫一整段話來解釋「我為什麼存在這裡而不是隔壁」,這個分類法就已經在漏水了。

更糟的是,連「技能 = 知識,plugin = 程式碼」這個你以為的直覺分界都站不住腳——`optional-skills/migration/openclaw-migration/scripts/openclaw_to_hermes.py` 是一個**裝在 skill 裡的 3,136 行 Python 程式**。技能也能捆綁可執行程式碼。所以「誰是知識、誰是程式碼」這個判準根本不成立。

差異在**信任邊界跟生命週期**:

- Skill ── prompt 注入、模型在任務中途自己決定要不要用、零啟動成本。
- Plugin ── 真正的 Python 在啟動時接進 host(因為一個 chat adapter 要握 Pub/Sub 長連線、一個 provider 要改寫 wire 格式,這些**真的需要程式碼在 host 程序裡**)。
- MCP ── 程序隔離 + 標準協定,擴充來自第三方、不可信、或要跟非 Hermes 的 client 共用時用它。

冗餘**部分是故意的**——這三套是「信任 / 耦合光譜上的三個點」。真正的問題是**可發現性跟命名**,不是「存在三套機制」本身。

(這個批判我先鋪墊,Day 14 會正面開砲——`cli.py` 657KB 那種等級的結構性債務,跟今天這個是同一條線:**抽取程式碼 ≠ 分解系統**,這是我們的暗線 C。)

---

## 五、那作者(我)會怎麼選?一棵粗糙的決策樹

承認 Hermes 沒給決策樹之後,我自己試著畫了一棵——這純粹是我的觀點,不代表 Hermes 官方:

```
你想加什麼?
├── 想讓「其他 framework / Claude Desktop / 自己寫的 agent」也能用?
│   → MCP server(犧牲一點啟動成本,換跨工具通用 + 程序隔離)
│
├── 想攔截 Hermes 的 core 行為(LLM call 前後 / session 開始 / post-tool)?
│   → Plugin(只有 plugin 有 hook callback)
│
├── 只想加「使用者輸入指令 → 對應流程 + 工具」,不需要跨 framework?
│   ├── 重點是「教模型一套程序性知識」 → Skill(純指令型)
│   ├── 流程要叫底層程式碼跑 → Skill + scripts/(腳本型)
│   └── 想暴露成「一個明確的 tool」給模型呼叫 → Plugin (kind: backend)
│
└── 想加新模型 / 改 wire 格式 → Plugin (kind: model-provider)
```

回到我的 Heptabase 情境:

- 我會用嗎?**會**。
- 我會用哪個?**MCP server**——因為我希望 Claude Desktop、自己其他的小 agent 也能讀同一份資料,跨 client 通用比較划算。如果只給 Hermes 用,我會選 Plugin (kind: backend) 註冊一個 tool。

但這是「我」的判斷。換個人可能會選別的——而**這份歧義本身就是 Hermes 留下的設計債**。

---

## 小結

今天的重點:Hermes 加東西有三套機制,**形式、註冊、觸發、隔離強度**全都不同。Skill 是模型面向的 Markdown,plugin 是 host 面向的 Python,MCP 是外部進程。漸進揭露是 skill 系統最值得學的設計——讓一個幾千 token 的技能在被呼叫前只花 ~100 token;而 skill 機制的注入分流(永遠不變的 index 進 system prompt 的 stable 區段、動態 body 走 user message / tool_result)把 Day 3 的 prompt cache 鐵律一路貫穿到今天。

至於三套職責重疊?這是有意的——它是信任光譜上的三個點。問題不在「存在三套」,而在**沒人告訴你什麼時候該選哪個**。

---

但講完「怎麼加東西進一個 agent」之後,你應該會冒出另一個更大的問題:**一個 agent 跑得再順,當任務複雜到一個 LLM 撐不住時呢?** 你可以給它再多技能、再多工具,但它就是一個腦袋,context 也是一個 context。明天我們來看 Hermes 怎麼讓多個 agent 合作不打架——子代理委派 + Kanban,Hermes 整套架構裡我個人最喜歡的一個設計。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `agent/prompt_builder.py` | `build_skills_system_prompt()` — 把 89 個技能的 metadata 索引組成一塊「skill index」進 system prompt 的 stable 區段 |
| `agent/system_prompt.py` | 第 178–185 行把 `skills_prompt` append 進 `stable_parts`,跟 system prompt 其他穩定段並排 |
| `agent/skill_bundles.py` | 技能包(bundle)的載入、合併、slash 指令 dispatch |
| `agent/skill_commands.py` | `/<skill-name>` 怎麼變成「載入 SKILL.md body 並組成 user message」(`build_skill_invocation_message`) |
| `agent/skill_preprocessing.py` | 模板變數展開 + inline shell 展開,在 body 真的被送進訊息流前做最後處理 |
| `agent/skill_utils.py` | SKILL.md 的 frontmatter parser、description 摘取、檔案系統掃描 |
| `agent/plugin_llm.py` | Plugin 的 host 託管 LLM 通道(`ctx.llm.complete(...)`),plugin 拿不到 raw token |
| `tools/skill_manager_tool.py` | Skill frontmatter 驗證器(`_validate_frontmatter` + `_validate_content_size`) |
| `skills/` / `optional-skills/` | 89 個內建技能 + 預設不啟用的官方技能 |
| `plugins/<name>/plugin.yaml` | 後端 plugin manifest,看 `kind` 欄位就知道它接哪個擴充點 |
| `plugins/<name>/manifest.json` | 儀表板分頁 plugin 的全端微前端契約 |

從 `agent/prompt_builder.py::build_skills_system_prompt` 入手最快——你會看到 skill index 怎麼被組起來、為什麼它能進 stable 區段(因為它是純函式、輸入確定就確定);再到 `skill_commands.py::build_skill_invocation_message` 看 slash 指令觸發後完整 body 怎麼變成 user message。Plugin 那邊從任一個 `plugins/<name>/__init__.py` 的 `register(ctx)` 進去,看它對 `ctx` 呼叫了什麼,就知道有哪些擴充點存在。
