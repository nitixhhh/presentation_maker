#!/usr/bin/env -S npx tsx
/**
 * CLI: search and render icons.
 *   npx tsx search-icons.ts gpu "chart up" paisa          # top 5 per query
 *   npx tsx search-icons.ts --limit 3 --json planet
 *   npx tsx search-icons.ts --svg lucide:cpu --size 64 --color "#2563eb"
 *   npx tsx search-icons.ts --info
 */
import { searchIcons, getIcon, iconLibraryInfo } from "./icons";

const argv = process.argv.slice(2);
let limit = 5, json = false, size = 48, color: string | undefined, svgName: string | undefined, style: "outline" | "filled" = "outline";
const queries: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--limit") limit = Number(argv[++i]);
  else if (a === "--json") json = true;
  else if (a === "--svg") svgName = argv[++i];
  else if (a === "--size") size = Number(argv[++i]);
  else if (a === "--color") color = argv[++i];
  else if (a === "--filled") style = "filled";
  else if (a === "--info") { console.log(JSON.stringify(iconLibraryInfo(), null, 2)); process.exit(0); }
  else queries.push(a);
}
if (svgName) {
  const svg = getIcon(svgName, { size, color });
  if (!svg) { console.error(`unknown icon: ${svgName}`); process.exit(1); }
  console.log(svg);
  process.exit(0);
}
if (!queries.length) { console.error("usage: search-icons.ts [--limit N] [--json] [--filled] <query> ... | --svg <id> | --info"); process.exit(2); }
const t0 = performance.now();
const results = queries.map((q) => ({ query: q, hits: searchIcons(q, limit, { style }) }));
const ms = performance.now() - t0;
if (json) console.log(JSON.stringify(results, null, 2));
else {
  for (const r of results) console.log(`${r.query.padEnd(16)} ${r.hits.map((h) => `${h.id} (${h.score})`).join(", ")}`);
  console.error(`${queries.length} queries in ${ms.toFixed(1)} ms`);
}
