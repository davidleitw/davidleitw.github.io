import type { SeriesDefinition } from "./types";
import { agenticDesignPatterns } from "./agentic-design-patterns";
import { hermesFromZero } from "./hermes-from-zero";

/** Every series on the site. Adding one here is the only step needed —
 *  navigation, the file tree and the collapsed recent lists all read from it. */
export const SERIES_DEFINITIONS: SeriesDefinition[] = [
  agenticDesignPatterns,
  hermesFromZero,
];

export type { SeriesDefinition, SeriesPart } from "./types";
