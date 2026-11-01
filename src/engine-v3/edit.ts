/**
 * Engine v3 — one paid edit: the student says what to change on one slide; the designer AI redoes that
 * slide (same deck design system, same facts and citations), then the normal render → DOM check → revise loop.
 */
import path from "path";
import { designerSystemPrompt, designerUserPrompt, parseDesign, reviseSlide, usableDesign, type DesignOut } from "./agents/designer";
import { chat, type Msg } from "./llm";
import { inspectSlide } from "./qa/inspect";
import { deckDir, saveDeck } from "./store";
import type { Deck } from "./types";

export async function editSlide(deck: Deck, n: number, instruction: string, emit: (step: string, percent: number, msg: string) => void): Promise<Deck> {
  const os = deck.outline.slides.find((s) => s.n === n);
  const cur = deck.slides.find((s) => s.n === n);
  if (!os || !cur) throw new Error("slide not found");
  const citeMap = new Map(deck.references.map((r) => [r.sourceId, r.n]));
  const messages: Msg[] = [
    { role: "system", content: designerSystemPrompt(deck.design, deck.brief) },
    { role: "user", content: designerUserPrompt(deck, os, citeMap) },
    { role: "assistant", content: `<slide>\n${cur.html}\n</slide>\n<notes>${cur.notes || ""}</notes>` },
    {
      role: "user",
      content: `The student looked at this slide and asked for a change:\n"""${instruction.slice(0, 500)}"""\n\nRedo the slide so it does exactly what they asked, while staying in the deck's design system (palette, fonts, motif) and keeping facts accurate and citations correct. Do not invent numbers or facts that are not in the brief/research. If the request conflicts with accuracy, follow accuracy and do the closest honest version. Update the speaker notes if the content changed. Output the complete <slide>…</slide><notes>…</notes>.`,
    },
  ];
  emit("Redesigning the slide", 20, `Designer is redoing slide ${n}`);
  const r = await chat("design", messages, { temperature: 0.6, maxTokens: 12000, timeoutMs: 240_000, label: `edit slide ${n}`, reasoning: (process.env.V3_DESIGN_REASONING as any) || "medium", validate: usableDesign });
  const parsed = parseDesign(r.text);
  if (parsed.html.length < 200) throw new Error("designer produced no usable HTML for the edit");
  let d: DesignOut = { html: parsed.html, notes: parsed.notes || cur.notes || "", provider: r.provider, model: r.model, messages: [...messages, { role: "assistant", content: r.text }] };
  const renderDir = path.join(deckDir(deck.id), "render");
  let insp = await inspectSlide(deck, n, d.html, renderDir, os.role);
  for (let round = 0; round < 2; round++) {
    const serious = insp.issues.filter((x) => x.severity === "high");
    emit("Checking the new slide", 55 + round * 15, `round ${round + 1}: ${serious.length} serious issues`);
    if (!serious.length) break;
    d = await reviseSlide({ ...d, html: insp.html }, insp.issues.map((x) => `- [${x.severity}] ${x.detail}`).join("\n"));
    insp = await inspectSlide(deck, n, d.html, renderDir, os.role);
  }
  const idx = deck.slides.findIndex((s) => s.n === n);
  deck.slides[idx] = { ...cur, html: insp.html, notes: d.notes, provider: d.provider, model: d.model, revisions: (cur.revisions || 0) + 1, qa: { domIssues: insp.issues, autoFixes: insp.autoFixes } };
  deck.log.push({ t: new Date().toISOString(), agent: "Edit", msg: `slide ${n}: ${instruction.slice(0, 160)}` });
  saveDeck(deck);
  return deck;
}
