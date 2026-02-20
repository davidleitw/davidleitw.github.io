---
name: improve-writing
description: Polish and improve blog post writing. Use when user says "improve writing", "潤飾文章", "改善文筆", "優化文章", or wants writing feedback/editing on a blog post draft.
allowed-tools: Read, Edit, Write, AskUserQuestion
---

# Blog Writing Style Guide — davidleitw

本 skill 的目標是協助優化部落格文章的文筆，使其符合作者一貫的寫作風格。

---

## 核心風格定位

**學習者視角的技術筆記**：文章不是教科書，是「我學了什麼、踩了什麼坑、想分享給同樣在學習的人」。語氣要誠實、直接，不需要裝作什麼都懂。

---

## 技術術語規則（最重要）

**技術術語一律保持英文，不強行翻譯。**

保持英文的詞彙：
- 系統：process、thread、kernel、scheduler、context switch、system call、file descriptor
- 網路：socket、namespace、veth、bridge、overlay、subnet、gateway、TCP/IP
- 容器：container、image、volume、network、Docker、namespace
- 演算法：BFS、DFS、DP（Dynamic Programming）、heap、stack、linked list
- 分散式：chunk、replica、metadata、checkpoint、lease、master、client
- 程式語言：goroutine、function pointer、callback、struct、interface
- 工具：Makefile、Dockerfile、Vagrantfile

**可以接受的中文化：** 一些已經高度本地化的詞彙可以用中文，例如「排程器」、「核心」（Linux 核心）、「執行緒」（搭配說明時）。
**原則：** 如果翻譯了反而讓讀者更困惑，就不要翻譯。

---

## 語氣與人稱

- **第一人稱敘述**：「我一開始不太理解...」、「趁這個機會整理一下...」、「因為作業需要...所以來研究」
- **承認不確定性**：如果有些細節不確定，可以說「具體的實作細節可以往下參考」或「有機會再深入研究」，不要硬撐講一個不完整的解釋
- **輕微幽默**：~~這樣寫然後打叉~~ 的格式是作者慣用的幽默，適度使用即可，不要過度
- **對話式收尾**：可以用「有興趣可以繼續往下看」、「底下的範例可以印證」這類引導語

## 開頭（前言）

每篇文章的前言應該回答：**「你為什麼要寫這篇？讀者為什麼需要看？」**

好的前言結構：
1. 一句話說明觸發點（遇到問題 / 課程進度 / 遇到有趣的設計）
2. 解釋為什麼這個主題值得紀錄
3. 如果有參考來源，在前言直接提及並附上連結

**好的前言範例（出自 concurrency01.md）：**
> 最近在複習 jserv 老師的並行與多執行緒程式設計，一開始介紹了兩個常常被混淆的名詞，Concurrency 與 Parallelism，每次感覺懂了，過一陣子要我清楚的說明又有點講不太清楚，所以來寫一篇筆記紀錄一下。

**好的前言範例（出自 fd.md）：**
> 在 Linux 中常常會看到 fd 的身影，但一直沒有花時間去深入了解這個 fd 底層的實現，只是有模糊的概念而已，所以趁這個機會來整理一篇筆記，紀錄一下。

**避免這樣寫：**
- 「本文將介紹...」（太正式，像論文）
- 直接跳進技術細節，沒有任何鋪陳

---

## 文章結構

### 技術深度文章（kernel / 網路 / 系統）

```
## 前言
（觸發點 + 為什麼寫）

## 背景 / 核心概念
（先解釋「是什麼」，再解釋「怎麼運作」）

## 實作 / 原始碼解讀
（搭配 code block 和圖片說明）

## 小結 or 延伸閱讀
（可省略，但如果有 takeaway 就寫）

## reference
（一定要有，尤其參考了 jserv 老師的課程或論文）
```

### 工具 / 踩坑紀錄文章

```
## 問題描述
（具體說清楚遇到什麼問題、在什麼情境下）

## 解決方法
（直接給解法，附上 code 或指令）

（可選）驗證步驟 + 截圖
```

### LeetCode 文章

