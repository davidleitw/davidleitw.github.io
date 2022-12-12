---
title: "搭建最小化的 xdp 實驗環境"
date: 2022-12-12T21:00:53+08:00
draft: false
tags: 
    - eBPF
    - linux
    - linux_kernel
    - network
    - XDP
categories: ["eBPF"]
---

## 前言

一般來說學習 xdp 都會參考 [xdp-tutorial](https://github.com/xdp-project/xdp-tutorial)，這個教學非常完整，雖然有一些範例可能需要額外查一些資源才能完成，但依舊被很多文章譽為學習 xdp 的最佳資源。

但是這個專案包裝了一些 testenv 的腳本方便學習的人不用自己架設環境，或者煩惱編譯的問題，在學習過程中的確很方便，不過如果想要自己建立新的 xdp 專案可能就需要理解編譯過程具體用了哪些工具，依賴的部份要怎麼引入，本篇文章想要搭建一個最簡化的實驗環境滿足以下幾點要求:

- `/bpf` 底下存放 xdp 程式碼
- `Makefile` 只包含 `make all`, `make clean` 兩個最簡單的功能，剩下根據需求再自行添加
- `main.go` 負責把編譯好的 `byte code` 載入 kernel，並且能對 `map` 進行操作

我認為只要符合以上幾點就能最小化的建立實驗環境，會用 go 語言是因為這樣可以不用處理 c++ 一些要編譯的前置作業。

理想上我們最後的目錄會長這樣，符合我們希望的最小化專案需求

![](https://i.imgur.com/4PBV8lj.png)

實際上可能會因為 `go.mod` 這些額外的配置多一些檔案，或者放一些編譯時需要的 header，不過本文會盡可能的讓目錄保持整潔，讓學習 xdp 的人不會被眼花撩亂的配置檔案搞的不知所措。

底下我們會根據 [xdp-tutorial](https://github.com/xdp-project/xdp-tutorial) 編寫一個簡單的 xdp 程式，然後編譯成 `.o` 檔之後由 user space 的程式(由 go 語言編寫) 來負責載入 xdp Program。

##

## 編寫 xdp 範例

這邊我們參考 [xdp-tutorial](https://github.com/xdp-project/xdp-tutorial) 的 [packet01-parsing](https://github.com/xdp-project/xdp-tutorial/tree/master/packet01-parsing#assignment-3-parsing-the-icmpv6-header-and-reacting-to-it) 中出現的一個例子，接收 ICMP 封包，並把 sequence number 為偶數的封包丟棄，不需要改動封包內容，算是一個很基本的範例。

```c
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/icmp.h>
#include <linux/in.h>

#define __linux__
#include "../includes/bpf.h"
#include "../includes/bpf_helpers.h"
#include "../includes/bpf_endian.h"

SEC("xdp")
int xdp_main(struct xdp_md *ctx)
{
  void *data = (void *)(long)ctx->data;
  void *data_end = (void *)(long)ctx->data_end;

  // L2
  struct ethhdr *eth = data;
  if (data + sizeof(*eth) > data_end) {
    return XDP_ABORTED;
  }

  // Only Ipv4 supported for this example
  // L3
  if (eth->h_proto != bpf_htons(ETH_P_IP)) {
    return XDP_PASS;
  }
  data += sizeof(*eth);
  
  struct iphdr *ip = data;
  if (data + sizeof(*ip) > data_end) {
    return XDP_ABORTED;
  }

  // Only need ICMP packet
  // L4
  if (ip->protocol != IPPROTO_ICMP) {
    return XDP_PASS;
  }
  data += sizeof(*ip);

  struct icmphdr *icmp = data;
  if (data + sizeof(*icmp) > data_end) {
    return XDP_ABORTED;
  }

  if (bpf_ntohs(icmp->un.echo.sequence) % 2 == 0)
    return XDP_DROP;

  return XDP_PASS;
}

char _license[] SEC("license") = "GPLv2";
```

在寫 eBPF 程式的時候會用到很多 bpf helper functions，因為我們的範例沒有使用 `libbpf`，所以我們需要建立一個資料夾存放那些編譯時所需的[標頭檔](https://github.com/davidleitw/minimalXdpTemplate/tree/master/includes)，這樣才能順利編譯，通常這些常用的 helper functions 或者符號表都是固定的，可以看到很多基於 eBPF 的專案底下都會有 `headers/` 或者 `includes/` 來存放這些檔案。


接著寫一個 `Makefile` 腳本負責編譯 `xdp_main.c` 程式

```shell
TARGET := xdp_main.o

.PHONY: all
all: build

build: $(TARGET)

$(TARGET): xdp_main.c
    clang -I../includes -O2 -target bpf -c $^ -o $@

clean:
    rm $(TARGET)
```

## user space 編寫

user space 我們使用 go 語言來負責載入編譯好的 `elf` 檔案，除此之外還需要提供 api 讓我們能在 user space 操作 eBPF map。

go 語言有非常多 eBPF library 可供選擇，最主流的選擇不外乎是 Cilium 與 Cloudflare 維護的 [ebpf-go](https://github.com/cilium/ebpf)，IO Visor 提供的 [gobpf](https://github.com/iovisor/gobpf)，最後就是 Dropbox 開源的 [goebpf](https://github.com/dropbox/goebpf)。

其中 IO Visor 維護的 [gobpf](https://github.com/iovisor/gobpf) 屬於 BCC 框架的體系，比較偏向 trace 方面，但筆者沒有使用經驗，如果有錯請指正。

[ebpf-go](https://github.com/cilium/ebpf) 應該是最多人使用的一套函式庫了，因為 Cilium 本身也大量使用了這個庫，所以整體的可靠度是有目共睹的。


本文選擇 Dropbox 維護的 [goebpf](https://github.com/dropbox/goebpf) 作為開發 user space 的函式庫，有幾個考量，一個是 [goebpf](https://github.com/dropbox/goebpf) 本身提供了一套非常簡潔的 API，像是載入 eBPF Program 到 Kernel，對於 eBPF map 的操作等等，用起來很像是原生的 [libbpf](https://github.com/libbpf/libbpf)，這種簡潔的 API 可以讓學習的人專注於 eBPF 本身，不用花費額外的力氣去學習 API 的使用方式，第二個考量就是環境架設也很簡潔，不需要額外設置什麼環境，只要將編譯好的 elf 檔案路徑餵進去，就能協助你載入或者移除 eBPF Program。

API 設計的簡潔也能體現在範例上，基本上光是看範例就能對用法略知一二，這種開發體驗我覺得可以評為 **直觀**，以下提供範例參考

```go
package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"time"

	"github.com/dropbox/goebpf"
)

func main() {
	bpf := goebpf.NewDefaultEbpfSystem()
	err := bpf.LoadElf("bpf/xdp_main.o")
	if err != nil {
	    log.Fatalln(err)
	}
	printXdpProgramInfo(bpf)

	xdp := bpf.GetProgramByName("xdp_root")
	if xdp == nil {
	    log.Fatalln("Program 'xdp_main' not found.")
	}

	err = xdp.Load()
	if err != nil {
	    log.Fatalln(err)
	}

	err = xdp.Attach("lo")
	if err != nil {
	    log.Fatalln(err)
	}
	defer xdp.Detach()

	// Add CTRL+C handler
	ctrlC := make(chan os.Signal, 1)
	signal.Notify(ctrlC, os.Interrupt)

	fmt.Println("XDP program successfully loaded and attached. Counters refreshed every second.")
	fmt.Println("Press CTRL+C to stop.")
	fmt.Println()

	ticker := time.NewTicker(1 * time.Second)
	for {
            select {
            case <-ticker.C:
            case <-ctrlC:
                fmt.Println("\nDetaching program and exit")
                return
            }
	}
}

func printXdpProgramInfo(bpfProgram goebpf.System) {
	fmt.Println("Maps:")
	for _, item := range bpfProgram.GetMaps() {
		fmt.Printf("\t%s: %v, Fd %v\n", item.GetName(), item.GetType(), item.GetFd())
	}
	fmt.Println("\nPrograms:")
	for _, prog := range bpfProgram.GetPrograms() {
		fmt.Printf("\t%s: %v, size %d, license \"%s\"\n",
			prog.GetName(), prog.GetType(), prog.GetSize(), prog.GetLicense(),
		)
	}
	fmt.Println()
}

```

詳細的程式請參考 [GitHub](https://github.com/davidleitw/minimalXdpTemplate)，實際跑一次程式才知道具體運作的流程。


## 實測

首先需要編譯 xdp 程式

```bash
$ cd bpf/
$ make
$ cd ..
```

成功後會出現一個 `xdp_main.o`

![](https://i.imgur.com/D0dwl5i.png)

接著我們需要執行 `main.go` 來載入編譯好的 `xdp_main.o`，因為需要載入 Kernel 所以必須加上 `sudo`

```bash
$ sudo go run main.go
```

正常執行會顯示

![](https://i.imgur.com/FRGnK9Y.png)

按下 `CTRL+C` 後會自動幫你 detach 剛剛載入的 xdp_main.o，因為範例只是簡單的 attach 到 `lo` 上，所以用簡單的 `ping 127.0.0.1` 即可測試效果。

![](https://i.imgur.com/Up4bJRc.png)

可以看到，偶數的 icmp packet 都被捨棄了，所以剛好會有 50 % 的封包收到回應，效果的確符合預期。

完整程式碼可以看[這邊](https://github.com/davidleitw/minimalXdpTemplate)，實際跑一次能學習的更有效率!

### reference

- [Getting Started with eBPF and Go](https://networkop.co.uk/post/2021-03-ebpf-intro/)