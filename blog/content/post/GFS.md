---
title: "The Google File System (GFS) 論文心得"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - distributed
    - paper
categories: ["paper"]
description: GFS
---

跟著 [MIT6.824](https://pdos.csail.mit.edu/6.824/schedule.html) 的課程進度， 在 Lec3 終於拜讀了這篇經典的論文，**```GFS```** 是一個分散式的檔案系統，由 Google 開發。 在2003年時 Google 發表了 [The Google File System](https://pdos.csail.mit.edu/6.824/papers/gfs.pdf) 這篇論文來分享一些 **```GFS```** 開發上的細節， 雖然 Google 沒有開源這個著名的檔案系統， 不過還是可以由 paper 來窺探當初 Google 設計的細節以及整體的架構。

## 背景

為了滿足當初 Google 日漸增長的資料處理需求， Google開發了 **```GFS```** 這套分散式檔案系統。 
> 用分散式的原因: 要處理的檔案大小已經遠遠超過單機可以容納的資料量
 
跟過往很多分散式系統一樣，**```GFS```**  也追求著以下幾點需求:

- **performance** 性能
- **scalability** 擴展性
- **reliability** 可靠性
- **availability** 可用性

因為成本以及其他因素的考量之下，Google 並沒有選擇商業用的 server 來製作 **```GFS```** 這套系統， 而且採用一般的 **普通主機(inexpensive commidity hardware)** 來作為叢集成員。因為是普通的主機，所以沒有商業用的 server 穩定， 在設計 **```GFS```** 的時候必須一併考慮容錯問題來增加穩定性。

在 **Introduction** 中也有先簡單介紹了 **```GFS```** 的幾個特色

- **元件失效(component failures)** 被認為是常態

**```GFS```** 中包含著數以百計或者更多的儲存機器，每一台都有可能在任何一個時間點發生不可預期的錯誤，也有些錯誤是無法從中恢復的。 所以 **```GFS```** 需要實現**持續的監控，錯誤偵測，容錯跟自動恢復**等功能。

- **```GFS```** 中的檔案通常大(GB級以上)而少

大的檔案裡面可能含有數億個 object， 一次管理數億個 kb 大小的物件是很不明智的。 所以 I/O 操作，Block 大小等參數都需要另外考慮。

- 資料讀寫特性(絕大部份資料都符合以下特性)

對於大部份資料都會將新資料添加在舊文件的尾部而不是去修改它，一旦寫入完成，文件將會變成唯讀，且必定是按照順序讀(only sequentially)。幾乎沒有隨機寫入或者隨機訪問(ex: 在文件中間插入資料等..)。 由此可知 append data 的操作是優化性能以及保持原子性的重點。

- **atomic append operation**

對於 append 實現了原子操作，使得多個 client 端可以同時對一個文件寫入又不需要額外的同步操作來維持一致性。

**```GFS```** 沒有強調低延遲，而是把重點放在巨大的 **throughput** 。

在 paper 的 ```2.1 Assumptions``` 章節中簡單描述的設計 **```GFS```** 的預期目標。

## Interface

**```GFS```** 提供了一系列類似傳統文件系統的 API 接口，且並沒有完全遵照 POSIX 的規範。

支持一些常見的功能
- **create**
- **delete**
- **open**
- **close**
- **read**
- **write**
- **snapshot**
- **record append**

**snapshot** 指令可以用很低的成本創建一個文件或者目錄的 ```copy```。
**record append** 指令允許多個 ```clients``` 同時對一個文件進行寫入動作，同時確保了每個 ```client``` 端寫入動作的原子性。讓 ```client``` 端可以不用花費額外的心力解決同步問題。

## Architecture
![](https://i.imgur.com/ftek3c4.png)

整個 **```GFS```** 包含一個 ```Master``` 節點，以及多台 ```chunk server```，每台 ```chunk server``` 都可以同時被多個 client 存取。
 
在 **```GFS```** 中儲存的每個文件都會被分割成固定大小的 ```chunk```，每個 ```chunk``` 創建時都會由 ```Master``` 分配一個 globally unique ```64 bits chunk handle(chunk ID)```。

```chunk server``` 會把 ```chunk``` 以一般 linux file 的形式儲存在 server 底下的硬碟之中，要讀寫的時候可以根據 ```chunk handle``` 以及偏移量來決定範圍。

> 預設每個 chunk 都會備份在三個不同的 chuck server，用戶可根據需求調整文件的備份數量。

```Master``` 主要管理所有的 [metadata](https://zh.wikipedia.org/wiki/%E5%85%83%E6%95%B0%E6%8D%AE)，除了一些系統設定參數之外，還有幾個 table 是需要特別了解的。

- **file name &rarr; array of the chunk handle**

```Master``` 管理的資料裡面最重要的一項就是儲存每個文件名稱對應的 ```chunk handle``` 陣列，一個資料進入 **```GFS```** 當中都會被拆成數個 ```chunk``` 分散在系統的各處，當 client 想要存取某個文件時，會先跟 ```Master``` 告知文件的名稱，```Master``` 就會查表來得知這個文件的各個 ```chunk handle```。

- **chunk handle 相關資訊**

獲得 ```chunk handle``` 之後，```Master``` 還有另一個表可以查詢各個 ```chunk handle``` 的相關資料，

> 因為有備份機制，所以每個 chunk 會被儲存在多個 chunk server內。


```Master``` 會以 **HeartBeat message** 的形式週期性得與每個 ```chunk server``` 通訊，以獲得 ```chunk server``` 的狀態。  

metadata會在後面的章節詳細再說明

## Single Master 設計理念

single master 的設計可以讓其透過全局的訊息來紀錄每個 ```chunk``` 的位置還有關於資料複製的決策，大大減少了設計的難度。

之後就衍生出另一個問題是只有 single master 的話，設計上需要盡可能的減少 ```Master``` 的工作量，不能讓 single master 的設計反而成為整個系統的效能瓶頸。

```client``` 的文件讀寫絕對不會透過 ```Master``` 來與 ```chunk server``` 溝通，```Master``` 的工作只有傳送 ```chunk``` 的各種資料，```client``` 獲得應該要與哪一個 ```chunk server``` 溝通後，會直接與其連線。 
> client 會將 chunk 的 metadata 緩存一段時間，讓後續相同的操作不需要再去詢問 master。

## chunk size 選擇議題

paper 中有一個章節簡單分析了一下 ```chunk size``` 選擇的問題，會甚麼選擇 64MB 這個遠大於普通 block 的大小，以及選擇的優缺點。


- 優點:減少 ```client``` 與 ```master``` 的通訊量， metadata 大小:

由於 ```sinlge master``` 的設計，每個環節都要盡可能地降低 ```master``` 的運算時間，避免 ```master``` 成為整個系統的效能瓶頸。

使用很大的 ```chunk size``` 可以讓 ```client``` 得到一個 ```chunk``` 的位置後進行多次的讀寫(會維持一段時間的 tcp 連線)，不會遇到寫幾行就要換下一個 ```chunk``` 的情況發生，另一方面也代表 ```chunk``` 的個數會下降，降低 ```master``` 需要儲存的 metadata，讓 ```master``` 把所有的 metadata 都存放在 memory 內。


- 缺點:熱點(hot spot)問題:

對於小文件來說，很可能 ```chunk``` 的數量很小，可能只有一個 ```chunk```，這種情況下有可能會發生同時有多個 ```client``` 訪問同一個文件的，導致熱點的發生。

這個 file 可能是配置參數 or something else，解決這個方案的長久之計可能是當遇到這種情況的時候允許 ```client``` 可以從別的 ```client``` 端讀取資料。

## Metadata

`Master` 主要維護三種類型的 `metadata`
- 命名空間相關
- 文件名稱(`file name`)與 `chunk` 的映射

每個文件以 64 MB 的大小分割成數個 `chunk`，此 table 專門儲存每個文件對應的 `chunk` 的 `chunk handle`。

- `chunk handle` 與 `chunk server` 的映射

因為一個 `chunk` 會備份之後存在各個 `chunk server`，所以會有一個 table 特別去紀錄每個 `chunk` 分別存在哪些 `chunk server` 內。

所有的 `metadata` 都會儲存在 `master` 的 memory 中。除此之外，上述 `metadata` 的前兩點(namespaces and file-to-chunkmapping) 都會額外的做持久化的處理，定期寫入硬碟內。(paper 中把此檔案稱為 `operation log`)

> - 持久化是避免 master crush 需要重新啟動的時候可以回到關機前的狀態。
> - `master` 除了在自己本地的硬碟存檔外，也會在遠端的機器備份 `operation log` 檔案。
> - `master` 不會把 `chunk` 的實際位置寫入 `operation log` 中，當 `master` 重新啟動之後會先 ask 每個 `chunk server` 來建立 `chunk` 的對應表。

把 `metadata` 保存在記憶體可以讓 `master` 很有效率的定期掃描所有的 `metadata`，藉此來達到 `chunk` 回收，負載平衡等操作。

## 2.6.3 Operation Log

假設今天系統已經跑了好幾個月甚至一兩年了，突然 `master` crush，需要按照 `operation log` 重新 set up 整個系統，如果從一開始的 `log` 慢慢條列執行，可以預期整個系統重啟的時間會非常的久，這對於一個大型系統來說是不太能接受的。

為了讓重新啟動的時間降低，必須要想辦法讓 `log` 盡可能的變小，所以在 `log` 增長一定長度之後 `master` 就會創建 `checkpoint file`(並且刪掉舊的 `log file`)，就像是遊戲的存檔點一樣，可以讓我們死掉之後不用重頭開始玩起。

有了 `checkpoint` 之後 `master` 重啟只要讀取最新的一次 `checkpoint file` 即可，`checkpoint file` 是以類似 compact B-tree 的資料結構儲存的，讀取這個檔案後可以把整個 data structure 映射到記憶體內不需要額外的處理，大大的加快了整個重啟的時間。

## Consistency Model 一致性模型

- 任何有關於 `file namespace` 的操作都是 atomic的，例如 `create` 等等操作，並且經由 `master` 直接處理。

因為 `client` 可能同時發送指令，`master` 會依照 `operation log` 來決定執行順序，這也是 `operation log` 的另一個重要用處。

`GFS` 中的資料大致上分成三種狀態:
- 客戶端讀取不同 Replica 時可能會讀到不同的內容，將資料定義為 **`Inconsistent(不一致)`**。
- 客戶端無論讀取哪份 Replica 讀到的內容都是相同的，將資料定義為 **`Consistent(一致)`**。
- 客戶端皆能看到上一次修改的全部內容，且該內容是一致的，將資料定義為 **`Defined(確定的)`**。

> file region 不太好翻譯成中文，可以理解成該次操作所涉及到的文件範圍。
> paper 中這個章節都是用 region 代指資料。

那狀態的改變想當然就會取決於文件的修改類型以及是否成功

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

在執行了一系列的 `successful mutation` 之後，`GFS` 保證修改的 `file region` 是 `Defined` 的狀態。為此 `GFS` 有兩個機制可以協助達成此目的。

- Applying mutations to a chunk in the same order on all its replicas

按照上面有提到的，根據 `operations log` 來控制指令的順序。

- Using chunk version numbers to detect stale replica that missed mutations

使用 `chunk version numbers` 來偵測是否有哪個 `chunk server` 中的 `chunk` 版本不是最新的。如果版本跟其餘不同有可能是該 `chunk server` 剛剛 crush 導致錯過了中間的一些修改。

被偵測到錯誤的 `chunk` 之後不會再被 `client` 的指令調用，當 `client` 詢問 `master` 時也不會再回傳該 `chunk` 的位置。等到下一輪 `master` 定期掃描時該 `chunk` 就會被 `garbage collected` 掉。

`GFS` 內有兩種容錯機制
- `master` 週期性的 `handshakes` 來詢問每個 `chunk server` 確認是否正常運作
- 如果有 `replica` 的資料損毀，可以藉由 `checksum` 的機制檢測出來，然後可以藉由其他的 `replica` 來恢復資料。
> 通常 master 偵測到錯誤並且反應的時間大概是幾分鐘之內。

## 2.7.2 Implications for Applications

大部分的 `application` 都採取 **appending(寫在尾部)** 的寫入方式， `GFS` 對於 append 有做性能上的優化。通常一個 `writer` 只會負責單一文件，不會寫入到一半跑去寫別的文件，當這次的寫入完成時，`GFS` 會保證原子性的方式把文件改名成一個永久的文件名稱。

### checkpoint

每個 `application` 都會週期性的維護一個 `checkpoint` 訊息，該訊息紀錄每次成功寫入後的位置同時也是 `Defined` 狀態的結束位置，每次 `append` 的操作都會更新這個訊息，`writer` 如果遇到什麼突發狀況中止了，下次也可以從 `checkpoint` 開始繼續寫入，`reader` 讀取資料也會把 `checkpoint` 當作結束位置。

`checkpoint` 也會同時紀錄 `checksums` 來確保每個段落的正確性。`checkpoint` 的設計可以使得 `writer` 一段一段的寫入資料，讓 `reader` 可以從還沒有寫入完成的文件中讀取資料。

### concurrently append

在另外一個常見的使用場景，通常會有很多 `writer` 同時對同一個檔案做修改，通常是在合併結果或者是用於 `生產者–消費者模型`。`Record append` 的 `append-at-least-once` 特性保證了每個 `writer` 的輸出。

在前面的[說明](#Consistency-Model-一致性模型)中有簡單提到過 `GFS` 可能會在文件中寫入 `padding(填充)` 或者`duplicates(重複的資料)`。`checkpoint` 也可以讓 `reader` 有效的處理上述的問題，盡可能得去避免讀到錯誤的資料。`writer` 在每次 `checkpoint` 的時候都會加入 `checksum` 來驗證上面段落的有效性，`reader` 可以藉由 `checksum` 來辨識 `padding` 或者 `duplicates`。

在 paper 中也有簡單說明如果 `application` 某些應用場景無法忍受偶發的重複資料，可以在 `checkpoint` 的地方加入一個 `unique identifiers`，讀入資料的時候可以藉由 ID 來避免重複資料。

## System interactions

### Lease(租約)

因為我們每份 `chunk` 都會備份在不同的 `chunk server` 內，所以需要有一個機制在修改完 `chunk` 之後讓所有複製的 `chunk` 都相同的內容。`GFS` 中使用 `leases` 去處理多個 `chunk` 在經過修改之後的一致性問題。

## reference
- [Google File System及其繼任者Colossus
](https://www.itread01.com/content/1546962067.html)
- [The Google File System](https://pdos.csail.mit.edu/6.824/papers/gfs.pdf)
- [MIT6.824](https://pdos.csail.mit.edu/6.824/schedule.html)
- [GFS 中文參考](https://www.open-open.com/lib/view/open1328763454608.html)