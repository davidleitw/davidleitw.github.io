---
name: deploy
description: Deploy the blog to GitHub Pages. Use when user says "deploy", "部署", or wants to publish the blog.
allowed-tools: Bash(hugo:*), Bash(git:*), Bash(cd:*), Bash(make:*), Bash(date:*), Bash(grep:*), Read, Edit, Glob, AskUserQuestion
---

# Deploy Blog to GitHub Pages

## Pre-deploy Checks

在執行 deploy 之前，先檢查準備發布的文章：

1. 使用 `grep -l "draft: false" blog/content/post/*.md` 找出非草稿文章
2. 檢查這些文章的 `description` 是否為空
3. 如果 `description` 為空，詢問用戶是否要補上描述
4. 使用 `date "+%Y-%m-%dT%H:%M:%S+08:00"` 取得當前時間，更新發布時間（如果用戶要求）

## Steps

1. 執行 Pre-deploy Checks
2. 進入 blog 目錄
3. 執行 `make deploy`（會自動 build + commit + push）
4. 確認部署成功

## Commands

```bash
cd /home/davidleitw/Desktop/davidleitw.github.io/blog
make deploy
```

## After deployment

告訴用戶：
- 等待 1-2 分鐘
- 訪問 https://davidleitw.github.io 確認更新
