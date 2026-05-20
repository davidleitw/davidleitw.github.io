---
title: "Hermes From Zero:15 天讀懂一個 agent framework"
description: "我把 NousResearch/hermes-agent 整個 repo 拆開來讀,挑出這個 agent framework 之所以長成現在這樣的關鍵架構決定,用 iThome 鐵人賽的口吻寫了 15 篇。"
pubDatetime: 2026-05-20T10:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

> 如果你寫過 `client.chat.completions.create(...)`,但想知道一個「真正能上線」的 agent framework 是怎麼長出來的——這 15 天是為你寫的。

---

## 這個系列在幹嘛

我把 [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) 整個 repo(3,400+ 個檔案)拆開來讀,挑出**這個 agent framework 之所以長成現在這樣的關鍵架構決定**,然後用 iThome 鐵人賽的口吻寫了 15 篇——一篇對應你接下來會撞到的一個牆。

不是 API 文件,不是怎麼安裝,不是「跟著做你也能寫一個 ChatGPT」。是:**「為什麼 Hermes 把 system prompt 鎖死不准你動?」、「為什麼一個 agent 的核心迴圈該是 protocol-agnostic 的?」、「為什麼這個 657KB 的 `cli.py` 是個警訊?」**

---

## 給誰看

- ✅ 你用過 OpenAI / Anthropic SDK,知道 `messages` array、function calling、token 是什麼。
- ✅ 你想做的不只是 chatbot,而是「會自己用工具、記得事情、跨 session 工作」的 agent。
- ✅ 你看過 LangChain / OpenAI Agents SDK,但覺得抽象太厚、想看真實的取捨。
- ❌ 你完全沒寫過 chat completion 的 API call(先去寫一個 chatbot 比較划算)。
- ❌ 你只想找「最快上線」的 SaaS(那個 Hermes 不是你要的)。

---

## 15 天清單

每天的故事 hook + 技術主菜:

| Day | 標題 | 一句話 |
|---|---|---|
| [01](/posts/hermes-from-zero-day01) | 我為什麼想拆一個 agent framework | 從 `chat.completions.create` 寫到一個「真正的 agent」中間到底差了什麼。 |
| [02](/posts/hermes-from-zero-day02) | Agent 的「最小心臟」長什麼樣 | 核心迴圈、兩層巢狀、迭代預算,以及最該偷的設計:每個結束點都有名字。 |
| [03](/posts/hermes-from-zero-day03) | 為什麼 system prompt 不准動 | 帳單翻五倍以後才會懂的事——prompt cache 不是優化,是鐵律。 |
| [04](/posts/hermes-from-zero-day04) | Context 不是無限大,所以要壓 | 三層壓縮、5-phase pipeline、為什麼壓縮是唯一被允許的中途變動。 |
| [05](/posts/hermes-from-zero-day05) | 同一段程式碼怎麼接 OpenAI 又接 Claude | Adapter、registry、credential pool——Hermes 怎麼忍受 LLM 圈的各種脾氣。 |
| [06](/posts/hermes-from-zero-day06) | Agent 怎麼「記住」昨天聊過什麼 | 記憶 provider、會「分叉自己去學習」的背景複查、Curator,合起來叫自我改進迴圈。 |
| [07](/posts/hermes-from-zero-day07) | 讓 agent 真的能動手做事 | 工具系統、七種沙箱、guardrail 三計數器、防說謊頁尾——讓謊報完成在結構上不可能。 |
| [08](/posts/hermes-from-zero-day08) | MCP 是什麼,為什麼大家都在喊 | Anthropic 那個 USB-C-of-tools 規格,Hermes 怎麼接、怎麼自己也當 server。 |
| [09](/posts/hermes-from-zero-day09) | Gateway — 一個 agent 接全世界 | Slack / Discord / cron / 自己當 OpenAI API,所有 channel 是 adapter。 |
| [10](/posts/hermes-from-zero-day10) | 技能、外掛、MCP — 三個聽起來都像擴充的東西到底差在哪 | 漸進揭露、entry points、process boundary——什麼時候用哪個。 |
| [11](/posts/hermes-from-zero-day11) | 多個 agent 怎麼合作不打架 | 委派是 context 防火牆,不是分工;Kanban 用 SQLite 蓋的多 agent 協作核心。 |
| [12](/posts/hermes-from-zero-day12) | CLI、Web、Cron — 同一個腦袋三張臉 | JSON-RPC、PTY、SessionDB——三個介面一份核心,怎麼做到的。 |
| [13](/posts/hermes-from-zero-day13) | 怎麼測試一個會講話的東西 | 「分離水管與水」的測試哲學,以及他們刻意沒測的那塊。 |
| [14](/posts/hermes-from-zero-day14) | Hermes 哪裡其實做得不夠好 | 657KB 的 `cli.py`、`len // 4` 的中文災難、24 種英文字串比對——誠實開砲。 |
| [15](/posts/hermes-from-zero-day15) | 如果是我會怎麼寫一個 agent framework | 14 天的收成:會保留的、會修掉的、會新加的。 |

