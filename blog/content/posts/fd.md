---
title: "Linux file descriptor 理解"
date: 2022-06-28T04:16:48+08:00
draft: false
tags: 
    - c
    - kernel
    - file_descriptor
categories: ["linux_kernel"]
---

## 前言

**file descriptor** 常被簡稱為 fd, 在學習 Linux 的過程中，會看到很多 system call 藉由 fd 來操作文件或抽象資源，像是 network programming 中呼叫 `socket` 之後會使用回傳的 socket fd 去進行後續的操作，或者 I/O 領域的 epoll 同樣在呼叫 `epoll_create` 之後會回傳 fd，此後對於 epoll 相關的操作都要把 fd 當作第一個參數傳入。

在 Linux 中常常會看到 fd 的身影，但一直沒有花時間去深入了解這個 fd 底層的實現，只是有模糊的概念而已，所以趁這個機會來整理一篇筆記，紀錄一下。

在 [File descriptor](https://en.wikipedia.org/wiki/File_descriptor) 中可以簡單看一下，究竟在 Linux 中有多少 system call 使用了 File descriptor 的概念，就知道 fd 在 Linux 中的重要性了。

## [Everything is a file](https://en.wikipedia.org/wiki/Everything_is_a_file)

Linux 秉持著 UNIX 哲學 **Everything is a file**，這個概念的好處是可以用一組通用的 Interface 來操作不同資源，在資源跟使用者之間加上一層抽象層，進而延伸出 **Universal I/O Model** 的概念。

**Universality of I/O** 代表可以用相同的 `open()`, `read()`, `write()`, `close()` 來操作不同類型的 I/O，後續很多不同的新技術或者機制都是用相同的精神設計，讓一組通用的 API 可以在不同場景有不同的作用。

> 補充閱讀: [Linux 核心設計: 檔案系統](https://hackmd.io/@sysprog/linux-file-system#File-Descriptor-%E5%8F%8A%E9%96%8B%E5%95%9F%E7%9A%84%E6%AA%94%E6%A1%88)

因為 `open()`, `read()`, `write()`, `close()` 等 system call 以及其他 system call 其實都是用 fd 來控制資源，所以有個說法是 **Everything is a file** 應該要說成 **Everything is a file descriptor** 更妥當。

### Kernel space & User space

為什麼需要 fd 可以先從 kernel space 與 user space 的概念開始思考。

寫在 user space 的程式沒辦法直接訪問硬體資源(像是硬碟, 網卡等等)，如果要讀取單個文件，我們會在 user space 呼叫 `read()` 來讀取資料時，會先用 system call 的方式跟 kernel 發起資源的請求，在 kernel space 中才會具體跟底層互動，最後才將結果從 kernel space 複製到 user space。

![](https://i.imgur.com/OrQqXis.png)

> 呼叫 read() system call 的流程圖

因為 user process 並沒有辦法直接控制底層的硬體資源，所以必須要用 fd 來代表底層資源的抽象。

```c
int open(const char *pathname, int flags);

ssize_t read(int fd, void *buf, size_t count);
ssize_t write(int fd, const void *buf, size_t count);
```

因為 **Everything is a file**, 所以任何資源都可以視為文件。當使用 `open()` 打開一個文件時，kernel 會回傳一個 file descriptor。

後續 `read()`, `write()` 這個文件，只需要使用回傳的 fd 來**識別**該文件，將其傳入 `read`, `write` 即可。

```c
/* open() example */
int fd = open("test.txt", O_RDONLY);
```

### 默認的 fd

底下看 source code 的時候會了解到每個 process 都會存放自己的 `file descriptors table` 來代表該 process 打開或者操作的文件/資源。

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

fd 在 kernel 中使用了三種不同的 table 來表示，本文會簡單分析一下底層的 source code。

下方為三種 table 的示意圖

![](https://i.imgur.com/2KoG0cs.png)

### [task_struct](https://elixir.bootlin.com/linux/latest/source/include/linux/sched.h#L1076)

要理解 fd 的實現就要從 `task_struct` 開始看起，我們聚焦在 `files` 這個成員。

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

`files_struct` 用來管理/紀錄一個 process 打開的所有文件，這個結構在上方的示意圖的最左方，存放一個 process 的 file descriptors。

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

`files_struct` 管理著一個 process 所有打開的文件/資源，它把所有打開的文件結構以 array 的方式儲存，這裡 `files_struct` 使用了兩個陣列的設計

- `struct file __rcu *fd_array[NR_OPEN_DEFAULT]` 是一個靜態的陣列，在 64 位元的電腦中這個陣列大小為 64
- `struct fdtable` 則是動態陣列，在一個 process 開啟文件的數量大於 **NR_OPEN_DEFAULT** 時啟用

大多數 process 只會開啟少數文件，所以只用靜態的 array 即可，開啟大量文件的情況才會用到動態陣列。

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

所以從上面的介紹中可以得知，無論是開啟文件較少時用的 `fd_array` 或者動態的 `fdtable`，fd 在裡面扮演的角色只是陣列中的**索引**，最終會指向對應文件的 `struct file` 結構。

![](https://i.imgur.com/bTiyp9S.png)

[來源](https://www.qiyacloud.cn/2021/04/2021-04-07/)

接著往下 `struct file` 還有更深入的 `struct inode` 就不在本篇的討論範圍內，避免篇幅過長。 在這篇文章中主要介紹了最外層的 `files_struct` 以及知道 fd 的本質就是索引，每個 fd 都可以對應到一個 `file` 的結構，更多深入的解析可以在底下 reference 中的連結內繼續往下探索。

## reference
- [Linux 的 file descriptor 筆記](https://kkc.github.io/2020/08/22/file-descriptor/)
- [理解linux中的file descriptor(文件描述符)](https://wiyi.org/linux-file-descriptor.html)
- [Linux 内核文件描述符表的演变](https://zhuanlan.zhihu.com/p/34280875)
- [Everything is a file](https://en.wikipedia.org/wiki/Everything_is_a_file)
- [如何理解 In UNIX, everything is a file？](https://www.zhihu.com/question/21040222)
- [存储基础 — 文件描述符 fd 究竟是什么？](https://www.qiyacloud.cn/2021/04/2021-04-07/)
- [刨根问底儿，看我如何处理 Too many open files 错误！](https://mp.weixin.qq.com/s/GBn94vdL4xUL80WYrGdUWQ)