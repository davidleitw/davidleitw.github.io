---
title: "golang 在 alpine image 的一個常見坑"
date: 2023-02-06T21:13:53+08:00
draft: false
tags: 
    - docker
    - go
categories: ["go"]
---


紀錄一下前幾天在實驗 [dapr](https://github.com/dapr/dapr) 遇到的一個小問題，通常發生在簡單的 golang 程式使用 apline image 當作基底的時候，程式如下

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

因為只是要快速實驗，所以 Dockerfile 也寫得很簡略

```dockerfile
FROM alpine:latest
ADD echo-server .

ENTRYPOINT [ "/echo-server" ]
```

經過 `go build -o echo-server main.go` 之後建立 image `docker build -t echo-server .`

在實際跑 image 時候報錯 `exec ./echo-server: no such file or directory`

![](https://i.imgur.com/3uzikto.png)

簡單爬了一下文章，發現這其實是個常見的坑，問題出在作為基底的 alpine image 上面與 `net` 函式庫之間

- [Go-compiled binary won't run in an alpine docker container on Ubuntu host](https://stackoverflow.com/questions/36279253/go-compiled-binary-wont-run-in-an-alpine-docker-container-on-ubuntu-host)
- [Docker部署golang程序时遇到的坑：golang程序在宿主机上可以运行，在容器中不可以运行](https://blog.csdn.net/tianyi520jx/article/details/127164636)
    - 這篇講解原因講的很仔細


簡單來說就是 `net` 在某些情況下會預設使用 `CGO`，詳情請查看上方的補充資料，所以解決方案有兩種思路

- 編譯的時候關閉 `CGO` 的支援

在編譯前設定環境變數 `CGO_ENABLED=0` 或者 `go build -tags netgo -o echo-server main.go`，這兩種方式都可以讓 `net` 不依靠 `CGO`，靠純 golang 實現執行


- 想辦法讓補全 `CGO` 需要的 library

上面的參考資料有說到，`net` 主要會呼叫 `gnu-libc`，但是在 alpine 裡面默認使用 `musl-libc` 導致程式無法執行，所以要在 Dockerfile 裡面補上 `gnu-libc` 的安裝

```dockerfile
FROM alpine:latest
ADD echo-server .
RUN apk add --no-cache libc6-compat 

ENTRYPOINT [ "/echo-server" ]
```

最後再執行一次，就可以看到正常的執行結果了。

![](https://i.imgur.com/QtBskPo.png)

