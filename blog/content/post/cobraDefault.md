---
title: "golang cobra: 在沒有添加任何參數的情況下預設產生 help message"
date: 2021-08-16T01:37:36+08:00
draft: false
tags: 
    - go
categories: ["go"]
description: cobra default function
---

## 問題描述

最近在使用 [cobra](https://github.com/spf13/cobra) 編寫一個簡單的 `command line` 應用程式，過程中遇到一個之前都沒有想過的問題，把解決方式紀錄在這邊

一般來說用 `cobra` 寫的程式要顯示詳細的使用教學都要使用 `--help` 參數，如圖

![](https://i.imgur.com/yK1XeVy.png)

但是我又想到 [golangci-lint](https://github.com/golangci/golangci-lint) 這個工具同樣也是用 [cobra](https://github.com/spf13/cobra) 來寫 `command line` 的應用，卻可以在沒有添加參數的時候跳出 `--help` 的說明

像是這樣 

![](https://i.imgur.com/LQ2TyVx.png)

所以我特別找了一些資料，發現其實解決的方法滿簡單的

## 解決方法

一般的教學文章在介紹 [cobra](https://github.com/spf13/cobra) 的時候都會訂一個 `rootCmd` 一類的物件，作為你的 `command line` 應用一開始的 `root`，之後的指令就會用

```go
rootCmd.AddCommand(功能名稱)
```

的方式添加進去

所以解決方式很簡單，只要在 `rootCmd` 定義的地方判斷如果其 `args` 的長度為零，就呼叫預設的 `Help` function 即可。

```go
var rootCmd = &cobra.Command{
	Use:   "leit",
	Short: "A calendar application in command line.",
	Long:  doc,
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			_ = cmd.Help()
		}
	},
}
```

接著再編譯看看

![](https://i.imgur.com/4a3XBnv.png)

可以看到應用程式在沒有加任何參數的情況下也會顯示 `--help` 的結果了。