---

## 三條會反覆出現的暗線

讀的時候留意,它們不只是「主題」,是**作者一邊讀 source 一邊撞到三次就確定「啊這條是貫穿的」的那種線**:

### 🅐 「一個核心,多種驅動」
`AIAgent` 是 protocol-agnostic 的——它不在乎是誰在呼叫它。

- Day 2 埋種子(核心迴圈是 protocol)
- Day 5 第一次明顯(provider adapter)
- Day 8 第二次(MCP 對稱性)
- Day 9 第三次(gateway 對外開放成 OpenAI API)
- Day 12 收成(CLI/Web/Cron 三套介面共享核心)

這是 Hermes 最重要、最成功的架構決定。

### 🅑 「prompt cache 是鐵律,不是事後優化」
「system prompt 在 session 中途絕不能變」這條不變式,**塑造了整個 API 設計**。

- Day 3 主角登場
- Day 4 壓縮為什麼是唯一被允許的中途變動
- Day 6 記憶為什麼不能塞 system prompt
- Day 10 技能注入為什麼走 user message

如果你只能挑一條學,挑這條。

### 🅒 「抽取程式碼 ≠ 分解系統」
Hermes 反覆出現的結構性債務:巨石檔案。

- Day 7 偷偷鋪墊(工具系統做得乾淨,形成對比)
- Day 12 提一下(`cli.py` 657KB)
- Day 14 正面開砲(`gateway/run.py` 855KB、`run_conversation()` 3,900 行)

團隊知道要模組化,卻停在「搬移程式碼」,沒走到「定義介面 + 狀態所有權」。這是你自己刻時最該避開的坑。

---

## 怎麼讀

**建議照順序讀**——每一篇都假設你讀過前一篇,而且故事 hook 跟技術鋪墊都是前後呼應的。

如果真的時間不夠:
- 想搞懂**整體架構決定**:Day 1 → Day 2 → Day 3 → Day 5 → Day 9 → Day 15
- 想學**寫自己 agent 時可以偷的設計**:Day 2 → Day 7 → Day 11 → Day 14 → Day 15
- 想直接看**他們踩過的坑**:Day 4 → Day 13 → Day 14

不建議:單篇跳著讀——故事線會斷,而且很多技術細節是「上一篇留鉤、下一篇解」的結構。

---

## 跟隔壁兩個資料夾的關係

這個 repo 旁邊有另外兩套東西,目標不同:

| 資料夾 | 它在幹嘛 | 什麼時候讀它 |
|---|---|---|
| **`hermes-from-zero/`**(這個) | 鐵人賽風格,故事 + 架構,15 天讀完 | 你想「**理解**一個 agent framework 為什麼長這樣」 |
| `../hermes-architecture-series/` | 13 篇結構化技術文件,密集 source 引用 | 你想「**查**某個機制的細節」,當參考手冊用 |
| `../hermes-agent-research/` | 實用架設指南,本機跑、綁工具、外網存取 | 你想「**真的架一台**來用」 |

三套互補——這套教你**為什麼**,隔壁教你**怎麼用**,再隔壁教你**細節**。

---

## 一些誠實的話

1. **不是逐行 code walkthrough**。如果你想看「`run_conversation()` 第 1,234 行在幹嘛」,請去看 `hermes-architecture-series/_research_notes/`——那裡有密集的 `檔案:行號` 參照。
2. **不是只誇 Hermes**。Day 14 整篇都在批判它。「值得讀 ≠ 值得照抄」是這個系列的基本立場。
3. **某些細節是抓取當下的快照**——版本號、檔案大小、issue 編號這些。我都盡量標出來「不確定的地方」,但你看到具體數字時還是建議自己 `wc -c` 確認一下。
4. **不會寫成「中立技術文件」的調調**。每一篇都有主觀判斷——什麼設計值得偷、什麼是 fragile、什麼該重寫。你可以同意或不同意,但不會看到「綜上所述」這種句子。

---

## 開讀

從 [Day 01](/posts/hermes-from-zero-day01) 開始。

如果你撐到 Day 15,你已經跟絕大多數「會寫 agent 但沒讀過 framework」的人不一樣了。
