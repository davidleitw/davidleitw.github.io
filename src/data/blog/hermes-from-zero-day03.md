---
title: "Day 03:為什麼 system prompt 不准動"
description: "prompt cache 不是事後優化,是 Hermes 設計裡最被當成鐵律的一條——為什麼 system prompt 在 session 中途絕不能變。"
pubDatetime: 2026-05-07T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

在 `agent/system_prompt.py` grep `cache` 跑下去,我看到 line 265 開始的一段註解,逐字長這樣:

```python
# Date-only (not minute-precision) so the system prompt is byte-stable
# for the full day.  Minute-precision changes invalidate prefix-cache KV
# on every rebuild path (compression boundary, fresh-agent gateway turns,
# session resume without a stored prompt).  The model can still query the
# exact wall-clock time via tools when it actually needs it.
# Credit: @iamfoz (PR #20451).
```

一個註解寫了五行解釋「為什麼時間戳只到日期、不到分鐘」,還掛了 PR 編號跟 contributor。這代表什麼?代表這條設計是被一個真實的 cache miss 事件逼出來的——有人寫了 `%H:%M` 級的時間戳,有人發現每分鐘 cache 都被洗、帳單冒煙,@iamfoz 開了 PR #20451 改掉,**然後團隊覺得這條教訓重要到要留五行註解 + contributor credit**。

整個 `system_prompt.py` 的設計都從這條教訓長出來。今天這篇就是要拆 Hermes 為什麼把 system prompt 在 session 中途**鎖死、絕不能變**,以及這條鐵律怎麼塑造了整個 API 形狀。

---

## Prompt cache 認的不是你的臉,是你掏錢的順序

先講清楚 prompt caching 到底是什麼,因為這直接影響你後面看 Hermes 的所有設計決定能不能看出味道。

Anthropic(以及 OpenRouter 之類的相容閘道)會把你請求的「前綴」快取起來。下次你送一個請求,如果它的前綴跟之前那個**逐位元組(byte-for-byte)一模一樣**,那段前綴就只收大約 **10% 的價錢**。也就是說 cache hit 的 token 大約是全價的 1/10;反過來說 cache miss 的話,你那段在花原本的 10 倍。

這不是我寫文章的修辭,Anthropic docs([Prompt caching 官方文件](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching))自己就明文這樣寫:

> "Exact matching: Cache hits require **100% identical** prompt segments, including all text and images up to and including the block marked with cache control."
> "Marking a block with `cache_control` writes exactly one cache entry: **a hash of the prefix ending at that block**."

換句話說,後端比的不是字串相似度、不是 embedding,是 **hash**。差一個 byte,hash 就完全不同,等於 cache miss——這就是為什麼後面 Hermes 為了 prefix 穩定要做到那麼偏執。

> **Note**:這裡的「10%」是 Anthropic 官方公告的大致比例,實務上會因模型、TTL(5 分鐘 vs 1 小時)、快取建立成本而略有不同。重點抓「**hit 跟 miss 之間是一個量級的價差**」這個感覺就好,不用記死數字。

我喜歡的比喻是這樣:prompt cache 像便利商店的熟客折扣,但折扣**認的不是你的臉**——它認的是「你拿出會員卡、刷條碼、按確認」這整套動作的**順序跟內容**一字不差。你今天比較開心,順序顛倒了一下,或者在中間多哈了一聲,折扣就沒了。

對 chat completion 來說,這條規則沒什麼。你一次性把 messages 丟過去、拿回答、結束,反正只送一次。但對 agent 就完全不是這麼回事了——agent 是「**同一個 session 裡會送幾十次、上百次幾乎一樣的 prompt**」的工作型態,每一輪只在訊息列表尾巴多加幾則訊息。如果前面那一大坨 system prompt + 早期對話可以一路 cache 下去,你每輪只付「尾巴那一小段新訊息」的全價,長對話的成本可以壓到原本的零頭。

但前提是——**前綴必須真的沒變**。一個字都不能動。

這就是我那個自以為聰明的 side project 出包的原因。每次切模式都在動 system prompt 中段那幾百個字——等於每一輪都跟模型大喊一聲「我不要折扣」。

---

## Hermes 的對應做法:system prompt 在 session 中途絕不能變

打開 `agent/system_prompt.py`,你會看到一個很明顯的設計姿態。`build_system_prompt()` 的 docstring 明白寫著:

> Called once per session (cached on `agent._cached_system_prompt`) and only rebuilt after context compression events.

翻成人話:**整個 session 從頭到尾,system prompt 只建一次**。建完之後存在 `agent._cached_system_prompt` 裡,後面每一輪直接逐字重播同一份。唯一被允許重建它的時機是「context 壓縮」(這個 Day 04 會講,你可以先記住它是個例外)。

這聽起來很沒彈性,對吧?**那如果中途使用者切到新模式怎麼辦?如果 agent 學到新的記憶怎麼辦?**這些問題等等會處理。先記住這條鐵律:**session 中途,system prompt 不准動**。

這就是這個系列的**第二條暗線**:**prompt cache 是鐵律**。接下來幾天你會看到所有設計都繞著這條轉——壓縮為什麼要切 session 邊界、記憶為什麼不能塞 system prompt、技能為什麼從 user message 注入——全都是同一條鐵律的延伸。

