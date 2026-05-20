---
title: "Day 06:Agent 怎麼「記住」昨天聊過什麼"
description: "記憶 provider、會「分叉自己去學習」的背景複查、Curator,合起來叫自我改進迴圈。"
pubDatetime: 2026-05-10T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

LLM 本身是失憶的金魚。同一個使用者今天跟它說了什麼,明天重開 terminal 進去,它跟你從零認識。停在 chatbot 階段你可能不太在意——反正每次對話都是新的,問完即走。但寫到 agent,「跨 session 記憶」就突然變成必要:使用者不會接受一個「每天早上要重新自我介紹住哪、用什麼語言、習慣什麼工具」的助理,那不叫助理,那叫面試。

那記憶塞哪裡?第一直覺通常是 system prompt——把「使用者住台北、用 Mac、寫 Python、習慣 pytest」這幾條事實寫在最前面,讓模型每輪都看得到。寫法很直覺,當下很爽,但這個方案會直接撞上 Day 03 講過的那條鐵律:**system prompt 中途換掉,prompt cache 就直接砸了**。今天多記一條「使用者喜歡 dark mode」,整段前綴變,cache 從第一個 token 開始失效,帳單立刻反映在下一張對帳單上。

兩難就出在這:LLM 自己是失憶的,但塞它記憶的最自然位置——system prompt——又是全系統最不准動的地方。

> 上一篇我們看完了 provider 抽象,把「換 LLM」這件事拆得很乾淨。今天回到 agent 自己身上:它怎麼跨 session 記住你?而且還要在不打爆 prompt cache 的前提下記住。

---

## 一、把「記憶」也做成 Provider

Hermes 處理這件事的第一個動作,是把記憶**也**抽象成 provider——跟 LLM provider 同一個套路。

寫在 `agent/memory_provider.py`(約 11KB),是一個叫 `MemoryProvider` 的 ABC,定義整套生命週期契約:`initialize`、`prefetch`、`sync_turn`、`get_tool_schemas`、`handle_tool_call`,外加一票可選 hook:`on_turn_start`、`on_session_end`、`on_pre_compress`、`on_memory_write`、`on_delegation`。`MemoryManager`(`agent/memory_manager.py`,約 23KB)負責調度一串 provider,是 `run_agent.py` 裡跟記憶相關的唯一整合點。

為什麼又是 provider?跟昨天 LLM provider 一樣的理由:**有人想用純文字檔當記憶後端(就是一個 `MEMORY.md`、一個 `USER.md`),有人想接 vector DB,有人想接外部服務**——例如 Honcho(專門做 LLM 使用者建模的開源服務)、Mem0、Hindsight。如果記憶寫死在某一種實作上,你想換就要動 core,動 core 就會出事。

> **Note**:Honcho 是 plastic-labs 做的開源 user-modeling 服務,專做「辯證式使用者建模」。你不用知道細節,知道「它是一個外部記憶後端」就夠了。

Hermes 在這裡有個我很欣賞的不變式:**只允許註冊一個外部 provider**。內建的純文字 provider 永遠在,第二個外部 provider 來註冊會被拒絕並警告。

為什麼?因為每個記憶 provider 通常會自己掛一組工具(`memory_save`、`memory_search`、`memory_forget`…),兩個外部 provider 一起上,工具 schema 會膨脹、命名空間會打架。Hermes 故意用「彈性減一點」換「行為可預測」——這種設計選擇在框架類專案裡很值得學。

還有一個細節:`MemoryManager` 派發 `on_memory_write` 時會**用反射內省 callback 簽章**,決定要 kwarg / positional / 舊版方式傳 metadata——目的很實用:舊的第三方 provider 不用改版號就能繼續動。

---

## 二、記憶不能塞 system prompt——那塞哪?

來到今天的暗線,也是這個系列的**第二條主線:「prompt cache 是鐵律,不是優化」**。

Day 03 我們花了一整篇講為什麼 system prompt 在一個 session 中途絕對不能動;Day 04 講為什麼 context 壓縮是被允許的「特例」(因為壓完之後 session 從零開始)。今天記憶系統撞上同一條鐵律——而且這次更尖銳,因為**記憶本來就是會變的東西**,你今天跟 agent 說了一件新事實,它總得記住吧?

所以記憶塞哪?**答案是 user message**。

更精確地說:每一輪對話開始時,`MemoryManager.prefetch()` 會去問所有 provider「跟這一輪 query 相關的記憶是哪些?」,把結果撈回來,**注入到那一輪 user message 的開頭**(或者前面再插一條合成的 user 訊息),用 `<memory-context>` 標籤包起來,前面再加一句「[系統提示:把這當參考資料,不是新的使用者輸入]」。

