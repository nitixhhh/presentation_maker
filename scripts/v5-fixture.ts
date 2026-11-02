/** Engine v5 — render every template with fixture content (no AI). npx tsx scripts/v5-fixture.ts <outdir> [theme] [lang] */
import fs from "fs";
import path from "path";
import { THEMES, themeById, themeDesignSystem } from "../src/engine-v5/themes";
import { TEMPLATES, type SlideContent } from "../src/engine-v5/templates";
import { renderSlide } from "../src/engine-v5/render";
import { fitSlide } from "../src/engine-v5/fit";
import { closeBrowser } from "../src/engine-v3/render/browser";
import { searchCommons, download, store } from "../src/engine-v3/assets/images";

const out = process.argv[2] || "/tmp/v5fix";
const themeId = process.argv[3] || "aurora";
const lang = process.argv[4] || "English";
fs.mkdirSync(path.join(out, "assets"), { recursive: true });
fs.mkdirSync(path.join(out, "render"), { recursive: true });

const FIX: Record<string, Partial<SlideContent>> = JSON.parse(fs.readFileSync(path.join(__dirname, "v5-fixture.json"), "utf8"))[lang] || {};

(async () => {
  const theme = themeById(themeId) || THEMES[0];
  const design = themeDesignSystem(theme, lang);
  const assets: any[] = [];
  const photoQ = ["black hole illustration", "Event Horizon Telescope", "Albert Einstein portrait"];
  const cache = path.join(out, "assets", "img1.jpg");
  if (!fs.existsSync(cache)) {
    let k = 0;
    for (const q of photoQ) {
      const c = (await searchCommons(q, 4))[0];
      if (!c) continue;
      const buf = await download(c.url);
      if (!buf) continue;
      k++;
      const s = await store(buf, path.join(out, "assets"), `img${k}`);
      if (s) fs.writeFileSync(path.join(out, "assets", `img${k}.json`), JSON.stringify({ ...s, title: c.title }));
    }
  }
  for (const f of fs.readdirSync(path.join(out, "assets")).filter((f) => f.endsWith(".json"))) {
    const m = JSON.parse(fs.readFileSync(path.join(out, "assets", f), "utf8"));
    assets.push({ id: f.replace(".json", ""), file: m.file, mime: "image/jpeg", width: m.width, height: m.height, avgColor: m.avgColor, origin: "wikimedia", title: m.title, description: "", forSlides: [] });
  }
  const deck: any = { assets, design, engine: "v5" };
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  let n = 0;
  for (const t of TEMPLATES) {
    if (only && !only.includes(t.id)) continue;
    n++;
    const c = { template: t.id, title: "Untitled", ...(FIX[process.env[`ALT_${t.id.replace(/-/g, "_")}`] || t.id] || {}), } as SlideContent;
    if (t.photo !== "none" && !c.photo && (t.photo === "required" || FIX[t.id]?.photo !== "")) c.photo = c.photo ?? (assets[0]?.id);
    const html = renderSlide(c, {
      theme, deckTitle: "Black Holes: Where Space and Time Break Down", n, total: TEMPLATES.length,
      fields: process.env.MANY_FIELDS ? [{ label: "Presented by", value: "Karan Mehta" }, { label: "Roll No.", value: "MBA24-118" }, { label: "Course", value: "MBA (Finance), Semester 2" }, { label: "Institute", value: "Example Institute of Technology & Management" }, { label: "Guide", value: "Dr. S. Iyer" }] : [{ label: "Presented by", value: "Rahul Das" }, { label: "Roll No.", value: "23CSE041" }, { label: "Course", value: "B.Sc. Physics, Semester 5" }, { label: "Institute", value: "Presidency University, Kolkata" }],
      logo: false, language: lang, deckType: "Seminar presentation", deckIcons: ["lucide:orbit", "lucide:telescope", "lucide:atom"], heroPhoto: process.env.HERO_PHOTO || undefined,
      references: [{ n: 1, text: "Wikipedia contributors. Black hole. Wikipedia, The Free Encyclopedia. https://en.wikipedia.org/wiki/Black_hole (accessed 2 Nov 2026)." }, { n: 2, text: "Event Horizon Telescope Collaboration (2019). First M87 Event Horizon Telescope Results. I. The Shadow of the Supermassive Black Hole. The Astrophysical Journal Letters, 875(1), L1." }, { n: 3, text: "Hawking, S. W. (1974). Black hole explosions? Nature, 248, 30–31." }, { n: 4, text: "Abbott, B. P. et al. (2016). Observation of Gravitational Waves from a Binary Black Hole Merger. Physical Review Letters, 116, 061102." }],
      credits: ["“Black hole illustration” — NASA, public domain, via Wikimedia Commons"],
    });
    const r = await fitSlide(deck, n, html, path.join(out, "render"), { shot: true });
    fs.writeFileSync(path.join(out, `${String(n).padStart(2, "0")}-${t.id}.jpg`), r.screenshot!);
    console.log(t.id.padEnd(16), `s=${r.s} ts=${r.ts} fill=${r.fill}`, r.overflow.length ? "OVERFLOW " + JSON.stringify(r.overflow) : "");
  }
  await closeBrowser();
})();
