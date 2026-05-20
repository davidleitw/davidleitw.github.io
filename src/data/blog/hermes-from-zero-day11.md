---
title: "Day 11:多個 agent 怎麼合作不打架"
description: "委派是 context 防火牆,不是分工;Kanban 用 SQLite 蓋的多 agent 協作核心。"
pubDatetime: 2026-05-15T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

在 `hermes_cli/kanban_db.py` line 2112 看到這段 SQL:

```sql
UPDATE tasks
   SET status        = 'running',
       claim_lock    = ?,
       claim_expires = ?,
       started_at    = COALESCE(started_at, ?)
 WHERE id            = ?
   AND status        = 'ready'
   AND claim_lock    IS NULL
```

這段是 multi-agent 協作的核心——atomic compare-and-swap 在 SQLite 上做 task claim,確保兩個 agent 不會搶同一個任務。`VALID_STATUSES`(line 97)定義了 9 種狀態:`triage / todo / scheduled / ready / running / blocked / review / done / archived`。整個 Kanban 系統就跑在這張表上。

我看到這段第一個反應是「**為什麼是 SQLite 不是 Redis / Postgres**?」——答案在 `kanban_db.py` 的 default:`DEFAULT_CLAIM_TTL_SECONDS = 15 * 60`、`HERMES_KANBAN_CLAIM_TTL_SECONDS` 環境變數,加上 WAL 模式。**因為 Hermes 是「能跑在你筆電上」的設計**,不希望使用者為了 multi-agent 還要架 broker。今天這篇拆委派、context 防火牆、Kanban CAS、為什麼選 SQLite。

## 一、委派的本質不是「叫人幫忙」,是「砌一道防火牆」

先把直覺翻過來。

你聽到「subagent delegation」這個詞,腦中浮現的可能是「父 agent 把任務交給子 agent,子 agent 完成後回報」。這個敘述沒錯,但**它把最重要的事情擺在最後**。

委派真正的價值不是「分工」,**是 context 隔離**。

回想開場那個情境:Reviewer 跟 Coder 共用 message history,結果兩邊互相污染。那個錯誤的根源是——**他們看得到對方的中間過程**。Reviewer 看到 Coder 每次 tool call 的 retry、每次自我修正、每次內部碎念,Coder 也是。LLM 最怕的就是 context 裡面塞滿無關雜訊,因為它沒辦法區分「這是我自己想的」vs「這是別人的草稿」。

Hermes 的 `delegate_task` 工具的做法剛好相反:**父 agent 呼叫 `delegate_task`,系統生出一個全新的 `AIAgent` 實例,新到連對話歷史都是空的**。子 agent 自己有一份獨立的 trajectory(就是它自己的 messages array),自己的 terminal session、自己的快取。父 agent 在它跑的時候**完全阻塞**,看不到子 agent 的任何中間步驟。子 agent 跑完,**只有「最終摘要」一行字會塞回父 agent 的 context**。

換句話說,委派把一段可能很吵、很長、很容易出錯的中間推理過程,**用一道防火牆隔開**,父 agent 那邊只看到「結果」。

