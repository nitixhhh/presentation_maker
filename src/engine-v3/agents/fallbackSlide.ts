/**
 * Engine v3 — last-resort slide. Used ONLY when every AI designer failed to return a usable slide for
 * this one slide (after the scheduler tried every model and one fresh retry). A finished deck with one
 * calm, on-brand slide beats a failed deck. It follows the deck's design system (palette, fonts, accent),
 * carries the slide's real points and citations, and still goes through the normal render + QA checks.
 */
import type { Deck, OutlineSlide } from "../types";

const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function fallbackSlideHtml(deck: Pick<Deck, "assets" | "brief" | "research">, os: OutlineSlide, citeMap: Map<string, number>): string {
  const img = deck.assets.find((a) => a.forSlides.includes(os.n));
  const factSrc = new Map((deck.research?.facts || []).map((f) => [f.id, f.sources]));
  const cite = (p: OutlineSlide["points"][number]) => {
    const ns = [...new Set((p.factIds || []).flatMap((id) => factSrc.get(id) || []).map((sid) => citeMap.get(sid)).filter((n): n is number => !!n))].sort((a, b) => a - b);
    return ns.length ? ` <sup class="fb-cite">[${ns.join(", ")}]</sup>` : "";
  };
  const isTitle = os.role === "title" || os.n === 1;
  const isClosing = /closing|thank/i.test(os.role) || /thank you|questions/i.test(os.title);
  if (isTitle || isClosing) {
    const sub = isTitle ? deck.brief.subtitle || os.keyMessage : os.keyMessage;
    return `<style>
.slide .fb-hero{position:absolute;inset:0;${img ? `background:linear-gradient(90deg,var(--bg) 0%,var(--bg) 46%,transparent 76%),url(asset:${img.id}) right center/cover no-repeat;` : "background:var(--bg);"}}
.slide .fb-bar{position:absolute;left:88px;top:250px;width:120px;height:8px;border-radius:4px;background:var(--accent)}
.slide .fb-h{position:absolute;left:88px;top:278px;width:${img ? 600 : 1000}px;font-size:${(os.title || "").length > 40 ? 52 : 64}px;line-height:1.08;color:var(--ink);margin:0}
.slide .fb-sub{position:absolute;left:88px;top:470px;width:${img ? 560 : 900}px;font-size:24px;line-height:1.4;color:var(--muted);margin:0}
</style>
<div class="fb-hero"></div><div class="fb-bar"></div><h1 class="fb-h">${esc(isTitle ? deck.brief.title || os.title : os.title)}</h1>${sub ? `<p class="fb-sub">${esc(sub)}</p>` : ""}`;
  }
  const pts = os.points.slice(0, 5);
  const chars = pts.reduce((s, p) => s + p.text.length, 0);
  const fs = chars > 520 ? 19 : chars > 380 ? 21 : 24;
  const textW = img ? 620 : 1100;
  return `<style>
.slide .fb-bar{position:absolute;left:72px;top:64px;width:96px;height:6px;border-radius:3px;background:var(--accent)}
.slide .fb-h{position:absolute;left:72px;top:84px;width:${img ? 640 : 1100}px;font-size:${(os.title || "").length > 48 ? 38 : 46}px;line-height:1.12;color:var(--ink);margin:0}
.slide .fb-key{position:absolute;left:72px;top:${(os.title || "").length > 48 ? 196 : 160}px;width:${textW}px;font-size:21px;line-height:1.4;color:var(--primary);margin:0;font-weight:600}
.slide .fb-list{position:absolute;left:72px;top:${(os.title || "").length > 48 ? 268 : 232}px;width:${textW}px;list-style:none;padding:0;margin:0}
.slide .fb-list li{position:relative;padding-left:28px;margin:0 0 ${Math.round(fs * 0.75)}px 0;font-size:${fs}px;line-height:1.4;color:var(--ink)}
.slide .fb-list li::before{content:"";position:absolute;left:0;top:${Math.round(fs * 0.5)}px;width:12px;height:12px;border-radius:3px;background:var(--accent)}
.slide .fb-cite{font-size:.62em;color:var(--muted)}
${img ? `.slide .fb-img{position:absolute;right:56px;top:84px;width:470px;height:560px;object-fit:cover;object-position:center;border-radius:20px}` : ""}
</style>
<div class="fb-bar"></div><h2 class="fb-h">${esc(os.title)}</h2>${os.keyMessage ? `<p class="fb-key">${esc(os.keyMessage)}</p>` : ""}
<ul class="fb-list">${pts.map((p) => `<li>${esc(p.text)}${cite(p)}</li>`).join("")}</ul>${img ? `<img class="fb-img" src="asset:${img.id}" alt="${esc(img.description.slice(0, 120))}">` : ""}`;
}