而且這條鐵律不只是「我這樣覺得」,Anthropic docs 自己就把這件事寫成**層級依賴**(來源同上,[Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) 的 *Cache hierarchy* 段落):

> "Cache prefixes are created in the following order: **`tools`, `system`, then `messages`**."
> "**Changes at each level invalidate that level and all subsequent levels.**"

換句話說,動 system prompt 不是「只洗掉 system 那塊 cache」——它連帶把後面所有 messages 的 cache 一起送終,因為 messages 的 prefix 本來就是建立在 system 之上的。Hermes 把 system prompt 鎖死,不只是經驗法則,是順著 Anthropic 官方層級規則的最佳化策略。

---

## 三層穩定性排序:stable / context / volatile

光說「不准動」還不夠,因為 system prompt 裡面其實有「比較會變」的東西跟「幾乎不會變」的東西。如果你**所有東西混在一起**,那只要有任何一塊變了,後面整段就重算錢。

Hermes 的解法很直接:**按穩定性排序**。`system_prompt.py` 把整段 system prompt 拆成三層,順序固定:

1. **`stable`** —— 身份(SOUL.md 或預設 identity)、工具使用指引、技能 prompt、平台提示。這些是**從 session 開始到結束都不會變**的東西。
2. **`context`** —— 呼叫方傳進來的 system message、`AGENTS.md` / `.cursorrules` 之類的 context 檔案。這些**整個 session 內也不變**,但跨 session 會變。
3. **`volatile`** —— 記憶快照、`USER.md` 個人檔、外部記憶、時間戳。這些**比較容易變**。

排序原則:**最不會變的放最前面,讓 cache 從頭命中得越深越好**。即使最後面的 `volatile` 段不幸變了,前面 `stable + context` 的快取還是能用。如果你把不穩的東西塞到開頭,後面再穩也救不回來——cache 命中只認前綴,前綴一掛,後面全廢。

這個排序看起來瑣碎,但少了它,前面那條鐵律省不到錢。

---

## 時間戳:只到 DATE,不到 minute

很多 agent 的 system prompt 會放一行時間戳,告訴模型「現在是幾年幾月幾日幾點幾分」。聽起來很合理,模型應該知道現在幾點啊。

但只要你接受了上面那條鐵律,結論就明顯了:**精確到分鐘的時間戳代表 system prompt 每分鐘都會變一次**。每變一次,後面整段 cache 直接失效。一個 agent session 跑半小時,你可能每隔幾分鐘就重建一次 system prompt,等於把整套 prefix cache 砸到地上——**而你還完全沒意識到**,因為功能上「沒壞」,只有錢包知道。

這個推理不複雜,但真實世界裡很多人還是踩。怎麼確定?Anthropic docs 的 *Common mistakes* 章節([Prompt caching — Common mistakes](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching))**直接拿 timestamp 當反例**:

> "a per-request block containing **a timestamp** and the user message … Request 2: **The timestamp differs**, so the prefix hash at block 6 differs. … **No cache hit.** You pay for a fresh cache write on every request and never get a read."

Hermes 那個 PR #20451,就是有人踩過這個坑、把帳單燒出洞之後才改成 date-only 的——官方明文點名的反例,真實世界裡每天都有人在踩。

Hermes 怎麼處理?看 `system_prompt.py` line 265–271 附近:

```python
# Date-only (not minute-precision) so the system prompt is byte-stable
# for the full day.  Minute-precision changes invalidate prefix-cache KV
# on every rebuild path...
# Credit: @iamfoz (PR #20451).
timestamp_line = f"Conversation started: {now.strftime('%A, %B %d, %Y')}"
```

**只到日期,不到分鐘**。整個 system prompt 在當天**逐位元組穩定**,prefix cache KV 可以一路撐。模型如果真的需要精確時間,呼叫一個 `get_time` tool 就好——把那個變動移到「使用者訊息」這條變動的軌道上,不要去碰那條必須穩定的軌道。

註解裡留了個來源 `PR #20451`,你有興趣可以去翻。這種「一行 code 背後是一張燒了的帳單」的細節,Hermes 裡到處都是。讀的時候很容易滑過去,但每一個都是某個團隊踩過坑才寫上的。

---

## 繼續 session 時,prompt 是「還原」不是「重建」

再一個容易踩的坑。Agent session 通常會存進 SQLite,使用者明天回來繼續聊,系統要把舊 session 載回來。

天真的寫法:**重建** system prompt——重新跑一次 `build_system_prompt(agent)`,反正函式都還在嘛。

問題是:**你跑這個函式的此刻,跟原本建這個 prompt 的彼時,中間發生過事情**。模型可能在 session 過程中編輯了自己的記憶(`USER.md` 改過、外部記憶新增條目),日期戳如果用 `now()` 重算還會跳到「今天」——如果你「重建」,那層 `volatile` 會把這些新東西統統吃進去,**產出一份跟原本不一樣的 system prompt**,後面整段 cache 直接 miss。

Hermes 的做法是「**從 session DB 還原**」——把當初存的那份 system prompt 字串撈出來,逐字重播,而不是重跑組裝函式。具體實作在 `agent/conversation_loop.py:85–138`(函式 `_restore_or_build_system_prompt`),核心邏輯白話翻譯:

