/** Engine v4 — render every diagram kind + icons locally (no AI calls). npx tsx scripts/v4-render-test.ts <outdir> */
import fs from "fs";
import path from "path";
import { buildDesignSystem, FONT_PAIRS } from "../src/engine-v3/agents/artDirector";
import { openSlide, closePage, closeBrowser } from "../src/engine-v3/render/browser";
import { slideDocument } from "../src/engine-v3/render/document";
import { makeDiagram } from "../src/engine-v4/diagrams";

const out = process.argv[2] || "/tmp/v4render";
fs.mkdirSync(out, { recursive: true });
const dark = process.argv[3] === "dark";
const design = buildDesignSystem({
  name: "Test",
  mood: "clean",
  dark,
  palette: dark ? { bg: "#0f172a", surface: "#1e293b", ink: "#f1f5f9", muted: "#94a3b8", primary: "#38bdf8", accent: "#f59e0b", accent2: "#a78bfa" } : { bg: "#ffffff", surface: "#f8fafc", ink: "#0f172a", muted: "#475569", primary: "#1d4ed8", accent: "#f59e0b", accent2: "#0d9488" },
  font: FONT_PAIRS[0],
  motif: "thin rule",
  rules: [],
});
const box = { left: 80, top: 150, width: 1120, height: 500 };
const specs: [string, any][] = [
  ["tree", { kind: "tree", box, items: [{ title: "Living things", icon: "leaf" }, { title: "Plants", parent: "Living things", icon: "sprout" }, { title: "Animals", parent: "Living things", icon: "paw" }, { title: "Fungi", parent: "Living things" }, { title: "Mammals", parent: "Animals" }, { title: "Birds", parent: "Animals", icon: "bird" }] }],
  ["matrix", { kind: "matrix", box, axes: { x: "Effort", y: "Impact" }, items: [{ title: "Big bets", desc: "high impact, high effort", icon: "rocket" }, { title: "Quick wins", desc: "high impact, low effort", icon: "zap", highlight: true }, { title: "Money pits", desc: "low impact, high effort", icon: "trash" }, { title: "Fill-ins", desc: "low impact, low effort", icon: "clock" }] }],
  ["sequence", { kind: "sequence", box, actors: ["Browser", "Server", "Database"], items: [{ from: "Browser", to: "Server", title: "GET /deck" }, { from: "Server", to: "Database", title: "query slides" }, { from: "Database", to: "Server", title: "rows", desc: "reply" }, { from: "Server", to: "Browser", title: "HTML page", desc: "reply" }] }],
  ["line", { kind: "chart", chart: "line", box, items: [{ title: "2019", value: 12 }, { title: "2020", value: 18 }, { title: "2021", value: 25 }, { title: "2022", value: 31 }, { title: "2023", value: 44, unit: "%" }] }],
  ["donut", { kind: "chart", chart: "donut", box, items: [{ title: "Coal", value: 45, unit: "%" }, { title: "Solar", value: 25, unit: "%" }, { title: "Wind", value: 18, unit: "%" }, { title: "Hydro", value: 12, unit: "%" }] }],
  ["stacked", { kind: "chart", chart: "stacked", box, series: ["Urban", "Rural"], items: [{ title: "2001", values: [28, 72] }, { title: "2011", values: [31, 69] }, { title: "2021", values: [35, 65] }] }],
  ["cycle", { kind: "cycle", box, items: [{ title: "Evaporation", icon: "sun" }, { title: "Condensation", icon: "cloud" }, { title: "Precipitation", icon: "cloud-rain" }, { title: "Collection", icon: "waves" }] }],
  ["hub", { kind: "hub", box, items: [{ title: "Black hole", icon: "orbit" }, { title: "Event horizon", desc: "point of no return" }, { title: "Singularity", desc: "infinite density" }, { title: "Accretion disk", desc: "hot gas spiral" }, { title: "Jets", desc: "beams of particles" }] }],
  ["flow", { kind: "flow", box, items: [{ title: "Input", icon: "keyboard" }, { title: "Process", icon: "cpu" }, { title: "Output", icon: "monitor" }] }],
  ["mermaid", { kind: "mermaid", box, code: "flowchart LR\n  A[Input image] --> B{Face found?}\n  B -- Yes --> C[Crop and align]\n  B -- No --> D[Skip frame]\n  C --> E[Recognise]" }],
  ["mermaid-seq", { kind: "mermaid", box, code: "sequenceDiagram\n  participant U as User\n  participant S as Server\n  U->>S: Login request\n  S-->>U: OTP sent\n  U->>S: OTP\n  S-->>U: Welcome" }],
];
(async () => {
  for (const [name, spec] of specs) {
    const r = await makeDiagram(spec, design);
    if (!r.markup) {
      console.log(name, "NO MARKUP", r.warnings);
      continue;
    }
    const html = `<style>.slide .t{position:absolute;left:80px;top:48px;width:1120px}.slide .t h2{font-size:48px;color:var(--ink)}.slide .t i{width:44px;height:44px;color:var(--accent);margin-right:12px}</style><div class="t"><h2><i class="ic" data-icon="lucide:sparkles"></i>${name} diagram</h2></div>${r.markup}`;
    const page = await openSlide(slideDocument(design, html, { assetBase: "./", deck: { assets: [] }, n: 2 }), out, name);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    await closePage(page);
    console.log(name, "ok", r.warnings.join("; "), r.icons.join(","));
  }
  await closeBrowser();
})();
