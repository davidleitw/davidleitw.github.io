# davidlei

我的個人 blog。繁體中文技術寫作為主——agent framework、Linux 系統、LeetCode、論文心得,以及任何當下在讀的東西。

**Live:** [davidleitw.github.io](https://davidleitw.github.io/)

---

## Stack

Astro 5 · Tailwind 4 · MDX · Pagefind(static search index)。視覺上保留了 aurora hero、glassmorphism nav、Cmd-K 搜尋 modal,客製過的部分:

- **Logo**:`<davidlei />` 工程師角括號 wordmark
- **`/posts`**:單頁 tag-categorized 分類面板,取代分頁式 grid

更多視覺細節:[CUSTOMIZATIONS.md](CUSTOMIZATIONS.md)。

---

## Develop

需要 Node 20+ 跟 pnpm。

```bash
pnpm install
pnpm run dev                          # http://localhost:4321
pnpm run build && pnpm run preview    # 含 Pagefind 索引,要測搜尋走這條
```

| Command            | What it does                                  |
| :----------------- | :-------------------------------------------- |
| `pnpm run dev`     | Dev server                                    |
| `pnpm run build`   | `astro check` + build + Pagefind 索引          |
| `pnpm run preview` | Preview production build                      |
| `pnpm run format`  | Prettier                                      |
| `pnpm run lint`    | ESLint                                        |

---

## Writing

文章放在 `src/data/blog/`,frontmatter 範例:

```yaml
---
title: "標題"
pubDatetime: 2026-05-21T22:00:00+08:00   # ISO 8601 + timezone
description: "SEO 跟卡片用的短描述"
tags:
  - hermes-from-zero
  - agent
  - llm
draft: false
---
```

**重點**:`tags` 的**第一個 tag** 是 primary,決定這篇文章在 `/posts` 落到哪個分類 bucket。

支援 MDX(可直接寫 JSX 元件),`<GalleryEmbed>` 不用 import 直接用——細節見 [GALLERIES.md](GALLERIES.md)。

---

## Site config

主要設定在 `src/config.ts` 的 `SITE`。社群連結與 share 按鈕設定在 `src/constants.ts`。

---

## License

見 [LICENSE](LICENSE)。`src/data/blog/` 裡的文章 © davidleitw,保留所有權利,引用請註明出處。
