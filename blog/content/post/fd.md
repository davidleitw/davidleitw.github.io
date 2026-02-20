---
title: "Linux file descriptor 理解"
date: 2022-06-28T04:16:48+08:00
draft: false
tags: 
    - c
    - kernel
    - file_descriptor
categories: ["linux_kernel"]
description: "深入 Linux file descriptor 的底層實作，從 task_struct、files_struct 到 fdtable，解析 fd 本質上只是陣列索引的設計原理。"
---

## 前言

**file descriptor** 常被簡稱為 fd。在學習 Linux 的過程中，會看到許多 system call 藉由 fd 來操作文件或抽象資源：network programming 中呼叫 `socket` 之後，會用回傳的 socket fd 進行後續操作；I/O 領域的 epoll 在呼叫 `epoll_create` 之後同樣會回傳 fd，此後所有 epoll 相關操作都需要把這個 fd 當作第一個參數傳入。

fd 在 Linux 中隨處可見，但我一直沒有認真花時間深入了解它底層的實作，只有模糊的概念。趁這個機會整理一篇筆記，好好記錄一下。

可以到 [File descriptor](https://en.wikipedia.org/wiki/File_descriptor) 的 Wikipedia 頁面看看，Linux 中有多少 system call 用到了 file descriptor 的概念，就能感受到 fd 在 Linux 中的核心地位了。

## [Everything is a file](https://en.wikipedia.org/wiki/Everything_is_a_file)

Linux 秉持 UNIX 哲學 **Everything is a file**。這個概念的好處是可以用一組通用的 interface 操作各種不同的資源，在資源和使用者之間加入一層抽象，進而延伸出 **Universal I/O Model** 的概念。

**Universality of I/O** 意指可以用相同的 `open()`、`read()`、`write()`、`close()` 操作不同類型的 I/O。後續許多新技術或機制都沿用了相同的精神，讓一組通用的 API 在不同場景發揮不同的作用。

> 補充閱讀: [Linux 核心設計: 檔案系統](https://hackmd.io/@sysprog/linux-file-system#File-Descriptor-%E5%8F%8A%E9%96%8B%E5%95%9F%E7%9A%84%E6%AA%94%E6%A1%88)

因為 `open()`、`read()`、`write()`、`close()` 等 system call 本質上都是透過 fd 來控制資源，所以有個說法認為 **Everything is a file** 應該改成 **Everything is a file descriptor** 才更貼切。

### Kernel space & User space

為什麼需要 fd？可以從 kernel space 與 user space 的概念開始思考。

user space 的程式無法直接存取硬體資源（像是硬碟、網卡等等）。當我們在 user space 呼叫 `read()` 讀取資料時，實際上是透過 system call 向 kernel 發起資源請求，在 kernel space 中才會真正與底層硬體互動，最後再將結果從 kernel space 複製回 user space。

![](https://i.imgur.com/OrQqXis.png)

> 呼叫 read() system call 的流程圖

正因為 user process 無法直接控制底層硬體，才需要用 fd 作為底層資源的抽象代表。

```c
int open(const char *pathname, int flags);

ssize_t read(int fd, void *buf, size_t count);
ssize_t write(int fd, const void *buf, size_t count);
```

基於 **Everything is a file** 的理念，任何資源都可以被視為文件。當使用 `open()` 打開一個文件時，kernel 會回傳一個 file descriptor。

後續對這個文件執行 `read()` 或 `write()` 時，只需要把回傳的 fd 傳入 `read()`、`write()` 來**識別**對應的文件即可。

```c
/* open() example */
int fd = open("test.txt", O_RDONLY);
```

### 默認的 fd

在後面看 source code 時會了解到，每個 process 都有自己的 `file descriptors table`，用來記錄該 process 已打開或正在操作的文件與資源。

每個 process 預留了 0, 1, 2 這三個 fd，分別代表 **stdin**, **stdout**, **stderr**

![](https://i.imgur.com/A3azUal.png)

> 詳細參考: [stdin(3) — Linux manual page](https://man7.org/linux/man-pages/man3/stdout.3.html)

### fd 的範圍

fd 有基本的範圍限制，可以通過 `ulimit` 來查看系統目前的配置

```shell
$ ulimit -n
1024
```

這個範圍包含著很多學問，詳情可以參考這篇 [刨根问底儿，看我如何处理 Too many open files 错误！](https://mp.weixin.qq.com/s/GBn94vdL4xUL80WYrGdUWQ)

## File descriptor (`fd`)

fd 在 kernel 中透過三種不同的 table 來表示。本文會簡單分析相關的底層 source code。

下方為三種 table 的示意圖

![](https://i.imgur.com/2KoG0cs.png)

### [task_struct](https://elixir.bootlin.com/linux/latest/source/include/linux/sched.h#L1076)

要理解 fd 的實作，要從 `task_struct` 開始看起，重點在於 `files` 這個成員。

```c
struct task_struct {
    // ...
    /* Open file information: */
    struct files_struct *files;
    // ...
    // ...
}
```


### [files_struct](https://elixir.bootlin.com/linux/latest/source/include/linux/fdtable.h#L49)

`files_struct` 用來管理並記錄一個 process 打開的所有文件，對應上方示意圖最左邊的部分，存放該 process 的 file descriptors。

```c
struct files_struct {
   /*
    * read mostly part
    */
    atomic_t count;
    bool resize_in_progress;
    wait_queue_head_t resize_wait;

    struct fdtable __rcu *fdt;
    struct fdtable fdtab;
   /*
    * written part on a separate cache line in SMP
    */
    spinlock_t file_lock ____cacheline_aligned_in_smp;
    unsigned int next_fd;
    unsigned long close_on_exec_init[1];
    unsigned long open_fds_init[1];
    unsigned long full_fds_bits_init[1];
    struct file __rcu * fd_array[NR_OPEN_DEFAULT];
};
```

`files_struct` 管理著一個 process 所有打開的文件/資源，以 array 的方式儲存所有已打開的文件結構。這裡採用了兩個陣列並存的設計：

- `struct file __rcu *fd_array[NR_OPEN_DEFAULT]` 是靜態陣列，在 64 位元系統上大小為 64
- `struct fdtable` 則是動態陣列，在 process 開啟的文件數量超過 **NR_OPEN_DEFAULT** 時啟用

大多數 process 只會開啟少數幾個文件，靜態的 array 就夠用了，只有需要開啟大量文件時才會動用到動態陣列。

### [fdtable](https://elixir.bootlin.com/linux/latest/source/include/linux/fdtable.h#L27)

`fdtable` 是用來管理 `fd` 的結構

```c
struct fdtable {
    unsigned int max_fds;
    struct file __rcu **fd;      /* current fd array */
    unsigned long *close_on_exec;
    unsigned long *open_fds;
    unsigned long *full_fds_bits;
    struct rcu_head rcu;
};
```

- `mzx_fds`: 代表此 fd table 能容納多少個 fd
- `fd`: 指向一個 array, array 內的元素為 `struct file*`

關於 `fdtable` 的建立，會呼叫 [alloc_fdtable](https://elixir.bootlin.com/linux/v5.15/source/fs/file.c#L90)，有興趣可以繼續往下看相關的邏輯，也能順便理解什麼情境才會呼叫 `alloc_fdtable`。

### fd 只是陣列中的索引值

從上面的介紹可以得知，無論是文件數量少時使用的 `fd_array`，還是動態的 `fdtable`，fd 在其中扮演的角色只是陣列中的**索引值**，最終會指向對應文件的 `struct file` 結構。

![](https://i.imgur.com/bTiyp9S.png)

[來源](https://www.qiyacloud.cn/2021/04/2021-04-07/)

再往下的 `struct file` 以及更深層的 `struct inode`，就不在本篇的討論範圍內了，以免篇幅過長。本文的重點在於介紹最外層的 `files_struct`，以及理解 fd 的本質就是索引值——每個 fd 都對應到一個 `struct file`。想繼續深入探索的話，可以從下方 reference 的連結繼續往下研究。

## reference
- [Linux 的 file descriptor 筆記](https://kkc.github.io/2020/08/22/file-descriptor/)
- [理解linux中的file descriptor(文件描述符)](https://wiyi.org/linux-file-descriptor.html)
- [Linux 内核文件描述符表的演变](https://zhuanlan.zhihu.com/p/34280875)
- [Everything is a file](https://en.wikipedia.org/wiki/Everything_is_a_file)
- [如何理解 In UNIX, everything is a file？](https://www.zhihu.com/question/21040222)
- [存储基础 — 文件描述符 fd 究竟是什么？](https://www.qiyacloud.cn/2021/04/2021-04-07/)
- [刨根问底儿，看我如何处理 Too many open files 错误！](https://mp.weixin.qq.com/s/GBn94vdL4xUL80WYrGdUWQ)