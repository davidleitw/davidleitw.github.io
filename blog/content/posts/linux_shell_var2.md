---
title: "Linux shell 變數相關用法整理(二): read, declare, array"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - linux
    - shell
categories: ["linux"]
description: linuxshellvar2
---

很多範例都是參考鳥哥的教材，再自己實際操作一次，文末有附上連結。

## read
讀取從鍵盤輸入的變數，常常會出現在 `shell script` 之中

```shell
$ read [-pt] 變數名稱
// 參數
// -p 後面接提示字元
// -t 後面接等待時間，超過時間沒輸入則取消指令
$ 
```

![](https://i.imgur.com/ESVYEHs.png)

## declare 
可以宣告變數的類型，我們上面提到有關變數的操作很多都只是單純的字串，但有些場合我們需要整數或者陣列時就要使用這個指令去指定變數的類型

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

接著試著把 `num` 轉成全域變數，並且用 `export` 指令觀察一下:

![](https://i.imgur.com/wthrxEi.png)

列出指定變數的資料型態

![](https://i.imgur.com/Q7PFV45.png)

## array

以 `arr[index]=content` 的形式來指定 array Index 所代表的值。 

![](https://i.imgur.com/ZMIa41Y.png)


### reference

- [鳥哥的 Linux 私房菜](http://linux.vbird.org/linux_basic/0320bash.php#variable_environ)