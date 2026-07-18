import type { CollectionEntry } from "astro:content";
import { slugifyStr } from "./slugify";
import { getPath } from "./getPath";

export type BlogPost = CollectionEntry<"blog">;

/* ------------------------------------------------------------------ *
 * Series configuration
 *
 * A "folder" is a group of posts that share the same first tag. Most
 * folders are just loose collections. A few are coherent, ordered
 * *series* (a translated book, a day-by-day build log) that should:
 *   - collapse into a single entry in recent / latest lists, and
 *   - render their parts in reading order inside the file tree.
 * Only folders listed here collapse; everything else stays as
 * individual posts.
 * ------------------------------------------------------------------ */
export const SERIES: Record<
  string,
  {
    name: string;
    landing: string;
    landingLabel?: string;
    order?: (post: BlogPost) => number;
  }
> = {
  "agentic-design-patterns": {
    name: "Agentic Design Patterns 繁中翻譯",
    landing: "/posts/agentic-design-patterns",
    landingLabel: "全書目錄",
    order: bookOrder,
  },
  "hermes-from-zero": {
    name: "Hermes From Zero",
    landing: "/posts/hermes-from-zero",
    landingLabel: "系列總覽",
    order: dayOrder,
  },
};

/** Human-facing folder names for tags that need a nicer label. */
const TAG_DISPLAY: Record<string, string> = {
  "agentic-design-patterns": "Agentic Design Patterns",
  "hermes-from-zero": "Hermes From Zero",
  leetcode: "LeetCode",
  linux: "Linux",
  "linux-kernel": "Linux Kernel",
  c: "C",
  go: "Go",
  docker: "Docker",
  concurrency: "Concurrency",
  network: "Networking",
  paper: "Paper",
  ai: "AI / LLM",
  ironman: "Ironman",
  agent: "Agent",
  llm: "LLM",
  container: "Container",
  kernel: "Kernel",
  ebpf: "eBPF",
  github: "GitHub",
  vagrant: "Vagrant",
  shell: "Shell",
  distributed: "Distributed",
  database: "Database",
  blog: "Blog",
  misc: "Misc",
};

