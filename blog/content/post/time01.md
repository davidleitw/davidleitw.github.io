---
title: "golang 定時器(一) Time, Ticker 基本用法整理"
date: 2021-12-24T01:04:53+08:00
draft: false
tags: 
    - go
    - timer
categories: ["go"]
description: "整理 Go 語言定時器的基本用法，介紹 time.Timer 的一次性觸發與 time.Ticker 的週期性觸發，以及常見的使用注意事項。"
---

後端開發中常常需要定時功能，例如處理 request 超過一定時間就觸發 timeout，或是週期性地推送請求等。這篇文章簡單介紹 Go 內建的定時器功能，以及一些常見的坑。

所有定時器相關功能都在 `time` 套件中，使用前需要先：
```go
import "time"
```

### 單次定時事件 - Timer
```go
// src/time/sleep.go

// The Timer type represents a single event.
// When the Timer expires, the current time will be sent on C,
// unless the Timer was created by AfterFunc.
// A Timer must be created with NewTimer or AfterFunc.
type Timer struct {
    C <- chan Time
    r runtimeTimer
}
```

在 Go 中，`Timer` 用來表示一個單次事件，可以用 `NewTimer` 或 `AfterFunc` 建立，簡單的使用範例如下：

```go
package main

import (
    "fmt"
    "time"
)

func main() {
    fmt.Println("now: ", time.Now().Format("2006-01-02 15:04:05"))

    // 定時三秒之後觸發
    timer := time.NewTimer(3 * time.Second)
    c := <-timer.C
    fmt.Println(c)

    // 在 <-timer.C 那行會等待三秒倒數完成事件發生，才會繼續往下
    fmt.Println("now: ", time.Now().Format("2006-01-02 15:04:05"))
}
```

