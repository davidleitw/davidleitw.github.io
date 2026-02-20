---
title: "利用 vagrant 執行自己編譯的 kernel，快速搭建實驗環境"
date: 2021-12-28T01:05:53+08:00
draft: false
tags: 
    - vagrant
    - kernel
    - linux
categories: ["vagrant"]
description: "介紹如何用 vagrant 快速建立虛擬機並執行自己編譯的 Linux kernel，適合需要反覆修改核心並測試的開發場景。"
---

## vagrant

![](https://i.imgur.com/9aODHGc.png)


`vagrant` 是一款用來建立與管理虛擬機的工具。透過 `vagrant` 可以快速在本機搭建實驗環境，並將自己習慣的環境打包，在任何安裝了 `vagrant` 的電腦上執行，達到 `IaC（Infrastructure as Code）`的效果。使用 `vagrant` 可以大幅節省環境建置的時間，趁這個機會順便學習一下基本用法。

這學期修 Linux 課程，會有新增 system call 或修改 kernel 的需求，所以這篇文章記錄如何用 `vagrant` 執行自己編譯好的 kernel，以及一些 `vagrant` 的基本操作。用虛擬機做實驗也能有效降低把本機環境搞壞的風險。

## install

安裝可以參考 [官方網站](https://www.vagrantup.com/downloads)，在 `ubuntu` 的環境安裝 `vagrant` 可以用以下指令:

```shell
$ curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
$ sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
$ sudo apt-get update && sudo apt-get install vagrant
$ vagrant plugin install vagrant-vbguest
```

`vagrant` 本身只是虛擬機的管理工具，底層可以選擇 `VirtualBox`、`VMware`、`AWS` 等不同的虛擬化環境。在 Linux 主機上最方便安裝的是 `VirtualBox`，記得在正式使用前先安裝好。

```bash
$ sudo apt install virtualbox
$ sudo apt upgrade virtualbox
```

## 建立基本的環境

虛擬機的基底選用 `ubuntu 16.04`，可以到 `Vagrant Cloud` 查看 Ubuntu 官方提供的 Vagrant box，選擇想要的版本：[ubuntu/boxes](https://app.vagrantup.com/ubuntu)。

```bash
$ mkdir project
$ cd project
$ vagrant init ubuntu/xenial64
$ vagrant up
```

![](https://i.imgur.com/w78RVs9.png)

流程跑完之後可以先用 `vagrant status` 來確認虛擬機狀態

```bash
$ vagrant status
```

![](https://i.imgur.com/JCElGpM.png)

### Vagrantfile

執行 `vagrant init` 時，會在目錄底下建立一個 `Vagrantfile`，可以把它當作虛擬機的配置文件，概念上有點像 `Dockerfile`。想深入了解 `Vagrantfile` 的寫法與詳細配置，可以參考[官方文件](https://www.vagrantup.com/docs/vagrantfile)。

第一次使用 `vagrant` 時，它會從雲端下載指定的 image 到本機，需要花一些時間。下載完成後，可以使用 `vagrant ssh` 進入虛擬機。

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

刪除虛擬機則是使用 `vagrant destroy`

```bash
$ vagrant destroy
```

重新啟動虛擬機可以使用 `vagrant reload`

```bash
$ vagrant reload
```

### 資料共享的特性

`vagrant` 還有一個很實用的特性：虛擬機中的 `/vagrant` 目錄與外部放置 `Vagrantfile` 的目錄是共享的。舉例來說，在虛擬機中把 `Hello.txt` 放到 `/vagrant` 目錄底下，離開虛擬機後就可以直接在外部目錄存取這個檔案。

```bash
host@ubuntu: ~$ vagrant ssh
vagrant@ubuntu: ~$ echo "Hello world" > /vagrant/Hello.txt 
vagrant@ubuntu: ~$ exit
host@ubuntu: ~$ cat Hello.txt
Hello world
host@ubuntu: ~$ 
```

![](https://i.imgur.com/Wy0DaaQ.png)

接下來就會利用這個共享特性，在 Host 端編譯好 kernel，再進入虛擬機啟動編譯好的 kernel。

在正式開始之前，先用 `vagrant snapshot` 建立一個存檔點，把目前的乾淨環境記錄下來，命名為 `clean-env`：

```bash
host@ubuntu: ~$ vagrant halt
host@ubuntu: ~$ vagrant snapshot save clean-env 
host@ubuntu: ~$ vagrant snapshot list
```

![](https://i.imgur.com/3DJg9Ee.png)

### 安裝編譯 kernel 所需要的套件

接著安裝編譯 kernel 所需的套件，並用 `snapshot` 記錄當前環境，命名為 `installed-tool-env`：

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

前面提到 `Vagrantfile` 所在目錄與虛擬機中 `/vagrant` 目錄是共用的，所以可以把 kernel source code 下載到本機目錄並編譯，再進入虛擬機使用編譯好的 kernel。

下載 `source code`，下載的版本是 `4.14.259`

```bash
host@ubuntu: ~$ wget https://cdn.kernel.org/pub/linux/kernel/v4.x/linux-4.14.259.tar.xz
host@ubuntu: ~$ tar Jxvf linux-4.14.259.tar.xz
host@ubuntu: ~$ rm linux-4.14.259.tar.xz
host@ubuntu: ~$ cd linux-4.14.259
```

下載好的 `linux-4.14.259` 資料夾，因為目錄共用機制，在虛擬機中也可以透過 `/vagrant/linux-4.14.259` 路徑存取。

![](https://i.imgur.com/3S4FK8m.png)

至於 config 的部分，直接將虛擬機 `4.4` 版本的 config 複製到 `/vagrant/linux-4.14.259`，建立 `obj/x86-64` 目錄存放編譯產出的 `.deb` 檔案。編譯的部分回到本機執行，並使用 `-j8` 加速編譯流程：

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

編譯完成後進入虛擬機，使用編譯好的 `.deb` 檔案安裝新的 kernel，最後重新啟動虛擬機：

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

## reference 
- [vagrant docs](https://www.vagrantup.com/docs)
- [Vagrant 基本使用操作](https://blog.csdn.net/visonyuan/article/details/103866612)
- [為 Guest Ubuntu 編譯 kernel](https://www.jianshu.com/p/50a7045d293a)