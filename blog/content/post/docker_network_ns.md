---
title: "Docker 網路模型與 Linux namespace, bridge 機制探討"
date: 2022-05-04T00:01:01+08:00
draft: false
tags: 
    - docker
    - container
    - linux
    - network
categories: ["docker"]
description: "透過實際操作 Linux network namespace、veth pair 與 bridge，一步步拆解 Docker 預設 bridge 網路模型的底層實現。"
---

Container 最重要的特性之一就是資源隔離。Linux 透過 namespace 提供各種資源的隔離機制，本文會特別探討其中最常出現的 network 隔離，並透過實際實驗來觀察 Docker 的網路模型是如何透過 namespace 實現的。

## Network Namespace 

在 command line 操作 network namespace 通常會使用 `ip netns` 來操作，先引用 `ip-netns` 的 [man page](https://man7.org/linux/man-pages/man8/ip-netns.8.html) 來介紹一下 network namespace 的定義

> A network namespace is logically another copy of the network stack, with its own routes, firewall rules, and network devices.


也可以查看 [NETWORK_NAMESPACES(7)](https://www.man7.org/linux/man-pages/man7/network_namespaces.7.html)

![](https://i.imgur.com/DHg0aoM.png)
 

由於 network namespace 隔離了整個 network stack，幾乎所有與 network 相關的資源都會被隔離，每個 namespace 內的資源都是獨立存在的。

若有呼叫 `fork()` 等建立新 process 的行為，原則上 child process 會繼承 parent 的 network namespace。

一開始可以用 `ip netns help` 來查看大概有哪些指令可以使用

![](https://i.imgur.com/3FdIjWB.png)

### 建立新的 network namespace

建立一個新的 network namespace 可以使用 `sudo ip netns add` 加上想要的 namespace 名稱，建立之後用 `ip netns ls` 就可以看到多了一個剛剛建立的 network namespace。

```shell
$ sudo ip netns add ns0
$ ip netns ls
```

使用 `ip netns` 建立的 network namespace 會出現在 `/var/run/netns` 底下。

![](https://i.imgur.com/9suVUf7.png)


在本地端我們常用 `ifconfig` 或 `ip addr` 來查看網路配置。`ip netns` 工具提供了 `ip netns exec` 子命令，讓我們可以在指定的 network namespace 中執行命令，方便操作。後續幾個範例都會以剛建立的 `ns0` 為對象，先來看看在 `ns0` 中執行 `ifconfig` 或 `ip addr` 的結果。

### 執行 cmd 在特定的 network namespace

**ip netns exec <network namespace name\> + cmd**

![](https://i.imgur.com/QSffLmE.png)

可以觀察到，新建立的 `ns0` 目前只有預設的 `lo (loopback interface)`，這個 `lo` 也可以說是 `localhost` 的虛擬網路 interface。

想要了解更多可以參考
- [這篇文章](https://www.cnblogs.com/hustcat/p/3920940.html) 
- [What is the loopback device and how do I use it?](https://askubuntu.com/questions/247625/what-is-the-loopback-device-and-how-do-i-use-it)

## veth - Virtual Ethernet Device  

Linux 中有 [veth - Virtual Ethernet Device](https://man7.org/linux/man-pages/man4/veth.4.html) 的概念。`veth` 可以用來建立不同虛擬網路裝置之間的橋樑，讓不同虛擬裝置得以互相連線，常見應用包括不同的 network namespace、docker container 之間的連線、以及 OVS 內的相關場景。

`veth` 總是成對出現，所以很多文章也把它稱為 `veth pair`。後續的實驗中也可以觀察到 Docker 使用的 veth pair。

為了實驗兩個 network namespace 的連線，我們再建立一個 `ns1`

```shell
$ sudo ip netns add ns1
$ ip netns ls
ns1
ns0
```

### 建立新的 veth Pair 

上面有提到 `veth` 都是成對出現的，所以在建立的時候也要同時建立兩端，這邊我們將兩端分別取名 `vth0` 以及 `vth1` 代表等等要接在 `ns0` 與 `ns1` 上面。

```shell
$ sudo ip link add vth0 type veth peer vth1
$ ip link show
```

接著用 `ip link show` 就可以看到剛剛建立的 `veth pair`

![](https://i.imgur.com/KfnBEla.png)

### 將 veth 連結到 network namespace

建立好了兩端的 `veth` 之後我們就需要把它接到對應的 network namespace

```shell
$ sudo ip link set vth0 netns ns0
$ sudo ip link set vth1 netns ns2
```

這時候我們再使用 `ip link show` 確認一下

![](https://i.imgur.com/Xxv9YDk.png)

剛剛建立的 `vth0` 與 `vth1` 從主機看不見了，因為它們已經移動到對應的 network namespace 中。可以分別進入 `ns0` 與 `ns1`，用 `ip addr` 確認。

![](https://i.imgur.com/FoVEZnV.png)

### 啟動 veth 並且分配一個私有的 ip

光是把 `vth0`, `vth1` 連結到 `ns0`, `ns1` 還不夠，為了後續 ping 的實驗我們必須在 `ns0`, `ns1` 中啟動 `veth` 並且分配一個私有的 ip 位置。

```shell
$ sudo ip netns exec ns0 ip link set vth0 up
$ sudo ip netns exec ns0 ip addr add 172.0.0.2/24 dev vth0
$ sudo ip netns exec ns1 ip link set vth1 up
$ sudo ip netns exec ns1 ip addr add 172.0.0.3/24 dev vth1
```

我們為 `vth0` 分配了 172.0.0.2/24，`vth1` 分配了 172.0.0.3/24，我們一樣分別進入 `ns0`, `ns1` 用 `ip addr` 確認他們對應的 `veth` 是否開啟並且正確的被分配了 ip

![](https://i.imgur.com/gz0Ro7m.png)

經過一系列的操作之後我們現在的網路拓樸如下

![](https://i.imgur.com/MhsCm9a.png)


因為設置的 ip 在同一個網域下，而且也經過 `ip addr` 確認綁定到 `veth` 上，現在可以用 ping 指令發現兩個 network namespace 之間可以通了!

![](https://i.imgur.com/AgY7egp.png)

## 用 bridge 串連多個不同的 namespace

前面的情境只有兩個 network namespace 互連。但在真實世界的網路拓樸中，通常是多個不同的裝置需要彼此連接，這時候一對一地用 `veth` 設置就不切實際了。一般網路環境中會想到用 switch 這類裝置來處理，在 Linux 中也可以透過 `bridge` 的概念，以類似虛擬 switch 的方式解決多個 network namespace 互連的問題。

從頭開始，目標是建立 `ns0`, `ns1`, `ns2` 三個 network namespace 並且讓他們可以透過 `bridge`互相連結。

最後目標的網路拓樸如下圖

![](https://i.imgur.com/bC0mjXe.png)

注意，這次我們有做一點調整，把 `veth` 連結到 network namespace 之後統一改名成 `eth0`

### 建立 bridge device 

先建立一個 `bridge device` 並且取名為 `br0`

```shell
$ sudo ip link add br0 type bridge
$ sudo ip link set br0 up
```

建立三個 network namespace 以及建立三對 `veth-pair` 分別對應 `ns0`, `ns1`, `ns2` 連結到 `br0`

```shell
$ sudo ip netns add ns0
$ sudo ip netns add ns1
$ sudo ip netns add ns2
$ sudo ip link add type veth
$ sudo ip link add type veth
$ sudo ip link add type veth
```

這次換了一種建立方式，直接 `ip link add type veth`，不用自己取名字，系統會幫你分配好，如下圖所示

![](https://i.imgur.com/OB3MrnC.png)

先處理對接 `br0` 的部份，把 `veth0`, `veth2`, `veth4` 連接到 `br0`，一定要記得把他們 set up。

```shell
$ sudo ip link set veth0 up
$ sudo ip link set veth0 master br0
$ sudo ip link set veth2 up
$ sudo ip link set veth2 master br0
$ sudo ip link set veth4 up
$ sudo ip link set veth4 master br0
```

接著處理對接到 network namespace 的部份

```shell
# 設置 ns0
$ sudo ip link set veth1 netns ns0
$ sudo ip netns exec ns0 ip link set veth1 name eth0
$ sudo ip netns exec ns0 ip addr add 10.0.0.1/24 dev eth0
$ sudo ip netns exec ns0 ip link set eth0 up

# 設置 ns1
$ sudo ip link set dev veth3 netns ns1
$ sudo ip netns exec ns1 ip link set dev veth3 name eth0
$ sudo ip netns exec ns1 ip addr add 10.0.0.2/24 dev eth0
$ sudo ip netns exec ns1 ip link set dev eth0 up

# 設置 ns2
$ sudo ip link set dev veth5 netns ns2
$ sudo ip netns exec ns2 ip link set dev veth5 name eth0
$ sudo ip netns exec ns2 ip addr add 10.0.0.3/24 dev eth0
$ sudo ip netns exec ns2 ip link set dev eth0 up
```

設置好之後可以去每個 network namespace 用 `ip addr` 查看是否設置完成

![](https://i.imgur.com/HxAIpep.jpg)

可以用 ping 測試是否成功

![](https://i.imgur.com/reV0urc.png)

正常情況下會發現還是無法成功 ping 通。這時需要對 `br0` 調整一下配置：

```shell
$ sudo iptables -A FORWARD -i br0 -j ACCEPT
```

接著就可以測試，發現三個 network namespace 可以互通了

![](https://i.imgur.com/fZYLfQW.png)

## Docker network drivers

介紹完基礎的 network namespace、veth、bridge 之後，接著來看看 Docker 的網路模型。

Docker 在設計時就提供了多種 network driver 可供選擇，不同的 network driver 對應著不同的網路模型。在使用 `docker` 指令建立容器時，可以透過 `--network` 參數指定想要的網路模型。

大致上可以分為這幾種

- `bridge`
- `host`
- `overlay`
- `ipvlan`
- `macvlan`
- `none`

本文主要介紹 `bridge` 模式，一方面是前面的實驗已經讓我們對 Linux 的 bridge 機制有了初步認識，另一方面則是 Docker 預設的網路模型本來就是 `bridge` 模式。

> In terms of networking, a bridge network is a Link Layer device which forwards traffic between network segments. A bridge can be a hardware device or a software device running within a host machine’s kernel.

在[官方文檔](https://docs.docker.com/network/bridge/)中從定義開始介紹，`bridge network` 專門用在同個網段(Network segmentation) 的流量轉發，`bridge` 可以是硬體也可以是 kernel 的機制，前文中我們介紹的 bridge 就是 kernel 提供的 software device。

安裝完 Docker 之後，執行 `ip addr` 就可以看到一個新的 `docker0` 裝置，這就是預設 `bridge` 模式所使用的 bridge。每次建立新容器時，Docker 預設都會建立一個新的 network namespace，並透過 `docker0` 讓各容器之間互相通訊。

![](https://i.imgur.com/l8FXB2A.png)

> 在實驗或者本地端執行的時候使用預設的網路模式很方便，但是在正式的環境往往會複雜許多。

也可以使用 `docker network ls` 來看到 driver 的 type 是 `bridge`。

![](https://i.imgur.com/MJvRh3C.png)

想繼續看 `bridge` 的詳細資料可以使用 `docker network inspect bridge`，可以看到 `bridge` 的 `subnet`, `gateway IP` 等等更詳細的設定 

![](https://i.imgur.com/LYB4sEG.png)

### 建立一個新的 container 

先建立一個 container 來試試預設的網路功能

```shell
$ sudo docker run --name nginx_test1 -d -p 8081:80 nginx
$ sudo docker ps -a
```

使用 `docker ps -a` 確定 `nginx_test1` 有跑起來

![](https://i.imgur.com/bvwRulh.png)


詳細資料可以使用 `docker inspect nginx_test1` 來查看，注意最下面 `Networks` 的地方，可以看到剛剛建立的 `nginx_test1` 連結到預設的 `bridge`，並且配了 `172.17.0.2` 的 ip address 給它

![](https://i.imgur.com/cKlyBb4.png)

在建立 `nginx_test1` 的時候有設定 `8081:80` 的映射，所以打開瀏覽器訪問 `localhost:8081` 應該可以看到 `nginx` 的首頁

![](https://i.imgur.com/kwOliZn.png)

用 `curl localhost:8081` 也可以獲得正確的 html

![](https://i.imgur.com/OtdrnLj.png)

我們再次確認 `bridge` 的配置

```shell
$ sudo docker inspect bridge
```

![](https://i.imgur.com/KELXW9t.png)

可以注意到 `Containers` 的地方多了剛剛建立的 `nginx_test1` 的資料，代表說 `nginx_test1` 是透過 `bridge` 跟外部建立連線的，這也是為什麼剛剛可以訪問 `nginx_test1` 的原因。

### 兩個 containers 透過預設的 bridge 互連

接著來觀察在預設的網路環境， container 之間是否也可以藉由 `bridge` 互連，先用 `alpine` 的 image 建立兩個 container

```shell
$ sudo docker run -dit --name a1 alpine ash
$ sudo docker run -dit --name a2 alpine ash
```

![](https://i.imgur.com/f97aohR.png)

確認 `a1`, `a2` 的 ip

![](https://i.imgur.com/OD0d2PV.png)

![](https://i.imgur.com/jmBZggO.jpg)


利用 `docker exec` 進入 `a1` 之後 ping `a2` 還有 `8.8.8.8` 試試看是否能連通隔壁的 `a2` 還有實際的網路

![](https://i.imgur.com/WAnNM09.png)

![](https://i.imgur.com/xqhpuxc.png)

前面已經介紹過 veth 與 network namespace 的概念，現在可以來實際觀察在預設模式下，Docker 是如何把多個 container 串連在一起讓彼此互通的。


```shell
$ ip addr
```

![](https://i.imgur.com/8DDjgxS.jpg)


使用 `ip addr` 發現多了兩個 veth 開頭的裝置，分別是

- `vethd1d03d7@1f5`
- `veth6e0f94d@if7`

`veth` 總是成對出現，所以這兩個裝置應該就是 `a1`、`a2` 各自與 `docker0` 對接的 veth pair。

接著進入 `a1`, `a2` 對應的 `veth` 裝置

![](https://i.imgur.com/YG8Ru1b.png)

所以這邊可以畫出目前的網路拓樸

![](https://i.imgur.com/dDqeeAL.png)

在預設模式下，每個 container 都可以透過 `docker0` 互連，也能對外連線。既然每個 container 都會建立一個新的 network namespace，理論上執行 `ip netns ls` 應該要能看到才對。

```
$ ip netns ls
```

實際上查詢結果會是空的。前面有提到，透過 `ip netns` 建立的 network namespace 都會在 `/var/run/netns` 底下新增一個文件，但 Docker 另外建立了自己的資料夾來存放容器建立時產生的 network namespace，放在 `/var/run/docker/netns` 底下。

![](https://i.imgur.com/cyh3TVU.png)


# reference
- [計算機網路 - Network Namespace](https://hackmd.io/@0xff07/network/https%3A%2F%2Fhackmd.io%2F%400xff07%2FSJzOwViYF)
- [Linux 網路虛擬化: network namespace](https://cizixs.com/2017/02/10/network-virtualization-network-namespace/)
- [一文搞懂 Linux network namespace](https://www.cnblogs.com/bakari/p/10443484.html)
- [Linux 虛擬網路設備 - bridge](https://segmentfault.com/a/1190000009491002)
- [Docker Container 基礎入門篇 2](https://azole.medium.com/docker-container-%E5%9F%BA%E7%A4%8E%E5%85%A5%E9%96%80%E7%AF%87-2-c14d8f852ae4)
- [Docker 網路入門篇(二) - Bridge 網路模型](https://www.hwchiu.com/docker-network-model-lab.html)