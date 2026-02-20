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
description: "從零搭建最小化的 XDP 開發環境，整理 BPF 程式的編譯流程，並以 Go 語言實作將 byte code 載入 kernel 的完整步驟。"
---

## 前言

一般來說學習 XDP 都會參考 [xdp-tutorial](https://github.com/xdp-project/xdp-tutorial)，這個教學非常完整，雖然有些範例可能需要額外查閱資料才能完成，但仍被許多文章譽為學習 XDP 的最佳起點。

不過這個專案封裝了一些 testenv 腳本，讓學習者不需要自己搭建環境或煩惱編譯問題，學習過程中的確很方便。但如果想從零建立一個新的 XDP 專案，就需要真正理解編譯過程用到哪些工具、依賴的 header 要如何引入。本篇文章想要搭建一個最精簡的實驗環境，滿足以下幾點要求：

- `/bpf` 底下存放 xdp 程式碼
- `Makefile` 只包含 `make all`, `make clean` 兩個最簡單的功能，剩下根據需求再自行添加
- `main.go` 負責把編譯好的 `byte code` 載入 kernel，並且能對 `map` 進行操作

我認為只要符合以上幾點，就能建立一個最小化的實驗環境。選擇用 Go 語言是因為可以省去 C++ 編譯環境的前置作業。

理想的最終目錄結構如下，符合我們希望的最小化專案需求：

![](https://i.imgur.com/4PBV8lj.png)

實際上可能會因為 `go.mod` 等配置文件多出幾個檔案，或者需要存放編譯用的 header，但本文會盡量保持目錄整潔，讓學習 XDP 的人不會被眼花撩亂的配置文件搞得不知所措。

下面我們會參考 [xdp-tutorial](https://github.com/xdp-project/xdp-tutorial) 編寫一個簡單的 XDP 程式，編譯成 `.o` 檔後，由用 Go 語言編寫的 user space 程式負責將其載入 kernel。

## 編寫 xdp 範例

這裡參考 [xdp-tutorial](https://github.com/xdp-project/xdp-tutorial) 中 [packet01-parsing](https://github.com/xdp-project/xdp-tutorial/tree/master/packet01-parsing#assignment-3-parsing-the-icmpv6-header-and-reacting-to-it) 出現的一個範例：接收 ICMP 封包，並將 sequence number 為偶數的封包丟棄，不需要修改封包內容，是個很基本的入門範例。

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

在寫 eBPF 程式時會用到許多 bpf helper functions，由於範例沒有使用 `libbpf`，所以需要建立一個資料夾存放編譯所需的[標頭檔](https://github.com/davidleitw/minimalXdpTemplate/tree/master/includes)，才能順利編譯。這些常用的 helper functions 或符號表通常是固定不變的，可以看到許多基於 eBPF 的專案都有 `headers/` 或 `includes/` 目錄來存放這些文件。


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

user space 部分使用 Go 語言負責載入編譯好的 ELF 檔案，同時也需要提供 API 讓我們能在 user space 操作 eBPF map。

Go 語言有非常多 eBPF library 可供選擇，最主流的有：Cilium 與 Cloudflare 維護的 [ebpf-go](https://github.com/cilium/ebpf)、IO Visor 提供的 [gobpf](https://github.com/iovisor/gobpf)，以及 Dropbox 開源的 [goebpf](https://github.com/dropbox/goebpf)。

其中 IO Visor 維護的 [gobpf](https://github.com/iovisor/gobpf) 屬於 BCC 框架體系，比較偏向 trace 方向，但筆者沒有使用經驗，若有描述不正確的地方歡迎指正。

[ebpf-go](https://github.com/cilium/ebpf) 應該是使用者最多的一套函式庫，Cilium 本身也大量使用這個庫，整體可靠度有目共睹。

本文選擇 Dropbox 維護的 [goebpf](https://github.com/dropbox/goebpf)，主要有兩個考量：第一，[goebpf](https://github.com/dropbox/goebpf) 提供了一套非常簡潔的 API，涵蓋載入 eBPF program 到 kernel、操作 eBPF map 等功能，用起來與原生的 [libbpf](https://github.com/libbpf/libbpf) 很像。這種簡潔的 API 讓學習者可以專注在 eBPF 本身，不需要另外花心力研究函式庫的用法；第二，環境架設也很簡單，只要把編譯好的 ELF 檔案路徑傳入，就能幫你載入或移除 eBPF program。

API 設計的簡潔也體現在範例上，光看範例就能大致了解用法，這種開發體驗個人覺得可以用**直觀**來形容。以下提供範例參考：

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

	<-ctrlC:
  fmt.Println("\nDetaching program and exit")
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

詳細的程式碼請參考 [GitHub](https://github.com/davidleitw/minimalXdpTemplate)，實際跑一次才能真正理解整個運作流程。


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

按下 `CTRL+C` 後會自動 detach 剛剛載入的 `xdp_main.o`。因為範例只是 attach 到 `lo`（loopback）上，用 `ping 127.0.0.1` 就能測試效果。

![](https://i.imgur.com/Up4bJRc.png)

可以看到，sequence number 為偶數的 ICMP 封包都被丟棄了，剛好有 50% 的封包收到回應，效果完全符合預期。

完整程式碼可以看[這邊](https://github.com/davidleitw/minimalXdpTemplate)，實際跑一次學習效果會更好！

### reference

- [Getting Started with eBPF and Go](https://networkop.co.uk/post/2021-03-ebpf-intro/)