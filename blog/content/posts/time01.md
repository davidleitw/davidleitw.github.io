---
title: "golang 定時器(一) Time, Ticker 基本用法整理"
date: 2021-12-24T01:04:53+08:00
draft: false
tags: 
    - go
categories: ["go"]
---

在後端中常常會有需要定時的場景出現，像是如果處理 `request` 超過一定時間就觸發 `timeout`，或者利用定時的功能推送請求等等，這篇文章將會簡單介紹一些 `golang` 內建的定時器功能，以及可能會遇到的坑。

所有有關定時器的功能都在 `time` 內，使用前必須先
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

在 `golang` 中 `Timer` 可以用來表示一個單一事件，可以用 `NewTimer` 或者 `AfterFunc` 兩個 `function` 去建立一個新的 `Timer`，簡單的使用範例如下

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

執行結果如下
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

`NewTimer` 的 `d` 參數代 `Timer` 需要等待多長時間，`Timer.C` 是一個帶有 `buffer` 的 `channel`，在上面的範例中，`<-timer.C` 那行會把程式阻塞直到 `Timer` 往 `Timer.C` 裡面傳送時間(當時倒數完的結果)，阻塞解除後才可以繼續往下執行，達到延遲執行，或者定時觸發的目的。

### 循環執行的定時任務 - Ticker
對於有持續執行的定時任務，可以使用 `time.Sleep` 或者 `time.Ticker` 兩種方式來實現。

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

如果是定時任務的需求，還是建議使用 `time.Ticker` 去實現，雖然沒有仔細去比較過兩種方式的時間誤差，不過 `time.Ticker` 利用 `channel` 的方式可以帶來比較高的彈性，用 `select` 可以設置超時條件，或者設定 `default` 的執行方式。

請一定要記得在使用完畢之後呼叫 `Stop`，不然會造成 `memory leak` 的問題，假設定時任務跑在背景的 `goroutine` 上一定要記得在結束前呼叫 `Stop()`，可以養成下例的好習慣:

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
利用 `defer` 的機制讓退出時自動呼叫 `Stop`

### Ticker 的一些注意事項

以下是 `NewTicker` 與 `Stop` 的具體實現，位置在 `src/time/tick.go`
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

有時候一些問題一定要看文檔才會注意到，在 `Stop` 的註解中有講到 `Stop does not close the channel, to prevent a concurrent goroutine reading from the channel from seeing an erroneous "tick".`

這句話代表什麼呢? 下面用一個簡單的範例來說明，如果今天的場景是

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

實際運作情況:

![](https://i.imgur.com/vfpu568.png)

單從程式看 `fmt.Println("Ticker Stop! Channel must be closed.")` 這行會發生在 `ticker.C` 關閉後，實際執行結果並沒有執行到這行，意味著其實 `Ticker` 內部的 `Channel` 是沒有關閉的，如果今天程式不斷的使用這種寫法，最終會導致主機嚴重的 `memory leak` 發生。

如果沒有看過實際的 `source code`，就不會發現其實在註解的時候已經有明確說明了，`Stop` 並不會關閉 `channel`，預防讀取 `channel` 發生錯誤，所以在 `Ticker` 的使用上，比較推薦下方這種寫法，可以有效的執行超時之後下方的程式碼，實現起來也比較優雅。

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

實際運行結果如下

![](https://i.imgur.com/pksM1Vl.png)

這次我們利用 `defer` 的機制，在 `goroutine` 內部呼叫 `Stop` 的方式，可以看到這種寫法在相較用 `for range` 來說，彈性高出很多，而且在調用 `Tocker.Stop` 時並不會 `close` 該 `channel`，用 `for range` 的寫法會造成一個無限迴圈卡在那裡，`golang` 中只要沒有 `goroutine` 持有該 `channel`，到最後那個 `channel` 就會被 `gc`，這就是為什麼不推薦使用 `for range` 的緣故，一般來說使用 `for range` 的寫法都要配合 `close`，但是在 `Timer` 的情況，無法主動關閉內部的 `channel`，只好退出 `goroutine` 讓 `gc` 回收。

### Timer vs Ticker
以用法來說，`Timer` 就是在 `timeout` 之後觸發一次，`Ticker` 則是週期性的觸發定時事件，因為 `Ticker` 是週期性的，所以如果沒有顯式的呼叫 `Stop` 就會發生上面提到的 `Resource leak` 問題，之後會再寫一兩篇文章從 `source code` 切入，還有 `Timer reset` 的問題也值得探討。

### reference
- [Golang 如何正確的停止 Ticker](https://blog.csdn.net/yjp19871013/article/details/82048944)
- [Go 高級併發模式: 第二部份(計時器)](https://zhuanlan.zhihu.com/p/338356039)
- [golang 源碼閱讀之定時器與避坑功能](https://www.pengrl.com/p/62835/)