```python
# conversation_loop.py:114–138 摘要
if conversation_history and agent._session_db:
    session_row = agent._session_db.get_session(agent.session_id)
    if session_row is not None:
        raw_prompt = session_row.get("system_prompt")
        if raw_prompt:                              # 有存的就照搬
            stored_prompt = raw_prompt
            stored_state = "present"
        elif raw_prompt is None:                    # legacy session
            stored_state = "null"
        elif raw_prompt == "":                      # silent persistence bug
            stored_state = "empty"

if stored_prompt:
    # Continuing session — reuse the exact system prompt from the
    # previous turn so the Anthropic cache prefix matches.
    agent._cached_system_prompt = stored_prompt
    return                                          # ← 直接 return,不重建
```

注意那個 return——**只要 DB 裡撈得到非空字串就直接拿來用,連組裝函式都不會跑**。剩下兩個分支(`null` / `empty`)是專門擋舊雷的:`null` 是早期還沒做 prompt 持久化的舊 session,`empty` 是某次寫入時靜默掛掉。兩個都會 log warning,因為它們等於「**這輪 cache 一定 miss**」——團隊真的踩過,所以才把 log level 從 DEBUG 拉到 WARNING,讓這種事不要再悄悄發生。

雖然「還原」這條路代表「**記憶被改過但 system prompt 還是舊的**」,但這正是要的:那份 prompt 必須跟產生它的那一刻完全一致,才能繼續用 cache。要讓模型看到新記憶?**塞到 user message 裡**(下一節講)。

---

## 那 timestamp 怎麼辦?——其實一開始就不打算更新

「還原而非重建」這條路有個副作用:**你五月一號開的 session,五月二十號回來繼續聊,system prompt 裡寫的還是 `Conversation started: Thursday, May 01, 2026`**。中間 19 天,timestamp 一個 byte 都不會變。

乍看像 bug,但這是刻意的。

看 `system_prompt.py:271` 那行 format:

```python
timestamp_line = f"Conversation started: {now.strftime('%A, %B %d, %Y')}"
```

字面上寫的是 **"Conversation started"**(對話開始於),不是 **"Today is"**(今天是)。這個用詞差異是刻意的——模型讀到的是「**這是這個 session 的起點時間,不是 wall-clock 的現在**」。再配上前面 date-only granularity 的設計(只到日期、不到分鐘):**這版作者從一開始就沒讓 system prompt 表達「現在幾點」這件事**。

那如果模型真的需要知道「今天是幾號」、「現在幾點幾分」呢?設計上有兩條合法的路:

1. **模型自己呼叫 shell tool 跑 `date`**——這是 `system_prompt.py:268–269` 那段註解明文寫的退路:「The model can still query the exact wall-clock time via tools when it actually needs it.」
2. **使用者在最新一則 user message 裡明說**——例如「今天是 5/20」這種上下文資訊,本來就該走 user message 軌道,不會碰 cache prefix。

那 Hermes 會不會偷偷在 user message 裡塞一句 `<今天是 XXX>` 來補救?**沒有**。整個 `tools/` 翻過去,沒有任何 `current_time`、`get_time`、`current_date` 之類的自動注入工具(`tools/terminal_tool.py:1259` 與 `tools/browser_tool.py:1255` 裡的 `current_time` 變數是 session 閒置倒數用的,跟對話 content 沒關係)。`agent/` 那一側也沒有任何路徑會在組 user message 時自動補日期上去。**模型要嘛接受「我只知道 session 起點那天」,要嘛自己呼工具拿時間**。

這個 trade-off 第一眼看很硬(「那模型不就誤以為今天還是 5/1?」),但實際跑下來幾乎不出事:

- Agent 大多數工具任務本來就跟日期無關(讀檔、跑 shell、改 code,沒一件需要知道今天幾號)
- 需要日期的場景(寫 commit message、生 changelog、排程之類的),模型自己會去跑 `date` 或讀檔抓
- 換到的「cache 永遠 hit」是一個量級的成本差距——這筆帳一算下去,讓出「**模型直覺知道今天幾號**」這件事划算

---

## 補一個小坑:`volatile tier` 這個名字會誤導

你打開 `system_prompt.py:240` 會看到一行 inline comment 寫:

```python
# ── Volatile tier (changes per session/turn — never cached) ───
```

**這句話跟主 docstring 互打架,而且是這行 inline comment 寫錯了**。

對照 line 287–301 的 `build_system_prompt` docstring:

> Called once per session (cached on `agent._cached_system_prompt`) and only rebuilt after context compression events. ... **The whole string is treated as one cached block — Hermes never rebuilds or reinjects parts of it mid-session**, which is the only way to keep upstream prompt caches warm across turns.

兩相對照,實際語意是:

- **三層 stable / context / volatile 只是組裝時的程式碼分區**,不是 cache 邊界。
- 送出去之後三層黏成一坨字串、整段進 Anthropic cache(透過 `prompt_caching.py` 那 1 個給 system 的 cache_control marker)。
- **`volatile` 真正的意思是「下次 rebuild 時這層會吃到當下最新的記憶 / 日期」**,而不是「這層每輪都重新計算」。
- 而 rebuild 唯一的觸發條件是 **context 壓縮**——見 `system_prompt.py:306–314` 的 `invalidate_system_prompt`,呼叫點在 `agent/conversation_compression.py:360`(壓縮成功後 `agent._cached_system_prompt = new_system_prompt`)。

