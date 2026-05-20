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

這不是我寫文章的修辭,Anthropic docs 自己就明文這樣寫:

> "Exact matching: Cache hits require **100% identical** prompt segments, including all text and images up to and including the block marked with cache control."
> "Marking a block with `cache_control` writes exactly one cache entry: **a hash of the prefix ending at that block**."

換句話說,後端比的不是字串相似度、不是 embedding,是 **hash**。差一個 byte,hash 就完全不同,等於 cache miss——這就是為什麼後面 Hermes 為了 prefix 穩定要做到那麼偏執。

> **Note**:這裡的「10%」是 Anthropic 官方公告的大致比例,實務上會因模型、TTL(5 分鐘 vs 1 小時)、快取建立成本而略有不同。重點抓「**hit 跟 miss 之間是一個量級的價差**」這個感覺就好,不用記死數字。

我喜歡的比喻是這樣:prompt cache 像便利商店的熟客折扣,但折扣**認的不是你的臉**——它認的是「你拿出會員卡、刷條碼、按確認」這整套動作的**順序跟內容**一字不差。你今天比較開心,順序顛倒了一下,或者在中間多哈了一聲,折扣就沒了。

對 chat completion 來說,這條規則沒什麼。你一次性把 messages 丟過去、拿回答、結束,反正只送一次。但對 agent 就完全不是這麼回事了——agent 是「**同一個 session 裡會送幾十次、上百次幾乎一樣的 prompt**」的工作型態,每一輪只在訊息列表尾巴多加幾則訊息。如果前面那一大坨 system prompt + 早期對話可以一路 cache 下去,你每輪只付「尾巴那一小段新訊息」的全價,長對話的成本可以壓到原本的零頭。

但前提是——**前綴必須真的沒變**。一個字都不能動。

這就是我那個自以為聰明的 side project 出包的原因。我每次切模式都在動 system prompt 中段那幾百個字——等於每一輪都跟模型大喊一聲「我不要折扣」。

---

## Hermes 的對應做法:system prompt 在 session 中途絕不能變

打開 `agent/system_prompt.py`,你會看到一個很明顯的設計姿態。`build_system_prompt()` 的 docstring 明白寫著:

> Called once per session (cached on `agent._cached_system_prompt`) and only rebuilt after context compression events.

翻成人話:**整個 session 從頭到尾,system prompt 只建一次**。建完之後存在 `agent._cached_system_prompt` 裡,後面每一輪直接逐字重播同一份。唯一被允許重建它的時機是「context 壓縮」(這個 Day 04 會講,你可以先記住它是個例外)。

這聽起來很沒彈性,對吧?「**那如果中途使用者切到新模式怎麼辦?**」、「**如果 agent 學到新的記憶怎麼辦?**」——這些問題我們等等會處理。先記住這條鐵律:**session 中途,system prompt 不准動**。

這就是這個系列的**第二條暗線**:**prompt cache 是鐵律,不是事後優化**。接下來幾天你會看到所有設計都繞著這條轉——壓縮為什麼要切 session 邊界、記憶為什麼不能塞 system prompt、技能為什麼從 user message 注入——全都是同一條鐵律的延伸。

而且這條鐵律不只是「我這樣覺得」,Anthropic docs 自己就把這件事寫成**層級依賴**:

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

這個排序看起來很瑣碎,但少了它,前面那條鐵律省不到錢。

---

## 神來一筆:時間戳只到 DATE,不到 minute

這是我第一次讀 Hermes 程式碼覺得「**蛤?**」、然後馬上「**喔幹聰明**」的地方。

很多 agent 的 system prompt 會放一行時間戳,告訴模型「現在是幾年幾月幾日幾點幾分」。聽起來很合理對吧,模型應該知道現在幾點啊。

但你想一下:**如果時間戳精確到分鐘,代表 system prompt 每分鐘都會變一次**。每變一次,後面整段 cache 直接失效。一個 agent session 跑半小時,你可能每隔幾分鐘就重建一次 system prompt,等於把整套 prefix cache 砸到地上,**而你還完全沒意識到**——因為功能上「沒壞」,只有錢包知道。

