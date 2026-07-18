import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SeriesDefinition } from "@/data/series/types";
import { agenticDesignPatterns as BOOK } from "@/data/series/agentic-design-patterns";
import { hermesFromZero as HERMES } from "@/data/series/hermes-from-zero";
import {
  assertLandingTocMatches,
  buildSeriesIndex,
  cleanTitle,
  extractTocLinks,
  getSeriesContext,
  type SeriesPost,
} from "./core";
import { buildFolders, collapseRecent } from "./tree";

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */
function makePost(href: string, over: Partial<SeriesPost> = {}): SeriesPost {
  const day = new Date("2026-01-01");
  return {
    href,
    title: href.split("/").pop()!,
    date: day,
    sortDate: day,
    tag: "misc",
    ...over,
  };
}

/** Every post a manifest expects, newest-first, so the index resolves fully. */
function postsFor(def: SeriesDefinition, titlePrefix = ""): SeriesPost[] {
  const hrefs = [def.landing, ...def.parts.flatMap(p => p.hrefs)];
  return hrefs.map((href, i) => {
    const leaf = href.split("/").pop()!;
    const when = new Date(2026, 0, 1, 0, hrefs.length - i);
    return makePost(href, {
      tag: def.tag,
      title: `${titlePrefix}${leaf}`,
      date: when,
      sortDate: when,
    });
  });
}

const bookIndex = () =>
  buildSeriesIndex(postsFor(BOOK, "Agentic Design Patterns "), [BOOK]);

const B = BOOK.landing;
const ctxFor = (href: string) => getSeriesContext(bookIndex(), href);

/* ------------------------------------------------------------------ *
 * Reading order
 * ------------------------------------------------------------------ */
