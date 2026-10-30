/** Engine v3 — References slide is built by the engine so citations are always exact (never re-written by an LLM). */
import type { Deck } from "../types";

const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

export function referencesSlideHtml(deck: Pick<Deck, "references" | "assets" | "brief">, title: string): string {
  const refs = deck.references;
  const credits = deck.assets.filter((a) => a.credit).map((a) => (a.origin === "generated" ? a.credit || "" : `“${a.title.replace(/[_]+/g, " ").slice(0, 40)}${a.title.length > 40 ? "…" : ""}” — ${a.credit || ""}`));
  const chars = refs.reduce((s, r) => s + r.text.length, 0) + credits.reduce((s, c) => s + c.length, 0) * 0.6;
  const twoCol = refs.length > 4 || chars > 900;
  const fs = chars > 2200 ? 14 : chars > 1500 ? 15 : chars > 900 ? 16 : 18;
  const items = refs
    .map((r) => `<li><span class="ref-n">[${r.n}]</span><p class="ref-t">${esc(r.text)}</p></li>`)
    .join("");
  const cr = credits.length
    ? `<div class="ref-credits"><h4>Image credits</h4>${credits.map((c) => `<p>${esc(c)}</p>`).join("")}</div>`
    : "";
  return `<style>
.slide .ref-bar{position:absolute;left:72px;top:64px;width:96px;height:6px;border-radius:3px;background:var(--accent)}
.slide .ref-title{position:absolute;left:72px;top:84px;font-size:48px;color:var(--ink)}
.slide .ref-num{position:absolute;right:72px;top:60px;font-family:var(--font-heading);font-size:120px;line-height:1;color:var(--primary);opacity:.12}
.slide .ref-list{position:absolute;left:72px;right:72px;top:170px;list-style:none;padding:0;margin:0;columns:${twoCol ? 2 : 1};column-gap:56px}
.slide .ref-list li{display:flex;gap:12px;break-inside:avoid;margin:0 0 ${Math.round(fs * 0.8)}px 0}
.slide .ref-n{flex:0 0 auto;font-weight:700;color:var(--primary);font-size:${fs}px;line-height:1.4}
.slide .ref-t{font-size:${fs}px;line-height:1.4;color:var(--ink);overflow-wrap:anywhere}
.slide .ref-credits{position:absolute;left:72px;right:72px;bottom:40px;border-top:1px solid color-mix(in srgb,var(--muted) 35%,transparent);padding-top:10px;columns:2;column-gap:56px}
.slide .ref-credits h4{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 4px 0;column-span:all}
.slide .ref-credits p{font-size:12px;line-height:1.35;color:var(--muted);margin:0 0 2px 0;overflow-wrap:anywhere}
</style>
<div class="ref-bar"></div><h2 class="ref-title">${esc(title)}</h2>
<ol class="ref-list">${items}</ol>${cr}`;
}