換句話說:**`volatile` 只有在「組裝那一刻」才是 volatile,組完之後它就跟 stable / context 一樣被釘死了**。整個 session 的壽命裡,要嘛根本不重建(最常見),要嘛只在壓縮邊界重建一次。所謂的「volatile」是相對於「跨 session 來看會變」,不是「每輪都會變」。

如果你讀 source 只看到 line 240 那行 inline comment,大概會以為 timestamp / 記憶每輪都是新鮮的——但實際上它們會跟整段 cache 一起被冷凍。**主 docstring 才是 source of truth**。

---

## 唯一的後門:`ephemeral_system_prompt`

那如果就是需要每輪偷塞一點只給這輪看的指令呢?完全沒辦法?

有,但要用對位置。Hermes 留了一條後門叫 `ephemeral_system_prompt`,設計理念在 `system_prompt.py:224–225` 寫得很白:

```python
# Note: ephemeral_system_prompt is NOT included here. It's injected at
# API-call time only so it stays out of the cached/stored system prompt.
```

它的組裝點在 `agent/conversation_loop.py:803–804` 跟 `agent/chat_completion_helpers.py:935–937`,長這樣:

```python
effective_system = agent._cached_system_prompt or ""
if agent.ephemeral_system_prompt:
    effective_system = (effective_system + "\n\n" + agent.ephemeral_system_prompt).strip()
```

意思就是:**API call 真的要送出去的那一瞬間,把 ephemeral 那段黏在 cached system prompt 後面,組成 effective system 丟出去,但 cached 那一份不動、SessionDB 那一份也不動**。下一輪你 ephemeral 換內容,只會影響「下一輪實際送的 system」,存起來的快照永遠乾淨。

但這條後門有幾個你必須清楚的代價:

1. **每輪都會 cache miss**——effective system 每輪都不一樣,前綴 hash 每輪都不一樣,prompt cache 等於直接被你 bypass 掉。
2. **Hermes 自己不會自動往這裡塞東西**——這條 API surface 是留給呼叫方(CLI、gateway adapter、外部 caller)有特殊需要時手動傳入用的,不是內建的注入機制。
3. **「ephemeral」這個名字就是用完即丟**——不寫進 trajectory、不寫進 SessionDB,下次 session resume 也撿不回來。

後門是有,但用它就是放棄 cache。要不要付這個代價,呼叫方自己決定。Hermes 主路徑沒往這裡塞日期——大概是因為作者也覺得「讓模型直覺知道今天幾號」不值得每輪燒一次 cache。

---

## 重新整理:整套設計的內在一致性

到這邊把 timestamp、session resume、volatile tier、ephemeral 這四件事擺在一起看,它們是同一條設計原則的不同切面:

| 設計決定 | 出處 | 為了避免什麼 |
|---|---|---|
| Timestamp 只到 `%A, %B %d, %Y` | `system_prompt.py:271` | 避免分鐘級變動造成每分鐘都 rebuild |
| 措辭用 "Conversation started" 而非 "Today is" | `system_prompt.py:271` | 在語意上預告「這不是 wall-clock now」 |
| Session resume 從 DB 撈 verbatim | `conversation_loop.py:134–138` | 避免「重建函式跑兩次語意就漂移」 |
| Rebuild 只在 context 壓縮時觸發 | `system_prompt.py:306` + `conversation_compression.py:360` | 避免任何「半路改 prompt」的誘惑 |
| `ephemeral_system_prompt` 不寫進 cache 也不存 DB | `system_prompt.py:224–225` | 給後門但不讓後門污染主路徑 |
| 沒有任何「往 user message 偷塞日期」的內建邏輯 | 整個 `tools/` 跟 `agent/` 都沒這條路 | 不為了「假裝模型知道現在」而破壞 cache |

把這幾條擺在一起看,**每一處設計都在保護同一條鐵律**——這是它跟一般 agent framework 比較大的差別。不是做了什麼炫的事,是**為了 cache 命中率,放棄掉很多看起來很合理的方便**:日期不準、記憶要延遲一輪才能看到、ephemeral 用了就 cache miss——這些都是被刻意接受的代價。

> **Note**:line 240 那行 inline comment(「never cached」)目前還在 source 裡沒改,讀 code 的時候別被它帶歪。比較可信的是主 docstring。

---

## 那動態的東西怎麼辦?全部走 user message

回到開頭那個問題:**如果 system prompt 不能動,那會變的東西要塞哪裡?**

答案是:**user message**。

- 技能 context(plugin context)→ 塞 user message
- 記憶回憶(memory recall)→ 塞 user message
- @-reference 展開的檔案內容 → 塞 user message
- 中途要給 agent 的提醒 → 塞 user message(或當成新一則訊息)

這條規則簡單到不像有什麼學問,但它就是 Hermes 整套架構的脊椎。**system prompt 是「跨輪不變」的軌道,user message 是「會變」的軌道**。會變的東西都被趕到第二條軌道上。

這個你在 Day 04(壓縮)、Day 06(記憶)、Day 10(技能注入)會反覆看到同一條鐵律——換不同的場景、解不同的問題,但最後都繞回「**不要動 system prompt**」這條紅線。

