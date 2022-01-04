---
title: "Linux shell 變數相關用法整理(一): assign, echo, export, unset"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - linux
    - shell
categories: ["shell"]
description: linuxshellvar1
---

假設今天我們常用的資料夾路徑是在 `/path1/workdir/project1/module...`
每次登入 `linux` 環境都要切換到這個資料夾我們就需要重新輸入路徑

```shell
$ cd /path1/workdir/project1/module...
```

我們這時候就可以用一個變數來取代常用的字串

在這之前先介紹一下變數的取用

### echo

```shell
$ echo $HOME
/home/davidlei

$ echo ${HOME} 
/home/davidlei
```
![](https://i.imgur.com/uaQeu5b.png)


取出 `Home` 這個變數的值並且顯示出來
> 在 Linux 底下變數前面都需要加上 $ 符號來做辨識
> 也可以在 $ 符號後面用 {} 把變數名稱框起來


回到一開始提到的案例，我們現在想要設置一個變數 `work` 來存放 `/path/workdir/project1/module`

```shell
$ echo $work
 // 還未設置的變數默認為空，echo 出來的結果是空
$ work=/path1/workdir/project1/module
$ echo $work
/path1/workdir/project1/module
```

![](https://i.imgur.com/afTw2VS.png)

### 變數的設定規則 

1. 設定變數中間以 "=" 連結，並且等號兩側不能有空格

```shell
$ var=something   // 正確
$ var = something // 等號兩邊不得有空格
```

2. 變數開頭不能是數字
3. 變數內容含有空白字元可以用 \"" 雙引號 或者 \'' 單引號包起來

- 如果變數內容包含著其他變數，需要用 "" 包起來，請看下方範例
  用 '' 包起來 `bash` 就不會把 `$變數` 置換成該變數的內容。
  
  ![](https://i.imgur.com/WojjWua.png)

4. 用跳脫字元 `\` 可以特殊符號置換成一般字元
  
   ![](https://i.imgur.com/N9K7Z6M.png)

5. 如果要用現有的變數組合成新的變數的時候有兩個寫法

假設今天我們團隊主要的工作目錄是在 `/davidlei/project/`，一開始建立目錄的時候我們把這個路徑設了一個變數 `$work`

現在假設 `$work` 路徑底下有兩個子目錄 `project1`, `project2`
我們想用 `workdir1`, `workdir2` 兩個變數來代表這兩個 project 的路徑
我們可以用底下兩種寫法

![](https://i.imgur.com/8UhGbDI.png)

6. 若要把一個變數設定成全域變數還需要使用 **`export`**
```shell
$ var=xxx
$ export var
```
> 此方式宣告的全域變數不等於環境變數，把 bash 關掉之後變數資料就會清除


1. 取消變數使用 **`unset`**

![](https://i.imgur.com/qwBEo4O.png)

### reference 
- [鳥哥的 Linux 私房菜 認識與學習BASH](http://linux.vbird.org/linux_basic/0320bash.php#variable_var)