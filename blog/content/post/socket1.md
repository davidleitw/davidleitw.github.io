---
title: "linux socket programming(一): 什麼是 socket & 創建一個新的 socket"
date: 2021-10-25T01:04:53+08:00
draft: false
tags: 
    - linux
    - network
    - socket
    - c
categories: ["socket"]
description: "介紹 socket 作為 IPC 機制的基本概念，以及如何在 Linux 中呼叫 socket() system call 建立一個新的通訊端點。"
---

# socket programming

socket 本質上是一種 **IPC**（Inter-Process Communication）技術，用於兩個或多個 process 之間進行資料交換。

在網路領域，socket 著重的是不同主機上的 process 之間如何互相傳遞資料，而不只是同一台機器上的 IPC。

這篇筆記會簡單介紹 Linux 提供的 socket API，並用兩個範例說明如何分別透過 TCP 和 UDP 協定傳輸資料。

![](https://i.imgur.com/gXp0tLh.png)

本文章所使用的環境

- ***kernel***: `5.11.0-37-generic`
- ***gcc version***: `gcc (Ubuntu 9.3.0-17ubuntu1~20.04) 9.3.0`
- ***GNU Make***: `4.2.1`

寫 socket 相關的程式時，需要先引入：

```c
#include <arpa/inet.h>  // sockaddr 相關
#include <sys/socket.h>
```

## socket

```c
int socket(int domain, int type, int protocol)
```

#### domain

定義要建立哪種類型的 socket，常用的有：
- **AF_UNIX**, **AF_LOCAL**：用於同一台主機上 process 之間的溝通
- **AF_INET**：IPv4 協定
- **AF_INET6**：IPv6 協定

詳細選項可以參考 [socket man page](https://man7.org/linux/man-pages/man2/socket.2.html)。

#### type

socket 傳輸資料的方式（communication semantics）：

- **SOCK_STREAM**：對應 TCP 協定
- **SOCK_DGRAM**：對應 UDP 協定

#### protocol

通訊協定的號碼，通常填 `0`，kernel 會根據前兩個參數自動選擇合適的協定。

`/etc/protocols` 中可以看到 Linux 支援的所有協定，詳細說明請參考 [protocol man page](https://man7.org/linux/man-pages/man5/protocols.5.html#top_of_page)。

#### Return Value

建立成功後會回傳該 socket 的**檔案描述符**（socket file descriptor），後續所有操作都透過這個值進行。若建立失敗則回傳 `-1`（INVALID_SOCKET）。

### 檔案描述符是什麼？

參考資料：
- [Everything is a file](https://en.wikipedia.org/wiki/Everything_is_a_file)
- [Linux 的 file descriptor 筆記 FD 真的好重要](https://kkc.github.io/2020/08/22/file-descriptor/)
- [Linux 下 socket 通訊所用的 sockfd 怎麼來的](https://www.cnblogs.com/chorm590/p/12745824.html)

### 建立 socket example

```c
#include <stdio.h>
#include <sys/socket.h>

int main() {
    // AF_INET = IPv4
    // SOCK_DGRAM = UDP
    int socket_fd = socket(AF_INET, SOCK_DGRAM, 0);
    
    // 檢查是否建立成功
    if (socket_fd < 0) {
        printf("Fail to create a socket.");
    }
    
    // 根據 socker_fd 關閉剛剛創立的 socket
    close(socket_fd);
    return 0;
}
```

完整專案請參考 [GitHub](https://github.com/davidleitw/socket)。