---
title: "linux socket programming(三): socket programming 中常用的位置轉換函數"
date: 2021-10-26T01:04:53+08:00
draft: false
tags: 
    - linux
    - network
    - socket
    - c
categories: ["socket"]
---

一般我們在表示 `ip` 位置時都會寫成人類比較容易讀的形式，像是`125.102.25.62`

以 `ipv4` 來說，`address` 是由4個 `byte`，32個 `bit`所組成，在實務上我們常常需要做字串與實際數值(`uint32_t`)的轉換，`linux` 函式庫提供了一系列輔助位置轉換的 `function`。

一般來說，`address` 的實際數值都會用 `in_addr` 或者 `in_addr_t` 來表示
其本質就是 `uint32_t`，用總共 32 個 `bits` 來表示一個 `IPv4` 的地址
```c
typedef uint32_t in_addr_t; // 4 byte
struct in_addr {
    in_addr_t s_addr;
};
```

常用的有以下這五種

- 只能用在 `IPv4` 的處理
    - inet_addr
    - inet_aton
    - inet_ntoa
- 兼容 `Ipv4` 與 `IPv6`
    - inet_pton
    - inet_ntop

使用前必須先
```c
#include <arpa/inet.h>
```

### inet_addr


```c
in_addr_t inet_addr(const char *cp)
```

**功能**: 將字串轉換成數值表示的 `ip address`

**回傳**: 假如輸入的地址合法，會回傳 `uint32_t` 的數值，若不合法則回傳 `INADDR_NONE`

> INADDR_NODE = 0xFFFFFFFF (32 個 bits 全部填一)

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

最後這兩個函式是為了因應 `IPv6` 而新增的，除了轉換 `IPv6` 之外，也可以兼容之前 `IPv4` 相關的轉換，本文章主要是介紹 `IPv4` 相關的用法，`IPv6` 的轉換有興趣的可以自己去查資料。

要做 `IPv6` 相關的轉換，要把 `domain` 填入 `AF_INET6` 即可，後面需要搭配 `IPv6` 相關的 `struct`

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

轉換相關的 `function` 我每個都寫了一個簡單的範例，可以參考 [完整程式碼](https://github.com/davidleitw/socket/tree/master/address)