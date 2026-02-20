---
title: "Linux shell 變數相關用法整理(一): assign, echo, export, unset"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - linux
    - shell
categories: ["shell"]
description: "整理 Linux shell 變數的基本操作，包含宣告、echo 輸出、export 匯出環境變數、unset 刪除等常用指令的語法與注意事項。"
---

假設常用的資料夾路徑是 `/path1/workdir/project1/module...`，每次登入 Linux 環境都要重新輸入這段路徑：

```shell
$ cd /path1/workdir/project1/module...
```

這時候就可以用一個變數來取代這個常用的字串。在此之前，先介紹一下變數的取用方式。

### echo

```shell
$ echo $HOME
/home/davidlei

$ echo ${HOME} 
/home/davidlei
```
![](https://i.imgur.com/uaQeu5b.png)


取出 `HOME` 這個變數的值並顯示出來。
> 在 Linux 下，取用變數時前面需要加上 `$` 符號；也可以用 `${}` 把變數名稱框起來。

回到一開始的例子，現在想設置一個變數 `work` 來存放 `/path/workdir/project1/module`：

```shell
$ echo $work
 // 還未設置的變數默認為空，echo 出來的結果是空
$ work=/path1/workdir/project1/module
$ echo $work
/path1/workdir/project1/module
```

![](https://i.imgur.com/afTw2VS.png)

### 變數的設定規則

1. 以 `=` 連結變數名稱與值，等號兩側不能有空格：

```shell
$ var=something   // 正確
$ var = something // 等號兩邊不得有空格
```

2. 變數名稱開頭不能是數字
3. 變數內容若含有空白字元，可以用雙引號 `"` 或單引號 `'` 包起來

- 如果變數內容中包含其他變數，需要用雙引號 `""` 包起來（參考下方範例）。用單引號 `''` 包起來的話，bash 不會把 `$變數` 替換成該變數的內容。

  ![](https://i.imgur.com/WojjWua.png)

4. 用跳脫字元 `\` 可以把特殊符號轉成一般字元：

   ![](https://i.imgur.com/N9K7Z6M.png)

5. 用現有變數組合出新變數時，有兩種寫法：

假設團隊的工作目錄是 `/davidlei/project/`，已設置變數 `$work`。現在 `$work` 路徑下有兩個子目錄 `project1`、`project2`，想分別用 `workdir1`、`workdir2` 兩個變數來代表它們，可以使用下面兩種方式：

![](https://i.imgur.com/8UhGbDI.png)

6. 若要把變數設定成全域變數，需要使用 **`export`**：
```shell
$ var=xxx
$ export var
```
> 這樣宣告的全域變數並不等同於環境變數，關閉 bash 後變數資料就會清除。

7. 取消變數使用 **`unset`**：

![](https://i.imgur.com/qwBEo4O.png)

### reference 
- [鳥哥的 Linux 私房菜 認識與學習BASH](http://linux.vbird.org/linux_basic/0320bash.php#variable_var)