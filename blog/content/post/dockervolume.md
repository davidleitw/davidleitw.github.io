---
title: "docker volume 用法整理"
date: 2021-08-13T21:34:43+08:00
author: davidlei
draft: false
tags: 
    - container
    - docker
categories: ["docker"]
description: "紀錄為小專案資料庫做持久化的過程，整理 Docker volume 的建立、掛載指令與 bind mount 等不同 volume 類型的使用方式。"
---

side project 的資料庫想包成 docker 讓大家試玩，就需要用 Volume 做資料持久化。這裡記錄一下 Docker Volume 的常用操作。

> 很多篇文章都不推薦使用 docker 存放資料庫，我也認為 Volume 比較適合使用在本地端或者非生產環境的小專案上。


## Volume 是什麼

Volume 可以想成一個可供單個或多個容器使用的特殊目錄，有以下特性：
- 可以在容器之間共享資源與檔案
- 更新 Volume 內的檔案並不會影響 image
- **Volume 會持續存在，不會隨著容器刪除而消失**

概念有點類似 Linux 的掛載（mount），Image 中被指定的目錄或檔案會複製到 Volume 中。

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

使用 `docker run` 時，可以用 `--mount` 參數將建立好的 Volume 掛載到容器內，一次可以掛載多個 Volume。

`target` 指的是容器內要綁定到 Volume 的目錄或檔案路徑。

- docker run 參數
    - -d: 背景執行 container
    - -P: Publish all exposed ports to random ports
    - --name: container name


執行之後可以使用
```shell
~$ docker inspect web
```

可以在 `Mounts` 欄位下找到 Volume 的相關資訊：
![](https://i.imgur.com/VvJ6lQi.png)

上述操作常見於 container 會產生資料的場景，如果希望這些資料在 container 刪除後仍然保留，就需要做持久化。

## 掛載本機目錄至容器內

除了將容器內的目錄綁定到 Volume，也可以反過來將本機已存在的目錄**掛載**進容器內部。舉例來說，寫了一個影像處理程式要在 docker 中跑，可以把想處理的影像存在本地，再掛載進容器，方便驗證結果是否正確：

```shell
~$ docker run -d -P \
    --name imageProcess \
    --mount type=bind,source=/src/testImage,target=/usr/share/src/testImage \
    imageDocker:latest
```

將本地的 `/src/testImage` 目錄掛載進容器，記得加上 **type=bind** 參數。

Docker 預設掛載的權限是**讀寫**，如果只需要唯讀，可以加上 **readonly** 參數：

```shell
~$ docker run -d -P \
    --name imageProcess \
    --mount type=bind,source=/src/testImage,target=/usr/share/src/testImage,readonly \
    imageDocker:latest
```

> 除了目錄以外也可以掛載單個文件，例如想記錄 container 內部的 bash history，可以綁定 `/root/.bash_history`。


## Reference
- [Docker 從入門到實踐](https://vuepress.mirror.docker-practice.com/)
- [Docker 安裝並且持久化postgresql資料](https://juejin.cn/post/6844904182319841294)