import type { CollectionEntry } from "astro:content";
import { SERIES_DEFINITIONS } from "@/data/series";
import { getPath } from "../getPath";
import { slugifyStr } from "../slugify";
import {
  assertLandingTocMatches,
  buildSeriesIndex,
  type SeriesIndex,
  type SeriesPost,
} from "./core";

export {
  buildSeriesIndex,
  cleanTitle,
  extractTocLinks,
  assertLandingTocMatches,
  getSeriesContext,
} from "./core";
export type {
  SeriesContext,
  SeriesEntry,
  SeriesIndex,
  SeriesPost,
} from "./core";
export { buildFolders, collapseRecent, displayName } from "./tree";
export type { RecentEntry, TreeEntry, TreeFolder } from "./tree";

/** Map a content-collection entry onto the minimal shape the series logic
 *  works with, so nothing below this file depends on Astro. */
export function toSeriesPosts(posts: CollectionEntry<"blog">[]): SeriesPost[] {
  return posts.map(p => ({
    href: getPath(p.id, p.filePath),
    title: p.data.title,
    date: new Date(p.data.pubDatetime),
    sortDate: new Date(p.data.modDatetime ?? p.data.pubDatetime),
    tag: slugifyStr(p.data.tags?.[0] ?? "misc"),
    description: p.data.description,
  }));
}

// Every page builds its own index; without this the same warnings would print
// once per generated page.
const reported = new Set<string>();

function report(index: SeriesIndex) {
  for (const d of index.diagnostics) {
    const line = `[series:${d.seriesId}] ${d.message}`;
    if (reported.has(line)) continue;
    reported.add(line);
    // Build-time only: the build log is the whole point of these diagnostics.
    // eslint-disable-next-line no-console
    console.warn(line);
  }
}

/**
 * Build the series index for a set of posts and check it against the
 * hand-written tables of contents. Pass posts that have already been filtered
 * (drafts and scheduled posts removed) — an unpublished chapter should drop
 * out of the reading order rather than render as a dead link.
 */
export function getSeriesData(posts: CollectionEntry<"blog">[]) {
  const seriesPosts = toSeriesPosts(posts);
  const index = buildSeriesIndex(seriesPosts, SERIES_DEFINITIONS);

  for (const def of SERIES_DEFINITIONS) {
    if (!def.tocHeading) continue;
    const landing = posts.find(p => getPath(p.id, p.filePath) === def.landing);
    if (landing?.body) assertLandingTocMatches(def, landing.body);
  }

  report(index);
  return { index, seriesPosts };
}