這個坑不用我講,Anthropic docs 的 *Common mistakes* 章節**直接拿 timestamp 當反例**:

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

註解裡留了個來源 `PR #20451`,你有興趣可以去翻。這種「**一行 code 背後是一張燒了的帳單**」的細節,在 Hermes 裡到處都是。讀的時候很容易滑過去,但每一個都是某個團隊真的踩過坑才寫上的。

---

## 繼續 session 時,prompt 是「還原」不是「重建」

再一個容易踩的坑。Agent session 通常會存進 SQLite,使用者明天回來繼續聊,系統要把舊 session 載回來。

天真的寫法:**重建** system prompt——重新跑一次 `build_system_prompt(agent)`,反正函式都還在嘛。

問題是:**你跑這個函式的此刻,跟原本建這個 prompt 的彼時,中間發生過事情**。模型可能在 session 過程中編輯了自己的記憶(`USER.md` 改過、外部記憶新增條目),如果你「重建」,那層 `volatile` 會把這些新東西吃進去——產出**一份跟原本不一樣的 system prompt**,後面整段 cache 直接 miss。

Hermes 的做法是「**從 session DB 還原**」——把當初存的那份 system prompt 字串撈出來,逐字重播,而不是重跑組裝函式。雖然這代表「記憶被改過但 system prompt 還是舊的」,但這正是要的:**那份 prompt 必須跟產生它的那一刻完全一致**,才能繼續用 cache。

要讓模型看到新記憶?**塞到 user message 裡**(下一節講)。

---

## 那動態的東西怎麼辦?全部走 user message

回到開頭那個問題:**如果 system prompt 不能動,那會變的東西要塞哪裡?**

答案是:**user message**。

- 技能 context(plugin context)→ 塞 user message
- 記憶回憶(memory recall)→ 塞 user message
- @-reference 展開的檔案內容 → 塞 user message
- 中途要給 agent 的提醒 → 塞 user message(或當成新一則訊息)

這條規則簡單到不像有什麼學問,但它就是 Hermes 整套架構的脊椎。**system prompt 是「跨輪不變」的軌道,user message 是「會變」的軌道**。任何會變的東西都被趕到第二條軌道上。

這個你在 Day 04(壓縮)、Day 06(記憶)、Day 10(技能注入)會反覆看到同一條鐵律——換不同的場景、解不同的問題,但最後都繞回「**不要動 system prompt**」這條紅線。

開頭那個「動態 system reminder」的想法,正確的做法不是改 system,而是**在輪到 agent 出手前,先塞一則 user message 進去**:「請接下來以 X 模式回答」。功能一樣,但前綴沒動,cache 還在。

---

## Cache marker 怎麼擺:system_and_3 layout

光有「前綴穩定」這個不變式還不夠,你還得告訴 Anthropic「**幫我把這幾個位置存進 cache**」。這就是 `cache_control` breakpoint。

Anthropic 的限制:**一個請求最多 4 個 cache_control breakpoint**。官方原文:

> "**You can define up to 4 cache breakpoints if you want to cache different sections that change at different frequencies.**"
> "If 4 explicit block-level breakpoints already exist, **the API returns a 400 error**."

也就是說超量是 fail-loud 的——你哪天看到 400 回來,先檢查 cache_control 是不是貼太多了。Hermes 怎麼用這 4 個額度?

打開 `agent/prompt_caching.py`,只有 79 行,函式名字就叫 `apply_anthropic_cache_control`。策略它自稱 **`system_and_3`**:

- 第 1 個 breakpoint 放 system prompt 尾端
- 剩下 3 個放**最後 3 則非系統訊息**的尾端

為什麼 marker 要放在「最後幾則訊息」而不只是 system prompt?因為 cache 認的是「**到這個 marker 為止的前綴**」。把 marker 放在尾巴,意思是「每一輪請求都能重用『到上一輪最後一則訊息為止』的前綴」——這比只快取到 system prompt 那邊深很多,長對話越省越多。

