---
title: "查找動態庫(.so) 是否安裝過以及路徑使用 ldconfig"
date: 2022-10-24T00:12:53+08:00
draft: false
tags: 
    - linux
    - shell
categories: ["shell"]
---

在編譯過程中可能會用到一些動態庫(`.so`) 來編譯，時常會遇到找不到需要的 `.so` 檔案

> error while loading shared libraries...   cannot open shared object file: No such file or directory

像是上面的這個錯誤訊息就是常常會看見的老朋友XD，這時我們就可以使用 `ldconfig` 來搜索是否有安裝過指定的 `.so`

一般來說 Linux 底下的 `.so` 都存放在 `/lib`, `/usr/lib` 底下，`ldconfig` 指令會在預設的路徑底下查找

詳細的用法可以參考 [ldconfig](https://man7.org/linux/man-pages/man8/ldconfig.8.html)，一般如果只是要根據關鍵字查找，只要配合 `-p` 即可，像是我如果想在本地找到 `ngtcp2` 相關的 `.so` 我就可以輸入

```bash
$ ldconfig -p | grep ngtcp2
```

![](https://imgur.com/V5G3vNG.png)
