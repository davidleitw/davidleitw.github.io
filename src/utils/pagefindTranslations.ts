// Traditional-Chinese UI strings for the Pagefind search widget. Pagefind
// ships Simplified-Chinese defaults for the `zh` language, which clash with the
// site's Traditional-Chinese copy, so we override every visible string.
// Placeholders like [SEARCH_TERM] / [COUNT] are filled in by Pagefind.
export const pagefindTranslations = {
  placeholder: "搜尋文章、筆記、想法⋯",
  clear_search: "清除",
  load_more: "載入更多結果",
  search_label: "搜尋這個網站",
  filters_label: "篩選",
  zero_results: "找不到「[SEARCH_TERM]」的結果",
  many_results: "找到 [COUNT] 筆「[SEARCH_TERM]」的結果",
  one_result: "找到 [COUNT] 筆「[SEARCH_TERM]」的結果",
  alt_search: "找不到「[SEARCH_TERM]」，改顯示「[DIFFERENT_TERM]」的結果",
  search_suggestion: "找不到「[SEARCH_TERM]」的結果，換個關鍵字試試",
  searching: "搜尋「[SEARCH_TERM]」中⋯",
};
