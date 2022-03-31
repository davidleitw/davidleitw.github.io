---
title: "從執行順序來探討 Race condition, go 語言的 happens-before 規則"
date: 2022-04-01T00:01:01+08:00
draft: false
tags: 
    - concurrency
    - parallelism
    - linux
    - linux_kernel
categories: ["Concurrency"]
---

## 同步處理(Synchronization)

確保多個執行單元同時存取某些資源的時候，執行結果不會因為執行單元的時間先後導致發生不可預期的錯誤。

Linux kernel 提供了很多協助處理 Synchronization 問題的機制，如果不在 Concurrency 的架構內使用適當的同步技術，就可能會引發 Race condition 的問題。

![](https://i.imgur.com/D6Yurh7.png)


可以參考 [Concurrency in the Kernel](https://web.fe.up.pt/~pfs/aulas/so2021/at/19conc.pdf) 來快速了解 kernel 內對於 Concurrency 提供了什麼樣的工具。

## Race condition

在一組執行單元(process/thread)以 shared memory 的方式進行資料共享或者溝通時，因為沒有對於共享變數提供互斥存取(mutual exclusive access)的處理，可能會導致執行單元之間因為**交錯執行**，導致最後的結果不如預期。

底下用一個簡單的例子來說明 race condition 造成執行結果不如預期的情況。

```cpp
#include <thread>
#include <iostream>

const int thread_num = 20000;

void func(int &count) { count = count + 1; }

int main() {
  int count = 0;
  std::thread threads[thread_num];

  for (int i = 0; i < thread_num; ++i)
    threads[i] = std::thread(func, std::ref(count));

  for (auto &th : threads)
    th.join();

  std::cout << count << std::endl;
  return 0;
}
```

今天我們這個程式想要操作 `count` 變數，總共開了 20000 條 thread，每個 thread 都會執行 `func`，`func` 的功能很簡單，把 `count` 變數傳入，並且+1。

所以我們 20000 條 thread 各執行一次 `func`，預期的結果應該會得到 `count = 20000`，現在來實際執行看看。

編譯
```bash=
clang++ -lpthread race.cc -o race
```

執行幾次會發現每個結果都不太一樣，如下圖所示

![](https://i.imgur.com/wOU3OG5.png)

我們利用上面這個累加的例子畫一個簡單的示意圖來說明

在實行 `count = count + 1` 的時候其實可以想成分成兩個步驟

![](https://i.imgur.com/jRIGuVf.png)

一開始先獲得 `count` 的值，之後 + 1，最後再存回 `count` 變數。

在單一執行緒的情況下不會有錯，但是多執行緒時就可能會造成 race condition 的問題，底下我們用兩條 thread 當作例子

![](https://i.imgur.com/kS8oX7Y.png)


一開始我們將 `count` 的初始值設為0，並且有兩條 thread 都呼叫 `func` 傳入 `count` 變數，再把 `count` 加 1。

按照上面的說法，每個 `count = count + 1` 都可以簡單的視為兩個獨立的步驟
- `temp` = `count + 1` (讀取 `count` 的值並且加一)
- `count` = `temp` (把計算好的值重新存回 `count`)

但是看上面的示意圖，在沒有任何限制的情況下，多條 thread 之間可能會**交互執行**指令，現在按照紅色箭頭的軌跡 trace 一次。

- `thread 0` 先取出 `count` 並且加一，存到 `temp0`，所以 `temp0 = 1`
- 接著輪到 `thread 1` 取出 `count` 並且加一，存到 `tmep1`，所以 `temp1 = 1`，這邊思考一下，因為 `thread 0` 在計算完 `temp0` 之後還沒做 assign 的動作就被切換了，所以 `thread 1` 取到的 `count` 依舊是 0。
- 再回到 `thread0`，把計算好的 `temp0` assign 給 `count`，`count = temp0 = 1`，此時 `count` 被更新為 1。
- 最後輪到 `thread1`，把計算好的 `temp1` assign 給 `count`，`count = temp1 = 1`，最後結果 **count = 1**，並不符合我們的預期，因為交錯執行導致出現 **race condition**。

以 2 條 thread 為例就知道為什麼一開始的範例，跑 20000 條 thread 結果可能會每次都不一樣，因為在同時執行時，沒有處理好同步問題，導致不同 thread 之間可能**交互執行**，最後得到錯的結果。

## 執行順序

上面提到了一個簡單的 race condition 例子，在多執行緒環境下，缺乏適度的同步機制，會造成很多無法預期的結果，其實簡單來看，我們的目的就是不要讓 thread 之間交互執行，所以我們應該要關注**執行順序**。

就是因為**執行順序**沒有按照當初設想，才會出現一些無法預期的結果，在 jserv 老師的 [並行程式設計: 執行順序](https://hackmd.io/@sysprog/concurrency/https%3A%2F%2Fhackmd.io%2F%40sysprog%2Fconcurrency-ordering) 講座中介紹了幾個程式語言描述**執行順序**的名詞，下面就簡單的做了一下筆記，最後會介紹一下 go 語言 `happens-before` 的原則。

## Evaluation 

Evaluation 可以想成 value computations 與 side effect 的組合，用上面 `func` 的例子，value computations 就是把 `count+1` 計算出來的動作，side effect 就是把計算出來的值 assign 給 `count` 的步驟。

side effect 有**改變物件/變數狀態**的語意，你 assign 某個值給變數的同時，如果有另外一個 thread 在呼叫 `func` 或者訪問被改變的變數，就有可能導致讀到錯誤(不符預期)的值。

### Evaluation orders

```c++
int solution = f1() + f2() + f3();
```

在上面的例子，可以看到 `solution` 必須要呼叫 `f1`, `f2`, `f3` 來取得最後的結果，每個語言的規範不同，有些語言會依序呼叫 `f1()`, `f2()`, `f3()`。

有些語言像是 c++ 沒有強制規定運算元的執行先後順序，而是交給編譯器處理，這時候編譯器可能會選擇[指令調度(Instruction scheduling)](https://zh.wikipedia.org/wiki/%E6%8C%87%E4%BB%A4%E8%B0%83%E5%BA%A6)來優化執行效率，可能會先呼叫 `f3()` 再去求 `f1() + f2()`，這種改變順序的行為有時候就會導致 side effect 的發生(可能彼此共有一些變數，使呼叫順序改變結果)。

Evaluation orders 在每個語言的規範都不相同，真的想深入了解一門語言，應該要花點時間去研究一下那個語言的規範，避免踩到坑。

## sequenced-before

sequenced-before 用來描述**同一個執行緒**下兩個 Evaluation 的先後順序。

- A is sequenced-before B: 代表 A 的 evaluation 會先於 B。
- B is sequenced-before A: 代表 B 的 evaluation 會先於 A。

如果交錯執行或者順序不定，則可以描述成

- A is not sequenced-before B && B is not sequenced-before A


sequenced-before 這個名詞不見得每個人都看過，但編寫程式就是在編寫一連串 sequenced-before 的關係，正常沒有 goto 或者條件判斷的情況，程式都會一行一行的往下執行，像下面這個例子，就可以說 line 87 is sequenced-before line 88。

```cpp=87
int a = getSomethingForA();
int b = getSomethingForB();
```

還有一些運算子都有一些基本的 evaluation order 規則

- `i++` 稱為**後置運算子**，value computation 會先於 side effect，所以在使用 `i++` 的時候會先回傳 `i` 再對 `i+1`。
- `++i` 稱為**前置運算子**，side effect 會先於 value computation，使用時則會回傳 `i+1` 的值。

在寫 if statement 如果有多個條件，我們都會傾向於把先檢查的放在前面，如果前面是 false 就不需要繼續往後執行了，像是

```cpp
if (a && b) {
    dosomething;
}
```

因為左邊的運算元 `a` 的 evaluation 會先於右邊的 `b`，所以在寫 `&&` 或者 `||` 的時候可以將比較需要優先檢查的條件放在前面。

## Happens-before

因為 [go 語言的官方文件](https://go.dev/ref/mem) 在介紹 Happens-before 的時候有牽扯到一些 go 語言獨有的特性(goroutine)，所以我們先跟 jserv 老師的講座一樣，從 [Java 的官方文件](https://docs.oracle.com/javase/specs/jls/se7/html/jls-17.html#jls-17.4.5) 來簡單介紹一下這個名詞。

<!-- {{<admonition abstruct "Happens-before" true>}} -->
> Two actions can be ordered by a happens-before relationship. If one action happens-before another, then the first is **visible** to and ordered before the second.
<!-- {{</admonition>}} -->

當 A happens-before B，代表 A 的操作對於 B 來說是**可見的(visible)**。

```cpp=
int main() {
    int num = 10;
    num = num - 2; // num = 8;
    std::cout << num << std::endl; // output: 8
}
```

以上面範例第四行的為例，在輸出 `num` 之前它必須要先被減二，這樣輸出的結果才會符合預期。我們可以說 `num = num - 2;` 這行必須 **happens-before** `std::cout << num << std::endl;`

那為什麼會強調只要 **visible** 就好呢，因為只要有達成效果就好，實際上編譯器可能會因為優化，私底下改變某些指令的執行順序，這部份可以參考 [Memory Ordering at Compile Time](https://preshing.com/20120625/memory-ordering-at-compile-time/)

我們用上面那篇參考文章的一個例子來簡單說明

```cpp
int A, B;

void foo() {
    A = B + 1;
    B = 1;
}
```

使用 [godbolt](https://gcc.godbolt.org/) 可以直接觀察 gcc 將程式碼轉成對應的程式語言

在沒有開任何優化的情況下，轉出來的組合語言如下

![](https://i.imgur.com/a7V1LdB.png)

轉換的組語就照著我們程式的邏輯，先把 B 放到 eax 暫存器，把 eax + 1 放到 A，最後再做 B = 1

底下是開了 `-O2` 的優化，可以觀察到程式的執行順序改變了

![](https://i.imgur.com/prwcT9U.png)

轉換出來，先把 B 放到 eax，先做 B = 1，接著把 eax + 1 的結果放到 A。

由上面的範例就可以知道為什麼 happens-before 強調的是 **visible**，在 `-O2` 的優化下，B = 1 這行事實上比 A = B + 1 更早完成，但是就結果來說是沒有錯的，所以寫程式只要在意邏輯的順序，但實際的執行順序可以會因為編譯器的調整而不同。

## Synchronized-With

synchronized-with 用來描述**不同執行緒** 下兩個 Evaluation 的先後順序。

A, B 兩個操作是在不同執行緒， A synchronized-with B 代表 A 對記憶體的操作對於 B 是 **visible** 的。

- **sequenced-before 描述單執行緒版的 happens-before 關係**
- **synchronized-with 描述多執行緒環境下的 happens-before 關係**

現在的程式語言都會提供很多協助 Synchronization 的語法(ex. Mutex)，目的在於多執行緒環境下程式碼不會交互執行，導致錯誤，這些語法其實就是在提供程式設計師去**定義不同執行緒間 happens-before 的關係**。

更多詳情可以參考 [The Synchronizes-With Relation](https://preshing.com/20130823/the-synchronizes-with-relation/) 這篇文章，底下就引用內文的一張圖片來介紹

![](https://i.imgur.com/aV6igOi.png)

可以看到 synchronizes-with 底下有很多不同的方式可以使用，大部份的語言也都有支援很多套定義多執行緒 happens-before 關係的語法。

## golang happens before

待補

## reference
- [The Go Memory Model](https://go.dev/ref/mem)
- [並行程式設計: 執行順序](https://hackmd.io/@sysprog/concurrency/https%3A%2F%2Fhackmd.io%2F%40sysprog%2Fconcurrency-ordering)
- [go 語言 happens-before 原則及應用](https://segmentfault.com/a/1190000039729417)