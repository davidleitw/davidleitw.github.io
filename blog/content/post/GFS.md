---
title: "The Google File System (GFS) 論文心得"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - distributed
    - paper
categories: ["paper"]
description: "跟著 MIT 6.824 閱讀 The Google File System 論文，整理 GFS 的架構設計、Single Master 理念、Metadata 管理、一致性模型與 Lease 機制。"
---

跟著 [MIT 6.824](https://pdos.csail.mit.edu/6.824/schedule.html) 的課程進度，在 Lec3 終於拜讀了這篇經典論文。**GFS** 是 Google 開發的分散式檔案系統，在 2003 年時 Google 發表了 [The Google File System](https://pdos.csail.mit.edu/6.824/papers/gfs.pdf) 這篇論文，分享了 GFS 開發上的細節。雖然 Google 並未開源這套系統，但透過這篇 paper 依然可以一窺當初的設計思路與整體架構。

## 背景

為了因應 Google 日益增長的資料處理需求，Google 開發了 **GFS** 這套分散式檔案系統。

> 選擇分散式架構的原因：要處理的檔案大小已遠遠超過單機所能容納的資料量。

和許多分散式系統一樣，**GFS** 也追求以下幾點需求：

- **performance** 性能
- **scalability** 擴展性
- **reliability** 可靠性
- **availability** 可用性

出於成本與其他因素的考量，Google 並沒有選用商業伺服器，而是採用一般的**普通主機（inexpensive commodity hardware）**作為叢集節點。由於普通主機的穩定性不如商業伺服器，在設計 GFS 時就必須同時將容錯機制納入考量。

論文的 **Introduction** 也簡單介紹了 GFS 的幾個特色：

- **元件失效(component failures)** 被認為是常態

GFS 叢集中包含數以百計甚至更多的儲存機器，每台機器隨時都可能發生不可預期的錯誤，有些錯誤甚至無法恢復。因此 GFS 需要實現**持續的監控、錯誤偵測、容錯與自動恢復**等功能。

- **GFS 中的檔案通常大（GB 級以上）而少**

大型檔案內部可能包含數億個 object，同時管理數億個 KB 大小的物件是很不明智的做法。因此 I/O 操作、block 大小等參數都需要特別考量。

- **資料讀寫特性（絕大部分資料都符合以下特性）**

大多數資料採取追加（append）的方式寫入，將新資料添加到舊文件的尾部，而非修改已有內容。一旦寫入完成，文件通常會變成唯讀，且必定是循序讀取（only sequentially）。幾乎沒有隨機寫入或隨機存取（例如在文件中間插入資料）。由此可知，append 操作是優化性能與保持原子性的關鍵。

- **atomic append operation**

對於 append 實現了原子操作，使得多個 client 端可以同時對一個文件寫入又不需要額外的同步操作來維持一致性。

GFS 並不強調低延遲，而是把重點放在極高的 **throughput**。

paper 的 `2.1 Assumptions` 章節簡單描述了設計 GFS 的預期目標。

## Interface

GFS 提供了一系列類似傳統文件系統的 API，但並未完全遵照 POSIX 的規範。

支持一些常見的功能
- **create**
- **delete**
- **open**
- **close**
- **read**
- **write**
- **snapshot**
- **record append**

**snapshot** 指令可以用極低的成本建立一個文件或目錄的 copy。
**record append** 指令允許多個 client 同時對同一個文件進行寫入，同時確保每個 client 寫入動作的原子性，讓 client 端不需要額外處理同步問題。

## Architecture
![](https://i.imgur.com/ftek3c4.png)

整個 GFS 包含一個 Master 節點，以及多台 chunk server，每台 chunk server 都可以同時被多個 client 存取。

GFS 中儲存的每個文件都會被切割成固定大小的 chunk，每個 chunk 在建立時由 Master 分配一個全域唯一的 64 bits chunk handle（chunk ID）。

chunk server 以一般 Linux 文件的形式將 chunk 儲存在硬碟中，讀寫時根據 chunk handle 以及偏移量來確定範圍。

> 預設每個 chunk 會備份在三台不同的 chunk server 上，用戶可根據需求調整備份數量。

Master 主要管理所有的 [metadata](https://zh.wikipedia.org/wiki/%E5%85%83%E6%95%B0%E6%8D%AE)，除了系統設定參數之外，有幾個 table 特別值得了解：

- **file name &rarr; array of the chunk handle**

Master 管理的資料中最重要的一項，就是儲存每個文件名稱對應的 chunk handle 陣列。一份資料進入 GFS 後會被拆成數個 chunk 分散在系統各處，當 client 想存取某個文件時，會先告知 Master 文件名稱，Master 再查表得知該文件對應的各個 chunk handle。

- **chunk handle 相關資訊**

取得 chunk handle 之後，Master 還有另一張表可以查詢各個 chunk handle 的相關資訊。

> 因為有備份機制，所以每個 chunk 會儲存在多台 chunk server 上。

Master 會以 **HeartBeat message** 的形式週期性地與每台 chunk server 通訊，以掌握 chunk server 的運作狀態。

metadata 的詳細內容會在後面的章節進一步說明。

## Single Master 設計理念

Single Master 的設計讓 Master 可以透過全域資訊掌握每個 chunk 的位置與資料複製決策，大幅降低了設計的複雜度。

但隨之而來的問題是：既然只有一個 Master，就必須盡可能減少 Master 的工作量，避免 single master 的設計反而成為整個系統的效能瓶頸。

client 的文件讀寫絕對不會透過 Master 來與 chunk server 溝通，Master 的工作只有傳遞 chunk 的相關資訊。client 取得應該連線的 chunk server 後，會直接與該 chunk server 建立連線。

> client 會將 chunk 的 metadata 緩存一段時間，讓後續相同的操作不需要再去詢問 Master。

## chunk size 選擇議題

paper 中有一個章節分析了 chunk size 的選擇問題，說明為什麼選擇 64MB 這個遠大於普通 block 的大小，以及這個選擇的優缺點。

- **優點：減少 client 與 Master 的通訊量，降低 metadata 大小**

由於 single master 的設計，每個環節都要盡可能降低 Master 的運算負擔，避免 Master 成為系統效能瓶頸。

使用大的 chunk size，client 取得 chunk 的位置後可以進行多次讀寫（維持較長時間的 TCP 連線），不會頻繁地換到下一個 chunk。另一方面，chunk 的總數量也會因此下降，減少 Master 需要儲存的 metadata 量，讓 Master 得以將所有 metadata 都保存在記憶體中。

- **缺點：熱點（hot spot）問題**

對於小文件來說，chunk 的數量可能很少，甚至只有一個。這種情況下，如果有大量 client 同時存取同一個文件，就容易形成熱點。

這類文件通常是配置參數之類的資料。長遠的解決思路之一，是在遇到這種情況時，允許 client 從其他 client 端讀取資料。

## Metadata

`Master` 主要維護三種類型的 `metadata`
- 命名空間相關
- 文件名稱(`file name`)與 `chunk` 的映射

每個文件以 64 MB 的大小分割成數個 `chunk`，此 table 專門儲存每個文件對應的 `chunk` 的 `chunk handle`。

- `chunk handle` 與 `chunk server` 的映射

因為一個 `chunk` 會備份之後存在各個 `chunk server`，所以會有一個 table 特別去紀錄每個 `chunk` 分別存在哪些 `chunk server` 內。

所有的 metadata 都儲存在 Master 的記憶體中。此外，上述 metadata 的前兩項（namespaces 與 file-to-chunk mapping）還會額外做持久化處理，定期寫入硬碟（paper 中稱此檔案為 `operation log`）。

> - 持久化的目的是：當 master crash 並重新啟動時，能夠回到 crash 前的狀態。
> - `master` 除了在自己本地的硬碟存檔外，也會在遠端的機器備份 `operation log` 檔案。
> - `master` 不會把 `chunk` 的實際位置寫入 `operation log` 中，當 `master` 重新啟動之後會先 ask 每個 `chunk server` 來建立 `chunk` 的對應表。

將 metadata 保存在記憶體，讓 Master 可以高效地定期掃描所有 metadata，進而實現 chunk 回收、負載平衡等操作。

## 2.6.3 Operation Log

假設系統已經運行了好幾個月甚至一兩年，突然 Master crash，需要依照 `operation log` 重新建立整個系統狀態。如果從最初的 log 開始逐條執行，可以預期整個重啟時間會非常漫長，這對大型系統來說是難以接受的。

為了縮短重啟時間，必須讓 log 盡可能地精簡。因此當 log 累積到一定長度後，Master 就會建立 `checkpoint file`（並刪除舊的 log file），就像是遊戲的存檔點，讓我們死掉之後不用從頭開始玩。

有了 checkpoint 之後，Master 重啟只需要讀取最新的 `checkpoint file` 即可。`checkpoint file` 以類似 compact B-tree 的資料結構儲存，讀取後可以直接將整個 data structure 映射到記憶體，不需要額外處理，大幅縮短了重啟所需的時間。

## Consistency Model 一致性模型

- 任何有關 `file namespace` 的操作都是 atomic 的，例如 `create` 等操作，一律由 Master 直接處理。

由於多個 client 可能同時發送指令，Master 會依照 `operation log` 來決定執行順序，這也是 `operation log` 的另一個重要用途。

`GFS` 中的資料大致上分成三種狀態:
- 客戶端讀取不同 Replica 時可能會讀到不同的內容，將資料定義為 **`Inconsistent(不一致)`**。
- 客戶端無論讀取哪份 Replica 讀到的內容都是相同的，將資料定義為 **`Consistent(一致)`**。
- 客戶端皆能看到上一次修改的全部內容，且該內容是一致的，將資料定義為 **`Defined(確定的)`**。

> file region 不太好翻譯成中文，可以理解成該次操作所涉及到的文件範圍。
> paper 中這個章節都是用 region 代指資料。

狀態的改變取決於文件的修改類型以及是否成功：

- 單一寫入**成功**，且沒有與其他 `concurrent ` 的寫入重疊，將這部份修改的文件定為 `Defined`(同時也隱含著滿足 `Consistent`)。
- 並行寫入**成功**，只能說這部份的修改滿足 `Consistent` 但 `Undefined`，因為客戶端無法看出單獨的修改內容。
- 寫入失敗會被定義成 `Inconsistent` 而且 `Undefined`。

> 所有的規則都被總結在下方的圖表

![](https://i.imgur.com/xluSnsz.png)

`Data mutations(資料修改)` 也分成兩種不同的類型:
- **`writes`** &rarr; 需要自行決定 `offset`:

`writes` 可以讓 `application` 由指定的 `offset` 來決定位置寫入資料。

- **`record appends`** &rarr; 由 `GFS` 指定 `offset`:

`record appends` 可以確保動作是 atomic 且 at least once，其操作的 `offset` 由 `GFS` 來決定。寫入完成之後 `GFS` 會把實際寫入的 `offset` 回傳給客戶端(代表寫入 data 的 region 的起始位置)

> `GFS` 可能會在文件中寫入 `padding(填充)` 或者重複的資料，就算有也只算佔整個文件的一小部份，這些多餘的資料 region 會被認為是 `Inconsistent`。
> 客戶端還是有機會會讀取到重複的資料，這時候只能依靠上層 application 來過濾重複的訊息。 

在執行了一系列 successful mutation 之後，GFS 保證修改的 file region 處於 `Defined` 狀態。為此 GFS 提供了兩個機制：

- Applying mutations to a chunk in the same order on all its replicas

按照上面有提到的，根據 `operations log` 來控制指令的順序。

- Using chunk version numbers to detect stale replica that missed mutations

使用 `chunk version numbers` 來偵測是否有哪個 `chunk server` 中的 `chunk` 版本不是最新的。如果版本跟其餘不同有可能是該 `chunk server` 剛剛 crash 導致錯過了中間的一些修改。

被偵測到問題的 chunk 之後不會再被 client 指令調用，當 client 詢問 Master 時也不會再回傳該 chunk 的位置，等到下一輪 Master 定期掃描時，該 chunk 就會被 garbage collected 掉。

GFS 內有兩種容錯機制：
- Master 週期性地以 handshake 的方式詢問每台 chunk server，確認其運作是否正常
- 如果某份 replica 的資料損毀，可以透過 checksum 機制偵測，並從其他 replica 恢復資料

> 通常 Master 偵測到錯誤並做出反應的時間在幾分鐘之內。

## 2.7.2 Implications for Applications

大多數 application 都採取 **append（寫在尾部）** 的寫入方式，GFS 對 append 做了性能上的優化。通常一個 writer 只負責單一文件，不會寫到一半去寫別的文件，當這次的寫入完成時，GFS 會以原子性的方式將文件改名成一個永久的文件名稱。

### checkpoint

每個 application 都會週期性地維護一個 checkpoint 訊息，記錄每次成功寫入後的位置，同時也是 Defined 狀態的結束位置。每次 append 操作都會更新這個訊息，writer 若遇到突發狀況中止，下次可以從 checkpoint 繼續寫入；reader 讀取資料時也會把 checkpoint 當作結束位置。

checkpoint 同時紀錄 checksums 來確保各段資料的正確性。這樣的設計讓 writer 可以分段寫入，也讓 reader 能夠從尚未寫入完成的文件中讀取已確認的資料。

### concurrently append

另一個常見的使用場景是多個 writer 同時對同一個文件進行修改，通常出現在合併結果或生產者–消費者模型中。Record append 的 `append-at-least-once` 特性保證了每個 writer 的輸出都不會遺失。

前面的[說明](#Consistency-Model-一致性模型)有提到 GFS 可能會在文件中寫入 padding（填充）或 duplicates（重複資料）。checkpoint 也可以幫助 reader 有效地處理這類問題，盡可能避免讀到錯誤的資料。writer 在每次 checkpoint 時都會加入 checksum 來驗證該段落的有效性，reader 則可以藉由 checksum 辨識出 padding 或 duplicates。

paper 中也提到，若某些應用場景無法容忍偶發的重複資料，可以在 checkpoint 時加入 `unique identifier`，讀取資料時藉由 ID 來過濾重複內容。

## System interactions

### Lease(租約)

由於每份 chunk 都備份在不同的 chunk server 上，修改完 chunk 之後需要一個機制確保所有副本的內容保持一致。GFS 使用 lease（租約）機制來處理多個 chunk 在修改後的一致性問題。

## reference
- [Google File System及其繼任者Colossus
](https://www.itread01.com/content/1546962067.html)
- [The Google File System](https://pdos.csail.mit.edu/6.824/papers/gfs.pdf)
- [MIT6.824](https://pdos.csail.mit.edu/6.824/schedule.html)
- [GFS 中文參考](https://www.open-open.com/lib/view/open1328763454608.html)