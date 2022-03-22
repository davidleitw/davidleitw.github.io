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
---

## 前言

最近在複習 jserv 老師的並行與多執行緒程式設計，一開始介紹了兩個常常被混淆的名詞，Concurrency 與 Parallelism，每次感覺懂了，過一陣子要我清楚的說明又有點講不太清楚，所以來寫一篇筆記紀錄一下。

裡面有些說法跟圖片是參考 [jserv 老師的講座](https://hackmd.io/@sysprog/concurrency/https%3A%2F%2Fhackmd.io%2F%40sysprog%2FS1AMIFt0D)，裡面內容非常精彩，有機會的話一定要挑戰看看!

## Concurrency(並行) vs Parallelism(平行)

常被混淆的原因不只是因為兩個單字的中文翻譯很像，而且兩者在觀念上也有重疊的部份，所以一開始很難去分清楚這兩者的差異。

Concurrency 通常用來描述程式的架構，將程式的功能拆成多個不同且獨立運行的模組或稱為工作(Task)，Parallelism 則是強調**同時**執行多個程式，底下會詳細舉例說明兩者的差異。

Concurrency 把程式功能拆分的小的 Task 後，如果**同時**運作，就可以說 Concurrency 有用到 Parallelism，所以不一定要用 Parallelism 才能達到 Concurrency 的目的。

Concurrency 只有強調把程式**拆**開成多個可獨立執行的模組，但沒有強調這些拆開的模組一定要**同時執行**。

![](https://i.imgur.com/6F2ptaH.png)

Parallelism 更強調的是**同時**的概念，不同的任務可以分配給不同的硬體，同一時間會有多個任務一起同時執行。

![](https://i.imgur.com/qW0Whec.png)


所以講到 Concurrency 偏向討論在程式架構上，把一個任務拆成多個可獨立執行的子任務，Parallelism 則討論規劃怎麼分配資源的議題，讓多個子任務可以同時執行。

### 單一 cpu 的 Concurrency

在以前的年代，或者一些資源受限的環境下，可能運算資源只有單個 cpu，這時候如果有多位使用者想同時使用這台電腦就必須要營造出 Concurrency 的感覺，讓每個使用者都覺得自己使用了這個電腦的全部資源。

底下的 jserv 老師上課給的範例

![](https://i.imgur.com/4nZ9RVx.png)

可以看到在單一 cpu 的場景，意味著同一時間只能有一個任務被執行，所以硬體需要在不同任務之間快速切換，在人類的角度，每個電腦的使用者都覺得自己有著所有的資源，但其實只是切換的速度很快，讓使用者有種錯覺。

![](https://i.imgur.com/F4uHK2q.png)


以[暗殺教室](https://zh.wikipedia.org/wiki/%E6%9A%97%E6%AE%BA%E6%95%99%E5%AE%A4)的殺老師為例，先不用講詳細的設定，在漫畫中有一幕場景，殺老師想要為底下的學生每個人量身打造上課的教材，但是上課時是固定的，這時候顯然殺老師有修過 Linux 核心設計，所以知道在單核的情況下只能透過快速的切換讓底下每位學生在體感上都上滿一整節課，示意圖如下

<iframe src="https://gifmagazine.net/embed/glp/1278421" width="300" height="168" frameBorder="0" class="gifmagazine-embed" allowFullScreen></iframe><p><a href="https://gifmagazine.net/post_images/1278421" target="_blank"></a></p>

~~找不到上課的素材，只能用體育課的快速切換當示意圖~~

因為殺老師只有單一個體，所以可以視作單一 cpu，在不同使用者之間快速切換，這樣就可以說他是 Concurrency，但是不能稱為 Parallelism，不能稱為 Parallelism 是因為即使移動的再快，都不符合**同時**的要求。

那動漫界最適合解釋 Parallelism 的角色是誰呢? 當然是火影忍者的漩渦鳴人了，他的招牌多重影分身之術就很適合拿來解釋 Parallelism 的概念。

![](https://i.imgur.com/jwfYWHM.png)

在設定上，多重影分身中每個分身都是有實體的存在，如果每個分身**同時**進行著某個任務的話，我們就可以說符合 Parallelism 的概念。

今天如果鳴人在寫作業，總共有10題，他叫了九個分身，大家一起完成作業，所以一個大的任務(作業)拆成10個子任務(每一個小題)，而且十個人同時去完，這樣就同時符合 Concurrency 跟 Parallelism 的定義了。

## Process and Thread

在恐龍書的課本上，對於 process 與 thread 有不同的定義，但在 Linux kernel 中兩者並沒有明確的區分，在程式中都用 `task_struct` 來表示一個 process 或者 thread，兩者的區別只有呼叫 system call 時傳入不同的參數，但是本質上都是用 `task_struct` 表示一個執行單元。

## 工作切換 (context switch)

context switch 是指 os 想要把目前執行中的 process 暫停，並且切換到下一個要執行的任務，這個動作就被稱為 context switch。

一般情況下被暫停的任務之後在某個時間點還是會被繼續執行，所以在進行 context switch 時必須要紀錄舊的 process 的相關資料，像是舊的 process 下個要執行指令的 address，或者被停止時暫存器的相關資料等等。

在後續 context switch 到舊的 process 繼續執行時，整個環境必須要回到舊的 process 被停止時的狀態，context switch 的實現很大一部份決定了整個系統 response 的速度，如果 context switch 做的不好，使用者可能會感受到很明顯的延遲。

## 排程器 (scheduler)

排程器 (scheduler) 的功能是決定 CPU 下一個要執行的任務，並且執行 context switch 指向新的任務下一個要執行的指令位置。

排程的演算法也是一個很多人在研究的議題，要如何恰當的分配硬體資源，還要考慮一些工作可能有比較高的 priority，怎麼優先去安排高 priority 的任務等等。

每一個任務可能都被分配一定的時間去執行，那段執行的時間被稱為 time slice，time slice 也不一定是固定時間，根據排程演算法的不同，有些演算法會動態的決定一個任務分配到的 time slice。

## Preemptive vs Non-preemptive

搶佔式(preemptive) 與非搶佔式(non-preemptive) 的差別在於在執行中的工作(process)是否為自願(voluntary)交出 cpu 使用權，又或者被迫放棄 cpu 使用權。

non-preemptive 的優點在於可預估程式的完成時間(不會突然被中斷)，context switch 的次數也相對較少，但相對的每個 process 的 waiting time 就會上升。

preemptive 系統中 process 可能會在執行的途中被插隊，**被迫放棄** cpu 週期給另外的 process，被插隊有很多種不同的原因，像是 Time-out, Interrupt 發生，高優先權的 process 插隊等等。

現在主流的 os 都用了 preemptive 的概念，有優先權的概念會比較彈性，可以根據需求去調整。

non-preemptive 的 os 比較沒彈性，舉個例子，像是如果有 20 個病人在排隊門診，這時候第 12 號的病人突然暈倒在地上抽搐，這時候醫生說因為我們診所是 non-preemptive 的設計，所以等我看完前面 11 個門診病人，就去幫它急救，~~然後病人就葛屁了~~。

preemptive 的作業系統最大的優點就是 response time 很短，面對不同的需求可以快速的調整排程的優先順序，讓緊急的事件先處理，但是以實作難度來說就會相對於 non-preemptive 高很多，不過真的商用或者伺服器的 os，應該在設計上不會考慮實作難度這件事情。