describe("reading order", () => {
  it("walks chapters in manifest order", () => {
    const ctx = ctxFor(`${B}/chapter-07-multi-agent-collaboration`);
    expect(ctx?.prev?.href).toBe(`${B}/chapter-06-planning`);
    expect(ctx?.next?.href).toBe(`${B}/chapter-08-memory-management`);
  });

  // Regression: publish dates run backwards through the front matter, so the
  // old date-driven nav walked these six posts in reverse.
  it("walks the front matter forwards", () => {
    const ctx = ctxFor(`${B}/introduction`);
    expect(ctx?.prev?.href).toBe(`${B}/a-thought-leaders-perspective`);
    expect(ctx?.next?.href).toBe(`${B}/what-makes-an-ai-system-an-agent`);
  });

  it("sends the first entry back to the landing post", () => {
    const ctx = ctxFor(`${B}/dedication`);
    expect(ctx?.position).toBe(1);
    expect(ctx?.prev).toEqual({ href: B, title: BOOK.landingLabel });
  });

  // Regression: the oldest post used to hand off to an unrelated older post.
  it("stops at the last entry instead of leaking out of the series", () => {
    const ctx = ctxFor(`${B}/index-of-terms`);
    expect(ctx?.position).toBe(38);
    expect(ctx?.next).toBeNull();
  });

  it("treats the landing post as the entry point", () => {
    const ctx = ctxFor(B);
    expect(ctx?.isLanding).toBe(true);
    expect(ctx?.position).toBeNull();
    expect(ctx?.prev).toBeNull();
    expect(ctx?.next?.href).toBe(`${B}/dedication`);
  });

  it("ignores publish dates when they disagree with the manifest", () => {
    const posts = postsFor(BOOK).map(p =>
      p.href === `${B}/chapter-02-routing`
        ? {
            ...p,
            date: new Date("2030-01-01"),
            sortDate: new Date("2030-01-01"),
          }
        : p
    );
    const ctx = getSeriesContext(
      buildSeriesIndex(posts, [BOOK]),
      `${B}/chapter-01-prompt-chaining`
    );
    expect(ctx?.next?.href).toBe(`${B}/chapter-02-routing`);
  });

  it("returns null for a post that is not in any series", () => {
    const index = buildSeriesIndex([makePost("/posts/lc1010")], [BOOK]);
    expect(getSeriesContext(index, "/posts/lc1010")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Position and parts
 * ------------------------------------------------------------------ */
describe("position and parts", () => {
  it("counts position across the whole series, not within a part", () => {
    const ctx = ctxFor(`${B}/chapter-01-prompt-chaining`);
    expect(ctx?.position).toBe(7); // six front-matter posts come first
    expect(ctx?.series.total).toBe(38);
  });

  it("reports which part an entry belongs to", () => {
    expect(ctxFor(`${B}/chapter-08-memory-management`)?.partTitle).toBe(
      "第二部:進階系統"
    );
    expect(
      ctxFor(`${B}/appendix-a-advanced-prompting-techniques`)?.partTitle
    ).toBe("附錄");
  });

  it("marks exactly one entry as current in the table of contents", () => {
    const ctx = ctxFor(`${B}/chapter-04-reflection`);
    const current = ctx!.parts.flatMap(p => p.entries).filter(e => e.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].href).toBe(`${B}/chapter-04-reflection`);
  });

  it("leaves the part title unset for an undivided series", () => {
    const index = buildSeriesIndex(postsFor(HERMES), [HERMES]);
    const ctx = getSeriesContext(index, "/posts/hermes-from-zero-day03");
    expect(ctx?.partTitle).toBeUndefined();
    expect(ctx?.parts).toHaveLength(1);
    expect(ctx?.parts[0].title).toBeUndefined();
    expect(ctx?.series.unitLabel).toBe("天");
    expect(ctx?.series.total).toBe(15);
  });

  it("stops the last day of the log without leaking", () => {
    const index = buildSeriesIndex(postsFor(HERMES), [HERMES]);
    expect(
      getSeriesContext(index, "/posts/hermes-from-zero-day15")?.next
    ).toBeNull();
    expect(
      getSeriesContext(index, "/posts/hermes-from-zero-day01")?.prev?.href
    ).toBe(HERMES.landing);
  });
});

/* ------------------------------------------------------------------ *
 * Titles
 * ------------------------------------------------------------------ */
describe("titles", () => {
  it("strips the repeated book name from entry titles", () => {
    expect(
      cleanTitle(BOOK, "Agentic Design Patterns 第 1 章:Prompt Chaining")
    ).toBe("第 1 章:Prompt Chaining");
  });

  it("leaves titles alone for a series with no prefix configured", () => {
    expect(cleanTitle(HERMES, "Day 01:我為什麼想拆一個 agent framework")).toBe(
      "Day 01:我為什麼想拆一個 agent framework"
    );
  });

  it("keeps the original title when stripping would empty it", () => {
    expect(cleanTitle(BOOK, "Agentic Design Patterns")).toBe(
      "Agentic Design Patterns"
    );
  });
});

/* ------------------------------------------------------------------ *
 * Missing, unlisted and duplicated posts
 * ------------------------------------------------------------------ */
describe("manifest and reality disagreeing", () => {
  it("skips an entry with no published post and joins its neighbours", () => {
    const posts = postsFor(BOOK).filter(
      p => p.href !== `${B}/chapter-02-routing`
    );
    const index = buildSeriesIndex(posts, [BOOK]);

    const ctx = getSeriesContext(index, `${B}/chapter-01-prompt-chaining`);
    expect(ctx?.next?.href).toBe(`${B}/chapter-03-parallelization`);
    expect(ctx?.series.total).toBe(37);
    expect(index.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "warn",
        message: expect.stringContaining("chapter-02-routing"),
      })
    );
  });

  it("appends a tagged post the manifest forgot rather than hiding it", () => {
    const stray = makePost(`${B}/chapter-22-something-new`, {
      tag: BOOK.tag,
      title: "Agentic Design Patterns 第 22 章",
    });
    const index = buildSeriesIndex([...postsFor(BOOK), stray], [BOOK]);

    expect(index.byId.get(BOOK.id)!.entries.at(-1)!.href).toBe(stray.href);
    expect(index.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "warn",
        message: expect.stringContaining("missing from the manifest"),
      })
    );
  });

  it("refuses to let two series claim the same post", () => {
    const clash: SeriesDefinition = {
      ...HERMES,
      id: "clash",
      parts: [{ hrefs: [`${B}/chapter-01-prompt-chaining`] }],
    };
    expect(() => buildSeriesIndex(postsFor(BOOK), [BOOK, clash])).toThrow(
      /claimed by both/
    );
  });

  it("drops a part whose entries have all gone missing", () => {
    const posts = postsFor(BOOK).filter(
      p => !p.href.startsWith(`${B}/appendix-`)
    );
    const index = buildSeriesIndex(posts, [BOOK]);
    const titles = index.byId.get(BOOK.id)!.parts.map(p => p.title);
    expect(titles).not.toContain("附錄");
  });

  it("survives a series whose landing post does not exist", () => {
    const posts = postsFor(BOOK).filter(p => p.href !== B);
    const index = buildSeriesIndex(posts, [BOOK]);
    expect(getSeriesContext(index, `${B}/dedication`)?.prev).toBeNull();
    expect(index.diagnostics).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("landing post"),
      })
    );
  });
});

/* ------------------------------------------------------------------ *
 * Landing table of contents
 * ------------------------------------------------------------------ */