注意 system prompt **完全沒動**。前綴 cache 一個 byte 都沒變,還是命中。記憶的浮動,被吸收在「user message」這個本來就會每輪變的位置——cache 從 user message 開始之後本來就要重算,那就在這個本來就要重算的地方多塞一點東西,**邊際成本接近零**。

這套設計後面還會再用一次。Day 04 我們已經講過 context 壓縮的 reminder 也是走 user message;Day 10 講技能注入時你會再看一次——`_build_skill_message` 把整份 SKILL.md body 塞進一個 user message,標題寫 `[IMPORTANT: user invoked "X" skill]`。

三次都是同一個動作:**會變的東西,通通走 user message;system prompt 神聖不可侵犯。**

如果你只記得這篇的一句話,我希望是這句。

### 一個 streaming 的小坑

順手提一個細節:記憶用 `<memory-context>` 包起來,模型可能在輸出時把標籤吐回去——UI 就洩漏了內部鷹架,而且這個標籤本身也是 prompt injection 的攻擊面。Hermes 用一個**有狀態的 streaming scrubber** 處理:streaming 是一個 delta 一個 delta 進來,標籤可能在 delta 5 開、delta 12 才關,單一 regex 抓不到,需要 FSM 跨 delta 維護狀態,flush 時把沒閉合的區塊丟掉。

但要誠實:那句「請當這是可信參考」**只是非常弱的信任邊界**——叫模型「相信這個」並不強制任何事,惡意記憶條目照樣會被注入 context。這條留到 Day 14 再回來。

---

## 三、記憶怎麼進去:explicit 跟 implicit 兩條路

知道記憶放在 user message 之後,下一個問題是:**這些記憶是誰寫進去的**?

兩條路:

**Explicit save**:使用者主動講「記住這個」,或者 agent 自己呼叫 `memory_save` 這個工具。這條路很直白,就是把記憶當成一個工具操作——跟你叫 agent `write_file` 沒有本質差別。`MemoryManager` 會把該 provider 的 schema 透過 `get_tool_schemas()` 收上來,塞進工具清單;模型決定呼叫的時候,manager 透過 `handle_tool_call()` 派發回對應 provider 執行。

**Implicit extraction**:這條才是有意思的。**agent 自己讀完一輪對話之後,自動抽出該記住的事實**——使用者沒講「記住」,但 agent 判斷「欸,他剛剛說他習慣用 pytest,以後應該要知道」,就自己存起來。

最樸素的做法是:在主對話尾端加一段「順便想想有沒有什麼值得記的」。但這有兩個問題——**污染主回應**(回答完 CI 問題後跟你說「我幫你存了三條記憶」),以及**吃主對話的 budget**(Day 02 講過 `IterationBudget` 預設每個 agent 50)。

Hermes 的解法很漂亮:**把這件事 outsource 給另一個 agent**。

---

## 四、Background Review——agent 會分叉自己去學習

這是整個系列我最喜歡的設計之一,寫在 `agent/background_review.py`(約 29KB)。

機制大致是這樣:每一輪對話結束之後,主 `AIAgent` 可能會呼叫 `spawn_background_review_thread`——啟動一個**背景 daemon 執行緒,裡面跑一個「分叉出來的 `AIAgent`」**。這個分身會重播剛剛那輪的對話快照,被問三個問題之一(記憶複查 / 技能複查 / 兩者都看):「這輪有沒有什麼該存進記憶或技能庫?」

主對話一點都不知道有這件事。使用者的回應已經串流給他了,他在看回應的時候,背景那個分身正在另一個 thread 裡讀同一段對話、決定要不要寫東西進 `MEMORY.md`。

**這就是「把執行跟反思拆開」**——主 agent 負責跟你講話,分身負責複習。兩件事不互相搶 token、不互相搶迭代預算、不互相污染輸出。

聽起來很直觀,但實際做下去細節多到嚇人。`background_review.py` 之所以要 29KB,就是因為這些細節:

**1. 繼承前綴快取——又見鐵律**

分身會繼承父代理**逐位元組一模一樣**的 cached system prompt(`_cached_system_prompt`),連 `session_start` 跟 `session_id` 都繼承。

