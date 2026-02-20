---
title: "golang 在 alpine image 的一個常見坑"
date: 2023-02-06T21:13:53+08:00
draft: false
tags: 
    - docker
    - go
categories: ["go"]
description: "記錄 Go 程式部署到 Alpine Docker image 時遇到執行失敗的問題，說明 CGO 與 musl libc 不相容的原因與解決方案。"
---


記錄前幾天在實驗 [dapr](https://github.com/dapr/dapr) 時踩到的一個坑，通常出現在 Go 程式以 alpine image 作為基底的時候。範例程式如下：

```go
package main

import (
    "log"
    "net/http"
)


func main() {
    log.Println("Start echo server")
    http.HandleFunc("/echo", echoHandler)
    if err := http.ListenAndServe(":3000", nil); err != nil {
        log.Fatal(err)
    }
}

func echoHandler(w http.ResponseWriter, r *http.Request) {
    r.ParseForm()
    log.Println("receive message: ", r.Form.Get("msg"))
    w.Write([]byte(r.Form.Get("msg") + "www\n"))
}
```

因為只是快速實驗，Dockerfile 也寫得很簡略：

```dockerfile
FROM alpine:latest
ADD echo-server .

ENTRYPOINT [ "/echo-server" ]
```

經過 `go build -o echo-server main.go` 之後建立 image `docker build -t echo-server .`

實際跑 image 時卻報錯 `exec ./echo-server: no such file or directory`：

![](https://i.imgur.com/3uzikto.png)

爬了一下文章，發現這其實是個常見的坑，問題出在 alpine image 和 `net` 套件之間：

- [Go-compiled binary won't run in an alpine docker container on Ubuntu host](https://stackoverflow.com/questions/36279253/go-compiled-binary-wont-run-in-an-alpine-docker-container-on-ubuntu-host)
- [Docker部署golang程序时遇到的坑：golang程序在宿主机上可以运行，在容器中不可以运行](https://blog.csdn.net/tianyi520jx/article/details/127164636)
    - 這篇講解原因講的很仔細


簡單來說，`net` 在某些情況下會預設使用 CGO，詳情請參考上方的補充資料。解決方案有兩種：

- 編譯時關閉 CGO

在編譯前設定環境變數 `CGO_ENABLED=0`，或使用 `go build -tags netgo -o echo-server main.go`，讓 `net` 不依賴 CGO，改用純 Go 實現。

- 在 image 中補上 CGO 所需的 library

上方參考資料中提到，`net` 主要呼叫 `glibc`，但 alpine 預設使用 `musl libc`，兩者不相容導致程式無法執行。解法是在 Dockerfile 中補上 `glibc` 的安裝：

```dockerfile
FROM alpine:latest
ADD echo-server .
RUN apk add --no-cache libc6-compat 

ENTRYPOINT [ "/echo-server" ]
```

加上這行後重新 build 並執行，就可以看到正常的結果了：

![](https://i.imgur.com/QtBskPo.png)

