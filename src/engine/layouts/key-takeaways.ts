/**
 * Engine v2 — Layout: key-takeaways
 * Title at top, 3-5 numbered key points.
 */
import type { LayoutDefinition, LayoutBuildParams } from "./types";
import type { Shape } from "../sceneGraph";
import { SAFE_AREA } from "../canvas";

export const layout: LayoutDefinition = {
  id: "key-takeaways",
  name: "Key Takeaways",
  roles: ["takeaways"],
  density: "med",
  slots: {
    title: { kind: "text", role: "title", rect: { x: 0.6, y: 0.5, w: 12.133, h: 0.9 }, minPt: 24, maxPt: 36, maxChars: 50, maxLines: 2, align: "left", bold: true },
    items: { kind: "list", rect: { x: 1.2, y: 1.8, w: 10.9, h: 5.0 }, minPt: 14, maxPt: 18, maxItems: 5, maxCharsPerItem: 90, bulletStyle: "number" },
  },
  variants: 2,
  decorations(ds) {
    const shapes: Shape[] = [];
    // Number badges
    for (let i = 0; i < 5; i++) {
      const y = 1.9 + i * 1.0;
      shapes.push({
        type: "rect", id: `deco-num-bg-${i}`,
        rect: { x: 0.6, y, w: 0.45, h: 0.45 },
        fill: { kind: "solid", color: ds.palette.primary },
        cornerRadius: 8,
      });
    }
    // Bottom accent bar
    shapes.push({
      type: "rect", id: "deco-bottom-bar",
      rect: { x: SAFE_AREA.x, y: 6.8, w: SAFE_AREA.w, h: 0.06 },
      fill: { kind: "gradient", type: "linear", angle: 90, stops: [{ color: ds.palette.primary, pos: 0 }, { color: ds.palette.accent, pos: 1 }] },
    });
    return shapes;
  },
  buildShapes(params: LayoutBuildParams): Shape[] {
    const { ds, slotContent, slideIndex } = params;
    const shapes: Shape[] = [];
    const sid = (n: string) => `slide-${slideIndex}-${n}`;

    const titleC = slotContent.title;
    if (titleC?.kind === "text") {
      shapes.push({ type: "text", id: sid("title"), rect: this.slots.title.rect, runs: [{ text: titleC.text, bold: true }], style: { fontFamily: ds.fonts.heading, fontSize: 32, color: ds.palette.text, bold: true, align: "left" } });
    }
    const itemsC = slotContent.items;
    if (itemsC?.kind === "list") {
      // Render each item as a row with number badge + text
      itemsC.items.slice(0, 5).forEach((item, i) => {
        const y = 1.9 + i * 1.0;
        // Number label on badge
        shapes.push({ type: "text", id: sid(`num-${i}`), rect: { x: 0.6, y, w: 0.45, h: 0.45 }, runs: [{ text: `${i + 1}`, bold: true }], style: { fontFamily: ds.fonts.heading, fontSize: 16, color: ds.palette.onPrimary, bold: true, align: "center", valign: "middle" } });
        // Item text
        shapes.push({ type: "text", id: sid(`item-${i}`), rect: { x: 1.2, y: y + 0.05, w: 10.9, h: 0.4 }, runs: [{ text: item }], style: { fontFamily: ds.fonts.body, fontSize: 16, color: ds.palette.text, align: "left" } });
        // Separator line
        if (i < (itemsC.items.length - 1)) {
          shapes.push({ type: "rect", id: sid(`sep-${i}`), rect: { x: 1.2, y: y + 0.7, w: 10.9, h: 0.01 }, fill: { kind: "solid", color: ds.palette.textMuted, opacity: 0.15 } });
        }
      });
    }
    shapes.push(...this.decorations(ds, params.rng));
    return shapes;
  },
};

