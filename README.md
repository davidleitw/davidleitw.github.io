# davidlei

我的個人 blog。繁體中文技術寫作為主——agent framework、Linux 系統、LeetCode、論文心得,以及任何當下在讀的東西。

**Live:** [davidleitw.github.io](https://davidleitw.github.io/)

---

## Stack

Astro 5 · Tailwind 4 · Pagefind(static search index)。fork 自 [Devosfera](https://devosfera.vercel.app/) 的 layout(它本身是 [AstroPaper](https://github.com/satnaing/astro-paper) 的重度客製版)。沿用了主視覺(aurora hero、glassmorphism nav、Cmd-K modal),不合的部分換掉:

- **Logo**:`<davidlei />` 工程師角括號 wordmark,取代原 Devosfera SVG
- **`/posts`**:單頁 tag-categorized 分類面板,取代原本 8 篇/頁的 grid 分頁
- **Prose voice**:`src/data/blog/` 裡的文章過了一輪 [hermes-voice skill](https://github.com/davidleitw/davidleitw.github.io/blob/master/CUSTOMIZATIONS.md),把 AI 味的句型(假個人經驗、擬人化 codebase、「不是 X,是 Y」對比、抬高詞)儘量拔掉

更多視覺細節與設計系統:[CUSTOMIZATIONS.md](CUSTOMIZATIONS.md)。

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

**重點**:`tags` 的**第一個 tag** 是 primary,決定這篇文章在 `/posts` 落到哪個分類 bucket(順序在 frontmatter 裡可以自由排)。

支援 MDX(可直接寫 JSX 元件),`<GalleryEmbed>` 不用 import 直接用——細節見 [GALLERIES.md](GALLERIES.md)。

---

## Site config

主要設定在 `src/config.ts` 的 `SITE`:

```ts
export const SITE = {
  website: "https://davidleitw.github.io/",
  author: "davidlei",
  profile: "https://github.com/davidleitw",
  desc: "一個紀錄心情、技術、人生的網站",
  title: "davidLei",
  timezone: "Asia/Taipei",
  showArchives: true,
  showGalleries: true,
  // ...
};
```

社群連結與 share 按鈕設定在 `src/constants.ts`。

---

## Credits

- Layout fork:[Devosfera](https://devosfera.vercel.app/) by [@0xdres](https://github.com/0xdres)
- Upstream:[AstroPaper](https://github.com/satnaing/astro-paper) by [Sat Naing](https://satnaing.dev),MIT

---

## License

- **Code**:MIT(繼承自上游)
- **`src/data/blog/` 裡的文章**:© davidleitw,保留所有權利。引用請註明出處。