export function displayName(slug: string): string {
  if (TAG_DISPLAY[slug]) return TAG_DISPLAY[slug];
  return slug
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function firstTagSlug(post: BlogPost): string {
  return slugifyStr(post.data.tags?.[0] ?? "misc");
}

function dateVal(post: BlogPost): number {
  return new Date(post.data.modDatetime ?? post.data.pubDatetime).getTime();
}

/** Source-file basename without extension (used to derive reading order). */
function baseName(post: BlogPost): string {
  const fp = post.filePath ?? post.id;
  const file = fp.split("/").pop() ?? "";
  return file.replace(/\.mdx?$/, "");
}

/** Tree order for the Agentic Design Patterns book. Chapters come first so the
 *  truncated preview shows the actual content (ch1, ch2…), then appendices,
 *  then front / back matter. The pinned landing post is the full reading-order
 *  table of contents. Lower sorts earlier. */
function bookOrder(post: BlogPost): number {
  const b = baseName(post);
  const front = [
    "dedication",
    "acknowledgment",
    "foreword",
    "a-thought-leaders-perspective",
    "introduction",
    "what-makes-an-ai-system-an-agent",
  ];
  const back = ["conclusion", "glossary", "index-of-terms", "faq"];
  const ch = b.match(/^chapter-(\d+)/);
  if (ch) return Number(ch[1]); // 1 … 21
  const ap = b.match(/^appendix-([a-z])/);
  if (ap) return 100 + (ap[1].charCodeAt(0) - 96); // appendices A … G
  const fi = front.indexOf(b);
  if (fi !== -1) return 200 + fi; // front matter
  const bi = back.indexOf(b);
  if (bi !== -1) return 300 + bi; // back matter
  return 400;
}

/** Reading order for a "Day NN" build-log series. */
function dayOrder(post: BlogPost): number {
  const m = baseName(post).match(/day(\d+)/i);
  return m ? Number(m[1]) : 0;
}

/** Strip a redundant series-name prefix from a chapter title so the tree
 *  shows "第 1 章：Prompt Chaining" instead of the full book title. */
export function cleanTitle(slug: string, title: string): string {
  if (slug === "agentic-design-patterns") {
    return title.replace(/^Agentic Design Patterns[：:\s]*/u, "").trim() || title;
  }
  return title;
}

/* ------------------------------------------------------------------ *
 * File tree
 * ------------------------------------------------------------------ */
export type TreeEntry = {
  title: string;
  href: string;
  date: Date;
};

export type TreeFolder = {
  slug: string;
  name: string;
  count: number;
  latest: Date;
  /** Series index post, pinned to the top of the folder (if any). */
  landing: TreeEntry | null;
  /** Ordered chapter / post entries (excludes the landing post). */
  entries: TreeEntry[];
  isSeries: boolean;
};

function toEntry(slug: string, post: BlogPost): TreeEntry {
  return {
    title: cleanTitle(slug, post.data.title),
    href: getPath(post.id, post.filePath),
    date: new Date(post.data.pubDatetime),
  };
}

/** Group posts into folders (by first tag) for the file-tree view. */
export function buildFolders(sortedPosts: BlogPost[]): TreeFolder[] {
  const map = new Map<string, BlogPost[]>();
  for (const p of sortedPosts) {
    const slug = firstTagSlug(p);
    const arr = map.get(slug) ?? [];
    arr.push(p);
    map.set(slug, arr);
  }

  const folders: TreeFolder[] = [];
  for (const [slug, posts] of map) {
    const cfg = SERIES[slug];

    let landing: TreeEntry | null = null;
    const rest: BlogPost[] = [];
    for (const p of posts) {
      if (cfg && getPath(p.id, p.filePath) === cfg.landing) {
        landing = toEntry(slug, p);
        if (cfg.landingLabel) landing.title = cfg.landingLabel;
      } else {
        rest.push(p);
      }
    }

    if (cfg?.order) {
      rest.sort((a, b) => cfg.order!(a) - cfg.order!(b));
    } else {
      rest.sort((a, b) => dateVal(b) - dateVal(a));
    }

    folders.push({
      slug,
      name: displayName(slug),
      count: posts.length,
      latest: new Date(Math.max(...posts.map(dateVal))),
      landing,
      entries: rest.map(p => toEntry(slug, p)),
      isSeries: !!cfg,
    });
  }

  folders.sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
  return folders;
}

/* ------------------------------------------------------------------ *
 * Recent / latest lists (series collapsed to one entry)
 * ------------------------------------------------------------------ */
export type RecentEntry =
  | {
      kind: "post";
      title: string;
      href: string;
      date: Date;
      description: string;
    }
  | {
      kind: "series";
      name: string;
      href: string;
      date: Date;
      count: number;
    };

/**
 * Walk newest-first posts and fold any run of a configured series into a
 * single "series" entry, so a 39-chapter book counts as one line instead
 * of burying everything else.
 */
export function collapseRecent(
  sortedPosts: BlogPost[],
  limit: number
): RecentEntry[] {
  const counts = new Map<string, number>();
  for (const p of sortedPosts) {
    const s = firstTagSlug(p);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  const out: RecentEntry[] = [];
  for (const p of sortedPosts) {
    if (out.length >= limit) break;
    const slug = firstTagSlug(p);
    const cfg = SERIES[slug];
    if (cfg) {
      const prev = out[out.length - 1];
      if (prev && prev.kind === "series" && prev.href === cfg.landing) {
        continue; // already represented; skip the rest of this run
      }
      out.push({
        kind: "series",
        name: cfg.name,
        href: cfg.landing,
        date: new Date(p.data.pubDatetime),
        count: counts.get(slug) ?? 1,
      });
    } else {
      out.push({
        kind: "post",
        title: p.data.title,
        href: getPath(p.id, p.filePath),
        date: new Date(p.data.pubDatetime),
        description: p.data.description ?? "",
      });
    }
  }
  return out;
}
