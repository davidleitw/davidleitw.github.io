import type { SeriesDefinition } from "@/data/series/types";

/* ------------------------------------------------------------------ *
 * Input shape
 *
 * Deliberately structural rather than `CollectionEntry<"blog">`: that type
 * comes from the `astro:content` virtual module, and depending on it would
 * force every test to boot Astro. The `.astro` files map their entries onto
 * this shape and everything below stays a plain function.
 * ------------------------------------------------------------------ */
export type SeriesPost = {
  /** Path as it appears in the browser, no trailing slash. */
  href: string;
  title: string;
  /** Publish date — what the UI shows. */
  date: Date;
  /** Sort key: modified date when present, else publish date. */
  sortDate: Date;
  /** Slug of the post's first tag, used to group folders. */
  tag: string;
  description?: string;
};

/* ------------------------------------------------------------------ *
 * Index
 * ------------------------------------------------------------------ */
export type SeriesDiagnostic = {
  level: "warn" | "error";
  seriesId: string;
  message: string;
};

export type SeriesEntry = {
  href: string;
  title: string;
  date: Date;
  partTitle?: string;
};

export type ResolvedPart = {
  title?: string;
  entries: SeriesEntry[];
};

export type ResolvedSeries = {
  def: SeriesDefinition;
  landing: SeriesEntry | null;
  /** Every resolved entry in reading order, part boundaries flattened away. */
  entries: SeriesEntry[];
  parts: ResolvedPart[];
};

export type SeriesIndex = {
  list: ResolvedSeries[];
  byId: Map<string, ResolvedSeries>;
  /** href → series id, covering both entries and landing posts. */
  memberOf: Map<string, string>;
  postByHref: Map<string, SeriesPost>;
  diagnostics: SeriesDiagnostic[];
};

/** Drop a redundant series-name prefix so a chapter reads
 *  "第 1 章:Prompt Chaining" rather than repeating the book title. */
export function cleanTitle(def: SeriesDefinition, title: string): string {
  if (!def.stripTitlePrefix) return title;
  const escaped = def.stripTitlePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    title.replace(new RegExp(`^${escaped}[：:\\s]*`, "u"), "").trim() || title
  );
}

/**
 * Resolve every series against the posts that actually exist.
 *
 * Entries listed in a manifest but missing from the collection (deleted,
 * renamed, or currently a draft) are skipped rather than rendered as dead
 * links; posts that carry a series tag but no manifest entry are appended so
 * nothing silently disappears. Both cases are reported as diagnostics.
 * A post claimed by two manifests is an authoring mistake with no sensible
 * resolution, so it throws.
 */
export function buildSeriesIndex(
  posts: SeriesPost[],
  defs: SeriesDefinition[]
): SeriesIndex {
  const postByHref = new Map(posts.map(p => [p.href, p]));
  const memberOf = new Map<string, string>();
  const diagnostics: SeriesDiagnostic[] = [];
  const list: ResolvedSeries[] = [];

  for (const def of defs) {
    const claim = (href: string) => {
      const owner = memberOf.get(href);
      if (owner && owner !== def.id) {
        throw new Error(
          `[series] ${href} is claimed by both "${owner}" and "${def.id}". ` +
            `A post can only belong to one series.`
        );
      }
      memberOf.set(href, def.id);
    };

    const toEntry = (post: SeriesPost, partTitle?: string): SeriesEntry => ({
      href: post.href,
      title: cleanTitle(def, post.title),
      date: post.date,
      partTitle,
    });

    claim(def.landing);
    const landingPost = postByHref.get(def.landing);
    if (!landingPost) {
      diagnostics.push({
        level: "warn",
        seriesId: def.id,
        message: `landing post ${def.landing} does not exist`,
      });
    }

    const parts: ResolvedPart[] = [];
    for (const part of def.parts) {
      const entries: SeriesEntry[] = [];
      for (const href of part.hrefs) {
        claim(href);
        const post = postByHref.get(href);
        if (!post) {
          diagnostics.push({
            level: "warn",
            seriesId: def.id,
            message: `${href} is listed in the manifest but has no published post (deleted, renamed, or draft) — skipped`,
          });
          continue;
        }
        entries.push(toEntry(post, part.title));
      }
      // A part whose every entry is missing would render as an empty heading.
      if (entries.length > 0) parts.push({ title: part.title, entries });
    }

    // Sweep up posts that carry the series tag but were never listed. Better
    // to show them at the end than to make them unreachable.
    const orphans = posts.filter(
      p => p.tag === def.tag && !memberOf.has(p.href)
    );
    if (orphans.length > 0) {
      for (const p of orphans) {
        claim(p.href);
        diagnostics.push({
          level: "warn",
          seriesId: def.id,
          message: `${p.href} is tagged "${def.tag}" but missing from the manifest — appended at the end`,
        });
      }
      parts.push({
        title: "未分類",
        entries: orphans.map(p => toEntry(p, "未分類")),
      });
    }

    const resolved: ResolvedSeries = {
      def,
      landing: landingPost
        ? { ...toEntry(landingPost), title: def.landingLabel }
        : null,
      entries: parts.flatMap(p => p.entries),
      parts,
    };
    list.push(resolved);
  }

  return {
    list,
    byId: new Map(list.map(s => [s.def.id, s])),
    memberOf,
    postByHref,
    diagnostics,
  };
}

