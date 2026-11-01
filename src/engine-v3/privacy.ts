/**
 * Engine v3 — keep student personal details (names, roll numbers, guide, institute …) out of AI prompts.
 *
 * Free AI tiers may keep prompts (Google AI Studio / Mistral free terms), so the title-slide details are built in
 * code and the designer only ever sees placeholders like {{P1}} with the value's length. The engine puts the real
 * text back into the slide HTML after every AI reply, and swaps it out again before a slide goes back to an AI
 * (revisions, edits). The rendered slide, QA and exports always carry the real details.
 */
import type { PresenterInfo } from "./types";

export type Field = { label: string; value: string };

const LABELS: [keyof PresenterInfo, string][] = [
  ["names", "Presented by"],
  ["rollNo", "Roll No."],
  ["course", "Course"],
  ["department", "Department"],
  ["institute", "Institute"],
  ["guide", "Under the guidance of"],
  ["date", "Date"],
];

/** Title-slide fields straight from what the student typed (exact text, fixed labels, no AI). */
export function presenterFields(p?: PresenterInfo | null): Field[] {
  if (!p) return [];
  const out: Field[] = [];
  for (const [k, label] of LABELS) {
    const v = String((p as any)[k] || "").replace(/\s+/g, " ").trim();
    if (v) out.push({ label, value: v.slice(0, 300) });
  }
  return out;
}

export const token = (i: number) => `{{P${i + 1}}}`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Fields as the AI sees them: label + placeholder + length hint. */
export function maskedFieldLines(fields: Field[]): string {
  return fields.map((f, i) => `  ${f.label}: ${token(i)}   (placeholder — the engine prints the real ${f.value.length}-character text here; size the box for that length)`).join("\n");
}

/** Put the real text back in place of the placeholders (HTML-escaped). */
export function fillPlaceholders(html: string, fields: Field[]): string {
  let out = html;
  fields.forEach((f, i) => {
    out = out.split(token(i)).join(esc(f.value));
  });
  return out;
}

/** Replace the real text with placeholders again before HTML or text goes back to an AI. */
export function maskText(text: string, fields: Field[]): string {
  let out = text;
  // longest first so "Priya Sen (Roll 23CSE057)" is replaced before "Priya Sen"
  const order = fields.map((f, i) => ({ f, i })).sort((a, b) => b.f.value.length - a.f.value.length);
  for (const { f, i } of order) {
    if (f.value.length < 2) continue;
    out = out.split(esc(f.value)).join(token(i));
    if (esc(f.value) !== f.value) out = out.split(f.value).join(token(i));
  }
  return out;
}

/** Placeholders the AI was asked to print but left out of the slide. */
export function missingPlaceholders(html: string, fields: Field[]): number[] {
  return fields.map((_, i) => i).filter((i) => !html.includes(token(i)));
}

/**
 * Safety net: if the designer dropped some details, add them in a small block at the bottom-left so the title
 * slide always carries every detail the student typed (the QA loop then checks it for overlaps like any text).
 */
export function ensureFields(html: string, fields: Field[], missing: number[]): string {
  if (!missing.length) return html;
  const rows = missing.map((i) => `<div><small style="opacity:.7;font-size:15px">${esc(fields[i].label)}</small> <strong style="font-size:19px">${token(i)}</strong></div>`).join("");
  return `${html}\n<div class="presenter-details" style="position:absolute;left:72px;bottom:48px;width:760px;display:flex;flex-direction:column;gap:6px;color:var(--ink,#111);background:color-mix(in srgb,var(--bg,#fff) 88%,transparent);padding:12px 18px;border-radius:10px">${rows}</div>`;
}
