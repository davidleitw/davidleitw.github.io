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
---

# socket programming

`socket` 本質上是一種 **IPC** (`Inter-Process Communication`) 的技術，用於兩個或多個 `process` 進行資料交換或者通訊。

在網路領域，`socket` 著重的不是同一台主機間 `process` 的通訊，而是不同主機執行的 `process` 互相交換資料的通訊。

我們在寫 `socket programming` 的時候會使用 `os` 提供的 `API`，來避免重複造輪子，今天的筆記會簡單介紹一下 `linux` 提供的 `socket API`，並用兩個簡單的範例介紹如何用 `tcp` 跟 `udp` 協定透過 `socket` 傳輸資料。

![](https://i.imgur.com/gXp0tLh.png)

本文章所使用的環境

- ***kernel***: `5.11.0-37-generic`
- ***gcc version***: `gcc (Ubuntu 9.3.0-17ubuntu1~20.04) 9.3.0`
- ***GNU Make***: `4.2.1`

在寫 `socket` 相關的程式的時候，需要先

```c
#include <arpa/inet.h>  // sockaddr 相關
#include <sys/socket.h>
```

## socket

```c
int socket(int domain, int type, int protocol)
```

#### *domain*
定義要建立哪一種類型的 `socket`，常用的有以下幾種類型
- **AF_UNIX**, **AF_LOCAL**: 用於本機間 `process` 的溝通   
- **AF_INET**, **AF_INET6**
    - **AF_INET**: IPv4 協定
    - **AF_INET6**: IPv6 協定

詳細的選項可以參考 `socket` 的 [man page](https://man7.org/linux/man-pages/man2/socket.2.html)

#### *type*
`socket` 傳輸資料的手段(`communication semantics`)

- **SOCK_STREAM**: 對應到 `tcp` 協定
- **SOCK_DGRAM**: 對應到 `udp` 協定

#### *protocol*
設定通訊協定的號碼，通常在寫的時候會填入 `0`，`kernel` 會根據上面的兩個參數自動選擇合適的協定。

- [protocol man page](https://man7.org/linux/man-pages/man5/protocols.5.html#top_of_page)

`/etc/protocols` 可以看到 `linux` 底下支援的協定

#### *Return Value*

成功建立 `socket` 之後，此函式會返回該 `socket` 的**檔案描述符**(`socket file descriptor`)，在之後的操作可以透過這個回傳值來操作我們建立的 `socket`。 如果建立失敗則會回傳 `-1(INVALID_SOCKET)`

### 檔案描述符是什麼?


參考資料
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

在 [github](https://github.com/davidleitw/socket) 參考完整專案