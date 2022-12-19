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
---

## 前言

最近為了找論文題目看了不少論文，剛好趁這個機會寫點文章當作讀這些 paper 的學習筆記，[這篇](https://marioskogias.github.io/docs/crab.pdf) 主要提出一個新的 Load balance 的機制，希望可以消除 LB 在 data path 花費的時間，讓 LB 專注於處理連線請求，決定 connection 去往哪台 server 之後就讓 Client 與 server 之間直接連線，細節就看底下的簡介或者論文內文吧，我覺得這篇 paper 在概念講解的地方畫了幾張不錯的示意圖，如果想要解釋 L4 的 load balancer 怎麼運作的，這是一篇滿推薦的論文。

這篇論文的作者也用了 P4, eBPF 等技術實現了他們的論文，如果有興趣的也可以研究看看實現的 [code](https://github.com/epfl-dcsl/crab)

## 常見 LB 技術分類

這篇論文在前面的幾個段落介紹了常見了 Load Belance 技術，然後規劃了一些簡單的實驗來分析各種不同技術的優劣，文中用以下五個標準/指標來分類不同種類的 LB 技術，如下圖所示

![](https://i.imgur.com/STj3dNc.png)

比較圖表如下:

![](https://i.imgur.com/Vyopids.png)

其中 L4 的 Load Balancer 以形式可以分成有沒有支援 DSR(Direct Server Return)，又或者分為 Stateless 和 Stateful，以筆者的理解大規模的服務來說會盡量把 Load Balancer 設計成無狀態的，這樣才能把雲端環境的**動態**優勢發揮出來，像是另一篇關於 LB 的論文 [A High-Speed Load-Balancer Design with Guaranteed Per-Connection-Consistency NSDI2020](https://www.usenix.org/system/files/nsdi20-paper-barbette.pdf) 有提到一個觀點，為什麼現在主流的 LB 技術都不依靠像是 weighted round robin 或者 power of two choices 這種可以根據伺服器狀態來最佳化負載的演算法，以下引用該文章的說法

> A natural question to ask is why existing load balancers do not rely on more sophisticated load balancing mechanisms, e.g., weighted round robin [51],“power of two choices” [33], or least loaded server. The answer lies in the extreme dynamicity of cloud environments. Services and load balancers “must be designed to gracefully withstand traffic surges of hundreds of times their usual loads, as well as DDoS attacks” [3]. This means that the number of servers and load balancers used to provide a service can quickly change over time. 

簡單來說，負載平衡技術在雲端環境下會面臨的挑戰在於 LB 或者後端 Server 的數量會根據請求的流量動態調整，或者是以容器為單位的調度，這種時候像是 WRR, P2C 這類的演算法就毫無用武之地，因為 Server 的數目跟狀態隨時都在變更，無法根據當時的狀態找出較好的調度方案。

實驗部份就不過多敘述了，接著來看這篇論文提出的 LB 方案想要滿足什麼條件，用什麼方式達成

## CRAB design

這篇論文提出的新 LB 技術取名為 **C**onnection **R**edirect Lo**A**d **B**alancer(**CRAB**)，作者用這段話總結實作的理念

> Implementing a centralized, stateful load balancing policy at a connection granularity requires the load balancer’s involvement only during connection setup, following which the client and server can communicate directly.


### 支援 DSR 模式的 LB 運作流程

![](https://i.imgur.com/imKOVJL.png)


在這個握手過程中，Client 會先向 Load Balancer 的 VIP 發送 TCP SYN 封包。Load Balancer 會將這個連接分配給特定的後端伺服器，並將 SYN 封包轉發到其 DIP。由於啟用了 DSR，伺服器會直接對 Client 發送一個源 IP 為 VIP 的 SYN-ACK 封包。最後，Client 會向 Load Balancer 發送 ACK 封包，Load Balancer 會將其轉發到後端伺服器，以完成連接建立。

為了能把 LB 從 data path 抽離，CRAB 運用了一個 *Connection Redirection* (**CR**) 的技術。

通常，當 Client 發送 SYN 包時，它會等待目標 IP 的 SYN-ACK 響應。如果收到的 SYN-ACK 與之前發送 SYN 的地址不同，則客戶端會丟棄該包。CR 的目的是允許 Client 在一定條件下接受與發送 SYN 地址不同的 SYN-ACK 包。這使得 Client 可以通過驗證收到的 SYN-ACK 包是其發起的握手的一部分來避免與負載平衡器直接連接，而是將連接重定向到另一個目標，CR 作為一個 TCP 的擴充 option 被實現，用 4 bytes 來存放初始丟 SYN 封包的 Initial destination IP。

運用了 CR 之後建立連線的示意圖如下

![](https://i.imgur.com/nSgxPCe.png)

- 在傳統的 TCP 情況下，Client 首先向 Load Balancer 發送 TCP SYN 包。這個 TCP SYN 包也會指示 Client 是否支持 CR。在這種情況下，我們假設 Client 支持 CR。
- Load Balancer 將該連接分配給特定的後端服務器，並將 SYN 包轉發到其 DIP。此外，它使用 Connection Redirect 選項將其 VIP 包含在數據包中，並告知後端服務器這是一個重定向連接。
- 服務器隨後直接將 SYN-ACK 包發送到 Client，源 IP 設置為其自己，並使用 Connection Redirect 選項回顯 Load Balancer 的 VIP。
- 最後， Client 處理新的 TCP 選項，並將連接重定向，從而將 ACK 包直接發送到後端服務器並繞過 Load Balancer

![](https://i.imgur.com/qspk11h.png)

## 結論

這套解決方案的確直觀的降低了 Load Balancer 的壓力，LB 只要專心處理建立連線的 SYN 封包，也能夠搭配自己的負載平衡策略，但缺點可能是如果要妥善利用這個機制需要 Client 也支援 CR，否則不支援的情況會退回原先的 stateless 的 load balance 機制。

最後筆者比較在意的地方是把 DIP 暴露給 Client 有一定的風險，我認為這種架構比較適合內部的 LB，論文第一段也有提到適合場景是 Internel load balancer。