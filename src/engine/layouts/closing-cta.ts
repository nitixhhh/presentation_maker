/**
 * Engine v2 — Layout: closing-cta
 * Big CTA headline, action text, optional background.
 */
import type { LayoutDefinition, LayoutBuildParams } from "./types";
import type { Shape } from "../sceneGraph";
import { CANVAS } from "../canvas";

export const layout: LayoutDefinition = {
  id: "closing-cta",
  name: "Closing CTA",
  roles: ["cta"],
  density: "low",
  slots: {
    title: { kind: "text", role: "title", rect: { x: 1.5, y: 1.5, w: 10.333, h: 2.0 }, minPt: 32, maxPt: 52, maxChars: 60, maxLines: 2, align: "center", bold: true },
    subtitle: { kind: "text", role: "subtitle", rect: { x: 2.5, y: 3.8, w: 8.333, h: 1.0 }, minPt: 14, maxPt: 22, maxChars: 100, maxLines: 3, align: "center" },
    action: { kind: "text", role: "caption", rect: { x: 4.5, y: 5.2, w: 4.333, h: 0.6 }, minPt: 12, maxPt: 16, maxChars: 40, maxLines: 1, align: "center", bold: true, textTransform: "uppercase" },
  },
  variants: 2,
  decorations(ds) {
    return [
      // Large gradient background rectangle
      {
        type: "rect", id: "deco-gradient-bg",
        rect: { x: 0, y: 0, w: CANVAS.W, h: CANVAS.H },
        fill: { kind: "gradient", type: "linear", angle: 135, stops: [
          { color: ds.palette.gradient.c1, pos: 0 },
          { color: ds.palette.gradient.c2, pos: 1 },
        ] },
        zIndex: -10,
      },
      // CTA "button" shape behind action text
      {
        type: "rect", id: "deco-cta-btn",
        rect: { x: 4.3, y: 5.1, w: 4.733, h: 0.8 },
        fill: { kind: "solid", color: ds.palette.primary },
        cornerRadius: 40,
      },
      // Top decorative circle
      {
        type: "rect", id: "deco-circle-top",
        rect: { x: 6.0, y: 0.3, w: 1.333, h: 1.333 },
        fill: { kind: "solid", color: ds.palette.accent, opacity: 0.15 },
        cornerRadius: 300,
      },
      // Bottom accent bar
      {
        type: "rect", id: "deco-bottom-line",
        rect: { x: 5.5, y: 6.5, w: 2.333, h: 0.05 },
        fill: { kind: "solid", color: ds.palette.onPrimary, opacity: 0.4 },
      },
    ];
  },
  buildShapes(params: LayoutBuildParams): Shape[] {
    const { ds, slotContent, slideIndex } = params;
    const shapes: Shape[] = [];
    const sid = (n: string) => `slide-${slideIndex}-${n}`;

    const titleC = slotContent.title;
    if (titleC?.kind === "text") {
      shapes.push({ type: "text", id: sid("title"), rect: this.slots.title.rect, runs: [{ text: titleC.text, bold: true }], style: { fontFamily: ds.fonts.heading, fontSize: 44, color: ds.palette.onPrimary, bold: true, align: "center", valign: "middle" } });
    }
    const subC = slotContent.subtitle;
    if (subC?.kind === "text") {
      shapes.push({ type: "text", id: sid("subtitle"), rect: this.slots.subtitle.rect, runs: [{ text: subC.text }], style: { fontFamily: ds.fonts.body, fontSize: 18, color: ds.palette.onPrimary, align: "center", valign: "top" } });
    }
    const actC = slotContent.action;
    if (actC?.kind === "text") {
      shapes.push({ type: "text", id: sid("action"), rect: this.slots.action.rect, runs: [{ text: actC.text, bold: true }], style: { fontFamily: ds.fonts.heading, fontSize: 14, color: ds.palette.onPrimary, bold: true, align: "center", valign: "middle", textTransform: "uppercase", charSpacing: 2 } });
    }
    shapes.push(...this.decorations(ds, params.rng));
    return shapes;
  },
};

