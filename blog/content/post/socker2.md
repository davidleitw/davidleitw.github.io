---
title: "linux socket programming(二): socket 中用來存放地址的 sockaddr"
date: 2021-10-26T01:04:53+08:00
draft: false
tags: 
    - linux
    - network
    - socket
    - c
categories: ["socket"]
description: "介紹 socket programming 中用來存放地址的通用結構 sockaddr，以及 sockaddr_in 等不同 address family 的差異與使用方式。"
---

## sockaddr

`sockaddr` 是 socket 的通用地址結構。如同上一篇提到的，socket 不只用在網路領域，也可以用在很多不同的通訊場景。

`sockaddr` 的定義如下：

```c
typedef unsigned short int sa_family_t;

#define	__SOCKADDR_COMMON(sa_prefix) \
  sa_family_t sa_prefix##family

struct sockaddr {
    __SOCKADDR_COMMON (sa_);	/* Common data: address family and length.  */
    char sa_data[14];		/* Address data.  */
};

// 上面的結構把巨集展開後，等價於下方的資料結構
struct sockaddr {
    unsigned short int sa_family; // 2 bytes
    char sa_data[14];             // 14 bytes
};
```

後來為了提升大型程式碼的可讀性，新增了 `sockaddr_in` 這個專門用於網路場景的結構。`in` 代表 internet，`sockaddr_in` 專門用來存放 IPv4 地址。

IPv6 則使用 `sockaddr_in6`，本文主要著重在 IPv4 相關的範例。

```c
typedef uint32_t in_addr_t; // 4 byte
struct in_addr {
    in_addr_t s_addr;
};

struct sockaddr_in {    
    __SOCKADDR_COMMON (sin_);
    in_port_t sin_port;			    /* Port number.  */
    struct in_addr sin_addr;		/* Internet address.  */

    /* Pad to size of `struct sockaddr'.  */
    unsigned char sin_zero[sizeof (struct sockaddr)
			   - __SOCKADDR_COMMON_SIZE
			   - sizeof (in_port_t)
			   - sizeof (struct in_addr)];
};

struct sockaddr_in {
    // sa_family_t sin_family
    unsigned short int sin_family; // 2 bytes
    unsigned short int sin_port;   // 2 bytes
    struct in_addr sin_addr;       // 4 bytes
    unsigned char sin_zero[8];     // 填充，讓 sockaddr_in 的 size 跟 sockaddr 相同
};
```

看到這裡可能會覺得奇怪：為什麼需要 `sin_zero` 做填充？

原因是 `sockaddr_in` 是後來才加入的結構，而大多數 socket API 的參數型別都是 `sockaddr`。如果 address 資料是用 `sockaddr_in` 儲存，呼叫這些 API 時就需要強制轉型。

同樣地，如果使用 socket 的場景不是網路，也會有對應的結構存放地址（例如 `sockaddr_un` 對應 Unix domain socket）。這些不同的結構在呼叫通用 API 時，都透過強制轉型成 `sockaddr` 來實現統一介面。

實際範例: [unix](https://man7.org/linux/man-pages/man7/unix.7.html)

在後面的例子中也會實際調用，下方的程式碼可以先作為參考。

```c
#define serverIP
#define serverPort 12000

// 建立一個 sockaddr_in 結構，存著 server 的相關資料
struct sockaddr_in serverAddr = {
    .sin_family = PF_INET,
    .sin_addr.s_addr = inet_addr(serverIP),
    .sin_port = htons(serverPort)
};

bind(socket_fd, (const struct sockaddr *)&serverAddr, sizeof(serverAddr));
```