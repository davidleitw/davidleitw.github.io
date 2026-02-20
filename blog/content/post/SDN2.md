---
title: "SDN 學習筆記(二): OpenFlow 1.0 介紹"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - network
    - SDN
categories: ["SDN"]
description: "深入 OpenFlow 1.0 的協定規範，了解 SDN 中 Controller 與 Switch 之間如何透過 flow table 進行流量控制。"
---

## 前言

想深入了解一個協定，直接看規格書是最快的。目前正在讀 OpenFlow 1.0 的相關內容，這篇文章會先介紹 **OpenFlow 1.0 的架構**，並整理一些 spec 的重點。

之後也會補上 OpenFlow 1.3 的內容，並簡單說明與 1.0 的差異。

### 為什麼著重在 1.0 與 1.3 兩個版本？

> 1.0 版本與之後的版本不相容，所以最先介紹。**1.0 與 1.3 都是長期支持的穩定版本**，1.3 是目前的主流版本，**多數支援 OpenFlow 的硬體設備都支援 OpenFlow 1.3**。
>
> 參考資料：[OpenFlow 協定演進](https://blog.csdn.net/qq_29229567/article/details/88797395)

## OpenFlow 1.0 架構

![](https://imgur.com/AioLuDj.jpg)
**OpenFlow 1.0 spec 架構圖**

--- 

## Flow Table

![](https://imgur.com/YazXiG6.jpg)

OpenFlow Switch 中存放轉發規則的表稱為 `Flow Table`。

> OpenFlow 1.0 中，每個 switch 只能存放一個 Flow Table。

Flow Table 中每個項目稱為 `Flow Entry`。在 OpenFlow 1.0 中，每個 Flow Entry 包含三個部分：

- `Header Fields`
- `Counters`
- `Actions`

### Header Fields

OpenFlow 1.0 協定共有 12 種可供匹配的條件，IP 部分只支援 IPv4。

以下僅列出條目，細節請參考 **OpenFlow 1.0 spec**：
- L1
    - **Ingress Port**: 封包進入 ```Switch``` 的Port
- L2
    - **Ether source**: 來源Mac Address
    - **Ether dst**: 目標Mac Address
    - **Ether type**: [乙太類型](https://zh.wikipedia.org/wiki/%E4%BB%A5%E5%A4%AA%E7%B1%BB%E5%9E%8B)
    - **VLAN ID**
    - **VLAN priority**
- L3
    - **IPv4 source**: 來源IP Address
    - **IPv4 dst**: 目標IP Address
    - **IPv4 proto**: [IP協定表](https://zh.wikipedia.org/wiki/IP%E5%8D%8F%E8%AE%AE%E5%8F%B7%E5%88%97%E8%A1%A8)
    - **IPv4 Tos bits**: [Type of service](https://en.wikipedia.org/wiki/Type_of_service)
- L4
    - **TCP/UDP source port**
    - **TCP/UDP dst port**

![](https://i.imgur.com/3BGpIr4.png)

### Counters

`Counter` 會針對每張 Flow Table、每條 Flow entry、每個 switch port 以及每個佇列分別記錄相關統計資訊。

![](https://i.imgur.com/exsmUoB.png)


### Actions

每個 Flow entry 都伴隨著 0 或多個 actions，代表封包成功匹配 Header Fields 條件後要執行的動作。

如果匹配成功但沒有設置 actions，switch 就會**丟棄（drop）**該封包。Actions list 的執行順序嚴格按照原本的順序**依序執行**。

> - 如果 Controller 寫入的 Flow entry 包含 switch 不支援的 action，會被拒絕並返回錯誤。
> - Controller 與 Switch 建立連線時，Switch 會告知 Controller 它支援哪些 Optional Action。

Switch 不需要支援 spec 中列出的所有 action，只有標注 **Required Action** 的才是必須支援的，**Optional Action** 則是選用。

#### Required Action: Forward（轉發封包）

轉發除了要支援基本的 switch port，還需要支援以下 **virtual port**：

![](https://i.imgur.com/tgv3Nbj.png)

另外有兩個 Optional Action 的 virtual port，Switch 可以自行選擇是否支援：

![](https://i.imgur.com/UdCjSyJ.png)

#### Required Action: Drop（丟棄封包）

除了可以明確設定 Drop action 之外，Flow entry 若沒有設定任何 action，switch 也會預設丟棄該封包。

#### Optional Action: Enqueue

Enqueue 可以將封包轉發至某個特定 port 的 queue 中，方便支援 QoS。

#### Optional Action: Modify-Field（修改封包）

Modify-Field 是彈性最高的 action 之一，雖然標注為 Optional Action，但 spec 中提到它能大幅提升 OpenFlow 的實用性，基本上所有支援 OpenFlow 的 switch 都會實作這個功能。

![](https://i.imgur.com/8L2cErK.png)

---

## Matching

### Packet flow in an OpenFlow switch：封包處理流程

![](https://i.imgur.com/QD4VWvh.png)

> Parse header fields 的步驟會按照下方圖表進行。

封包會按照 flow entry 的優先度依序進行匹配：
- 匹配成功：更新 Counter，並依序執行對應的 actions；若 flow entry 沒有設置 actions，則**丟棄**封包
- 若**沒有匹配**到任何 flow entry，則將**封包轉發給 Controller**

### 解析封包以取得 Header field

![](https://i.imgur.com/wJHVTOf.png)

#### 解析步驟大致可分為四步

- 初始化 Headers：設置 Ingress Port 與 Ethernet src、dst、type，其餘欄位設為 0
- 根據 Eth type 填寫 Header：
    - Eth type: 0x8100（802.1q）→ 設置 VLAN ID 與優先度
    - Eth type: 0x0806（ARP）→ **Optional**，設置 IPv4 src、dst
    - Eth type: 0x0800（IPv4）→ 設置 IPv4 src、dst、tos
- 根據 IPv4 封包確認是 TCP / UDP / ICMP 協定
- 寫入 TCP / UDP / ICMP 協定資料

## Secure Channel

作為連結 Switch 與 Controller 的橋樑。

## OpenFlow Protocol Message

> 提醒：OpenFlow 是定義 Controller 與 Switch 之間溝通的通訊協定。

OpenFlow 協定訊息分成三大類：
- **Controller-to-Switch**：通常由 Controller 主動發出
- **Asynchronous**：通常由 Switch 主動發出
- **Symmetric**：Controller 與 Switch 都可以發出

### Controller-to-Switch

- **Features**：初始化 TLS 連線時由 Controller 發送，要求 Switch 回覆它支援的 Optional 功能。
- **Configuration**：Controller 用來設置或查詢 Switch 的配置資訊。
- **Modify-State**：用來新增、修改或刪除 Switch 上的 Flow Table，也可以設置 Switch port 的屬性。
- **Read-State**：用來讀取 Switch 的 Flow Table 狀態、統計資料以及 port 狀態。
- **Send-Packet**：用來傳送資料到指定 Switch 的特定 port。
- **Barrier**：`OFPT_BARRIER_REQUEST`、`OFPT_BARRIER_REPLY`。

### Asynchronous

- **Packet-in**：在以下兩種情況觸發，將封包轉送給 Controller：
    - 沒有 match 到任何 Flow entry
    - match 到的 Flow entry 設有 `packet-in` action

    若 Switch 有足夠的 memory 緩衝封包，會傳送部分 packet header（預設 128 bytes）與 buffer ID 給 Controller；若 memory 不足或 Switch 不支援緩衝，則將完整封包轉送。

- **Flow-Removed**：Controller 傳送 flow modify message 時，可設定 `idle timeout` 和 `hard timeout`：
    - `idle timeout`：Counter 記錄 flow entry 最後被 match 的時間，超過時限就刪除
    - `hard timeout`：Counter 記錄 flow entry 建立的時間，超過時限就刪除

    Switch 刪除某條 Flow entry 時，會觸發 Flow-Removed message 通知 Controller。

- **Port-status**：Switch port 狀態改變時，傳送狀態更新給 Controller。
- **Error**：Switch 回傳錯誤訊息。

### Symmetric

- **Hello**：初始化 OpenFlow 連線時使用。
- **Echo**：Controller 或 Switch 均可發起 echo request，收到的一方必須回覆 reply，可用於測試延遲、頻寬和連線狀況。
- **Vendor**：自定義訊息。

## 結語

OpenFlow 規格書通常前半部是**規範**（概念說明），後半部是**協議實作**（規範的具體細節）。本文只介紹了規範部分，讓讀者快速了解 OpenFlow 的概要。

目前主流的 OpenFlow 版本是 1.3，相較於 1.0 新增了許多實用功能。大概看過 1.0 之後，建議把閱讀重心放在 1.3 版本上。

網路上有找到 OpenFlow 1.3 的中文全文翻譯，非常推薦搭配原文規格書一起看：[OpenFlow 1.3 中文解析](https://www.jianshu.com/p/acfeae1771b3)。

**後續的實作都會以 1.3 版本為主**，建議先看過上述文件再繼續接下來的練習。




## Reference 

> - [OpenFlow 1.0 spec](https://opennetworking.org/wp-content/uploads/2013/04/openflow-spec-v1.0.0.pdf)
> - [OpenFlow 1.3 spec](https://opennetworking.org/wp-content/uploads/2014/10/openflow-spec-v1.3.0.pdf)
> - [OpenFlow：简述对OpenFlow协议的认识](https://blog.csdn.net/qq_29229567/article/details/88796456)
> - [软件定义网络基础---OpenFlow流表](https://www.cnblogs.com/ssyfj/p/11620375.html)
> - [OpenFlow 1.0 協議講解](https://blog.csdn.net/lady_killer9/article/details/104540806)
> - [OpenFlow 1.3 中文解析](https://www.jianshu.com/p/acfeae1771b3)