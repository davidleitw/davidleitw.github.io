import type { SeriesDefinition } from "./types";

const P = "/posts/agentic-design-patterns";

/** Reading order follows the original book: front matter, four parts,
 *  appendices, back matter. Keep this in sync with the table of contents on
 *  the landing post — the build fails if the two diverge. */
export const agenticDesignPatterns: SeriesDefinition = {
  id: "agentic-design-patterns",
  name: "Agentic Design Patterns 繁中翻譯",
  shortName: "Agentic Design Patterns",
  landing: P,
  landingLabel: "全書目錄",
  tag: "agentic-design-patterns",
  unitLabel: "章",
  tocHeading: "全書目錄",
  stripTitlePrefix: "Agentic Design Patterns",
  parts: [
    {
      title: "前言",
      hrefs: [
        `${P}/dedication`,
        `${P}/acknowledgment`,
        `${P}/foreword`,
        `${P}/a-thought-leaders-perspective`,
        `${P}/introduction`,
        `${P}/what-makes-an-ai-system-an-agent`,
      ],
    },
    {
      title: "第一部:基礎模式",
      hrefs: [
        `${P}/chapter-01-prompt-chaining`,
        `${P}/chapter-02-routing`,
        `${P}/chapter-03-parallelization`,
        `${P}/chapter-04-reflection`,
        `${P}/chapter-05-tool-use`,
        `${P}/chapter-06-planning`,
        `${P}/chapter-07-multi-agent-collaboration`,
      ],
    },
    {
      title: "第二部:進階系統",
      hrefs: [
        `${P}/chapter-08-memory-management`,
        `${P}/chapter-09-learning-and-adaptation`,
        `${P}/chapter-10-mcp`,
        `${P}/chapter-11-goal-setting-and-monitoring`,
      ],
    },
    {
      title: "第三部:上線前的考量",
      hrefs: [
        `${P}/chapter-12-exception-handling-and-recovery`,
        `${P}/chapter-13-human-in-the-loop`,
        `${P}/chapter-14-knowledge-retrieval-rag`,
      ],
    },
    {
      title: "第四部:Multi-Agent 架構",
      hrefs: [
        `${P}/chapter-15-inter-agent-communication-a2a`,
        `${P}/chapter-16-resource-aware-optimization`,
        `${P}/chapter-17-reasoning-techniques`,
        `${P}/chapter-18-guardrails-safety-patterns`,
        `${P}/chapter-19-evaluation-and-monitoring`,
        `${P}/chapter-20-prioritization`,
        `${P}/chapter-21-exploration-and-discovery`,
      ],
    },
    {
      title: "附錄",
      hrefs: [
        `${P}/appendix-a-advanced-prompting-techniques`,
        `${P}/appendix-b-ai-agentic-interactions`,
        `${P}/appendix-c-agentic-frameworks-overview`,
        `${P}/appendix-d-building-an-agent-with-agentspace`,
        `${P}/appendix-e-ai-agents-on-the-cli`,
        `${P}/appendix-f-under-the-hood`,
        `${P}/appendix-g-coding-agents`,
      ],
    },
    {
      title: "結尾",
      hrefs: [
        `${P}/conclusion`,
        `${P}/faq`,
        `${P}/glossary`,
        `${P}/index-of-terms`,
      ],
    },
  ],
};
