---
title: "C Function Pointer 基礎用法整理"
date: 2021-08-15T00:04:43+08:00
author: davidlei
draft: false
tags: 
    - c
categories: ["c"]
description: "整理 C 語言 Function Pointer 的宣告語法、作為參數傳遞的用法，以及在回呼函數（callback）等實際場景的應用範例。"
---


最近在讀 jserv 老師的 Linux 核心設計講座，由於之前比較少寫 C，對 function pointer 只有模糊的概念，從來沒有認真用過，趁這個機會寫個筆記好好整理一下。

之後在學習過程中遇到 function pointer 的應用，也會一併補充到這篇文章中。

## function pointer

function pointer 顧名思義就是指向某個 function 的 pointer。有了 function pointer，就可以把 function 當作參數傳入另一個 function，讓程式設計更有彈性，也可以減少大量的 `if/else` 或 `switch case`。

先從一個簡單的 function pointer 宣告開始：

```c
int (*myFunc)(int, int);
```

這是一個基本的 function pointer 宣告，`myFunc` 是一個指標，指向一個 function：

- 該 function 接受兩個 `int` 參數
- 該 function 回傳 `int`

假設有個 function 宣告成以下形式：

```c
void parseFunc(float f1, int i1, char c1);
```

對應的 function pointer 宣告如下：

```c
void (*myFunc)(float, int, char);
```

解讀：`myFunc` 是一個指標，指向一個接受 `float`、`int`、`char` 三個參數並回傳 `void` 的 function。

來驗證看看這個 function pointer 是否真的能呼叫 `parseFunc`：
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

宣告 function pointer 時需要注意，`*myFunc` 必須用括號包起來：
```c
void (*myFunc)(float, int, char)
```
這個括號不能省略，省略之後就不是 function pointer 的宣告了，而是：

```c
void *myFunc(float, int, char);
```

這樣 `myFunc` 就不是 function pointer，而是單純宣告了一個回傳 `void*` 的 function。

### Jserv 上課的範例

看完基礎的例子，來試試 jserv 在 [你所不知道的C語言：指標篇](https://hackmd.io/@sysprog/c-pointer) 開頭舉出的範例：

試著自己解釋這個宣告的意思：

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

假設要寫一個 `calculate` function，它接受三個參數：
- `a`
- `b`
- 要執行的運算（加減乘除）

傳入 `a`、`b` 之後再傳入計算方式，就可以用 function pointer 取代 `switch/case`，大幅提升可讀性：

我們可以宣告成
```c
int add(int a, int b) { return a + b; }
int sub(int a, int b) { return a - b; }
int mul(int a, int b) { return a * b; }
int div(int a, int b) { return a / b; }

int calculate(int a, int b, int (*cal)(int, int));
```

這樣就可以把實現好的加減乘除 function 當作參數傳入 `calculate`。

不過 `calculate` 第三個參數的宣告還是有點囉嗦，可讀性還有改善空間。這時候可以用 `typedef` 幫常用的 function pointer 宣告取一個簡短的名稱：

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

這樣在看 `calculate` 的宣告時，一眼就能知道第三個參數是要傳入指定的運算方法。

完整的程式碼放在 [GitHub](https://github.com/davidleitw/c-pointer-review)，把 code 載下來自己跑一次，順便改改看寫法，觀察其中的差異。

## reference
- [你所不知道的C語言：指標篇](https://hackmd.io/@sysprog/c-pointer)
- [(c/c++) Function Pointer函式指標兩三事 (Function Pointer 的 typedef 與 Array of Function Pointer)
](http://hackgrass.blogspot.com/2017/07/cc-function-pointer-function-pointer.html)
- [C - Function Pointer](http://godleon.blogspot.com/2008/01/c-function-pointer-function-pointer.html)
