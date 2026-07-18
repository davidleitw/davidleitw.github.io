import type { SeriesDefinition } from "./types";

/** Day 01 … Day 15, flat files at the top of the blog directory. */
const days = Array.from(
  { length: 15 },
  (_, i) => `/posts/hermes-from-zero-day${String(i + 1).padStart(2, "0")}`
);

export const hermesFromZero: SeriesDefinition = {
  id: "hermes-from-zero",
  name: "Hermes From Zero",
  shortName: "Hermes From Zero",
  landing: "/posts/hermes-from-zero",
  landingLabel: "系列總覽",
  tag: "hermes-from-zero",
  unitLabel: "天",
  tocHeading: "15 天清單",
  // One undivided run — the header shows no part name.
  parts: [{ hrefs: days }],
};