開頭那個「動態 system reminder」的想法,正確的做法不是改 system,而是**在輪到 agent 出手前,先塞一則 user message 進去**:「請接下來以 X 模式回答」。功能一樣,但前綴沒動,cache 還在。

---

## Cache marker 怎麼擺:`system_and_3` 是什麼意思

光有「前綴穩定」這個不變式還不夠。Anthropic 不會主動幫你 cache 任何東西——你得**手動在訊息序列裡插「打標」(marker)**,告訴 API:「**到這個位置為止,請幫我存起來**」。這個 marker 在 SDK 裡叫做 `cache_control`,寫法是在 system / messages / tools 某個 block 上掛 `cache_control: { type: "ephemeral" }`(來源:[Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching))。

Anthropic 的限制:**一個請求最多 4 個 `cache_control` breakpoint**。官方原文(同上來源):

> "**You can define up to 4 cache breakpoints if you want to cache different sections that change at different frequencies.**"
> "If 4 explicit block-level breakpoints already exist, **the API returns a 400 error**."

也就是說超量是 fail-loud 的——你哪天看到 400 回來,先檢查 `cache_control` 是不是貼太多了。

那麼這 4 個額度怎麼用?打開 `agent/prompt_caching.py`(只有 79 行,函式名 `apply_anthropic_cache_control`),策略它自稱 **`system_and_3`**——白話翻譯:**1 個給 system,3 個給最後三則訊息**。

訊息序列上實際長這樣:

```
[ system prompt .................. ] ← breakpoint 1
[ user (turn 1) ]
[ assistant (turn 1) ]
[ tool_use / tool_result ... ]
[ user (turn 2) ]
[ assistant (turn 2) ]
...
[ 倒數第三則訊息 ................. ] ← breakpoint 2
[ 倒數第二則訊息 ................. ] ← breakpoint 3
[ 最後一則訊息 ................... ] ← breakpoint 4
```

**為什麼 marker 要放在「訊息尾巴」而不只是 system prompt 後面?**

關鍵是:cache 認的是「**從開頭到這個 marker 為止的整段前綴**」。如果你只標在 system prompt 結尾,那後面 30 輪對話累積的訊息,每一輪都得從 system 後面那一格開始重新算錢——你只 cache 到 system,後面全裸。

把 marker 鋪到尾巴,意思就變成「**到上一輪最後一則訊息為止,全部都已經快取過了**」。下一輪只要在尾巴再加一則新訊息,前面那一大坨直接 hit。對話越長,越省。

那為什麼是「**最後 3 則**」而不是「最後 1 則」?這跟下面 *Anthropic cache 規則的其他眉角* 那一節要講的 **20-block lookback window** 直接相關——簡單講就是:Anthropic 的 cache 查找只往前看 20 個 block,如果你只標 1 個 marker、那個位置剛好被新訊息推超出 lookback 範圍,就 miss。在尾段鋪 3 個 marker 等於布了多個 fallback 點,前一輪的 marker 即使被擠到後面一些,還是有機會 hit 上。剩下那一格給 system 是因為 system 是整段訊息序列的開頭、是所有 cache hit 必經之路,獨立給它一個 marker 最划算。

> **再簡單講一次**:把 4 個 breakpoint 想成「在訊息序列上釘 4 根樁」。前 1 根釘在 system 末端、後 3 根釘在最後三則訊息的末端。下次請求進來,API 從前往後比對前綴,只要你的訊息跟上次一模一樣,就會在這些樁的位置依序撈到 cache。

具體實作上還有個小細節:`cache_control` 怎麼掛到「一則 tool result 訊息」上,取決於它的 content 是字串還是 list。字串要先包成 `[{"type":"text", "text":..., "cache_control":...}]`,list 則是掛到最後一個元素。這種「根據格式變形,但語意一致」的處理就是 Hermes 在做 provider 抽象時的做法,Day 05 會更明顯看到。

---

## 連 `tool_call_id` 都要 deterministic——這是什麼鬼?

這是整篇我覺得最容易卡住的一段,拆開講。

### 先講 `tool_call_id` 是什麼

當模型決定要呼叫一個工具,它回給你的訊息**不是純文字**,而是一段 structured 的 tool call,大概長這樣(以 Anthropic 格式為例):

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01ABC123XYZ",          // ← 這就是 tool_call_id
      "name": "read_file",
      "input": { "path": "agent.py" }
    }
  ]
}
```

然後你 framework 收到這個,實際去執行 `read_file({"path": "agent.py"})`,拿到結果,**把結果塞回訊息序列**準備發下一輪請求。塞回去的那則訊息長這樣:

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01ABC123XYZ",  // ← 必須跟上面那個 id 一樣
      "content": "file contents here..."
    }
  ]
}
```

那個 `tool_use_id` 是 API 強制要求的——你必須用它告訴模型「**這個 result 是回應剛才哪一個 tool_use 的**」。如果一輪裡模型同時呼叫了 3 個工具,3 個 result 訊息都要靠各自的 id 對回去。沒有這個 id,模型就不知道哪個結果對應哪個呼叫。

### 那「deterministic」是在 deterministic 什麼?