/* ------------------------------------------------------------------ *
 * Per-post context
 * ------------------------------------------------------------------ */
export type SeriesNavTarget = { href: string; title: string };

export type SeriesContext = {
  series: {
    id: string;
    name: string;
    shortName: string;
    landing: string;
    landingLabel: string;
    unitLabel: string;
    total: number;
  };
  isLanding: boolean;
  /** 1-based position among entries; null on the landing post. */
  position: number | null;
  partTitle?: string;
  prev: SeriesNavTarget | null;
  next: SeriesNavTarget | null;
  parts: {
    title?: string;
    entries: { href: string; title: string; isCurrent: boolean }[];
  }[];
};

/** What a post needs to know about the series it sits in. `null` for the
 *  vast majority of posts, which keeps their pages exactly as they were. */
export function getSeriesContext(
  index: SeriesIndex,
  href: string
): SeriesContext | null {
  const id = index.memberOf.get(href);
  if (!id) return null;
  const resolved = index.byId.get(id);
  if (!resolved) return null;

  const { def, entries } = resolved;
  const isLanding = href === def.landing;
  const position = isLanding
    ? null
    : entries.findIndex(e => e.href === href) + 1 || null;

  // A member href that resolved to nothing (draft landing, say) has no place
  // in the reading order — treat it as an ordinary post.
  if (!isLanding && position === null) return null;

  let prev: SeriesNavTarget | null = null;
  let next: SeriesNavTarget | null = null;

  if (isLanding) {
    next = entries[0]
      ? { href: entries[0].href, title: entries[0].title }
      : null;
  } else {
    const i = position! - 1;
    prev =
      i === 0
        ? resolved.landing
          ? { href: def.landing, title: def.landingLabel }
          : null
        : { href: entries[i - 1].href, title: entries[i - 1].title };
    next = entries[i + 1]
      ? { href: entries[i + 1].href, title: entries[i + 1].title }
      : null;
  }

  return {
    series: {
      id: def.id,
      name: def.name,
      shortName: def.shortName,
      landing: def.landing,
      landingLabel: def.landingLabel,
      unitLabel: def.unitLabel,
      total: entries.length,
    },
    isLanding,
    position,
    partTitle: isLanding ? undefined : entries[position! - 1].partTitle,
    prev,
    next,
    parts: resolved.parts.map(p => ({
      title: p.title,
      entries: p.entries.map(e => ({
        href: e.href,
        title: e.title,
        isCurrent: e.href === href,
      })),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Landing table-of-contents check
 * ------------------------------------------------------------------ */

/** Pull the links out of the section a heading introduces, stopping at the
 *  next heading of the same level so unrelated links further down the page
 *  are ignored. */
export function extractTocLinks(body: string, heading: string): string[] {
  const lines = body.split("\n");
  const start = lines.findIndex(l =>
    new RegExp(
      `^#{2,4}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`
    ).test(l)
  );
  if (start === -1) return [];

  const level = (lines[start].match(/^#+/) ?? ["##"])[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }

  const section = lines.slice(start + 1, end).join("\n");
  const links: string[] = [];
  for (const m of section.matchAll(/\]\((\/posts\/[^)\s#]+)\)/g)) {
    links.push(m[1].replace(/\/+$/, ""));
  }
  return links;
}

/** Compare the hand-written table of contents on a landing post against the
 *  manifest. They encode the same thing, so any divergence is a bug — throwing
 *  turns a silently broken index into a failed build. */
export function assertLandingTocMatches(
  def: SeriesDefinition,
  body: string
): void {
  if (!def.tocHeading) return;

  const expected = def.parts.flatMap(p => p.hrefs);
  const found = extractTocLinks(body, def.tocHeading);

  if (found.length === 0) {
    throw new Error(
      `[series] "${def.id}": found no links under the "${def.tocHeading}" heading ` +
        `on ${def.landing}. Did the heading get renamed?`
    );
  }

  const missing = expected.filter(h => !found.includes(h));
  const extra = found.filter(h => !expected.includes(h));
  const sameOrder =
    found.length === expected.length &&
    found.every((h, i) => h === expected[i]);

  if (missing.length || extra.length || !sameOrder) {
    const detail = [
      missing.length
        ? `in the manifest but not the page:\n  ${missing.join("\n  ")}`
        : "",
      extra.length
        ? `on the page but not the manifest:\n  ${extra.join("\n  ")}`
        : "",
      !missing.length && !extra.length && !sameOrder
        ? "same entries, different order"
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(
      `[series] "${def.id}": the table of contents on ${def.landing} disagrees ` +
        `with the manifest.\n${detail}`
    );
  }
}