執行結果：
![](https://i.imgur.com/NREJhL9.png)

### NewTimer
```go
// NewTimer creates a new Timer that will send
// the current time on its channel after at least duration d.
func NewTimer(d Duration) *Timer {
    c := make(chan Time, 1)
    t := &Timer{
        C: c,
        r: runtimeTimer{
            when: when(d),
            f: sendTime,
            arg: c,
        },
    }
    startTimer(&t.r)
    return t
}
```

`NewTimer` 的 `d` 參數代表 Timer 需要等待的時間。`Timer.C` 是一個帶 buffer 的 channel，`<-timer.C` 那行會阻塞程式，直到 Timer 計時到期並將當前時間寫入 `Timer.C`，阻塞解除後才繼續往下執行，達到延遲或定時觸發的效果。

### 循環執行的定時任務 - Ticker

需要週期性執行的定時任務，可以用 `time.Sleep` 或 `time.Ticker` 兩種方式實現。

用 `time.Sleep` 方式實現
```go
package main

import (
    "fmt"
    "time"
)

func main() {
    sleepTime := 4 * time.Second // 設定每四秒執行一次

    for {
        time.Sleep(sleepTime)
        fmt.Println("now: ", time.Now().Format("2006-01-02 15:04:05"))
    }
}
```

用 `time.Ticker` 方式實現
```go
package main

import (
    "fmt"
    "time"
)

func main() {
    count := 0
    IntervalTime := 2 * time.Second      // 觸發間隔時間
    ticker := time.NewTicker(IntervalTime) // 設定 2 秒觸發一次

finish:
    for {
        select {
        case c := <-ticker.C:
            fmt.Println("now: ", c)
            count++
            // 設定 4 輪之後結束工作
            if count == 4 {
                ticker.Stop()
                break finish
            }
        }
    }
}
```

如果是週期性的定時任務，建議使用 `time.Ticker`。雖然沒有仔細比較過兩種方式的時間誤差，但 `time.Ticker` 透過 channel 的方式彈性較高，可以搭配 `select` 設置超時條件或 default 處理邏輯。

使用完畢後**一定要記得呼叫 `Stop()`**，否則會造成 memory leak。如果定時任務跑在背景 goroutine 中，建議養成以下習慣：

```go
go func() {
    ticker := time.NewTicker(5*time.Second)
    defer ticker.Stop()

    for now := range ticker.C {
        // do something
        if (exception) {
            break
        }
    }
}()
```
利用 `defer` 確保退出時自動呼叫 `Stop`。

### Ticker 的注意事項

以下是 `NewTicker` 與 `Stop` 的具體實作，位在 `src/time/tick.go`：
```go
// NewTicker returns a new Ticker containing a channel that will send
// the current time on the channel after each tick. The period of the
// ticks is specified by the duration argument. The ticker will adjust
// the time interval or drop ticks to make up for slow receivers.
// The duration d must be greater than zero; if not, NewTicker will
// panic. Stop the ticker to release associated resources.
func NewTicker(d Duration) *Ticker {
    if d <= 0 {
        panic(errors.New("non-positive interval for NewTicker"))
    }
    // Give the channel a 1-element time buffer.
    // If the client falls behind while reading, we drop ticks
    // on the floor until the client catches up.
    c := make(chan Time, 1)
    t := &Ticker{
        C: c,
        r: runtimeTimer{
                when: when(d),
                period: int64(d),
                f: sendTime,
                arg: c,
        },
    }	
    startTimer(&t.r)
    return t
}

// Stop turns off a ticker. After Stop, no more ticks will be sent.
// Stop does not close the channel, to prevent a concurrent goroutine
// reading from the channel from seeing an erroneous "tick".
func (t *Ticker) Stop() {
    stopTimer(&t.r)
}
```

有些細節不看文件是不會注意到的。`Stop` 的註解中明確說明：`Stop does not close the channel, to prevent a concurrent goroutine reading from the channel from seeing an erroneous "tick".`

這句話是什麼意思？下面用一個範例說明：

```go
package main 

import (
    "fmt"
    "time"
)

func NewCronJob() *time.Ticker {
    ticker := time.NewTicker(1 * time.Second)
    go func(ticker *time.Ticker) {
        for range ticker.C {
            fmt.Println("Cron job...")
        }
        fmt.Println("Ticker Stop! Channel must be closed.")
    }(ticker)

    return ticker
}

func main() {
    ticker := NewCronJob()
    time.Sleep(5 * time.Second)
    ticker.Stop()
}
```

實際執行結果：

![](https://i.imgur.com/vfpu568.png)

從程式碼看，`fmt.Println("Ticker Stop! Channel must be closed.")` 應該在 `ticker.C` 關閉後執行，但實際上這行根本沒有被執行到——這代表 Ticker 內部的 channel 並沒有被關閉。如果程式持續這樣用，最終會導致嚴重的 memory leak。

不看 source code 或文件的話很容易踩這個坑。`Stop` 不關閉 channel 是刻意的設計，為了防止並發讀取時看到錯誤的 tick。因此推薦改用下面這種寫法，能確保在停止後順利執行後續程式，實現起來也更優雅：

```go
package main

import (
    "fmt"
    "time"
)

func NewCronJob() chan bool {
    ticker := time.NewTicker(1 * time.Second)
    stopChan := make(chan bool)

    go func(ticker *time.Ticker) {
        defer ticker.Stop()
        for {
            select {
            case <-ticker.C:
            fmt.Println("Cron job...")
            case stop := <- stopChan:
                if stop {
                    fmt.Println("Ticker Stop! Channel must be closed")
                    return
                }
            }
        }
    }(ticker)

    return stopChan
}

func main() {
    stopController := NewCronJob()
    time.Sleep(5 * time.Second)
    stopController <- true
    close(stopController)
}
```

執行結果：

![](https://i.imgur.com/pksM1Vl.png)

透過在 goroutine 內部用 `defer` 呼叫 `Stop`，可以看到這種寫法比 `for range` 彈性高出很多。由於 `Ticker.Stop` 不會關閉 channel，用 `for range` 讀取的 goroutine 就會一直卡在那裡形成無限迴圈。在 Go 中，只要沒有 goroutine 持有某個 channel，它最終會被 GC 回收——這也是為什麼退出 goroutine 是這種情況下唯一的出路。一般情況下，`for range` 要搭配 `close` 使用，但 Ticker 無法主動關閉內部 channel，因此不建議用這種寫法。

### Timer vs Ticker

用法上，`Timer` 在到期後只觸發一次；`Ticker` 則週期性地觸發定時事件。正因為 Ticker 是持續運作的，如果沒有明確呼叫 `Stop`，就會發生上述的 resource leak 問題。之後會再寫幾篇從 source code 切入的文章，也打算探討 `Timer.Reset` 的細節。

### reference
- [Golang 如何正確的停止 Ticker](https://blog.csdn.net/yjp19871013/article/details/82048944)
- [Go 高級併發模式: 第二部份(計時器)](https://zhuanlan.zhihu.com/p/338356039)
- [golang 源碼閱讀之定時器與避坑指南](https://www.pengrl.com/p/62835/)