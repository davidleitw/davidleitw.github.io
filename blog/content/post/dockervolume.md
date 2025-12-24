---
title: "docker volume 用法整理"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - container
    - docker
categories: ["docker"]
description: dockervolume
---

因為 side project 可能會用簡單的資料庫，為了方便包成 docker 讓大家試玩，想要使用 `Volume` 的方式對資料庫做持久化。在這邊紀錄一下 `Docker Volume` 相關的一些用法。

> 很多篇文章都不推薦使用 docker 存放資料庫，我也認為 Volume 比較適合使用在本地端或者非生產環境的小專案上。


## `Volume` 是什麼
`Volume` 可以想成一個可供單個或多個容器使用的特殊目錄，有以下特性:
- `Volume` 可以在容器間共享資源，檔案
- 更新 `Volume` 內的檔案並不會影響 Image
- **`Volume` 會持續存在，並不會隨著容器刪除而消失**

有點類似 Linux 底下的掛載，Image 中被指定掛載的目錄/檔案會複製到 `Volume` 中。

## 創建 `Volume`

```shell
~$ docker volume create volume_name
```

- 查看所有 `Volume`
```shell
~$ docker volume ls
```

- 查看指定 `Volume` 資料
```shell
~$ docker volume inspect volume_name
```

![](https://i.imgur.com/mRZ8bUN.png)


## 運行一個掛載 `Volume` 的 Container

```shell
~$ docker run -d -P \
    --name web \
    # -v my-vol:/usr/share/nginx/html \
    --mount source=v1,target=/usr/share/nginx/html \
    nginx:alpine
```

在使用 `docker run` 指令的時候可以使用 `--mount` 參數來將創建好的 `Volume` 掛載到容器內部，一次 `docker run` 可以掛載多個 `Volume`。

`target` 指的是要將容器內的哪一個檔案/資料夾綁定到 `Volume` 上

- docker run 參數
    - -d: 背景執行 container
    - -P: Publish all exposed ports to random ports
    - --name: container name


執行之後可以使用
```shell
~$ docker inspect web
```

可以在 `Mounts` 欄位底下找到 `Volume` 的相關資料
![](https://i.imgur.com/VvJ6lQi.png)


上述的操作通常用在 container 產生一些 data，我們想要讓那些 data 不會在 container 被刪除之後消失，做資料持久化的時候才會使用。

## 掛載一個本機目錄至容器內

除了將容器內指定的檔案綁定到本機之外，我們也可以將原先就存在於本機的檔案/資料夾**加載**到容器內部，舉例來說今天寫了一個影像處理相關的程式，我們把它丟到 docker 上面跑，我們可以把想要處理的影像存在本地端，然後加載到容器內，就可以很方便的測試結果是否正確。

```shell
~$ docker run -d -P \
    --name imageProcess \
    --mount type=bind,source=/src/testImage,target=/usr/share/src/testImage \
    imageDocker:latest
```

把存在本地端的 /src/testImage 資料夾加載到容器內，記得要加參數 **type=bind**

Docker 預設掛載目錄的權限是**讀寫**，如果想用成唯讀，則要另外加上參數 **readonly**

```shell
~$ docker run -d -P \
    --name imageProcess \
    --mount type=bind,source=/src/testImage,target=/usr/share/src/testImage,readonly \
    imageDocker:latest
```

> 除了目錄以外也可以掛載單個文件，像是想要紀錄 container 內部的 history，可以綁定/root/.bash_history 等等多種應用


## Reference
- [Docker 從入門到實踐](https://vuepress.mirror.docker-practice.com/)
- [Docker 安裝並且持久化postgresql資料](https://juejin.cn/post/6844904182319841294)