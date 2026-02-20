---
title: "sudo go: command not found 問題解決"
date: 2022-04-09T00:01:01+08:00
draft: false
tags: 
    - shell
    - linux
    - go
categories: ["shell"]
description: "記錄 sudo 環境下出現 'go: command not found' 的原因，以及透過修改 /etc/sudoers 的 secure_path 解決問題的方法。"
---

這個坑每次開新的虛擬機或建環境都會踩到（~~然後每次都忘記解法，再去 Google 一遍~~），乾脆記錄下來。

## /etc/sudoers

使用 `sudo` 執行指令時，系統會從 `/etc/sudoers` 取得環境變數，根據其中的路徑去找指令的執行檔。因此需要把 `/usr/local/go/bin` 加進去，讓系統知道 go 指令放在哪裡。

`/etc/sudoers` 中有個 `secure_path`，把 `/usr/local/go/bin` 加到那個路徑字串裡即可：

![](https://i.imgur.com/k4QKhFj.png)