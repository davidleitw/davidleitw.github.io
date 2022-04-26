---
title: "sudo go: command not found 問題解決"
date: 2022-04-09T00:01:01+08:00
draft: false
tags: 
    - shell
    - linux
    - go
categories: ["shell"]
---

這問題算是一個小坑，每次開新的虛擬機或者建環境的時候都會遇到(~~然後每次都忘記解決方式跑去google~~)，所以在這邊紀錄一下解決方式

## /etc/sudoers

在用 `sudo` 下指令時，系統會從 `/etc/sudoers` 這個文件來獲得環境變數，根據那些路徑去找指令的執行檔案在哪，所以我們需要把 `/usr/local/go/bin` 放到 `/etc/sudoers` 裡面，讓系統知道 go 指令要去哪執行.

`/etc/sudoers` 裡面有個 secure_path，把 `usr/local/go/bin` 加到那個字串即可

![](https://i.imgur.com/k4QKhFj.png)