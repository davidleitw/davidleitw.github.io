---
title: "SDN 學習筆記(一): SDN 的發展歷史以及基本名詞介紹"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - network
    - SDN
categories: ["SDN"]
description: "從 SDN 的發展歷史出發，介紹 Software Defined Networking 的基本架構與 control plane、data plane 分離的核心設計理念。"
---

這個系列用來整理學習 SDN 的相關知識與參考資料。由於剛開始學，會著重於個人學習的**順序**，希望在整理的過程中也能幫助到同樣在研究 SDN 的朋友。

如果有描述不正確的地方，也歡迎各位前輩指點。

## 預備知識

學習 SDN 之前，我先重新複習了一輪 [Computer Networking: A Top-Down Approach 7th](https://www.ucg.ac.me/skladiste/blog_44233/objava_64433/fajlovi/Computer%20Networking%20_%20A%20Top%20Down%20Approach,%207th,%20converted.pdf)。大學學過的很多東西有點忘了，先把傳統網路概論複習一遍，之後才能比較清楚地理解 SDN 為什麼會被提出、它具體解決了哪些傳統架構無法解決的問題。

之後會陸續整理一些網路基礎理論的筆記，讓後面的 SDN 概念更好解釋。

## 什麼是 SDN 以及 SDN 的發展歷史

> 參考文章
> - [SDN 簡介](https://feisky.gitbooks.io/sdn/content/sdn/)
> - [SDN 發展趨勢](https://hackmd.io/@cnsrl/SJur_2twL)

傳統網路的幾個特點：
- 每個節點由設備單獨控制，屬於分散式架構
- 控制面與轉接面放在同一台設備上
- 管理員無法直接操作封包轉送行為，只能設定通訊協定，再透過協定的規則間接影響設備
- 通訊協定對設備的影響是固定的，無法突破協定本身的規則

SDN 的目標是採取集中式控制，要求轉接面與控制面分離，由遠端的 controller 計算並下發每個路由器的轉送表，讓管理員可以直接操作設備轉封包的行為。

![](https://i.imgur.com/uF2pcH0.png)

SDN 並非一種具體技術，而是一種設計理念：只要符合**控制面與轉接面分離**，並提供開放的**可程式化**介面，就可以稱為 SDN 架構。SDN 通常也伴隨著**集中控制**的特性——controller 可以取得整個網路的全局視角（而非傳統架構只能看到局部資料），再根據業務邏輯進行調整與優化。


## 常用名詞解釋

![](https://sites.google.com/a/cnsrl.cycu.edu.tw/da-shu-bi-ji/_/rsrc/1565708281052/sdn/sdn_architecture.png)


### Network Device 網路設備

網路設備不限於實體設備（例如 switch、路由器），也可能是虛擬 switch（例如 OVS）。封包在網路設備上被處理與轉送，設備透過 Southbound Interface 接收 controller 下發的轉送規則，也可以將資料回傳給 controller。

網路設備有時也被稱為 **Data Plane**。

支援 OpenFlow 的 switch 具備以下功能：
- 對接收到的封包進行修改或轉送到指定 port
- 將封包轉送給 controller（Packet-In）
- 接收來自 controller 的封包並轉送到指定連接埠（Packet-Out）

### 南向界面（Southbound Interface / Control Data Plane Interface）

南向界面是 Data Plane 與 Controller 之間的介面。SDN 架構理想上希望南向界面是標準化的，讓軟體不受硬體限制，能在任何設備上執行，不過目前仍是理想多過現實。

目前主流的南向界面標準是 OpenFlow 協定，雖然也有其他南向界面，但 OpenFlow 仍是大宗。

> 因為也是新手，所以從 OpenFlow 開始學 SDN，本系列也會著重在 OpenFlow 協定上。

### 控制器（Controller）

**Controller** 是 SDN 的核心，應用程式將業務邏輯傳給 Controller，再由 Controller 透過 Southbound Interface 將轉送規則下發給網路設備，是整個 SDN 架構最重要的部分。

目前 controller 的選擇很多，有不少開源版本（例如 Ryu、FloodLight、NOX/POX），也有商用版本。本系列會用 Ryu 做一些 OpenFlow 相關的實驗。

### 北向界面（Northbound Interface）

北向界面是應用程式與 Controller 之間的介面，目前尚無統一標準，通常根據使用情境採用不同的方案。

### Application（Services）

這裡的 Application 幾乎涵蓋所有網路應用，包括 load balancing、security、monitoring 等。應用程式的業務邏輯透過 Controller 傳送規則給網路設備，讓設備彈性地執行我們想要的功能。


## OpenFlow 協定

OpenFlow 是最具代表性的南向界面，也被視為第一個 SDN 標準之一。它定義了 SDN controller 與實體或虛擬網路設備的轉發平面溝通的協定，讓 controller 能直接操控設備的轉送行為，更靈活地應對業務需求的變化。

### 概述（[維基百科](https://zh.wikipedia.org/wiki/OpenFlow)）

OpenFlow 讓遠端 controller 能透過網路交換器決定封包的轉送路徑。它的發明者將其定位為 SDN 的啟動器。

OpenFlow 允許從遠端控制交換器的封包轉送表，透過新增、修改和移除封包控制規則，改變轉送路徑。相較於 ACL 或路由協定，它支援更靈活的流量管理。同時，OpenFlow 讓不同廠商的設備可以用一套簡單的開源協定進行遠端管理（這些設備傳統上各自提供專有的介面和描述語言）。

### 協定內容

OpenFlow 是 SDN 學習中的重要指標性協定，它的 specification 非常值得一讀。後續會單獨開一個章節來介紹，請點以下連結：

- [OpenFlow 協定](https://github.com/davidleitw/learn_SDN/blob/master/OpenFlow.md)

---

> 參考資料
> - [OpenFlow 1.0 spec](https://opennetworking.org/wp-content/uploads/2013/04/openflow-spec-v1.0.0.pdf)
> - [OpenFlow: Enabling Innovation in Campus Networks](https://www.researchgate.net/publication/220195143_OpenFlow_Enabling_innovation_in_campus_networks)
> - [協定心得](https://www.cnblogs.com/ssyfj/tag/SDN/)

下一篇文章會從 OpenFlow 1.0 開始介紹，後續再補充 OpenFlow 1.3 新增的內容。目前商業上應用最廣的是 OpenFlow 1.3，許多支援 OpenFlow 的 switch 都是以這個版本為主。