> **Note**:「context 防火牆」這個比喻是我自己取的——Anthropic 官方在「Building Effective Agents」用的詞是「**preserve context**」「**isolate context**」「**fresh conversation**」([連結](https://www.anthropic.com/research/building-effective-agents)),概念跟我說的「防火牆」一致,但官方沒用這個比喻。我覺得「防火牆」抓得更直覺——它強調的不只是「乾淨的 context」,而是「**有意識地建立邊界**,擋掉特定方向的污染」。

> **Note**:這個模式有個學術名字叫 **orchestrator-worker pattern** —— 協調者把工作丟出去,工人各自獨立做,協調者只收摘要。Hermes 的 schema 文件甚至特別寫「父 agent 拿到的是子 agent 的自我報告,你要自己驗證任何外部副作用」—— 這等於明說:**我擋住了 context 污染,但我擋不住事實準確性,那是你的事。**

這是今天最值得帶走的一點。如果你以後自己想做 multi-agent,先問自己一句:**「我這個 architecture 有沒有 context 防火牆?」** 沒有的話,你大概率會撞到我撞過的那個牆。

## 二、子代理的預算為什麼是獨立的

Day 02 我們講過 `IterationBudget` —— 每個 agent 自己有一個迭代次數計數器,**父 agent 預設 90 圈、子代理預設 50 圈**,跑超過就強制停。

子代理拿到的不是「父代理的剩餘預算」,**而是自己一份全新的 50 圈**。

第一次看到這個設計我有點不舒服——這樣整棵 agent 樹的總 iteration 不就可以無限膨脹?父用 89 圈、子用 49 圈、孫又 49 圈……

後來想通了。**這就是設計刻意。** 你想想——如果子 agent 跟父共用同一份預算,那委派就毫無意義。父 agent 跑了 80 圈才決定「這個子問題交給子 agent 處理」,結果子 agent 只剩 10 圈可以用——它連把問題想清楚都不夠。

預算獨立才能讓委派發揮真正的價值:**子 agent 拿到一個複雜任務,可以從零開始、認真跑滿自己的 50 圈來解決,父 agent 那邊只佔一個 tool call 的成本**。父的 budget 等於只花了「1 圈」,但子裡面跑了 50 圈,等價於把計算延伸到 context window 之外。

當然 Hermes 也有縱深防禦防止你 fork 炸彈:**深度上限預設 `MAX_DEPTH=1`** —— 子代理拿到的 toolset 預設**不包含 `delegate_task` 本身**,所以子不能再生孫。如果你真的需要兩層委派,要明確把 `role='orchestrator'` 加回去,而且要全域 kill switch 跟深度上限都同意,否則無聲降級成 leaf。

> **Note**:`DELEGATE_BLOCKED_TOOLS` 是個黑名單,**永遠**從子代理身上剝掉:不能遞迴 `delegate_task`、不能呼叫 `clarify`(子不准回頭騷擾使用者)、不能讀寫 `memory`(子不能污染共享記憶)、不能 `send_message`、不能 `execute_code`。**子代理的 toolset 永遠是父的子集**,不能提權。

## 三、Cache 鐵律「不會」自動跨 agent 邊界——但有一個刻意的例外

這裡要回頭呼應一下我們的第二條暗線:**「prompt cache 是鐵律,不是優化」**。

Day 03 講過,system prompt session 中途絕對不能變,因為 cache prefix 一改就全壞。Day 06 講記憶為什麼不能塞 system prompt,也是同一條鐵律。

那子代理呢?照直覺想,**子代理是一個全新的 `AIAgent`,它應該有自己全新的 system prompt**——對吧?

是的。讀一下 `agent_init.py:912`,你會看到子代理的 `_cached_system_prompt` 在初始化時其實是 `None`,`tools/delegate_tool.py` 建子代理時也沒有把父的 cached prompt 傳下去。**一般的 `delegate_task` 子代理會自己重新組裝 system prompt,從 prompt-cache 的角度看,它就是一個獨立 session**——父子之間沒有共用 cache prefix 這回事。

我以前讀到這裡也愣了一下,直覺是「這樣不會把暖好的 cache 浪費掉嗎?」會,但這個取捨是刻意的:子代理的 toolset 跟父不一樣(被 `DELEGATE_BLOCKED_TOOLS` 剝掉一堆)、人格 prompt 也常常被覆蓋成子任務專用的版本,**「強行共用 cache」反而會把不一致的內容塞進同一塊 prefix,反而更危險**。乾脆讓子重新算,只在子自己的多輪 iteration 裡享受 cache 命中即可。

**但有一個例外值得記:Hermes 的「review agent」(`agent/background_review.py:431`,Day 06 出現過)**——也就是那個在背景對對話做事後審視的 agent——**會**特地繼承父的 `_cached_system_prompt`。為什麼這條獨立出來?因為 review agent 的 system prompt 設計上就是要等於父的 prompt(它在做的是「對父的同一段對話、用同一個身份重新審視一次」),共用 cache 不只是合法的,而是這個設計的整個重點:**review 想盡量便宜,就必須跟父共用 prefix**。

所以這條鐵律的精確版本應該是:

> **Prompt cache 是鐵律,但「跨 agent 邊界共用 cache」不是自動的——只有當兩個 agent 是同一個邏輯 session、刻意設計成共用 prompt 時才會發生。** Hermes 在 review agent 上明確選了「共用」,在一般 delegate 子代理上明確選了「不共用」。

> **白話比喻**:會員卡的折扣不是「你姓的人都能用」——只有同一張家庭卡上掛名的人才能共用。review agent 是被刻意「掛到父的家庭卡上」的;delegate 子代理沒有,它要自己辦新卡。

這個區分很細,但對之後讀 Hermes 任何「多 agent」程式碼都很重要:**不要假設 cache 會無條件跨邊界,要去看那條邊界是怎麼設計的**。

## 四、Kanban — 用 SQLite 蓋一個多代理協作核心

委派解決的是「同步、短暫」的協作:父 agent 問子 agent 一個問題,等它回答,結束。

但你會遇到另一種需求:**好幾個 agent 同時在跑、彼此沒有父子關係、需要共用一個任務列表**。例如你想做一個「夜間 batch」——讓三個 agent 平行去處理今天累積的 50 個 PR review,做完之後另一個 agent 把結果彙總。

這時委派就不夠了。因為:

- 委派是同步阻塞的,父被中斷,所有子的工作就丟了。
- 委派只能一對多(父對子),不能多對多。
- 委派沒有持久性,程式關掉,狀態消失。

Hermes 的回答是 Kanban。

`hermes_cli/kanban_db.py`——**一個用 SQLite 蓋的任務看板**。每個 task 實際有 **9 種狀態**:`triage` / `todo` / `scheduled` / `ready` / `running` / `blocked` / `review` / `done` / `archived`(`kanban_db.py:97` 的 `VALID_STATUSES`)。每個 agent 可以從這個看板上 claim 一個 task、做完、寫結果回去,然後再 claim 下一個。

聽起來像 GitHub Issues 對吧?**對,本質上就是 GitHub Issues 加上強鎖。**

那為什麼需要強鎖?因為多個 agent 並行的時候,你不能讓兩個 agent 同時 claim 到同一個 task—— 不然就會回到開場那種情境:兩個搶同一個檔案、log 滿天飛。

Hermes 的做法是 **CAS(compare-and-swap)寫進 SQL**:

```sql
UPDATE tasks SET status='running', claim_lock=?
WHERE id=? AND status='ready' AND claim_lock IS NULL
```

> 實際上 `kanban_db.py` 還會在同一個 `UPDATE` 裡 set `claim_expires=?, started_at=COALESCE(started_at,?)`(claim 租約、首次起跑時間)——這裡只展示 CAS 核心。

只有「我看到 status 還是 ready、claim_lock 還是空」的 agent 能 update 成功,其他 agent 看到 `rowcount==0` 就走開,**沒有重試迴圈、沒有鎖伺服器**。SQLite 內部會 serialize 寫入者,所以剛好只有一個 agent 會贏。

> **Note**:**WAL(Write-Ahead Logging)** 是 SQLite 的一種模式,允許多讀者跟一個寫入者並行,效能比預設模式好很多。**CAS(compare-and-swap)** 是一個原子操作——「只有當值還是我預期的舊值時才更新」,是並行程式設計的基本原語。把這兩個組合起來,SQLite 就變成一個夠用的協調核心。

## 五、為什麼是 SQLite,不是 Redis、不是 Postgres?

這題我問過自己很多次。如果你做過分散式系統,你的第一直覺一定是「**這種需求就該上 Redis 啊**」——畢竟 Redis 有 `WATCH/MULTI`、有 list、有 pub/sub,做任務佇列比 SQLite 順太多。

但你要記得 Hermes 的目標使用者:**單機跑、單人用、跑在你筆電上的 agent 框架**。

你想想,如果為了「我想跑兩個 agent 平行 review PR」這種需求,我得叫使用者先 `brew install redis`、設定 password、起個 docker container、處理 connection pool、處理 Redis 跟主程序 lifecycle 的同步問題——**這個門檻已經把一半潛在使用者擋在外面了**。

SQLite 的好處是:**它就是一個檔案**。不用裝、不用設定、Python 內建支援、跨平台。WAL 模式打開之後,單機多進程的鎖機制夠用——對 Hermes 預期的「五個、十個 agent」這種 scale,綽綽有餘。

當然有取捨:**這個架構不能跨機器**。你不能把 SQLite 檔案放在 NFS 上然後讓五台機器一起讀寫,那會壞。但 Hermes 的目標使用者壓根不需要分散式——你會跨機器跑 agent swarm 的時候,你已經是 enterprise 客戶,你會自己選 Temporal 或 Airflow。

> **白話比喻**:這就像便利商店收銀台 vs 機場安檢的差別。便利商店一個店員一張收銀機就夠了,你硬要塞十個櫃台只會卡死;機場一天要過十萬人,當然要分散。Hermes 選了便利商店等級的工具——**因為它就是想當你筆電上的便利商店**。

## 六、Trajectory 隔離才是真正擋幻覺的關鍵

回到開場那個情境。當兩個 agent 共用 history 時,Reviewer 跟 Coder 才會互相幻覺,根本原因是**他們共用 message history**——一個 agent 的中間草稿,變成另一個 agent 的「事實」。

Hermes 的整個架構刻意把這條路堵死:**每個 agent 自己的 trajectory(對話紀錄)是獨立的,Kanban 上交換的是「結構化結果」,不是「對話歷史」**。

什麼意思?Kanban 的 task 表上,只存「任務描述、status、最終結果(一個 JSON blob 或一段 markdown)」。當 worker A 完成一個 task、worker B 接手下一個 task,**B 看到的只是 A 寫進 task 結果欄的那段結構化文字**,**B 完全看不到 A 的中間 tool call、retry、自我修正、內心戲**。

這就擋掉了開場那種「context 互相污染」的問題。每個 agent 都活在自己的小宇宙裡,只透過「黑板(blackboard)上的結構化留言」溝通——`kanban_swarm.py` 真的就叫「blackboard pattern」,在根任務上掛一段結構化 JSON 留言,讓所有 worker 都看得到。

**「資料才是介面,對話不是介面。」** 這句話我覺得是 Kanban 設計裡最該記住的一點。多 agent 系統如果用「對話」當介面,你會碰到我撞過的牆;如果用「資料」當介面(任務 + 結構化結果),你才有機會擴展。

## 七、啊,原來業界把這套叫 Orchestrator-Workers

寫到這裡我才回頭翻 Anthropic 那篇「Building Effective Agents」(2024/12),才發現我前面拆了半天的「委派 + Kanban」這套東西,人家早就有一個正式名字。

那篇文章整理了 5 種 agent 設計模式,其中第 4 種叫 **Orchestrator-Workers**:「a central LLM dynamically breaks down tasks, delegates them to worker LLMs, and synthesizes their results」——一個中央 LLM 動態拆解任務、派發給 worker LLM、再彙總結果。

這跟 Hermes 的委派 + Kanban 模式幾乎一對一:`delegate_task` 是 orchestrator 把工作切出去,Kanban swarm 的 planner→worker→synthesizer 流程是同一套東西的持久化版本。

你讀其他 framework 的 multi-agent 文件時(LangGraph、AutoGen、CrewAI),會看到不同的命名——supervisor、planner、dispatcher、manager——但**底層都是同一個 pattern**。我前面用「委派 = context 防火牆」的比喻去拆它,是從**目的**(隔離 context)切入;業界用 Orchestrator-Workers 命名,是從**結構**(中央調度 + 平行 worker)切入。兩條路指的是同一棟建築。

Hermes 的特色不在發明這個 pattern,而在**用 SQLite + CAS 把它做得「能跑在你筆電上」**——不依賴 Redis、Kafka、其他重型基建。同樣是 Orchestrator-Workers,Temporal / Airflow 那個方向是 enterprise scale,Hermes 這個方向是「你一個人在家就能跑五個 agent」。同樣的 pattern,不同 scale 的工程選擇。

> **Note**:這也是為什麼前面我堅持「context 防火牆」這個比喻——Orchestrator-Workers 的命名是中性的、講結構的,但它沒解釋**為什麼**要這樣搭。「context 防火牆」回答了那個 why:你不是為了「中央調度」才委派,你是為了**擋住 context 污染**才委派。

## 八、主線 A 補充:父子代理用的還是同一段程式

最後補一下我們的第一條暗線——「**一個核心,多種驅動**」。

到目前為止你聽過的「驅動方式」包括 CLI、gateway、MCP、ACP。今天再加一個:**子代理也是一種「驅動」**。

`AIAgent` 是 protocol-agnostic 的——它不知道自己是被使用者直接呼叫、是被 webhook 觸發、還是被另一個 agent 透過 `delegate_task` 生出來的。父子代理跑的是**同一段** `run_conversation()`,差別只在初始化時設定的幾個 flag(`_delegate_depth`、`_active_children`、繼承的 cached prompt)。

這就是「一個核心」哲學的另一個面向:**核心不認得 caller 是誰**。對核心來說,所有 caller 都長一樣——一段初始 messages、一個 toolset、一個 budget,然後跑。誰餵的不重要。

這個設計讓委派幾乎免費——不需要為「子代理」寫一套新的執行邏輯,直接 reuse 既有的 conversation loop 就好。

## 小結

開場那個 multi-agent 翻車情境的根源,**不是「兩個 agent」這件事本身**,而是「兩個 agent 共用 context、共用對話歷史、共用檔案、沒有任何隔離機制」。Hermes 給的答案是三層工具:

- **委派(`delegate_task`)**:同步、短暫、強隔離的 context 防火牆。
- **Kanban(SQLite + CAS)**:持久、多代理、共享待辦列表。
- **Trajectory 隔離**:agent 之間只透過「結構化資料」溝通,不共用對話。

這三層加起來,才能讓「多個 agent 一起跑」這件事從「兩個 LLM 互相幻覺」變成「真的能用」。

但你現在應該有個更實際的問題冒出來了:**這個 agent,你一開始到底是怎麼跟它講話的?** CLI?Web?還是 cron job 自動跑?**同一個 agent 怎麼讓三套介面同時跑、狀態還不會打架?** 明天就來拆這題——三套介面與狀態持久化。

---

## 想自己翻原始碼?

| 檔案 | 在幹嘛 |
|---|---|
| `tools/delegate_tool.py` | `delegate_task` 工具本體,生子代理、阻塞等待、收摘要 |
| `agent/agent_init.py` | 子代理初始化(`_delegate_depth`、`_active_children`、繼承 cached prompt) |
| `hermes_cli/kanban_db.py` | SQLite 看板核心,CAS claim、WAL 模式、心跳回收 |
| `hermes_cli/kanban_swarm.py` | Swarm 拓撲(規劃 → worker → 驗證 → 綜合),blackboard pattern |
| `hermes_cli/kanban_decompose.py` | LLM 拆解粗略任務成任務圖,反幻覺驗證 |
| `hermes_cli/kanban_diagnostics.py` | dispatcher tick 的健康檢查、殭屍回收 |

進入點建議:從 `delegate_tool.py` 的 `delegate_task()` 進去看「context 防火牆怎麼蓋」,接著翻 `kanban_db.py` 的 `claim_task()` 看 CAS 那一句 SQL,最後看 `kanban_swarm.py` 怎麼用「資料」表達多 agent 拓撲——這三段看完,multi-agent 協作這題你大概有八成的直覺。
