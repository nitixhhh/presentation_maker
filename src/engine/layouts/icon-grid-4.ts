/**
 * Engine v2 — Layout: icon-grid-4
 * 2×2 grid of icon + text blocks.
 */
import type { LayoutDefinition, LayoutBuildParams } from "./types";
import type { Shape } from "../sceneGraph";
import { SAFE_AREA } from "../canvas";

export const layout: LayoutDefinition = {
  id: "icon-grid-4",
  name: "Icon Grid (2×2)",
  roles: ["data", "process", "comparison"],
  density: "med",
  slots: {
    title: { kind: "text", role: "title", rect: { x: 0.6, y: 0.5, w: 12.133, h: 0.8 }, minPt: 22, maxPt: 32, maxChars: 60, maxLines: 2, align: "left", bold: true },
    item1_icon: { kind: "icon", rect: { x: 0.8, y: 1.7, w: 0.5, h: 0.5 }, iconSize: 28 },
    item1_title: { kind: "text", role: "label", rect: { x: 1.5, y: 1.65, w: 4.8, h: 0.4 }, minPt: 14, maxPt: 18, maxChars: 40, maxLines: 1, align: "left", bold: true },
    item1_desc: { kind: "text", role: "body", rect: { x: 1.5, y: 2.1, w: 4.8, h: 0.9 }, minPt: 12, maxPt: 14, maxChars: 120, maxLines: 3, align: "left" },
    item2_icon: { kind: "icon", rect: { x: 7.0, y: 1.7, w: 0.5, h: 0.5 }, iconSize: 28 },
    item2_title: { kind: "text", role: "label", rect: { x: 7.7, y: 1.65, w: 4.8, h: 0.4 }, minPt: 14, maxPt: 18, maxChars: 40, maxLines: 1, align: "left", bold: true },
    item2_desc: { kind: "text", role: "body", rect: { x: 7.7, y: 2.1, w: 4.8, h: 0.9 }, minPt: 12, maxPt: 14, maxChars: 120, maxLines: 3, align: "left" },
    item3_icon: { kind: "icon", rect: { x: 0.8, y: 4.0, w: 0.5, h: 0.5 }, iconSize: 28 },
    item3_title: { kind: "text", role: "label", rect: { x: 1.5, y: 3.95, w: 4.8, h: 0.4 }, minPt: 14, maxPt: 18, maxChars: 40, maxLines: 1, align: "left", bold: true },
    item3_desc: { kind: "text", role: "body", rect: { x: 1.5, y: 4.4, w: 4.8, h: 0.9 }, minPt: 12, maxPt: 14, maxChars: 120, maxLines: 3, align: "left" },
    item4_icon: { kind: "icon", rect: { x: 7.0, y: 4.0, w: 0.5, h: 0.5 }, iconSize: 28 },
    item4_title: { kind: "text", role: "label", rect: { x: 7.7, y: 3.95, w: 4.8, h: 0.4 }, minPt: 14, maxPt: 18, maxChars: 40, maxLines: 1, align: "left", bold: true },
    item4_desc: { kind: "text", role: "body", rect: { x: 7.7, y: 4.4, w: 4.8, h: 0.9 }, minPt: 12, maxPt: 14, maxChars: 120, maxLines: 3, align: "left" },
  },
  variants: 2,
  decorations(ds, rng) {
    const shapes: Shape[] = [];
    // Icon background circles for each quadrant
    const positions = [
      { x: 0.75, y: 1.6 }, { x: 6.95, y: 1.6 },
      { x: 0.75, y: 3.9 }, { x: 6.95, y: 3.9 },
    ];
    positions.forEach((pos, i) => {
      shapes.push({
        type: "rect", id: `deco-icon-bg-${i}`,
        rect: { x: pos.x, y: pos.y, w: 0.6, h: 0.6 },
        fill: { kind: "solid", color: ds.palette.primary, opacity: 0.12 },
        cornerRadius: 300,
      });
    });
    // Horizontal divider
    shapes.push({
      type: "rect", id: "deco-hdivider",
      rect: { x: SAFE_AREA.x, y: 3.4, w: SAFE_AREA.w, h: 0.02 },
      fill: { kind: "solid", color: ds.palette.textMuted, opacity: 0.15 },
    });
    // Vertical divider
    shapes.push({
      type: "rect", id: "deco-vdivider",
      rect: { x: 6.5, y: 1.5, w: 0.02, h: 4.8 },
      fill: { kind: "solid", color: ds.palette.textMuted, opacity: 0.15 },
    });
    return shapes;
  },
  buildShapes(params: LayoutBuildParams): Shape[] {
    const { ds, slotContent, slideIndex } = params;
    const shapes: Shape[] = [];
    const sid = (name: string) => `slide-${slideIndex}-${name}`;

    // Title
    const titleC = slotContent.title;
    if (titleC?.kind === "text") {
      shapes.push({
        type: "text", id: sid("title"),
        rect: this.slots.title.rect,
        runs: [{ text: titleC.text, bold: true }],
        style: { fontFamily: ds.fonts.heading, fontSize: 28, color: ds.palette.text, bold: true, align: "left" },
      });
    }

    // 4 grid items
    for (let i = 1; i <= 4; i++) {
      const iconC = slotContent[`item${i}_icon`];
      const titleItemC = slotContent[`item${i}_title`];
      const descC = slotContent[`item${i}_desc`];

      if (iconC?.kind === "icon") {
        shapes.push({
          type: "icon", id: sid(`item${i}-icon`),
          rect: this.slots[`item${i}_icon`].rect,
          iconName: iconC.iconName, color: ds.palette.primary, size: 28,
        });
      }
      if (titleItemC?.kind === "text") {
        shapes.push({
          type: "text", id: sid(`item${i}-title`),
          rect: this.slots[`item${i}_title`].rect,
          runs: [{ text: titleItemC.text, bold: true }],
          style: { fontFamily: ds.fonts.heading, fontSize: 16, color: ds.palette.text, bold: true, align: "left" },
        });
      }
      if (descC?.kind === "text") {
        shapes.push({
          type: "text", id: sid(`item${i}-desc`),
          rect: this.slots[`item${i}_desc`].rect,
          runs: [{ text: descC.text }],
          style: { fontFamily: ds.fonts.body, fontSize: 13, color: ds.palette.textMuted, align: "left" },
        });
      }
    }

    shapes.push(...this.decorations(ds, params.rng));
    return shapes;
  },
};

