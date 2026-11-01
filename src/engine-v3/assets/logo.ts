import fs from "fs";
import path from "path";
import sharp from "sharp";
import { logoPath } from "@/server/uploads";
import type { Asset, OutlineSlide } from "../types";

/**
 * The uploaded institution logo.
 *  - It is attached (as an asset the designer may place) ONLY to the title slide and the closing slide, where an
 *    official academic title page shows it in the presenter block.
 *  - Every other slide gets the same small corner logo placed by the ENGINE (render/document.ts), so the logo is
 *    consistent and the designer AI never treats it as the slide's image.
 *  - A hard guard (qa/logoGuard.ts) makes sure the logo is never a background, hero, watermark or large picture.
 */
export const LOGO_ASSET_ID = "logo";

/** Slides that may show the logo in their own layout: the title slide and the closing slide (slide 1 if no title role). */
export function logoSlides(slides: Pick<OutlineSlide, "n" | "role">[]): number[] {
  const out = slides.filter((s) => s.role === "title" || s.role === "closing").map((s) => s.n);
  if (!out.length && slides.length) out.push(slides[0].n);
  return Array.from(new Set(out));
}

/** Copy the uploaded logo into the deck as an asset for the title/closing slide(s). */
export async function addLogoAsset(logoId: string, assetDirPath: string, slides: number[]): Promise<Asset | null> {
  const src = logoPath(logoId);
  if (!src) return null;
  try {
    const file = "logo.png";
    fs.mkdirSync(assetDirPath, { recursive: true });
    fs.copyFileSync(src, path.join(assetDirPath, file));
    const meta = await sharp(src).metadata();
    const st = await sharp(src).flatten({ background: "#ffffff" }).stats();
    const [r, g, b] = st.channels.map((c) => Math.round(c.mean));
    return {
      id: LOGO_ASSET_ID,
      file,
      width: meta.width || 400,
      height: meta.height || 400,
      avgColor: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
      mime: "image/png",
      origin: "upload",
      title: "Institution logo",
      description: `the presenter's college/university logo (PNG${meta.hasAlpha ? " with transparent background" : ""}). It is NOT a photo and never the slide's main visual: place it SMALL (at most 180×120 px) in the title/presenter block the way an official academic title page would, object-fit: contain, full opacity, never cropped, recoloured, stretched, faded, blurred or used as a background/watermark; give it a light plate if the background would hide it`,
      credit: "",
      forSlides: slides,
    } as Asset;
  } catch {
    return null;
  }
}

/** The logo asset of a deck, if one was uploaded. */
export function deckLogo(deck: { assets: Asset[] }): Asset | undefined {
  return deck.assets.find((a) => a.id === LOGO_ASSET_ID && a.origin === "upload");
}

/** Corner logo box (slide px) — the designer is told to keep this corner free. */
export const LOGO_CORNER = { right: 24, bottom: 18, maxW: 132, maxH: 40, pad: 5 };
/** The corner the designer must keep clear on slides that carry the engine's corner logo. */
export const LOGO_CORNER_ZONE = { x: 1100, y: 648 };

/** Engine-placed small corner logo (bottom-right) for slides whose own layout does not carry the logo. */
export function logoCornerHtml(src: string): string {
  const c = LOGO_CORNER;
  return `<div data-v3-engine="logo" style="position:absolute;right:${c.right}px;bottom:${c.bottom}px;z-index:50;background:#ffffff;border-radius:6px;padding:${c.pad}px ${c.pad + 2}px;box-shadow:0 1px 3px rgba(0,0,0,.18);line-height:0;"><img src="${src}" alt="Institution logo" style="display:block;max-width:${c.maxW}px;max-height:${c.maxH}px;width:auto;height:auto;object-fit:contain;"></div>`;
}

/** Remove an engine corner logo that a serialised slide still carries (it is re-added on every render). */
export function stripEngineLogo(html: string): string {
  return html.replace(/<div[^>]*data-v3-engine=["']?logo["']?[^>]*>[\s\S]*?<\/div>/gi, "");
}
