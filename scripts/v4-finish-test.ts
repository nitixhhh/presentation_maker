
import fs from "fs"; import path from "path"; import sharp from "sharp";
import { loadDeck, deckDir } from "../src/engine-v3/store";
import { finishSlideV4 } from "../src/engine-v4/finish";
import { finalizePlaceholders } from "../src/engine-v4/finalize";
import { inspectSlide } from "../src/engine-v3/qa/inspect";
import { closeBrowser } from "../src/engine-v3/render/browser";
(async () => {
  const id = process.argv[2]; const out = process.argv[3] || "/tmp/fin"; fs.mkdirSync(out, { recursive: true });
  const deck: any = loadDeck(id)!;
  console.log("placeholders:", finalizePlaceholders(deck));
  const files: string[] = [];
  for (const s of deck.slides) {
    const role = deck.outline.slides.find((o: any) => o.n === s.n)?.role || "";
    const r = await finishSlideV4(deck, s.n, s.html, path.join(deckDir(id), "render"), role);
    console.log(s.n, role, r.bottom, r.fixes.join(" | "));
    const insp = await inspectSlide(deck, s.n, r.html, path.join(deckDir(id), "render"), role);
    const f = path.join(out, `s${s.n}.jpg`); fs.writeFileSync(f, insp.screenshot); files.push(f);
    console.log("   issues:", insp.issues.filter((i: any) => i.severity !== "low").map((i: any) => `${i.severity}:${i.type}`).join(", "));
  }
  const cols = 3, tw = 640, th = 360, pad = 10, rows = Math.ceil(files.length / cols);
  const comps = await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(tw, th).toBuffer(), left: pad + (i % cols) * (tw + pad), top: pad + Math.floor(i / cols) * (th + pad) })));
  await sharp({ create: { width: pad + cols * (tw + pad), height: pad + rows * (th + pad), channels: 3, background: "#9ca3af" } }).composite(comps).jpeg({ quality: 82 }).toFile(path.join(out, "sheet.jpg"));
  await closeBrowser();
})();
