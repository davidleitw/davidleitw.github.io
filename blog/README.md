# Blog

基於 Hugo + hugo-theme-stack 的個人技術 Blog。

## 快速指令

```bash
make new name=my-post   # 建立新文章
make serve              # 本地預覽 http://localhost:1313
make deploy             # 部署到 GitHub Pages
make help               # 顯示所有指令
```

---

## 寫文章流程

### Step 1: 建立文章

```bash
make new name=my-article-name
```

這會在 `content/post/` 建立 `my-article-name.md`，自動帶入模板。

### Step 2: 編輯 Front Matter

打開新建的 `.md` 檔案，設定文章 metadata：

```yaml
---
title: "文章標題"
slug: my-article-name          # URL 路徑 (會變成 /p/my-article-name/)
date: 2024-01-01T12:00:00+08:00
draft: true                    # true=草稿, false=發布
description: "文章簡短描述"     # 顯示在文章列表、SEO
image: "cover.jpg"             # 封面圖 (可選)
tags:
    - tag1
    - tag2
categories:
    - category1
---
```

### Step 3: 撰寫內容

使用 Markdown 撰寫文章內容。支援：

- 標準 Markdown 語法
- 程式碼區塊 (語法高亮)
- 數學公式 (KaTeX)
- 圖片、連結、表格

### Step 4: 本地預覽

```bash
make serve
```

瀏覽器開啟 http://localhost:1313 預覽。
`draft: true` 的文章也會顯示（僅本地預覽）。

### Step 5: 發布

確認無誤後：

1. 將 `draft: true` 改為 `draft: false`
2. 執行部署：

```bash
make deploy
```

---

## Front Matter 完整欄位說明

### 基本欄位（Hugo 內建）

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `title` | string | ✓ | 文章標題 |
| `date` | datetime | ✓ | 發布日期 |
| `draft` | bool | ✓ | 草稿狀態 |
| `slug` | string | | URL 路徑，預設用檔名 |
| `aliases` | []string | | URL 別名/重導向 |
| `lastmod` | datetime | | 最後修改日期 |
| `weight` | int | | 排序權重（數字越小越前面） |

### 主題欄位（hugo-theme-stack）

| 欄位 | 類型 | 預設 | 說明 |
|------|------|------|------|
| `description` | string | | 文章描述，用於列表和 SEO |
| `image` | string | | 封面圖路徑 |
| `tags` | []string | | 標籤列表 |
| `categories` | []string | | 分類列表 |
| `toc` | bool | `true` | 顯示目錄（需有標題才會出現） |
| `math` | bool | `true` | 啟用 KaTeX 數學公式 |
| `comments` | bool | `true` | 顯示評論區 |
| `readingTime` | bool | `false` | 顯示預估閱讀時間 |
| `license` | string/bool | | 授權資訊，`false` 隱藏 |
| `keywords` | []string | | SEO 關鍵字 |

### 日期格式

```yaml
# 完整格式（推薦）
date: 2024-01-01T12:00:00+08:00

# 簡短格式
date: 2024-01-01
```

### 完整範例

```yaml
---
title: "文章標題"
slug: my-article
date: 2024-01-01T12:00:00+08:00
lastmod: 2024-01-02T10:00:00+08:00
draft: false

description: "這是一篇關於 XXX 的文章"
image: cover.jpg
keywords:
    - keyword1
    - keyword2

tags:
    - Go
    - Linux
categories:
    - 技術筆記

toc: true
math: false
comments: true
readingTime: true
license: "CC BY-NC 4.0"
---
```

### 最小範例

```yaml
---
title: "文章標題"
date: 2024-01-01
draft: false
categories:
    - 分類
---
```

### 封面圖設定方式

**方式一：放在文章同目錄（推薦）**

```
content/post/
└── my-article/
    ├── index.md      # 文章內容
    └── cover.jpg     # 封面圖
```

Front matter:
```yaml
image: cover.jpg
```

**方式二：放在 static 目錄**

```
static/
└── images/
    └── my-cover.jpg
```

Front matter:
```yaml
image: /images/my-cover.jpg
```

---

## 目錄結構

```
blog/
├── content/
│   ├── post/              # 文章
│   │   ├── article1.md    # 單檔文章
│   │   └── article2/      # 文章資料夾（含封面圖）
│   │       ├── index.md
│   │       └── cover.jpg
│   ├── page/              # 頁面
│   │   ├── about/
│   │   ├── archives/
│   │   ├── links/
│   │   └── search/
│   └── categories/        # 分類設定（可選，設定縮圖用）
├── assets/
│   ├── img/               # 圖片資源 (avatar)
│   └── scss/custom.scss   # 自定義樣式
├── static/                # 靜態檔案 (favicon, 圖片)
├── hugo.yaml              # 主配置
└── Makefile               # 快速指令
```

---

## About 頁面建議內容

編輯 `content/page/about/index.md`，可包含：

- **簡短自介** - 一句話說明你是誰、在做什麼
- **技術棧** - 主要使用的語言/框架/工具
- **興趣領域** - 關注的技術方向
- **經歷** - 工作、開源貢獻、Side projects（可選）
- **聯繫方式** - GitHub, LinkedIn, Email

---

## 分類縮圖設定（可選）

為分類頁面添加縮圖：

```
content/categories/
├── linux-kernel/
│   ├── _index.md
│   └── cover.jpg
└── go/
    ├── _index.md
    └── cover.jpg
```

`_index.md` 內容：
```yaml
---
title: "Linux Kernel"
description: "Linux 核心相關筆記"
image: cover.jpg
---
```

---

## 待辦事項

- [ ] 完成 About 頁面內容
- [ ] 設定 Favicon (`static/favicon.ico`)
- [ ] 設定 Giscus 評論（到 https://giscus.app 獲取設定）
- [ ] 為分類添加縮圖（可選）