```
## 題目敘述
（一句話說清楚題目要求）

## 思路
（核心觀察是什麼？為什麼用這個方法？）
（說清楚時間複雜度思考，例如：「暴力法是 O(n²)，觀察到 X 特性可以降到 O(n)」）

## 解題紀錄
（code block，如果有重要的部分加行內注釋）
```

### 論文筆記

```
## 前言
（為什麼讀這篇 paper？主要貢獻是什麼？）

## 核心設計 / 問題背景
（作者要解決什麼問題）

## 各章節整理
（不要純翻譯，加上自己的理解和疑問）

## 個人心得 / 延伸思考
（可選，但推薦加）

## reference
```

---

## 技術寫作原則

1. **「為什麼」優先於「是什麼」**
   - 每引入一個新概念，先說清楚它存在的原因
   - 例：介紹 fd 前先說清楚為什麼 user space 需要一個抽象層

2. **類比讓抽象概念具體化**
   - 技術概念配上生活化類比非常有效（作者曾用殺老師解釋 single CPU concurrency，用鳴人影分身解釋 parallelism）
   - 類比不需要完美，重要的是讓讀者「抓到感覺」

3. **從小範例開始，再推廣**
   - 先用 2 個 thread 的例子說清楚 race condition，再延伸到 20000 個
   - 先示範兩個 namespace 互連，再說明 bridge 如何處理多個

4. **圖片和截圖是補充，不是替代**
   - 在截圖前後要有文字說明「觀察什麼」和「結果代表什麼」
   - 不要只貼圖沒有解釋

5. **程式碼搭配說明**
   - code block 之後要說明「這段 code 在做什麼」、「輸出什麼」、「為什麼這樣寫」

---

## Description 撰寫規則

Front matter 的 `description` 欄位應該：
- **長度**：1-2 句話（約 40-80 字）
- **內容**：說清楚「這篇文章用什麼方法探討什麼主題」，不只是標題換句話說
- **格式**：不要以「本文」開頭，用「介紹」、「整理」、「解析」、「探討」、「記錄」等動詞開頭

**好的 description 範例：**
- `透過實際操作 Linux network namespace、veth pair 與 bridge，一步步拆解 Docker 預設 bridge 網路模型的底層實現。`
- `用殺老師與鳴人的影分身之術，直觀解釋 Concurrency 與 Parallelism 的核心差異，並介紹 context switch、scheduler、preemptive 等核心名詞。`
- `從 fork() system call 出發，追蹤 Linux kernel v4.14 中 _do_fork() 的實作流程，理解 process 建立時 task_struct 的初始化細節。`

**差的 description 範例（避免）：**
- `GFS` （太短，沒資訊）
- `cobra default function` （沒說清楚解決了什麼問題）
- `本文介紹了...` （被動、無聊）

---

## 常見的文筆問題與修正方向

| 問題 | 修正方式 |
|------|---------|
| 段落過長，沒有換行 | 每個獨立的概念或步驟單獨一個段落 |
| 沒有過渡語句，章節之間太突然 | 用一句話橋接（「了解了 X 之後，再來看 Y...」） |
| 正式語氣與口語語氣混用 | 統一用較輕鬆的口語，技術詞彙維持英文 |
| `待補` 留在文章中 | 要麼完成，要麼刪除該 section |
| 沒有說清楚「為什麼這麼設計」 | 多問自己：「讀者看完知道這個設計解決了什麼問題嗎？」 |
| LeetCode 只貼 code 沒說思路 | 一定要加 `## 思路` 解釋核心觀察 |

---

## Skill 使用方式

當用戶要求改善文章寫作時，依照以下步驟：

1. **讀取文章全文**（使用 Read 工具）
2. **分析問題**：
   - description 是否完整？
   - 前言是否有說清楚觸發點？
   - 各章節過渡是否順暢？
   - 有沒有「待補」或空洞的 section？
   - LeetCode 文章有沒有思路說明？
3. **進行修改**（使用 Edit 工具），保留作者的個人風格和聲音
4. **說明修改了什麼**，讓作者理解改動的原因

**重要**：改善文筆的目標是讓作者的原始聲音更清晰，不是把文章改成另一種風格。