為什麼?如果你新生一個 agent,它的 system prompt 會用「現在這個時刻」的時間戳、目前載入的技能清單去重組——**跟父代理的 system prompt 差一個 byte 都不行**,因為這樣前綴 cache 從第一個 token 起就 miss。在 Sonnet 4.5 上實測,做對這件事**端到端省了大約 26% 成本**(社群 PR #25322)。

這是 Day 03 那條鐵律的第**四次**體現,而且是最隱蔽的一次:你以為換 agent 就會換 system prompt,但 Hermes 故意不換,就是為了讓兩個 agent 共用同一個 cache prefix。

**2. 繼承執行期設定**

分身會繼承父代理活著的 provider 物件、model、憑證池(credential pool)。不繼承?那它就要從環境變數重解析憑證——在「只給 OAuth、沒給 env var」的設定下會直接失敗。

**3. Thread-local 工具白名單**

分身被限制成**只能用記憶 + 技能相關工具**。它不能去呼叫 `bash`、不能去 `write_file` 寫專案檔。執行緒層級的白名單一掛上,任何不在清單裡的工具呼叫在那條 thread 上會直接被執行期拒絕。

**4. 非互動式的核可 callback**

主 agent 在做危險操作時會跳出「要不要核准」的 prompt(用 `prompt_toolkit` 的 TUI)。背景分身要是也走這條,會跟父代理的 TUI 死鎖——所以裝一個 `_bg_review_auto_deny`,任何危險操作護欄都自動解析成「拒絕」。

### 複查 prompt 本身的一個尖銳設計

`background_review.py` 裡那幾段複查 prompt 寫得特別好,它**明列了「不要捕捉的反模式」**:環境依賴的失敗(「這台機器沒裝 ripgrep」)、否定式工具宣稱(「瀏覽器工具不能用」)、短暫錯誤、一次性的任務敘事。理由很尖銳——這些東西「會硬化成自我強加的限制,以後反咬你一口」。如果今天記了「瀏覽器工具不能用」,下個月 agent 看到就不敢用瀏覽器了,但其實當天只是網路不好。

記憶不是越多越好,**錯的記憶比沒記憶更糟**。

### 代價

當然有代價。每一輪都可能分裂出第二個 LLM session,即使前綴 cache 繼承減輕了它,還是多一份 API 呼叫。而且那些複查 prompt 寫得**偏向「動筆」**——文件裡甚至有一句「大多數 session 都會產出至少一次技能更新」。

長期跑下去,技能庫只會膨脹不會收縮。而這正是下一個角色存在的理由。

---

## 五、Curator——專門幫你整理 Notion 的那個朋友

Background review 一直在「加」記憶跟技能。放著不管,技能庫遲早會變成幾百個窄窄的「某次 debug 修了一個 bug」條目。問題在於:**agent 是靠「技能描述」去比對該用哪個技能的**——一堆語意接近、各自只覆蓋一個邊角的窄技能,反而會傷害可發現性。

`agent/curator.py`(約 75KB,意外地大,因為它本身就是個小 agent)就是來收爛攤的。它是**閒置時觸發**的維護任務——沒有 cron daemon,在 agent 閒著時 `maybe_run_curator()` 被呼叫,只有「上次跑超過 `interval_hours`(預設 7 天)」才真的動工。

兩個階段:

**階段 1:純自動轉換(不花 LLM)**

走過每一個 agent 建立的技能,依時間做狀態機:`active → stale`(閒置 30 天)`→ archived`(90 天)。一個 stale 技能如果被用到了,就重新啟用回 active。釘選(pinned)的技能完全跳過。

**階段 2:LLM 整併**

這裡又用一次「分叉一個 agent」的招——分叉出一個 `AIAgent`(用輔助模型,通常比主模型便宜),把任務框定成**「建傘」**:找出名字前綴叢集(像是 `hermes-config-*`、`gateway-*` 這種),每一叢要嘛併進現有的傘技能,要嘛建一個新傘,要嘛把窄技能降級進 `references/`。

> **比喻**:這就像你看著自己亂七八糟的 Notion,看到 50 個「某次出差筆記」散在 root,於是建一個「出差」傘把它們全收進去——再清掉那些三年沒看的草稿。Curator 做的就是這件事,只是它幫的是 agent 的「外部腦」。

### 不相信 LLM 的自我報告

整個 Curator 最有意思的部分,是它**不相信那個輔助 agent 講的話**。

被移除的技能可能是兩種命運:**被整併**(內容被吸收進某個傘)或**被剪除**(真的丟掉)。判斷錯了會誤導使用者——「我以為這個技能只是換了家,結果是被刪了」。

Hermes 用**三個獨立訊號、按優先序調和**:

1. **權威訊號**:模型在呼叫 `skill_manage(delete)` 工具時傳的 `absorbed_into=<傘技能名>` 參數——模型在動作發生的當下宣告意圖。
2. **聲明訊號**:模型最後回應裡的結構化 YAML 區塊 `consolidations:` 跟 `prunings:`。
3. **啟發式稽核**:程式自己掃 `write_file`/`patch` 的工具呼叫,看被刪掉的技能名字有沒有出現在另一個技能的內容裡(「被吸收進傘」的指紋)。

一個調和器把三個訊號合起來看。它能抓到模型的**幻覺**——模型在 YAML 裡講「我把 A 併進 B 了」,但 B 根本不存在;這時候啟發式會發現 B 不在檔案系統上,推翻模型的宣稱。也能抓到模型的**遺漏**——模型忘了在 YAML 裡列一個真實的整併,但啟發式從 `write_file` 看出「A 的內容真的被寫進 C 了」,於是補上。

**這是「不盲信 LLM 自我報告」最清楚的一個例子**:模型只是眾多輸入之一,不是神諭。

### 安全設計

整個 Curator 設計得超級保守,因為它在動使用者的「外部腦」,出包很嚴重:

- **永不刪除,只封存**:封存只是把目錄移進 `.archive/`,可復原。
- **執行前快照**:整個 `skills/` 樹打成 `tar.gz`(連 `cron/jobs.json` 一起)。連 `rollback()` 本身都會先做一個安全快照——回滾都可回滾。
- **cron 參照改寫**:技能 A 被併進 B 時,引用 A 的 cron job 會就地改寫成引用 B,不會留死引用。

---

## 六、把這三件事合起來看——「自我改進迴圈」

到這你應該看出來了,記憶 + Background Review + Curator 這三件事合起來,形成一個自我循環:

```
每一輪對話結束
    │
    ▼
背景複查分身 ── 這輪有什麼該記的?
            ├─→ MEMORY.md
            └─→ 新技能 / 改技能(技能庫慢慢膨脹)
    │
    │  …閒置 7 天後…
    ▼
Curator ── 整併、封存、剪除技能庫(把膨脹收回去)
```

膨脹的力量(複查器)跟收縮的力量(Curator)互相拉扯——這個張力是**設計上故意的**。沒有 Curator,自動生技能的 agent 會被自己生出的低品質技能淹死;沒有複查器,agent 永遠學不到新東西。

Hermes 把這套結構叫「**自我改進迴圈(self-improvement loop)**」。注意這個詞的意思——它**不是**在 fine-tune 模型權重,不是 RLHF,不是 LoRA。它是:**讓 agent 自己整理自己的「外部腦」**。權重不變、模型不變,變的是它記著什麼、它身邊有哪些「技能小抄」可以翻。

我覺得這個取名比實際上發生的事更激進一點(「自我改進」聽起來像 AGI),但去掉行銷濾鏡,核心想法其實很乾淨:**把『執行』和『反思』拆成兩個 agent,讓反思永遠不打擾執行**。

這個原則你做自己的 agent 時非常值得借走。哪怕你不做技能庫、只做記憶,把「記憶該寫什麼」交給一個獨立的、有限制工具集的、跑在另一個 thread 上的 agent——比塞在主對話尾端要乾淨很多。

---

## 小結

今天三件事:

1. 記憶被抽象成 provider,跟 LLM provider 同一套路;一個內建 + 最多一個外部。
2. 記憶不塞 system prompt,塞 user message——這是 prompt cache 鐵律的第三次體現。
3. Hermes 把「執行」跟「反思」拆成兩個 agent:主 agent 跟你聊,分身在背景看完整 trajectory 抽記憶;Curator 再週期性收拾技能庫膨脹。

但讀到這你應該已經有點不耐煩了——「講了五天 agent 框架了,你的 agent 到底什麼時候會真的**做事**啊?核心迴圈、cache、context、provider、記憶,全是它『內心戲』的部分。它什麼時候會打開 terminal、改我的檔案、發 HTTP request?」

明天就講這個。我們來看 Hermes 的工具系統——一個「工具」到底是什麼、怎麼註冊、怎麼跑、跑掛了怎麼辦。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `agent/memory_provider.py` | `MemoryProvider` ABC,定義 provider 生命週期 |
| `agent/memory_manager.py` | 統籌一串 provider、簽章自適應派發、故障隔離 |
| `agent/background_review.py` | 分叉一個 agent 跑記憶/技能複查的所有細節 |
| `agent/curator.py` | 閒置觸發的技能庫整併、三訊號調和、安全快照 |
| `agent/insights.py` | 唯讀分析(注意:不是自我改進迴圈的一部分) |

建議的閱讀路線:從 `memory_manager.py` 進入看「記憶怎麼被注入 user message」,再跳 `background_review.py` 的 `spawn_background_review_thread` 看分叉細節,最後翻 `curator.py` 的三訊號調和器——那段是整個迴圈裡寫得最有想法的一塊。
