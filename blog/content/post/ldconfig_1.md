---
title: "查找動態庫(.so) 是否安裝過以及路徑使用 ldconfig"
date: 2022-10-24T00:12:53+08:00
draft: false
tags: 
    - linux
    - shell
categories: ["shell"]
description: "介紹如何使用 ldconfig 搜尋動態函式庫（.so）是否已安裝及其路徑，快速解決編譯時 'cannot open shared object file' 的問題。"
---

編譯過程中常常需要用到動態函式庫（`.so`），也常常會遇到這個錯誤：

> error while loading shared libraries... cannot open shared object file: No such file or directory

這個時候可以用 `ldconfig` 搜尋系統是否已安裝指定的 `.so`。

Linux 下的 `.so` 通常存放在 `/lib` 或 `/usr/lib`，`ldconfig` 預設也會在這些路徑下查找。詳細的用法可以參考 [ldconfig man page](https://man7.org/linux/man-pages/man8/ldconfig.8.html)。如果只是要根據關鍵字搜尋，搭配 `-p` 參數就夠了，例如想找 `ngtcp2` 相關的 `.so`：

```bash
$ ldconfig -p | grep ngtcp2
```

![](https://imgur.com/V5G3vNG.png)
