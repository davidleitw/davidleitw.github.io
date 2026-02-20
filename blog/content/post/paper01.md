---
title: "Bypassing the Load Balancer Without Regrets - SoCC ’20"
date: 2022-12-19T22:13:53+08:00
draft: false
tags: 
    - eBPF
    - linux
    - linux_kernel
    - network
    - XDP
    - paper
categories: ["paper"]
description: "閱讀 SoCC '20 論文 CRAB，介紹其提出的繞過 Load Balancer 直連後端的新型 L4 負載均衡設計，並比較各種常見 LB 技術的優缺點。"
---

## 前言

最近為了找論文題目看了不少 paper，趁這個機會寫點文章當作閱讀筆記。[這篇論文](https://marioskogias.github.io/docs/crab.pdf)提出了一個新的 load balance 機制，目標是消除 LB 在 data path 上花費的時間，讓 LB 只專注於處理建立連線的請求，一旦決定好 connection 去往哪台 server，就讓 client 與 server 直接連線。細節可以看下方的介紹或論文原文。我覺得這篇 paper 在概念講解的部分畫了幾張不錯的示意圖，如果想搞懂 L4 load balancer 的運作方式，這是一篇很值得推薦的論文。

論文作者也用了 P4、eBPF 等技術實現了他們提出的設計，有興趣的話可以研究看看他們的 [code](https://github.com/epfl-dcsl/crab)。

## 常見 LB 技術分類

論文在前面幾個段落介紹了常見的 load balance 技術，並設計了一些實驗分析各種技術的優劣，以以下五個標準/指標來分類不同的 LB 技術，如下圖所示：

![](https://i.imgur.com/STj3dNc.png)

比較圖表如下:

![](https://i.imgur.com/Vyopids.png)

其中 L4 的 Load Balancer 可以按是否支援 DSR（Direct Server Return）來區分，或者分成 Stateless 與 Stateful。以筆者的理解，大規模服務通常會盡量把 Load Balancer 設計成無狀態的，這樣才能充分發揮雲端環境**動態**擴縮的優勢。另一篇 LB 相關論文 [A High-Speed Load-Balancer Design with Guaranteed Per-Connection-Consistency NSDI2020](https://www.usenix.org/system/files/nsdi20-paper-barbette.pdf) 提到了一個很有意思的觀點，說明為何現在主流的 LB 技術不依賴像是 weighted round robin 或 power of two choices 這類能根據伺服器狀態優化負載的演算法，以下引用該文章的說法：

> A natural question to ask is why existing load balancers do not rely on more sophisticated load balancing mechanisms, e.g., weighted round robin [51],“power of two choices” [33], or least loaded server. The answer lies in the extreme dynamicity of cloud environments. Services and load balancers “must be designed to gracefully withstand traffic surges of hundreds of times their usual loads, as well as DDoS attacks” [3]. This means that the number of servers and load balancers used to provide a service can quickly change over time. 

簡單來說，LB 技術在雲端環境下面臨的最大挑戰，是 LB 與後端 server 的數量會根據請求流量動態調整，或以容器為單位進行調度。在這種情況下，WRR、P2C 這類演算法幾乎沒有用武之地——因為 server 的數量與狀態隨時都在變更，根本無法根據當下狀態做出有效的調度決策。

實驗部分就不多敘述了，接下來看看這篇論文提出的 LB 方案想要滿足哪些條件、又用什麼方式實現。

## CRAB design

這篇論文提出的新 LB 技術取名為 **C**onnection **R**edirect Lo**A**d **B**alancer(**CRAB**)，作者用這段話總結實作的理念

> Implementing a centralized, stateful load balancing policy at a connection granularity requires the load balancer’s involvement only during connection setup, following which the client and server can communicate directly.


### 支援 DSR 模式的 LB 運作流程

![](https://i.imgur.com/imKOVJL.png)


在這個握手過程中，client 先向 Load Balancer 的 VIP 發送 TCP SYN 封包。Load Balancer 將連線分配給特定的後端 server，並將 SYN 封包轉發到其 DIP。由於啟用了 DSR，server 直接向 client 發送來源 IP 為 VIP 的 SYN-ACK 封包。最後，client 向 Load Balancer 發送 ACK 封包，Load Balancer 再轉發給後端 server，完成連線建立。

為了將 LB 從 data path 中抽離，CRAB 運用了一種叫做 *Connection Redirection*（**CR**）的技術。

通常，當 client 發送 SYN 封包後，它會等待目標 IP 回傳 SYN-ACK。如果收到的 SYN-ACK 來源與原本發送 SYN 的目標不同，client 就會直接丟棄該封包。CR 的目的是讓 client 在特定條件下，能夠接受來源 IP 與原始 SYN 目標不同的 SYN-ACK 封包。client 透過驗證收到的 SYN-ACK 屬於自己發起的握手，就可以把連線重定向到另一台 server，不需要再經過 Load Balancer。CR 作為 TCP 的擴充 option 實現，用 4 bytes 存放初始 SYN 封包的目標 IP。

運用了 CR 之後建立連線的示意圖如下

![](https://i.imgur.com/nSgxPCe.png)

- client 首先向 Load Balancer 發送 TCP SYN 封包，封包中也會指示 client 是否支援 CR。這裡假設 client 支援 CR。
- Load Balancer 將連線分配給特定的後端 server，並將 SYN 封包轉發到其 DIP。同時利用 Connection Redirect option 將自己的 VIP 夾帶在封包中，並通知後端 server 這是一個重定向連線。
- server 直接將 SYN-ACK 封包發送給 client，來源 IP 設為自己的 IP，並透過 Connection Redirect option 將 Load Balancer 的 VIP 回傳給 client。
- 最後，client 處理新的 TCP option，將連線重定向，直接把 ACK 封包發送給後端 server，繞過 Load Balancer。

![](https://i.imgur.com/qspk11h.png)

## 結論

這套解決方案確實直觀地降低了 Load Balancer 的負擔，LB 只需要專心處理建立連線的 SYN 封包，同時仍可搭配自己的負載平衡策略。缺點是要妥善利用這個機制，client 端也必須支援 CR；若不支援，就會退回原本 stateless 的 load balance 機制。

筆者比較在意的一點是，將 DIP 暴露給 client 有一定的安全風險，個人認為這種架構比較適合用於內部的 LB。論文第一段也提到，適合的使用場景是 internal load balancer。