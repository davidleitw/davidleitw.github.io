import type { SeriesIndex, SeriesPost } from "./core";

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

/* ------------------------------------------------------------------ *
 * /posts file tree
 * ------------------------------------------------------------------ */
export type TreeEntry = { title: string; href: string; date: Date };

export type TreeFolder = {
  slug: string;
  name: string;
  count: number;
  latest: Date;
  /** Series index post, pinned above everything else. */
  landing: TreeEntry | null;
  /** Flat entry list — what a plain tag folder shows. */
  entries: TreeEntry[];
  /** Part sub-folders; null for folders that are not an ordered series. */
  parts: { title?: string; entries: TreeEntry[] }[] | null;
  isSeries: boolean;
};

/**
 * Group posts into folders. A tag folder is a loose bag sorted newest-first;
 * a series folder keeps manifest order and nests its parts, because the whole
 * point of a series is that the order carries meaning.
 */
export function buildFolders(
  index: SeriesIndex,
  posts: SeriesPost[]
): TreeFolder[] {
  const folders: TreeFolder[] = [];

  for (const series of index.list) {
    const { def } = series;
    const own = posts.filter(p => index.memberOf.get(p.href) === def.id);
    if (own.length === 0) continue;

    folders.push({
      slug: def.tag,
      name: displayName(def.tag),
      count: own.length,
      latest: new Date(Math.max(...own.map(p => p.sortDate.getTime()))),
      landing: series.landing
        ? {
            title: series.landing.title,
            href: series.landing.href,
            date: series.landing.date,
          }
        : null,
      entries: series.entries.map(e => ({
        title: e.title,
        href: e.href,
        date: e.date,
      })),
      parts: series.parts.map(p => ({
        title: p.title,
        entries: p.entries.map(e => ({
          title: e.title,
          href: e.href,
          date: e.date,
        })),
      })),
      isSeries: true,
    });
  }

  const grouped = new Map<string, SeriesPost[]>();
  for (const p of posts) {
    if (index.memberOf.has(p.href)) continue;
    const arr = grouped.get(p.tag) ?? [];
    arr.push(p);
    grouped.set(p.tag, arr);
  }

  for (const [slug, group] of grouped) {
    const sorted = [...group].sort(
      (a, b) => b.sortDate.getTime() - a.sortDate.getTime()
    );
    folders.push({
      slug,
      name: displayName(slug),
      count: sorted.length,
      latest: sorted[0].sortDate,
      landing: null,
      entries: sorted.map(p => ({
        title: p.title,
        href: p.href,
        date: p.date,
      })),
      parts: null,
      isSeries: false,
    });
  }

  folders.sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
  return folders;
}

/* ------------------------------------------------------------------ *
 * Recent / latest lists
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
 * Walk newest-first posts and fold each run of series posts into one entry, so
 * a 39-part book takes a single line instead of burying everything else.
 */
export function collapseRecent(
  index: SeriesIndex,
  sortedPosts: SeriesPost[],
  limit: number
): RecentEntry[] {
  const totals = new Map<string, number>();
  for (const p of sortedPosts) {
    const id = index.memberOf.get(p.href);
    if (id) totals.set(id, (totals.get(id) ?? 0) + 1);
  }

  const out: RecentEntry[] = [];
  for (const p of sortedPosts) {
    if (out.length >= limit) break;
    const id = index.memberOf.get(p.href);
    const series = id ? index.byId.get(id) : undefined;

    if (series) {
      const prev = out[out.length - 1];
      if (prev?.kind === "series" && prev.href === series.def.landing) continue;
      out.push({
        kind: "series",
        name: series.def.name,
        href: series.def.landing,
        date: p.date,
        count: totals.get(series.def.id) ?? 1,
      });
    } else {
      out.push({
        kind: "post",
        title: p.title,
        href: p.href,
        date: p.date,
        description: p.description ?? "",
      });
    }
  }
  return out;
}
