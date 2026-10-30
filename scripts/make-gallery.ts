/**
 * Homepage gallery from real engine-made decks (no hand editing):
 *   npx tsx scripts/make-gallery.ts <deckId> [<deckId> ...]
 * Copies each deck's rendered slide previews into public/gallery/<id>/ and writes public/gallery/index.json.
 */
import fs from "fs";
import path from "path";
import { loadDeck, deckDir } from "../src/engine-v3/store";

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error("usage: npx tsx scripts/make-gallery.ts <deckId> ...");
  process.exit(1);
}
const out = path.join(process.cwd(), "public", "gallery");
fs.mkdirSync(out, { recursive: true });
const indexFile = path.join(out, "index.json");
const index: { samples: any[] } = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : { samples: [] };
for (const id of ids) {
  const deck = loadDeck(id);
  if (!deck) {
    console.error(`deck ${id} not found`);
    continue;
  }
  const dir = path.join(out, id);
  fs.mkdirSync(dir, { recursive: true });
  const slides: string[] = [];
  for (const s of deck.slides) {
    const src = path.join(deckDir(id), "previews", `slide-${String(s.n).padStart(2, "0")}.jpg`);
    if (!fs.existsSync(src)) continue;
    const name = `slide-${String(s.n).padStart(2, "0")}.jpg`;
    fs.copyFileSync(src, path.join(dir, name));
    slides.push(`/gallery/${id}/${name}`);
  }
  index.samples = index.samples.filter((x) => x.id !== id);
  index.samples.push({ id, title: deck.brief.title, topic: deck.request.topic, language: deck.brief.language, slides });
  console.log(`added ${deck.brief.title} (${slides.length} slides)`);
}
fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
