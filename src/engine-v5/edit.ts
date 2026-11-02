/**
 * Engine v5 — one student edit ("make this slide a timeline", "shorter text", "add the 2023 figure"):
 * the slot-filling AI rewrites THIS slide's slots (it may switch to another designed template), then the same
 * deterministic render + auto-fit runs. The slide stays in the deck's theme; no free-form HTML.
 * Decks made before slots were stored (or by other engines) fall back to the v3 designer edit.
 */
import path from "path";
import { editSlide as editSlideV3 } from "../engine-v3/edit";
import { inspectSlide } from "../engine-v3/qa/inspect";
import { chatJson } from "../engine-v3/llm";
import { deckDir, saveDeck } from "../engine-v3/store";
import type { Deck } from "../engine-v3/types";
import { previewFile } from "../engine-v4/pipeline";
import { factsBlock, normalizeOne, resolveIcons } from "./planner";
import { TEMPLATES, templateById, type RenderCtx, type SlideContent } from "./templates";
import { renderFitted } from "./pipeline";
import sharp from "sharp";
import fs from "fs";

export async function editSlideV5(deck: Deck, n: number, instruction: string, emit: (step: string, percent: number, msg: string) => void): Promise<Deck> {
  const cur = deck.slides.find((s) => s.n === n);
  const slot = (cur as any)?.v5;
  const base = (deck as any).v5?.ctx;
  if (!cur || !slot?.content || !base) return editSlideV3(deck, n, instruction, emit);
  const c0: SlideContent = slot.content;
  const fixedRole = n === 1 ? "title" : c0.template === "references" ? "references" : c0.template === "closing" ? "closing" : "";
  const allowed = TEMPLATES.filter((t) => (fixedRole === "title" ? t.family === "title" : fixedRole ? t.id === c0.template : t.family !== "title" && !["references", "closing"].includes(t.id)));
  emit("Rewriting the slide", 20, `Re-filling slide ${n} from your note`);
  const { data } = await chatJson<any>("planner", [
    { role: "system", content: `You edit ONE slide of a designed presentation. The slide is a designer template with content slots. Do exactly what the student asks: change the wording, add/remove points, or switch to another template when they ask for a different layout. Keep facts accurate (use only the facts given; never invent numbers). Write in ${deck.brief.language}. Reply with ONLY the slide JSON (keys: template, title, eyebrow, lede, items, stat, left, right, chart, table, quote, takeaway, term, center, axes, photo_query, notes). Allowed templates and their slots:\n${allowed.map((t) => `${t.id}: ${t.slots}`).join("\n")}` },
    { role: "user", content: `Deck: ${deck.brief.title}. Slide ${n} now:\n${JSON.stringify({ template: c0.template, title: c0.title, eyebrow: c0.eyebrow, lede: c0.lede, items: c0.items, stat: c0.stat, left: c0.left, right: c0.right, chart: c0.chart, table: c0.table, quote: c0.quote, takeaway: c0.takeaway, term: c0.term, center: c0.center, notes: c0.notes })}\n\nThe student asked: """${instruction.slice(0, 500)}"""\n\n${factsBlock(deck.research as any).slice(0, 6000)}` },
  ], { temperature: 0.4, maxTokens: 3000, label: `v5 edit slide ${n}` });
  const next = normalizeOne({ ...data, n }, deck.brief as any, deck.research as any);
  if (!next || !allowed.some((t) => t.id === next.template)) throw new Error("the edit did not produce a usable slide");
  resolveIcons(next);
  const t = templateById(next.template)!;
  const c: SlideContent = { ...next, photo: t.photo !== "none" ? c0.photo : undefined, photoFocus: c0.photoFocus, cites: c0.cites, notes: next.notes || c0.notes } as SlideContent;
  const ctx: RenderCtx = { ...base, n, logo: slot.logo, logoAsset: slot.logoAsset } as RenderCtx;
  emit("Checking the new slide", 60, "Fitting the text and checking contrast");
  const renderDir = path.join(deckDir(deck.id), "render");
  const r = await renderFitted(deck, c, ctx, renderDir, () => {});
  const insp = await inspectSlide(deck, n, r.html, renderDir, t.family);
  try {
    const out = previewFile(deck.id, n);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (insp.screenshot) await sharp(insp.screenshot).resize(1280, 720).jpeg({ quality: 84 }).toFile(out);
  } catch {
    /* previews are rebuilt by the export step anyway */
  }
  const idx = deck.slides.findIndex((s) => s.n === n);
  deck.slides[idx] = { ...cur, html: r.html, notes: c.notes || cur.notes, provider: "engine", model: `v5:${c.template}`, revisions: (cur.revisions || 0) + 1, qa: { domIssues: insp.issues, autoFixes: [...insp.autoFixes, ...r.trims] } } as any;
  (deck.slides[idx] as any).v5 = { ...slot, content: r.content };
  deck.log.push({ t: new Date().toISOString(), agent: "Edit", msg: `slide ${n} (${c0.template} → ${c.template}): ${instruction.slice(0, 160)}` });
  saveDeck(deck);
  return deck;
}
