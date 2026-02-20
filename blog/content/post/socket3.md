---
title: "linux socket programming(三): socket programming 中常用的位置轉換函數"
date: 2021-11-12T01:04:53+08:00
draft: false
tags: 
    - linux
    - network
    - socket
    - c
categories: ["socket"]
description: "整理 socket programming 中常用的 IP 位址與位元組序轉換函數，包含 inet_pton、htons 等 API 的用途與使用範例。"
---

一般來說，我們習慣用點分十進位（如 `125.102.25.62`）來表示 IPv4 地址，這種格式對人類友善，但在實務上常常需要在字串與數值（`uint32_t`）之間轉換。Linux 函式庫提供了一系列輔助地址轉換的函數。

IPv4 address 本質上是 32 bits 的數值，通常以 `in_addr` 或 `in_addr_t` 表示：
```c
typedef uint32_t in_addr_t; // 4 byte
struct in_addr {
    in_addr_t s_addr;
};
```

常用的地址轉換函數有以下五種：

- 只支援 IPv4
    - inet_addr
    - inet_aton
    - inet_ntoa
- 同時支援 IPv4 與 IPv6
    - inet_pton
    - inet_ntop

使用前需要引入：
```c
#include <arpa/inet.h>
```

### inet_addr


```c
in_addr_t inet_addr(const char *cp)
```

**功能**: 將字串轉換成數值表示的 `ip address`

**回傳**: 假如輸入的地址合法，會回傳 `uint32_t` 的數值，若不合法則回傳 `INADDR_NONE`

> INADDR_NONE = 0xFFFFFFFF（32 個 bits 全部為 1）

[範例程式: inet_addr_ex.c](https://github.com/davidleitw/socket/blob/master/address/inet_addr_ex.c)

### inet_aton

```c
int inet_aton(const char *string, struct in_addr *addr)
```

**功能**: 將字串轉換成數值表示的 `ip address`

**回傳**: 轉換成功，會回傳一個非零的值，失敗則會回傳 `0`

[範例程式: inet_aton_ex.c](https://github.com/davidleitw/socket/blob/master/address/inet_aton_ex.c)

### inet_ntoa

```c
char *inet_ntoa(struct in_addr)
```

**功能**: 將 `in_addr` 轉換成字串形式的 `ip address`

**回傳**: 如果沒有錯誤，會傳回成功轉換的字串，失敗時則會回傳 `NULL`

[範例程式: inet_ntoa_ex.c](https://github.com/davidleitw/socket/blob/master/address/inet_ntoa_ex.c)

> [可怕的坑](https://blog.hubert.tw/2009/04/18/%E5%BE%9E-inet_ntoa-%E7%9C%8B-thread-safe-%E7%9A%84-api/)

### inet_pton & inet_ntop

```c
const char *inet_pton(int domain, const void *restrict addr, char *restrict str, socklen_t size)
int inet_pton(int domain, const char *restrict str, void *restrict addr)
```

這兩個函數是為了支援 IPv6 而新增的，同時也向下相容 IPv4 的轉換。本文主要介紹 IPv4 的用法；若要處理 IPv6，將 `domain` 改為 `AF_INET6` 並搭配對應的 IPv6 結構即可。

```c
#include <stdio.h>
#include <arpa/inet.h>

int main()
{
    struct in_addr addr;
    if (inet_pton(AF_INET, "8.8.8.8", &addr.s_addr) == 1) {
        printf("Ip address: %u\n", addr.s_addr);
    }

    char ip_addr[20];
    if (inet_ntop(AF_INET, &addr.s_addr, ip_addr, sizeof(ip_addr))) {
        printf("After inet_ntop function, ip address: %s\n", ip_addr);
    }
}
```

[inet_pton man page](https://man7.org/linux/man-pages/man3/inet_pton.3.html)
[inet_ntop man page](https://man7.org/linux/man-pages/man3/inet_ntop.3.html)

[範例程式碼 inet_ntop_pton_ex.c](https://github.com/davidleitw/socket/blob/master/address/inet_ntop_pton_ex.c)

以上每個函數都有對應的範例，可以參考 [完整程式碼](https://github.com/davidleitw/socket/tree/master/address)。