describe("landing table of contents", () => {
  const body = [
    "intro linking to /posts/agentic-design-patterns/introduction",
    "",
    "## 全書目錄",
    "",
    "### 前言",
    "- [獻詞](/posts/agentic-design-patterns/dedication)",
    "",
    "## 之後的段落",
    "- [不算數](/posts/agentic-design-patterns/faq)",
  ].join("\n");

  it("reads only the links under the given heading", () => {
    expect(extractTocLinks(body, "全書目錄")).toEqual([
      "/posts/agentic-design-patterns/dedication",
    ]);
  });

  it("returns nothing when the heading is absent", () => {
    expect(extractTocLinks(body, "沒有這個標題")).toEqual([]);
  });

  it("accepts the real landing pages", () => {
    for (const def of [BOOK, HERMES]) {
      const file =
        def === BOOK ? "agentic-design-patterns" : "hermes-from-zero";
      const md = readFileSync(`src/data/blog/${file}.md`, "utf8");
      expect(() => assertLandingTocMatches(def, md)).not.toThrow();
    }
  });

  it("rejects a page that is missing an entry", () => {
    const def: SeriesDefinition = {
      ...BOOK,
      parts: [{ title: "前言", hrefs: [`${B}/dedication`, `${B}/foreword`] }],
    };
    expect(() => assertLandingTocMatches(def, body)).toThrow(/not the page/);
  });

  it("rejects a page whose entries are in a different order", () => {
    const two = [
      "## 全書目錄",
      `- [b](${B}/foreword)`,
      `- [a](${B}/dedication)`,
    ].join("\n");
    const def: SeriesDefinition = {
      ...BOOK,
      parts: [{ hrefs: [`${B}/dedication`, `${B}/foreword`] }],
    };
    expect(() => assertLandingTocMatches(def, two)).toThrow(/different order/);
  });

  it("rejects a renamed heading rather than silently passing", () => {
    expect(() =>
      assertLandingTocMatches({ ...BOOK, tocHeading: "改過的標題" }, body)
    ).toThrow(/no links under/);
  });
});

/* ------------------------------------------------------------------ *
 * Lists and the file tree
 * ------------------------------------------------------------------ */
describe("recent list", () => {
  const newest = (href: string, tag: string, minutes: number) =>
    makePost(href, {
      tag,
      date: new Date(2026, 5, 1, 0, minutes),
      sortDate: new Date(2026, 5, 1, 0, minutes),
    });

  it("folds a run of series posts into a single entry", () => {
    const posts = postsFor(BOOK);
    const index = buildSeriesIndex(posts, [BOOK]);
    const recent = collapseRecent(index, posts, 5);

    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({
      kind: "series",
      href: BOOK.landing,
      count: 39,
    });
  });

  it("keeps standalone posts separate", () => {
    const posts = [
      newest("/posts/a", "go", 3),
      newest("/posts/b", "go", 2),
      newest("/posts/c", "go", 1),
    ];
    const index = buildSeriesIndex(posts, [BOOK]);
    expect(collapseRecent(index, posts, 5).map(e => e.kind)).toEqual([
      "post",
      "post",
      "post",
    ]);
  });

  it("re-opens a series entry when other posts interrupt the run", () => {
    const posts = [
      newest(`${B}/chapter-01-prompt-chaining`, BOOK.tag, 4),
      newest("/posts/standalone", "go", 3),
      newest(`${B}/chapter-02-routing`, BOOK.tag, 2),
    ];
    const index = buildSeriesIndex(posts, [BOOK]);
    expect(collapseRecent(index, posts, 5).map(e => e.kind)).toEqual([
      "series",
      "post",
      "series",
    ]);
  });

  it("honours the limit", () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      newest(`/posts/p${i}`, "go", 10 - i)
    );
    const index = buildSeriesIndex(posts, [BOOK]);
    expect(collapseRecent(index, posts, 4)).toHaveLength(4);
  });
});

describe("file tree", () => {
  it("gives a series folder one sub-folder per part", () => {
    const posts = postsFor(BOOK);
    const folders = buildFolders(buildSeriesIndex(posts, [BOOK]), posts);
    const book = folders.find(f => f.slug === BOOK.tag)!;

    expect(book.isSeries).toBe(true);
    expect(book.count).toBe(39);
    expect(book.landing?.title).toBe(BOOK.landingLabel);
    expect(book.parts?.map(p => p.title)).toEqual([
      "前言",
      "第一部:基礎模式",
      "第二部:進階系統",
      "第三部:上線前的考量",
      "第四部:Multi-Agent 架構",
      "附錄",
      "結尾",
    ]);
    expect(book.parts!.flatMap(p => p.entries)).toHaveLength(38);
  });

  it("leaves a plain tag folder flat and newest-first", () => {
    const posts = [
      makePost("/posts/old", { tag: "go", sortDate: new Date("2020-01-01") }),
      makePost("/posts/new", { tag: "go", sortDate: new Date("2026-01-01") }),
    ];
    const folders = buildFolders(buildSeriesIndex(posts, [BOOK]), posts);
    const go = folders.find(f => f.slug === "go")!;

    expect(go.isSeries).toBe(false);
    expect(go.parts).toBeNull();
    expect(go.entries.map(e => e.href)).toEqual(["/posts/new", "/posts/old"]);
  });

  it("never lists a series post twice", () => {
    const posts = [...postsFor(BOOK), makePost("/posts/solo", { tag: "go" })];
    const folders = buildFolders(buildSeriesIndex(posts, [BOOK]), posts);
    const seen = folders.flatMap(f => [
      ...(f.landing ? [f.landing.href] : []),
      ...f.entries.map(e => e.href),
    ]);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(posts.length);
  });

  it("sorts folders by size then name", () => {
    const posts = [
      ...postsFor(BOOK),
      makePost("/posts/z1", { tag: "zed" }),
      makePost("/posts/a1", { tag: "alpha" }),
    ];
    const folders = buildFolders(buildSeriesIndex(posts, [BOOK]), posts);
    expect(folders.map(f => f.slug)).toEqual([BOOK.tag, "alpha", "zed"]);
  });
});
