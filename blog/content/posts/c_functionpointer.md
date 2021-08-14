---
title: "C Function Pointer 基礎用法整理"
date: 2021-08-15T00:04:43+08:00
author: davidlei
draft: false
tags: 
    - c
categories: ["c"]
description: function pointer 
---


這最近在看 `jserv` 大神的 linux 核心設計講座，因為之前比較少寫 c，所以對於 `function pointer` 只有一點概念但沒有真正寫過，所以趁這個機會寫個筆記來紀錄一下用法。

之後在學習的過程中如果遇到 `function pointer` 的應用也會一併整理在這篇文章中。

## function pointer

`function pointer` 顧名思義就是指向某個 `function` 的 `pointer`，有了 `function pointer` 我們就可以實現把 `function` 當作參數，傳進一個 `function` 之中，或者更加彈性的設計我們的程式，減少多餘的 `if/else`, `switch case`。

我們先從一個簡單的 `function pointer` 宣告開始講起

```c
int (*myFunc)(int, int);
```

上面就是一個基本的 `function pointer` 宣告

一個 `function pointer` 變數名稱為 `myFunc`，可以這麼解讀

- `myFunc` 是一個指標指向一個 `function`
    - 該 `function` 有兩個 `int` 的 parameters
    - 該 `function` 會回傳 `int`


假設今天我有個 `function` 宣告成以下這種形式

```c
void parseFunc(float f1, int i1, char c1);
```

我們要怎麼宣告一個 `pointer` 去指向這個 `function` 呢？

```c
void (*myFunc)(float, int, char);
```

解讀成

- `myFunc` 是一個指標指向一個 `function`
    - 該 `function` 有三個 parameters，分別要傳入
        - _`float`_
        - _`int`_
        - _`char`_
    - 該 `function` 會回傳 _`void`_


所以我們可以來驗證看看這個 `function pointer` 是否能真的呼叫 `parseFunc` 這個 `function`
```c
#include <stdio.h>

void parseFunc(float f1, int i1, char c1) {
    printf("%f %d %c\n", f1, i1, c1);
}

int main() {
    parseFunc(0.87, 87, 'a');

    void (*myFunc)(float, int, char) = parseFunc;
    myFunc(0.87, 877, 'b');
    return 0;
}
```

[程式執行結果](https://ideone.com/CaCBwE)

### 注意

上面在宣告 `function pointer` 的時候
```c
void (*myFunc)(float, int, char)
```
會注意到 `*myFunc` 會用括號包起來，這是不能省略的喔，省略的話就不是 `function pointer` 的宣告方法了。

省略的話會變成

```c
void *myFunc(float, int, char);
```

這樣子 `myFunc` 就不是 `function pointer` 了，而是單純宣告一個 `function`

### Jserv 上課的範例

簡單的例子看完就可以來看看 `Jserv` 在 [你所不知道的C語言：指標篇](https://hackmd.io/@sysprog/c-pointer) 開頭所舉出來的範例

試試看能不能自己寫出該宣告怎麼解釋

```c
void **(*d) (int &, char **(*)(char *, char **));
```

- d 是一個 `function pointer`, 該 `function` 有兩個 `parameters`
    - 第一個 `parameters`: a reference to an _`int`_
    - 第二個 `parameters`: 同樣也是一個 `function pointer`
        - 該 `function` 有兩個 `parameters`
            - a pointer to a _`char`_
            - a pointer to a pointer to a _`char`_
        - return a pointer to a pointer to a _`char`_
- return a pointer to a pointer to _`void`_

## 應用舉例

今天如果我想寫一個 `calculate` 的 `function` 該 function 有三個參數
- a
- b
- 加減乘除

傳入 a, b 之後再傳入要計算的動作，我們可以利用 `function pointer` 來取代 `switch/case`, 並增加可讀性

我們可以宣告成
```c
int add(int a, int b) { return a + b; }
int sub(int a, int b) { return a - b; }
int mul(int a, int b) { return a * b; }
int div(int a, int b) { return a / b; }

int calculate(int a, int b, int (*cal)(int, int));
```

用這樣的宣告形式，就可以把我們實現好的加減乘除 `function` 當作參數傳入 `calculate` 當中

但是又有人會說 `calculate` 的第三個參數宣告還是有點複雜，有沒有辦法可以再讓可讀性增加呢？ 

這時候我們會習慣用 `typedef` 的關鍵字把常用的 `function pointer` 宣告取一個比較簡短的名稱

導入 `typedef` 之後我們可以寫成以下的形式

```c
typedef int (*calc)(int, int);

int add(int a, int b) { return a + b; }
int sub(int a, int b) { return a - b; }
int mul(int a, int b) { return a * b; }
int div(int a, int b) { return a / b; }

int calculate(int a, int b, calc method) 
{
    return method(a, b);
}
```

這樣子我們在看 `calculate` 宣告的時候就會清楚的知道第三個參數要把指定的 `method` 傳進去。

完整的程式碼我放在 [GitHub](https://github.com/davidleitw/c-pointer-review)，可以把 code 載下來自己 run 一次，順便改改看寫法，觀察其中的不同。

## reference
- [你所不知道的C語言：指標篇](https://hackmd.io/@sysprog/c-pointer)
- [(c/c++) Function Pointer函式指標兩三事 (Function Pointer 的 typedef 與 Array of Function Pointer)
](http://hackgrass.blogspot.com/2017/07/cc-function-pointer-function-pointer.html)
- [C - Function Pointer](http://godleon.blogspot.com/2008/01/c-function-pointer-function-pointer.html)