接下來才是 cache 出場的地方。**整條訊息序列(包含這些 id)會被當成前綴丟回給模型**——下一輪請求送出去時,API 會逐位元組比對前綴,看能不能 hit。也就是說:**模型上一輪生出來的 `id`、跟你 framework 塞回去的 `tool_use_id`、會跟著訊息序列一起被 hash 進 cache key**。

問題在哪?**問題出在「同一段對話可能會被組裝不只一次」**——而每次組裝如果 id 不一樣,前綴 hash 就不一樣,cache 就 miss。舉幾個真實會踩到的情境:

- **跨 provider 翻譯**:Hermes 同一份內部訊息要能餵給 Anthropic、OpenAI、Gemini 三家 API。當上游(例如 OpenAI Responses)沒給 call_id 時,Hermes 得自己補一個。如果現場隨機產生,同一段對話翻譯兩次就會有兩組不同的 id。
- **Session 還原 / replay**:某些路徑會「重放」訊息序列(例如 dev 模式下重跑同一個 turn 看模型有沒有不同回應、或是測試 retry),如果 id 是隨機的,每次 replay 出來的序列都不一樣。
- **序列化來回**:歷史訊息被丟到 SQLite、撈出來、又經過 normalize / re-encode 一次。如果這個過程中有「找不到 id 就補一個」的 fallback path,同一段 tool call 在不同次的組裝下會拿到不同 UUID。

換句話說:**`tool_call_id` 應該是「同一段內容,不管組裝幾次,都長一樣」的東西**。它由內容決定,不由時間決定。

Hermes 怎麼處理?**當上游 API 沒給 call_id 時,Hermes 的 fallback 是用 `hash(函式名 + 參數 + 在這一輪的 index)` 當 id**(見 `agent/codex_responses_adapter.py:143–152` 的 `_deterministic_call_id`,format `call_{sha256(...)[:12]}`)。同樣的 function、同樣的 args、同樣的順序,就會產出同樣的 id。任何一條重建路徑經過,都會生出 byte-identical 的訊息序列。

### JSON key 順序也要正規化

順帶一個更細的點:模型回給你的 tool call 參數是個 JSON object,例如 `{"path": "x", "mode": "r"}`。同樣語意的 args,序列化出來的字串可能是 `{"path":"x","mode":"r"}` 也可能是 `{"mode":"r","path":"x"}`——對 cache 來說那是兩段不同的 bytes,直接 miss。

Anthropic docs 這條**直接點名**了哪些語言會出包([Prompt caching — Best practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)):

> "Verify that the keys in your `tool_use` content blocks have stable ordering as some languages (**for example, Swift, Go**) randomize key order during JSON conversion, **breaking caches**."

Python 3.7+ 的 dict 保留插入順序,看起來沒事——但你跑的序列化 lib(orjson、ujson、stdlib)、上游 client、tool schema validator 都可能洗亂 key 順序。Hermes 統一用 `json.dumps(..., sort_keys=True)` 重序列化,確保 key 順序固定。這個動作不只幫到 Anthropic 的 prefix cache——你本機跑 llama.cpp / vLLM 的 KV cache 命中率也一起改善,因為它們本質上也是「比對 token 序列前綴」。同一個原則打通所有層。

讀到這應該感覺到了:Hermes 不是在 system prompt 那一處檔住 cache,**它是在整條前綴的所有可變點上都檔住**。任何一個地方滲漏——時間戳精確到分、tool_call_id 隨機、JSON key 順序飄移——前綴一變,cache 就掉。這條鐵律不是「加個註解寫『請勿修改』」就完事,它需要在程式碼的**每一條重建路徑上都明文強制**。

---

## Anthropic cache 規則的其他眉角

讀 Anthropic docs 還會撈到三條跟 Hermes 設計**互動很深**的細節,這幾條你大概也踩過,值得攤開來看:

### A. Cache TTL:5 分鐘 vs 1 小時,而且 read 是免費續命

Anthropic 的 prompt cache 有**兩種 TTL**(來源:[Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) 的 *Cache duration* 段落):

> "By default, the cache has a **5-minute** lifetime. The cache is refreshed for no additional cost each time the cached content is used."
> "If you find that 5 minutes is too short, Anthropic also offers a **1-hour cache duration** at additional cost."

語法是 `{"cache_control": {"type": "ephemeral", "ttl": "1h"}}`。價格上:

- **5 分鐘**:寫入 1.25× base、讀取 0.1× base
- **1 小時**:寫入 2.0× base、讀取 0.1× base
- 任何一次 cache read 都會**免費 refresh TTL 計時器**

所以對 Hermes 這種「使用者連續對話」型 session,**預設 5 分鐘就夠了**——只要每幾分鐘有一輪請求,TTL 一直被續命,不用付 1.6× 的溢價去買 1 小時。真正會踩到 1 小時的是「使用者離開超過 5 分鐘才回來繼續」這種斷點,或是 cron job、scheduled agent 這類低頻長 session。

順便提一個 Simon Willison 寫過的觀察:「如果你的 app 每 5 分鐘來不到一次請求,你開 cache 是在虧錢」——因為寫入要 1.25×,冷流量根本沒機會 hit 第二次。

### B. 最小可快取 token 門檻(這條最坑,因為它**靜默失敗**)

