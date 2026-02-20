---
title: "golang cobra: 在沒有添加任何參數的情況下預設產生 help message"
date: 2021-08-16T01:37:36+08:00
draft: false
tags: 
    - go
categories: ["go"]
description: "記錄在使用 Cobra 開發 CLI 工具時，如何在沒有傳入任何參數的情況下自動顯示 help message，而不需要手動輸入 --help。"
---

## 問題描述

最近用 [cobra](https://github.com/spf13/cobra) 寫一個簡單的 command line 工具，過程中遇到一個之前沒想過的問題，記錄在這裡。

一般來說，用 cobra 寫的程式要顯示使用說明，都需要加上 `--help` 參數，如圖：

![](https://i.imgur.com/yK1XeVy.png)

不過我注意到 [golangci-lint](https://github.com/golangci/golangci-lint) 同樣是用 cobra 寫的，卻可以在不加任何參數的情況下自動顯示說明：

![](https://i.imgur.com/LQ2TyVx.png)

找了一下資料，發現解法其實很簡單。

## 解決方法

一般介紹 cobra 的教學文章都會先建立一個 `rootCmd`，作為整個 CLI 應用的入口，其他子指令再用

```go
rootCmd.AddCommand(功能名稱)
```

的方式掛上去。

解法很直覺：在 `rootCmd` 的 `Run` 函式裡判斷 `args` 長度是否為零，如果是就呼叫預設的 `Help` function：

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

重新編譯後：

![](https://i.imgur.com/4a3XBnv.png)

可以看到，在沒有加任何參數的情況下也會自動顯示 help 內容了。