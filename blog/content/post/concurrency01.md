---
title: "Concurrency vs Parallelism 淺談兩者區別以及名詞介紹"
date: 2022-03-23T00:12:53+08:00
draft: false
tags: 
    - concurrency
    - parallelism
    - linux
    - linux_kernel
categories: ["Concurrency"]
description: "用暗殺教室與火影忍者的影分身之術，直觀解釋 Concurrency 與 Parallelism 的核心差異，並介紹 context switch、scheduler、preemptive 等重要名詞。"
---

## 前言

最近在複習 jserv 老師的並行與多執行緒程式設計，一開始就介紹了兩個常常被混淆的名詞：Concurrency 與 Parallelism。每次看完感覺懂了，過一陣子要我清楚說明，又有點說不太清楚，所以乾脆寫一篇筆記好好整理一下。

部分說法與圖片參考自 [jserv 老師的講座](https://hackmd.io/@sysprog/concurrency/https%3A%2F%2Fhackmd.io%2F%40sysprog%2FS1AMIFt0D)，內容非常精彩，有機會的話強烈推薦挑戰看看！

## Concurrency(並行) vs Parallelism(平行)

這兩個詞常被混淆，一方面是中文翻譯很像，另一方面是兩者在概念上確實有重疊，所以一開始很難清楚分辨。

Concurrency 通常用來描述程式的架構，將程式功能拆成多個不同且可獨立運行的模組，或稱為工作（Task）；Parallelism 則強調**同時**執行多個程式。底下會詳細舉例說明兩者的差異。

Concurrency 把程式功能拆分成小的 Task 之後，如果讓這些 Task **同時**運作，就可以說 Concurrency 也用到了 Parallelism。換句話說，不一定要有 Parallelism 才能實現 Concurrency 的目的。

Concurrency 強調的是把程式**拆**開成多個可獨立執行的模組，但不要求這些模組一定要**同時執行**。

![](https://i.imgur.com/6F2ptaH.png)

Parallelism 更強調的是**同時**的概念，不同的任務可以分配給不同的硬體，同一時間會有多個任務一起同時執行。

![](https://i.imgur.com/qW0Whec.png)


總結來說，Concurrency 偏向討論程式架構的設計，著重如何把一個任務拆成多個可獨立執行的子任務；Parallelism 則討論資源分配的議題，目標是讓多個子任務能夠同時執行。

### 單一 cpu 的 Concurrency

在以前的年代，或者一些資源受限的環境下，運算資源可能只有單個 cpu。這時候如果有多位使用者想同時使用這台電腦，就必須營造出 Concurrency 的感覺，讓每個使用者都以為自己佔用了全部的資源。

以下是 jserv 老師上課給的範例：

![](https://i.imgur.com/4nZ9RVx.png)

在單一 cpu 的場景下，同一時間只能有一個任務被執行，所以硬體必須在不同任務之間快速切換。在人類的視角來看，每位使用者都以為自己擁有全部的資源，但其實只是切換速度夠快，產生了一種錯覺。

![](https://i.imgur.com/F4uHK2q.png)


以[暗殺教室](https://zh.wikipedia.org/wiki/%E6%9A%97%E6%AE%BA%E6%95%99%E5%AE%A4)的殺老師為例：漫畫中有一幕，殺老師想替班上每位學生量身打造上課教材，但上課時間是固定的。這時候，顯然殺老師修過 Linux 核心設計，知道在單核的情況下只能靠快速切換，讓每位學生在體感上都覺得上滿了整節課，示意圖如下：

![](https://imgur.com/1esyuuQ.gif)

~~找不到上課的素材，只能用體育課的快速切換當示意圖~~

殺老師只有單一個體，可以視作單一 cpu，在不同使用者之間快速切換。這樣的行為可以說是 Concurrency，但不能稱為 Parallelism——因為不管移動再快，本質上都不符合**同時**的要求。

那動漫界最適合解釋 Parallelism 的角色是誰呢？當然是火影忍者的漩渦鳴人，他的招牌多重影分身之術就非常適合拿來說明 Parallelism 的概念。

![](https://i.imgur.com/jwfYWHM.png)

在設定上，多重影分身的每個分身都是有實體的存在。如果每個分身**同時**執行某項任務，就完全符合 Parallelism 的概念。

舉個例子：鳴人在寫作業，總共有 10 題，他叫出九個分身，大家一起分工完成。這樣一來，一個大任務（作業）被拆成 10 個子任務（每一小題），而且十個人同時各自作業，就同時滿足了 Concurrency 與 Parallelism 的定義。

## Process and Thread

恐龍書對 process 與 thread 有不同的定義，但在 Linux kernel 中兩者並沒有明確的區分。程式中都以 `task_struct` 來表示一個 process 或 thread，兩者的差別只在於呼叫 system call 時傳入的參數不同，本質上都是以 `task_struct` 表示一個執行單元。

## 工作切換 (context switch)

context switch 是指 os 將目前執行中的 process 暫停，切換到下一個要執行的任務，這個動作就稱為 context switch。

被暫停的任務通常在某個時間點還是會繼續執行，所以在進行 context switch 時，必須保存舊 process 的相關資料，像是下一條要執行的指令位址、被暫停當下的暫存器狀態等等。

等到之後再度 context switch 回來繼續執行時，整個環境必須還原到當初被暫停的狀態。context switch 的實作品質在很大程度上決定了整個系統的 response time，如果 context switch 做得不好，使用者就可能感受到明顯的延遲。

## 排程器 (scheduler)

scheduler 的功能是決定 CPU 下一個要執行的任務，並且執行 context switch，將控制權交給新任務的下一條指令。

排程演算法是一個許多人持續研究的議題，核心問題在於如何恰當地分配硬體資源，同時還要考慮不同任務的 priority，確保高 priority 的任務能夠優先被安排。

每個任務通常會被分配一段固定的執行時間，稱為 time slice。不過 time slice 不一定是固定長度，某些排程演算法會根據當時的情況動態調整每個任務分配到的 time slice。

## Preemptive vs Non-preemptive

preemptive 與 non-preemptive 的核心差別，在於執行中的 process 是否**自願**交出 cpu 使用權，還是被迫放棄。

non-preemptive 的優點是可預估程式的完成時間（不會突然被中斷），context switch 的次數也相對較少；代價是每個 process 的 waiting time 可能會拉得很長。

在 preemptive 的系統中，process 可能在執行途中被插隊，**被迫讓出** cpu 給另一個 process。插隊的原因有很多，像是 time-out、interrupt 發生，或者有更高 priority 的 process 需要執行。

目前主流的 os 幾乎都採用 preemptive 的設計，因為有 priority 的概念，可以根據需求靈活調整排程順序。

non-preemptive 的 os 就沒這麼彈性了。舉個例子：診間有 20 個病人在排隊，結果第 12 號突然暈倒在地上抽搐，醫生卻說「我們診所是 non-preemptive 設計，等我看完前面 11 個病人再去急救」——~~然後病人就葛屁了~~。

preemptive 作業系統的最大優勢就是 response time 短，能夠快速因應各種緊急事件。實作難度雖然比 non-preemptive 高不少，但對於商用或伺服器等級的 os 來說，這通常不是考量的重點。