不是任何前綴都能 cache。Anthropic 對「值不值得幫你寫 cache」有最小門檻(同樣來自 [Prompt caching 官方文件](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) 的 *Minimum cacheable length* 段落):

> "the minimum cacheable prompt length is:
> - **4,096 tokens** for Claude Opus 4.7 / 4.6 / 4.5
> - **1,024 tokens** for Claude Sonnet 4.6 / 4.5
> - **4,096 tokens** for Claude Haiku 4.5"
> "Shorter prompts cannot be cached, even if marked with `cache_control`. Any requests to cache fewer than this number of tokens will be processed without caching, **and no error is returned**."

注意最後那句——**低於門檻不會報錯**。你 cache_control 鋪得漂漂亮亮,dashboard 上 `cache_creation_input_tokens` 卻一直是 0,而程式邏輯完全沒壞。這就是為什麼 Hermes 不是「每則訊息都掛 cache_control」,而是先確保 stable 區段(identity + tool guidance + skills index)堆起來輕鬆破 4096 tokens 再掛——不然在 Opus 上根本不會建 cache。

### C. 20-block lookback window

Anthropic 找 cache 不是無限往前看(來源:[Prompt caching — How automatic prefix checking works](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)):

> "The lookback window is **20 blocks**. The system checks at most 20 positions per breakpoint, counting the breakpoint itself as the first. If the system finds no matching entry in that window, checking stops."

也就是說從你最後一個 cache_control 標記開始往前**最多回看 20 個 content block**,超過就放棄。這跟 Hermes 的 `system_and_3` 策略有直接互動:把 4 個 marker **集中放在 system + 最後 3 則訊息**,等於「永遠在最近 4 個位置打標」,確保下一輪請求進來時,**20-block window 一定撈得到上一輪剛寫的 cache**。如果你把 marker 散得太前面,長對話一推下去,window 就超出了——你 marker 寫得再勤也撿不回來。

---

## 其他家怎麼做?OpenAI 與 Gemini 的對照

寫到這裡你大概有個疑問:**這套 marker 玩法是只有 Anthropic 這樣搞嗎?** 是,這也是為什麼 Hermes 在這一塊的程式碼大部分是「Anthropic 專屬」邏輯。其他兩家走的路完全不同——值得花一小節釐清,因為這直接影響你後面看 Hermes 怎麼做 provider 抽象(Day 05)。

### OpenAI:**全自動,但「自動」只省了一件事**

