/**
 * Engine v2 — Layout: agenda
 * Title + numbered agenda items with timeline line.
 */
import type { LayoutDefinition, LayoutBuildParams } from "./types";
import type { Shape } from "../sceneGraph";
import { SAFE_AREA } from "../canvas";

export const layout: LayoutDefinition = {
  id: "agenda",
  name: "Agenda / Outline",
  roles: ["agenda"],
  density: "med",
  slots: {
    title: { kind: "text", role: "title", rect: { x: 0.6, y: 0.5, w: 12.133, h: 0.9 }, minPt: 24, maxPt: 36, maxChars: 40, maxLines: 1, align: "left", bold: true },
    items: { kind: "list", rect: { x: 1.6, y: 1.8, w: 10.5, h: 5.0 }, minPt: 14, maxPt: 18, maxItems: 6, maxCharsPerItem: 70, bulletStyle: "number" },
  },
  variants: 2,
  decorations(ds) {
    const shapes: Shape[] = [];
    // Vertical timeline line
    shapes.push({
      type: "rect", id: "deco-timeline",
      rect: { x: 1.1, y: 1.8, w: 0.03, h: 5.0 },
      fill: { kind: "solid", color: ds.palette.primary, opacity: 0.3 },
    });
    // Dot accents on timeline
    for (let i = 0; i < 6; i++) {
      shapes.push({
        type: "rect", id: `deco-dot-${i}`,
        rect: { x: 0.97, y: 2.0 + i * 0.82, w: 0.3, h: 0.3 },
        fill: { kind: "solid", color: ds.palette.primary },
        cornerRadius: 300,
      });
    }
    // Title underline accent
    shapes.push({
      type: "rect", id: "deco-title-line",
      rect: { x: 0.6, y: 1.4, w: 2.5, h: 0.05 },
      fill: { kind: "solid", color: ds.palette.accent },
      cornerRadius: 4,
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
      itemsC.items.slice(0, 6).forEach((item, i) => {
        const y = 2.0 + i * 0.82;
        // Number on dot
        shapes.push({ type: "text", id: sid(`num-${i}`), rect: { x: 0.97, y, w: 0.3, h: 0.3 }, runs: [{ text: `${i + 1}`, bold: true }], style: { fontFamily: ds.fonts.heading, fontSize: 12, color: ds.palette.onPrimary, bold: true, align: "center", valign: "middle" } });
        // Item text
        shapes.push({ type: "text", id: sid(`item-${i}`), rect: { x: 1.6, y: y + 0.02, w: 10.5, h: 0.35 }, runs: [{ text: item }], style: { fontFamily: ds.fonts.body, fontSize: 16, color: ds.palette.text, align: "left" } });
      });
    }

    shapes.push(...this.decorations(ds, params.rng));
    return shapes;
  },
};

