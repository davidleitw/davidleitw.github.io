---
title: "使用 Hugo 主題 LoveIt 架設 blog 資源紀錄"
date: 2021-08-13T23:01:13+08:00
author: davidlei
draft: false
tags: 
    - blog
categories:
    - 日常紀錄
---

這次新架的 blog 使用了 [LoveIt](https://github.com/dillonzq/LoveIt) 這個主題

詳細的架設參數設定都是參考其[官方部落格](https://hugoloveit.com/zh-cn/posts/)，寫的算是滿詳細的，值得參考。

至於跟 github page 連動的部份，這方面很多文章都有不同的解決方案，我在這篇分享一下我的解決方法。

因為 github page 只認得 docs 或者 public 兩個資料夾存放靜態檔案，所以我們勢必要把 hugo 生成的靜態檔案放到專案根目錄的 `/docs` 或者 `/public` 之中，底下是我 github page 專案的架構

![](https://i.imgur.com/D4zg5E6.png)

其中 `blog` 是主要 hugo 生成的目錄，`docs` 是給 github page 辨識靜態檔案的目錄。

在 `/blog` 添加完新的文章之後，用指定目錄的方式，讓靜態檔案生成到 `/docs` 底下，讓 github page 讀取

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