OpenAI 的 Prompt Caching 在 2024 年 10 月發佈,設計哲學跟 Anthropic 完全相反:**伺服器自己判斷哪段前綴要 cache,你什麼 marker 都不用標**(來源:[OpenAI — Prompt Caching in the API](https://openai.com/index/api-prompt-caching/))。

幾個關鍵規則,出自上面那篇官方公告:

- **沒有 `cache_control` 這種東西**。API 收到請求後,以前 256 個 token 為基礎做 hash 路由,自動把後續的 prompt 前綴 cache 起來。
- **最少 1024 token 才會啟動 cache**,之後以 128 token 為單位往後延伸命中範圍。短 prompt 不享受 cache。
- **cache hit 折扣是 input 的 50%**——官方公告原文「**50% discount on cached input tokens**」,搭配「**up to 80% latency reduction**」。比 Anthropic 的 90% off 略保守,但門檻零。
- **TTL 大約 5–10 分鐘閒置就會被清掉,off-peak 最多撐到 1 小時**。比 Anthropic 預設 5 分鐘略寬,但你也沒辦法手動延長。

**「全自動」到底是哪裡自動?——這是容易誤解的地方**:

「OpenAI 全自動 = 我什麼都不用管」這句話只對了三分之一。它的意思是:**「marker 該擺哪」這件事,API 幫你決定了**——你不用像 Anthropic 那樣手動鋪 `system_and_3`。

但**「前綴必須逐位元組穩定」這條底層物理規則,對 OpenAI 完全一樣成立**。因為三家(Anthropic / OpenAI / Gemini)底層都是 transformer + KV cache,prefix cache 的本質就是「**同樣的 token 序列才能重用同樣的 attention 計算結果**」。這跟廠商願不願意給你 marker API 沒關係。

所以這篇前面講過的所有 Hermes 不變式,**對 OpenAI 一條都不能少**:

| 不變式 | OpenAI 也要遵守? |
|---|---|
| system prompt session 中途不准動 | ✅ |
| 時間戳只到 DATE,不到 minute | ✅(分鐘級變動 = 前綴變動 = cache miss) |
| 繼續 session 從 DB 還原,不是重建 | ✅ |
| 動態內容走 user message,不進 system | ✅ |
| `tool_call_id` deterministic | ✅(OpenAI 的 `tool_calls[].id` 一樣進前綴) |
| JSON args 用 `sort_keys=True` 正規化 | ✅ |

**唯一可以省略的是 `apply_anthropic_cache_control` 那 79 行**——marker 鋪設的程式碼。但訊息序列要怎麼維持 byte-stable,**程式碼量幾乎沒少**。

驗證方式也對應換一下:Anthropic 在 response 看 `usage.cache_read_input_tokens`,OpenAI 看 `usage.prompt_tokens_details.cached_tokens`。任何一邊看到 0,就是你某條前綴變動了——找出來。

### Gemini:**雙軌制——implicit + explicit**

Gemini 的做法又是另一種風味,2025 年中以後是「**兩種 cache 並存**」:

**Implicit caching**(Gemini 2.5 以上預設啟用,來源:[Google Developers Blog — Gemini 2.5 Models now support implicit caching](https://developers.googleblog.com/en/gemini-2-5-models-now-support-implicit-caching/))

- 跟 OpenAI 一樣是全自動,前綴穩定就 hit,你什麼都不用做。
- 折扣大約 **75%(Gemini 2.0)** 或 **90%(Gemini 2.5+)**——官方公告原文。
- 也是只在 prompt 達到某個最小長度才會啟動(Flash 系列 1,024 token、Pro 系列 4,096 token,來源:[Gemini API — Context caching](https://ai.google.dev/gemini-api/docs/caching))。

**Explicit caching**(用 `cachedContents` API,來源同上 [Gemini API — Context caching](https://ai.google.dev/gemini-api/docs/caching))

- 你**先把要 cache 的內容(例如一整本 PDF、一份大型 codebase、一段 system prompt)透過 API 上傳建立成一個 `cachedContent` 物件**,拿到一個 cache name(類似 resource ID)。
- 之後每次發請求,在 request 裡指向那個 cache name,Gemini 就會把它當成 prompt 開頭塞進去。
- 折扣同樣是 75%(2.0)/ 90%(2.5+),但**你要付一個「存儲費」**:cache 物件存在 Google 那邊期間,以「token-hour」計費。
- TTL 自己設,從幾分鐘到幾小時都行。

**Explicit 的價值在哪?**

- 適合「**這份大型 context 我打算重複用很多次、跨很長時間**」的場景。例如一個 RAG 系統把整本產品文件 cache 起來、24 小時內所有 query 都引用它。
- 對 agent loop 這種「**每一輪都在動態長 messages**」的場景,explicit 反而不太直覺,implicit + 前綴穩定更實用。

**三家對照**:

| 維度 | Anthropic | OpenAI | Gemini |
|---|---|---|---|
| Cache 啟動方式 | **手動標 marker**(`cache_control`,最多 4 個) | 全自動 | Implicit 全自動 + Explicit 手動建 cache 物件 |
| 最小生效長度 | Sonnet 1,024 / Opus & Haiku 4,096 token | 1,024 token | Flash 1,024 / Pro 4,096 token |
| Cache hit 折扣 | base input 的 ~10%(等於省 90%) | 50% off cached input | 75%(2.0)/ 90%(2.5+) |
| 預設 TTL | 5 分鐘(可延長到 1 小時,收建立費) | 5–10 分鐘(off-peak 最長 ~1 小時),不可手動延長 | Implicit 自動;Explicit 由你設定,額外收存儲費 |
| 「前綴 byte-stable」鐵律 | ✅ | ✅ | ✅(implicit);explicit 不適用 |

**結論**:不管哪一家,**「前綴必須逐位元組穩定」這條物理規則都成立**——因為三家底層都是 transformer + KV cache,prefix cache 的本質就是「同樣的 token 序列才能重用同樣的 attention 計算結果」。差別只在「**你能多大程度控制 cache 的劃線位置**」。Anthropic 是「**自己畫線**」,OpenAI 是「**畫線完全交給伺服器**」,Gemini 是「**兩條路你自己選**」。

Hermes 之所以在 `prompt_caching.py` 那邊看起來只服務 Anthropic,正是因為**只有 Anthropic 需要這種顯式 marker 鋪設**。其他兩家走 implicit 的時候,Hermes 那些「前綴穩定」的不變式自動會生效,**不需要額外程式碼**——這也是為什麼那 79 行檔案這麼小。

---

## 小結

整篇講白話就一句:**Hermes 把 prompt cache 當成一條塑造整個架構的鐵律**。

- system prompt session 中途不准動
- 三層 `stable / context / volatile` 按穩定性排序,不穩的擺後面
- 時間戳只到日期,不到分鐘
- 繼續 session 從 DB 還原,不是重建
- 所有會變的東西走 user message,不准進 system
- cache marker 用 `system_and_3` 鋪在尾巴
- 連 tool_call_id 都 deterministic,連 JSON key 都 sort

這幾條規則加起來,才讓「cache hit」這件事在一個跑著跑著就幾十輪的 agent session 裡真的成立。少任何一條,marker 都是廢的。

但接下來的問題是:**context 一直長,長到塞不下怎麼辦?如果 system prompt 不能動,那能動的是什麼?** 明天答案揭曉——你會看到那個「**唯一被允許的中途變動**」是怎麼設計的。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `agent/prompt_caching.py` | `apply_anthropic_cache_control` 把 4 個 cache_control breakpoint 鋪在 system + 最後 3 則訊息 |
| `agent/system_prompt.py` | `build_system_prompt` / `_build_system_prompt_layers`,三層 stable/context/volatile 組裝,只建一次快在 `_cached_system_prompt` |
| `agent/system_prompt.py` line 265–271 附近 | 時間戳只到 DATE 的那段註解,有 PR #20451 出處 |

從 `build_system_prompt()` 進入,留意它的 docstring 寫「only rebuilt after context compression events」——這就是 Day 04 要拆的那條例外。