具體實作裡有些細節值得注意:tool message 在 native Anthropic 格式下能直接掛 `cache_control`,字串 content 要先包成 `[{"type":"text", "text":..., "cache_control":...}]`,list content 則是把 marker 掛到最後一個元素。這種「**根據格式變形,但語意一致**」的處理就是 Hermes 在做 provider 抽象時的味道,Day 05 會更明顯看到。

---

## 連 tool call ID 都要 deterministic

最後一個你大概沒想過的細節。

當模型呼叫一個工具,訊息裡會有個 `tool_call_id`,後面 tool result 訊息要用同一個 id 對應回去。最直覺的寫法是:**生一個 random UUID**。簡單、不會撞、人人都這樣寫。

但你想一下:**random UUID 代表每次重跑同一個 agent loop 拿到的訊息序列都不一樣**。哪怕模型輸出一模一樣、工具參數一模一樣,tool_call_id 不同——前綴**逐位元組**比較就會 miss。你的 cache 一輩子都重建,永遠在花全價。

Hermes 怎麼處理?**當上游 API 沒給 call_id 時,Hermes 的 fallback 是用 `hash(函式名 + 參數 + 在這一輪的 index)` 當 id**(見 `agent/codex_responses_adapter.py:143–152` 的 `_deterministic_call_id`,format `call_{sha256(...)[:12]}`)。同樣的 function、同樣的 args、同樣的順序,就會產出同樣的 id。前綴穩了,cache 才能命中。

順帶提一下,工具呼叫的參數也會用 `json.dumps(..., sort_keys=True)` 重新序列化——JSON 物件的 key 順序在不同實作下可能不一樣,逐位元組正規化才能確保 cache hit。Anthropic docs 這條**直接點名**了哪些語言會出包:

> "Verify that the keys in your `tool_use` content blocks have stable ordering as some languages (**for example, Swift, Go**) randomize key order during JSON conversion, **breaking caches**."

Python 3.7+ 的 dict 保留插入順序,看起來沒事——但你跑的序列化 lib(orjson、ujson、stdlib)、上游 client、tool schema validator 都可能洗亂 key 順序。Hermes 對所有 provider 都做 byte-canonicalization,就是要連這種跨語言、跨 lib 的隱形洗牌也一起擋掉。這個動作不只幫到 Anthropic 的 prefix cache——你本機跑 llama.cpp / vLLM 的 KV cache 命中率也一起改善。**同一個原則打通所有層**。

讀到這你應該開始感覺到了:Hermes 不是在 system prompt 那一處檔住 cache,**它是在整條前綴的所有可變點上都檔住**。任何一個地方滲漏,前綴一變,cache 就掉。所以這條鐵律不是「加個註解寫『請勿修改』」就完事,它需要在程式碼的**每一條重建路徑上都明文強制**。

---

## Anthropic cache 規則的其他眉角

讀 Anthropic docs 還會撈到三條跟 Hermes 設計**互動很深**的細節,這幾條你大概也踩過,值得攤開來看:

### A. Cache TTL:5 分鐘 vs 1 小時,而且 read 是免費續命

Anthropic 的 prompt cache 有**兩種 TTL**:

> "By default, the cache has a **5-minute** lifetime. The cache is refreshed for no additional cost each time the cached content is used."
> "If you find that 5 minutes is too short, Anthropic also offers a **1-hour cache duration** at additional cost."

語法是 `{"cache_control": {"type": "ephemeral", "ttl": "1h"}}`。價格上:

- **5 分鐘**:寫入 1.25× base、讀取 0.1× base
- **1 小時**:寫入 2.0× base、讀取 0.1× base
- 任何一次 cache read 都會**免費 refresh TTL 計時器**

