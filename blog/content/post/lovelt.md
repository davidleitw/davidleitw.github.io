---
title: "使用 Hugo 主題 LoveIt 架設 blog 資源紀錄"
date: 2021-08-13T23:01:13+08:00
author: davidlei
draft: false
tags: 
    - blog
categories:
    - 日常紀錄
description: "記錄使用 Hugo LoveIt 主題架設靜態部落格的過程，整理主題設定的參考資源與各項配置注意事項。"
---

這個 blog 使用了 [LoveIt](https://github.com/dillonzq/LoveIt) 主題。

詳細的設定參數都是參考其[官方部落格](https://hugoloveit.com/zh-cn/posts/)，寫得相當詳細，很值得參考。

至於與 GitHub Pages 連動的部分，網路上有很多不同的解法，這裡分享我自己用的方式。

由於 GitHub Pages 只認得 `docs` 或 `public` 這兩個資料夾來存放靜態檔案，因此需要把 Hugo 生成的靜態檔案放到專案根目錄的 `/docs` 或 `/public` 下。以下是我的專案架構：

![](https://i.imgur.com/D4zg5E6.png)

其中 `blog` 是 Hugo 的主要工作目錄，`docs` 則是讓 GitHub Pages 讀取靜態檔案的目錄。

在 `/blog` 新增文章後，用指定目錄的方式讓靜態檔案生成到 `/docs`，再推上 GitHub：

```bash
hugo -d ../docs
cd ..
git add . 
git commit -m "update"
git push
```

### reference
- [使用 GitHub Pages 展示你的 Single Page Application](https://blog.timtnlee.me/post/development/spa-on-github-page)
- [使用 Github Pages 和 Hugo 搭建个人博客教程](https://yousali.me/how-to-create-blog/)
- [使用hugo生成静态博客并部署在GitHub上](https://zhuanlan.zhihu.com/p/397612900)
- [LoveIt 官方 blog](https://hugoloveit.com/zh-cn/categories/)