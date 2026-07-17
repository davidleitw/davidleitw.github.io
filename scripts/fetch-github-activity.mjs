/**
 * Fetch the GitHub contribution calendar for SITE author and write a static
 * snapshot to src/data/github-activity.json. Runs at build time (CI daily
 * schedule) — visitors never hit any API.
 *
 * Data source priority:
 *   1. GitHub GraphQL API (needs GITHUB_TOKEN, present in Actions)
 *   2. Public mirror api (github-contributions-api.jogruber.de) for local runs
 *   3. Keep the previous snapshot on any failure (never break the build)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LOGIN = "davidleitw";
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "github-activity.json"
);

async function fromGraphQL(token) {
  const query = `query {
    user(login: "${LOGIN}") {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { contributionCount date } }
        }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) throw new Error("GraphQL: unexpected shape");
  return {
    total: cal.totalContributions,
    days: cal.weeks.flatMap(w =>
      w.contributionDays.map(d => ({ date: d.date, count: d.contributionCount }))
    ),
  };
}

async function fromPublicMirror() {
  const res = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${LOGIN}?y=last`
  );
  if (!res.ok) throw new Error(`mirror HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.contributions)) throw new Error("mirror: bad shape");
  return {
    total: json.total?.lastYear ?? 0,
    days: json.contributions.map(d => ({ date: d.date, count: d.count })),
  };
}

function toSnapshot({ total, days }) {
  // Keep the most recent 20 full weeks, grouped Sunday-first like GitHub.
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const weeks = [];
  let week = [];
  for (const day of sorted) {
    const dow = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    if (dow === 0 && week.length > 0) {
      weeks.push(week);
      week = [];
    }
    week.push(day.count);
  }
  if (week.length > 0) weeks.push(week);
  const recent = weeks.slice(-20);
  const recentTotal = recent.flat().reduce((a, b) => a + b, 0);
  // 4 intensity levels relative to this window's own max
  const max = Math.max(1, ...recent.flat());
  const levels = recent.map(w =>
    w.map(c =>
      c === 0 ? 0 : c <= max * 0.25 ? 1 : c <= max * 0.5 ? 2 : c <= max * 0.75 ? 3 : 4
    )
  );
  return {
    login: LOGIN,
    updated: new Date().toISOString().slice(0, 10),
    yearTotal: total,
    windowWeeks: recent.length,
    windowTotal: recentTotal,
    counts: recent,
    levels,
  };
}

try {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const raw = token ? await fromGraphQL(token) : await fromPublicMirror();
  writeFileSync(OUT, JSON.stringify(toSnapshot(raw), null, 2) + "\n");
  console.log(`github-activity.json updated (${raw.total} contributions/yr)`);
} catch (err) {
  try {
    readFileSync(OUT);
    console.warn(`fetch failed (${err.message}) — keeping previous snapshot`);
  } catch {
    console.error(`fetch failed (${err.message}) and no previous snapshot exists`);
    process.exit(1);
  }
}