所以對 Hermes 這種「使用者連續對話」型 session,**預設 5 分鐘就夠了**——只要每幾分鐘有一輪請求,TTL 一直被續命,不用付 1.6× 的溢價去買 1 小時。真正會踩到 1 小時的是「使用者離開超過 5 分鐘才回來繼續」這種斷點,或是 cron job、scheduled agent 這類低頻長 session。

順便提一個 Simon Willison 寫過的觀察:「如果你的 app 每 5 分鐘來不到一次請求,你開 cache 是在虧錢」——因為寫入要 1.25×,冷流量根本沒機會 hit 第二次。

### B. 最小可快取 token 門檻(這條最坑,因為它**靜默失敗**)

不是任何前綴都能 cache。Anthropic 對「值不值得幫你寫 cache」有最小門檻:

> "the minimum cacheable prompt length is:
> - **4,096 tokens** for Claude Opus 4.7 / 4.6 / 4.5
> - **1,024 tokens** for Claude Sonnet 4.6 / 4.5
> - **4,096 tokens** for Claude Haiku 4.5"
> "Shorter prompts cannot be cached, even if marked with `cache_control`. Any requests to cache fewer than this number of tokens will be processed without caching, **and no error is returned**."

注意最後那句——**低於門檻不會報錯**。你 cache_control 鋪得漂漂亮亮,dashboard 上 `cache_creation_input_tokens` 卻一直是 0,而程式邏輯完全沒壞。這就是為什麼 Hermes 不是「每則訊息都掛 cache_control」,而是先確保 stable 區段(identity + tool guidance + skills index)堆起來輕鬆破 4096 tokens 再掛——不然在 Opus 上根本不會建 cache。

### C. 20-block lookback window

Anthropic 找 cache 不是無限往前看:

> "The lookback window is **20 blocks**. The system checks at most 20 positions per breakpoint, counting the breakpoint itself as the first. If the system finds no matching entry in that window, checking stops."

也就是說從你最後一個 cache_control 標記開始往前**最多回看 20 個 content block**,超過就放棄。這跟 Hermes 的 `system_and_3` 策略有直接互動:把 4 個 marker **集中放在 system + 最後 3 則訊息**,等於「永遠在最近 4 個位置打標」,確保下一輪請求進來時,**20-block window 一定撈得到上一輪剛寫的 cache**。如果你把 marker 散得太前面,長對話一推下去,window 就超出了——你 marker 寫得再勤也撿不回來。

---

## 小結

整篇講白話就一句:**Hermes 把 prompt cache 當成一條塑造整個架構的鐵律,不是事後才加的小優化**。

- system prompt session 中途不准動
- 三層 `stable / context / volatile` 按穩定性排序,不穩的擺後面
- 時間戳只到日期,不到分鐘
- 繼續 session 從 DB 還原,不是重建
- 所有會變的東西走 user message,不准進 system
- cache marker 用 `system_and_3` 鋪在尾巴
- 連 tool_call_id 都 deterministic,連 JSON key 都 sort

這幾條規則加起來,才讓「cache hit」這件事在一個跑著跑著就幾十輪的 agent session 裡真的成立。少任何一條,marker 都是廢的。

但講到這你心裡馬上會冒出一個問題:**context 一直長,長到塞不下怎麼辦?如果 system prompt 不能動,那能動的是什麼?** 明天答案揭曉——而且你會看到那個「**唯一被允許的中途變動**」是怎麼設計的。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `agent/prompt_caching.py` | `apply_anthropic_cache_control` 把 4 個 cache_control breakpoint 鋪在 system + 最後 3 則訊息 |
| `agent/system_prompt.py` | `build_system_prompt` / `_build_system_prompt_layers`,三層 stable/context/volatile 組裝,只建一次快在 `_cached_system_prompt` |
| `agent/system_prompt.py` line 265–271 附近 | 時間戳只到 DATE 的那段註解,有 PR #20451 出處 |

從 `build_system_prompt()` 進入,留意它的 docstring 寫「only rebuilt after context compression events」——這就是 Day 04 要拆的那條例外。
