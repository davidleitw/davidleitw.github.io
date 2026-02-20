---
title: "Linux shell 變數相關用法整理(二): read, declare, array"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - linux
    - shell
categories: ["shell"]
description: "整理 Linux shell 進階變數操作，介紹 read 讀取使用者輸入、declare 宣告變數型別、array 陣列的使用方式與實際範例。"
---

很多範例都參考自鳥哥的教材，再自己實際操作一遍，文末有附上連結。

## read

`read` 用來讀取從鍵盤輸入的變數，常見於 shell script 中：

```shell
$ read [-pt] 變數名稱
// 參數
// -p 後面接提示字元
// -t 後面接等待時間，超過時間沒輸入則取消指令
$ 
```

![](https://i.imgur.com/ESVYEHs.png)

## declare

`declare` 用來宣告變數的類型。上一篇提到的變數操作大多只是字串，但某些場合需要整數或陣列時，就必須用這個指令明確指定型別：

```shell
$ declare [-aixr] 變數名稱
// 參數
// -a 宣告陣列型態的變數
// -i 宣告整數型態的變數
// -x 同 export 指令，宣告的變數變成全域變數(可以讓子程序讀取)
// -r 宣告 readonly, 不可更改變數內容，也無法被 unset 取消
// -p 列出變數資料型態
$ 
```

![](https://i.imgur.com/f9Dy2zj.png)

接著試著把 `num` 轉成全域變數，並用 `export` 指令觀察結果：

![](https://i.imgur.com/wthrxEi.png)

列出指定變數的資料型態：

![](https://i.imgur.com/Q7PFV45.png)

## array

以 `arr[index]=content` 的形式指定 array 各個 index 所代表的值。

![](https://i.imgur.com/ZMIa41Y.png)


### reference

- [鳥哥的 Linux 私房菜](http://linux.vbird.org/linux_basic/0320bash.php#variable_environ)