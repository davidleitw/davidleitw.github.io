/**
 * A series is a run of posts that reads as one ordered document — a translated
 * book, a day-by-day build log. Unlike a tag, the order matters and the parts
 * are not interchangeable.
 *
 * The manifest below is the single source of truth for that order. Publish
 * dates deliberately play no part: they used to encode reading order by hand,
 * which broke silently whenever a date moved.
 */

export type SeriesPart = {
  /** Part heading. Omit for a series that isn't divided into parts. */
  title?: string;
  /** Post paths in reading order, as they appear in the browser. */
  hrefs: string[];
};

export type SeriesDefinition = {
  id: string;
  /** Full display name, used in lists and collapsed entries. */
  name: string;
  /** Short name for the compact in-article header. */
  shortName: string;
  /** The index / table-of-contents post. Also the series entry point. */
  landing: string;
  /** Short label for the landing post, used when linking back to it. */
  landingLabel: string;
  /** Tag slug this series groups under in the /posts file tree. */
  tag: string;
  /** Counter word for prev/next labels — 章 for a book, 天 for a log. */
  unitLabel: string;
  /**
   * Heading on the landing post that introduces the hand-written table of
   * contents. The build compares the links under it against `parts`, so the
   * two can never drift apart. Omit to skip that check.
   */
  tocHeading?: string;
  /** Redundant prefix to strip from entry titles ("Agentic Design Patterns"). */
  stripTitlePrefix?: string;
  parts: SeriesPart[];
};
