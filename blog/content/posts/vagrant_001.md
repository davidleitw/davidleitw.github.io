---
title: "利用 vagrant 執行自己編譯的 kernel，快速搭建實驗環境"
date: 2021-12-28T01:05:53+08:00
draft: false
tags: 
    - vagrant
    - kernel
    - linux
categories: ["vagrant"]
---

## vagrant

![](https://i.imgur.com/9aODHGc.png)


`vagrant` 是一款建立及管理虛擬機的工具，利用 `vagrant` 可以快速在本機端架設實驗環境，並且可以把自己習慣的環境包裝後在任何有安裝 `vagrant` 的電腦執行，達到 `IaC(Infrastructure as Code)` 的特性，使用 `vagrant` 可以大幅降低環境的架設時間，趁這個機會順便學習一下基本的用法。

這學期在修 `linux` 的課程會有添加 `system call` 或者改 `kernel` 的需求，所以這篇文章紀錄一下如何使用 `vagrant` 來執行自己編譯好的 `kernel`，以及一些 `vagrant` 的基本用法，用虛擬機做實驗也降低了把自己的環境搞壞的風險。

## install

安裝可以參考 [官方網站](https://www.vagrantup.com/downloads)，在 `ubuntu` 的環境安裝 `vagrant` 可以用以下指令:

```shell
$ curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
$ sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
$ sudo apt-get update && sudo apt-get install vagrant
$ vagrant plugin install vagrant-vbguest
```

`vagrant` 只是一個管理虛擬機的工具，底層可以選擇 `VirtualBox`, `VMware`, `AWS`.. 等不同的虛擬機環境，在 `linux` 的主機中最方便安裝的就是 `VirtualBox`，所以在正式使用之前要記得先安裝 `VirtualBox`。

```bash
$ sudo apt install virtualbox
$ sudo apt upgrade virtualbox
```

## 建立基本的環境

虛擬機的底我們選擇使用 `ubuntu 16.04` 版本，可以看 `Vagrant Cloud` 中 `ubuntu` 官方提供的 `Vagrant box` 選擇自己想要的版本, [ubuntu/boxes](https://app.vagrantup.com/ubuntu)。

```bash
$ mkdir project
$ cd project
$ vagrant init ubuntu/xenial164
$ vagrant up
```

![](https://i.imgur.com/w78RVs9.png)

流程跑完之後可以先用 `vagrant status` 來確認虛擬機狀態

```bash
$ vagrant status
```

![](https://i.imgur.com/JCElGpM.png)

### Vagrantfile

在執行 `vagrant init` 的指令時，會在該目錄底下創立一個 `Vagrantfile`，可以把這個文件當作虛擬機的配置檔案，有點像是 `Dockerfile`，如果想深入了解 `Vagrantfile` 的寫法還有詳細配置，可以參考 [官方文檔](https://www.vagrantup.com/docs/vagrantfile)

第一次使用 `vagrant` 時它會從雲端把指定的 `image`下載進本機，會花比較長的時間，下載好之後可以使用 `vagrant ssh` 來進入開啟的虛擬機中。

```bash
$ vagrant ssh
```

![](https://i.imgur.com/oRUShR5.png)

`vagrant ssh` 之後就可以正式操作我們創立的虛擬機了，利用 `uname -r` 確認 `kernel` 版本是 `4.4.0-210-generic`。

如果要關閉虛擬機要用 `vagrant halt`

```bash
$ vagrant halt
```

![](https://i.imgur.com/TTkSq9Y.png)

刪除虛擬機則是使用 `vagrant destory`

```bash
$ vagrant destory
```

重新啟動虛擬機可以使用 `vagrant reload`

```bash
$ vagrant reload
```

### 資料共享的特性

`vagrant` 還有一個方便的特性，在虛擬機中如果把檔案放到 `/vagrant` 內，就可以跟外部放置 `Vagrantfile` 的目錄做資料共享。舉例來說我們在虛擬機建立一個 `Hello.txt` 放到 `/vagrant` 目錄底下，離開虛擬機存取到該檔案。

```bash
host@ubuntu: ~$ vagrant ssh
vagrant@ubuntu: ~$ echo "Hello world" > /vagrant/Hello.txt 
vagrant@ubuntu: ~$ exit
host@ubuntu: ~$ cat Hello.txt
Hello world
host@ubuntu: ~$ 
```

![](https://i.imgur.com/Wy0DaaQ.png)

接下來我們就會利用這個特性在 `Host` 編譯好 `kernel` 然後再進去虛擬機啟動編譯好的 `kernel`。

在正式開始前先建立一個存檔點，利用 `vagrant snapshot` 指令把目前的環境紀錄下來，把這個存檔點的名稱設為 `clean-env`

```bash
host@ubuntu: ~$ vagrant halt
host@ubuntu: ~$ vagrant snapshot save clean-env 
host@ubuntu: ~$ vagrant snapshot list
```

![](https://i.imgur.com/3DJg9Ee.png)

### 安裝編譯 kernel 所需要的套件

接下來安裝一些編譯 `kernel` 時依賴的套件，並且用 `snapshot` 紀錄一下目前的環境，把名稱設為 `installed-tool-env`

```bash
host@ubuntu: ~$ vagrant ssh
vagrant@ubuntu: ~$ sudo apt install bison flex libelf-dev libncurses5-dev \
    openssl libssl-dev gcc bc make dpkg-dev git socat gdb libbabeltrace-dev
vagrant@ubuntu: ~$ exit
host@ubuntu: ~$ vagrant halt
host@ubuntu: ~$ vagrant snapshot save installed-tool-env
host@ubuntu: ~$ vagrant snapshot list
host@ubuntu: ~$ vagrant up
```

上一個段落有提到放置 `Vagrantfile` 的目錄與虛擬機中 `/vargrant` 目錄是共用的，所以我們可以把 `kenrel source code` 下載到本機的目錄中編譯好再用虛擬機開啟編譯好的 `kernel`。

下載 `source code`，下載的版本是 `4.14.259`

```bash
host@ubuntu: ~$ wget https://cdn.kernel.org/pub/linux/kernel/v4.x/linux-4.14.259.tar.xz
host@ubuntu: ~$ tar Jxvf linux-4.14.259.tar.xz
host@ubuntu: ~$ rm linux-4.14.259.tar.xz
host@ubuntu: ~$ cd linux-4.14.259
```

下載好的 `linux-4.14.259` 資料夾因為共用機制 ，這個資料夾也會存在於虛擬機的 `/vagrant/linux-4.14.259`  路徑下。

![](https://i.imgur.com/3S4FK8m.png)

至於 `config` 的部份，我們直接複製虛擬機 `4.4` 版本的 `config` 到 `/vagrant/linux-4.14.259`，建立 `obj/x86-64` 來存放編譯好的 `deb` 檔案，編譯部份我們跳回本機，並用 `-j8` 來加速編譯流程。

```bash
host@ubuntu: ~$ vagrant ssh
vagrant@ubuntu: ~$ cp /usr/src/linux-headers-`uname -r`/.config /vagrant/linux-4.14.259
vagrant@ubuntu: ~$ cd /vagrant/linux-4.14.259
vagrant@ubuntu: ~$ mkdir -p obj/x86-64
vagrant@ubuntu: ~$ make oldconfig
vagrnat@ubuntu: ~$ make O=obj/x86-64 oldconfig
vagrant@ubuntu: ~$ exit
host@ubuntu: ~$ cd linux-4.14.259
host@ubuntu: ~$ make O=obj/x86-64 -j8 && make O=obj/x86-64 bindeb-pkg -j8
```

等待完成之後進入虛擬機，利用編譯好的 `.deb` 檔案更改 `kernel` 版本，最後重新啟動虛擬機。

```bash
host@ubuntu: ~$ vagrant ssh
vagrant@ubuntu: ~$ cd /vagrant/linux-4.14-259/obj
vagrant@ubuntu: ~$ ls
linux-4.14.259_4.14.259-3_amd64.changes      linux-image-4.14.259_4.14.259-3_amd64.deb  x86_64
linux-headers-4.14.259_4.14.259-3_amd64.deb  linux-libc-dev_4.14.259-3_amd64.deb

vagrant@ubuntu: ~$ sudo dpkg -i ./linux-image-4.14.259_4.14.259-3_amd64.deb
vagrant@ubuntu: ~$ sudo dpkg -i ./linux-headers-4.14.259_4.14.259-3_amd64.deb
vagrant@ubuntu: ~$ exit
host@ubuntu: ~$ vagrant reload 
```

開啟虛擬機之後，可以看到 `kernel` 版本已經變成 `4.14.259`。

![](https://i.imgur.com/52NUYEd.png)

在這裡做一次存檔

```bash
host@ubuntu: ~$: vagrant snapshot save kernel_4.14_env
host@ubuntu: ~$: vagrant snapshot list
```

## 讀取 snapshot(存檔點)

```bash
host@ubuntu: ~$: vagrant snapshot restore kernel_4.14_env
host@ubuntu: ~$: vagrant up
```

