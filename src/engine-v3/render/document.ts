/** Engine v3 — builds the standalone HTML document for a slide (preview, QA, PDF, PPTX all use it). */
import type { Deck, DesignSystem } from "../types";
import { COMPONENTS_CSS, COMPONENTS_JS } from "./components";
import { deckLogo, logoCornerHtml, stripEngineLogo } from "../assets/logo";
import { expandIcons, ICON_CSS } from "../../engine-v4/iconRender";

export function resolveAssets(html: string, assetBase: string, deck: Pick<Deck, "assets">): string {
  return html.replace(/asset:([a-z0-9_-]+)/gi, (m, id) => {
    const a = deck.assets.find((x) => x.id === id);
    return a ? `${assetBase}${a.file}` : "";
  });
}

export function slideDocument(design: DesignSystem, innerHtml: string, opts: { assetBase: string; deck: Pick<Deck, "assets">; n?: number; extraHead?: string }): string {
  let body = resolveAssets(stripEngineLogo(innerHtml), opts.assetBase, opts.deck);
  // engine v4 icon placeholders (<i data-icon="lucide:cpu">) → real inline SVG (no-op for slides without icons)
  const iconCss = /data-icon\s*=/.test(body) ? ICON_CSS : "";
  if (iconCss) body = expandIcons(body).html;
  // the institution logo: designed into the title/closing slide; every other slide gets the same small corner logo
  const logo = opts.deck.assets ? deckLogo(opts.deck as { assets: any[] }) : undefined;
  if (logo && opts.n != null && !logo.forSlides.includes(opts.n)) body += `\n${logoCornerHtml(`${opts.assetBase}${logo.file}`)}`;
  // engine v4 decks get a few stricter DOM checks (domScripts reads this flag); v3 decks render exactly as before
  const v4 = (opts.deck as any).engine === "v4";
  const role = v4 && opts.n != null ? String(((opts.deck as any).outline?.slides || []).find((s: any) => s.n === opts.n)?.role || "").replace(/[^a-z-]/gi, "") : "";
  return `<!DOCTYPE html><html${v4 ? ` data-engine="v4"${role ? ` data-role="${role}"` : ""}` : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=1280">
${design.fontLink}
<style>${design.css}${COMPONENTS_CSS}${iconCss}</style>${opts.extraHead || ""}
</head><body><section class="slide" data-n="${opts.n ?? ""}">
${body}
</section><script>window.__v3ready=false;function __v3draw(){try{${COMPONENTS_JS}}finally{window.__v3ready=true;}}document.fonts && document.fonts.ready ? document.fonts.ready.then(__v3draw) : __v3draw();</script></body></html>`;
}

/** A self-contained slideshow page for the web preview / HTML download (each slide in an iframe-isolated srcdoc). */
export function deckViewerHtml(deck: Deck, assetBase: string): string {
  const frames = deck.slides
    .map((s) => {
      const doc = slideDocument(deck.design, s.html, { assetBase, deck, n: s.n });
      return `<div class="frame"><iframe scrolling="no" srcdoc="${doc.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></iframe></div>`;
    })
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.brief.title)}</title>
<style>body{margin:0;background:#111;display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px 0;font-family:sans-serif}
.frame{width:1280px;height:720px;box-shadow:0 10px 40px #0008}.frame iframe{width:1280px;height:720px;border:0;display:block}
@media (max-width:1320px){.frame{transform:scale(calc((100vw - 40px)/1280));transform-origin:top center;margin-bottom:calc(720px * ((100vw - 40px)/1280) - 720px)}}</style>
</head><body>${frames}</body></html>`;
}

export function escapeHtml(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
