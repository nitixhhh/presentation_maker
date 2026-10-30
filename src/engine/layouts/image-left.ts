/**
 * Engine v2 — Layout: image-left
 * Left: large image. Right: title + bullets.
 */
import type { LayoutDefinition, LayoutBuildParams } from "./types";
import type { Shape } from "../sceneGraph";
import { SAFE_AREA } from "../canvas";

export const layout: LayoutDefinition = {
  id: "image-left",
  name: "Image Left + Content Right",
  roles: ["statement", "data", "section"],
  density: "med",
  slots: {
    image: { kind: "image", rect: { x: 0.6, y: 0.5, w: 5.4, h: 6.5 }, aspectRatio: 5.4 / 6.5, objectFit: "cover", cornerRadius: 12 },
    title: { kind: "text", role: "title", rect: { x: 6.6, y: 1.0, w: 5.8, h: 1.2 }, minPt: 22, maxPt: 36, maxChars: 60, maxLines: 2, align: "left", bold: true },
    body: { kind: "list", rect: { x: 6.6, y: 2.5, w: 5.8, h: 3.5 }, minPt: 13, maxPt: 16, maxItems: 4, maxCharsPerItem: 80, bulletStyle: "disc" },
    caption: { kind: "text", role: "caption", rect: { x: 6.6, y: 6.2, w: 5.8, h: 0.4 }, minPt: 10, maxPt: 12, maxChars: 60, maxLines: 1, align: "left" },
  },
  variants: 1,
  decorations(ds, rng) {
    return [
      { type: "rect", id: "deco-accent-bar", rect: { x: 6.6, y: 0.7, w: 0.4, h: 0.06 }, fill: { kind: "solid", color: ds.palette.primary }, cornerRadius: 4 },
      { type: "rect", id: "deco-img-frame", rect: { x: 0.5, y: 0.4, w: 5.6, h: 6.7 }, fill: { kind: "none" }, stroke: { color: ds.palette.primary, width: 1.5 }, cornerRadius: 16 },
    ];
  },
  buildShapes(params: LayoutBuildParams): Shape[] {
    const { ds, slotContent, slideIndex } = params;
    const shapes: Shape[] = [];
    const sid = (n: string) => `slide-${slideIndex}-${n}`;

    const imgC = slotContent.image;
    if (imgC?.kind === "image") {
      shapes.push({ type: "image", id: sid("image"), rect: this.slots.image.rect, src: imgC.src, alt: imgC.alt, objectFit: "cover", cornerRadius: 12, credit: imgC.credit });
    }
    const titleC = slotContent.title;
    if (titleC?.kind === "text") {
      shapes.push({ type: "text", id: sid("title"), rect: this.slots.title.rect, runs: [{ text: titleC.text, bold: true }], style: { fontFamily: ds.fonts.heading, fontSize: 30, color: ds.palette.text, bold: true, align: "left" } });
    }
    const bodyC = slotContent.body;
    if (bodyC?.kind === "list") {
      shapes.push({ type: "bulletList", id: sid("body"), rect: this.slots.body.rect, items: bodyC.items, bulletStyle: "disc", bulletColor: ds.palette.primary, style: { fontFamily: ds.fonts.body, fontSize: 14, color: ds.palette.text, align: "left" }, itemSpacing: 0.3 });
    }
    const capC = slotContent.caption;
    if (capC?.kind === "text") {
      shapes.push({ type: "text", id: sid("caption"), rect: this.slots.caption.rect, runs: [{ text: capC.text }], style: { fontFamily: ds.fonts.body, fontSize: 11, color: ds.palette.textMuted, align: "left" } });
    }
    shapes.push(...this.decorations(ds, params.rng));
    return shapes;
  },
};

