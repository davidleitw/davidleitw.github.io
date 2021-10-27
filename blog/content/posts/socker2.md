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
---

## sockaddr

`sockaddr` 是 `socket` 的通用地址結構，就如同一開始提到的，`socket` 除了在網路領域之外，也可以在很多不同的地方用來通訊。

`sockaddr` 結構，定義如下

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

後來的更新中，為了讓龐大的程式碼可讀性上升，新增了 `sockaddr_in` 的結構用來存取網路相關的應用， `in` 指的是 `internet`，`sockaddr_in` 專門用來存 `IPv4` 的相關地址。

`IPv6` 則是使用 `sockaddr_in6` 結構，在本文章主要會著重在 `IPv4` 相關的範例。

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

這邊觀看原始碼會覺得奇怪，為什麼還需要使用 `sin_zero` 來做填充的動作。

原因是很多 `socket` 的 `api`，參數都需要填入 `sockaddr`，`sockaddr_in` 則是後來加入的 `struct`。 今天如果我們 `address` 的資料是用 `sockaddr_in` 來儲存，並且想調用相關的函式時，我們就需要強制轉型。 

假設今天用 `socket` 的場景不是網路，也會有對應的結構來存地址，在呼叫 `socket` 通用的 `api` 時，就可以使用強制轉型的方式，讓不同的結構呼叫同一個函式。

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