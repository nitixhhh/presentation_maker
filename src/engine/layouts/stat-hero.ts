/**
 * Engine v2 — Layout: Stat Hero
 *
 * 2-3 big stat callouts side by side. Each has number + label.
 * Variants: 0 = horizontal row, 1 = stacked grid
 */

import type { Shape } from "../sceneGraph";
import type { DesignSystemTokens } from "../sceneGraph";
import type {
  LayoutDefinition,
  LayoutBuildParams,
  RNG,
  Slot,
  TextSlotContent,
  BigNumberSlotContent,
} from "./types";
import { CANVAS, SAFE_AREA, gridCol } from "../canvas";

function sid(slideIndex: number, name: string): string {
  return `slide-${slideIndex}-${name}`;
}

const slots: Record<string, Slot> = {
  title: {
    kind: "text",
    role: "title",
    rect: { x: SAFE_AREA.x, y: SAFE_AREA.y, w: SAFE_AREA.w, h: 1.0 },
    minPt: 24,
    maxPt: 32,
    maxChars: 60,
    maxLines: 2,
    align: "center",
    valign: "middle",
    bold: true,
  },
  stat1: {
    kind: "bigNumber",
    rect: { ...gridCol(1, 4), y: 2.2, h: 3.0 },
    numberMaxPt: 72,
    numberMinPt: 48,
    labelMaxPt: 16,
  },
  stat2: {
    kind: "bigNumber",
    rect: { ...gridCol(5, 4), y: 2.2, h: 3.0 },
    numberMaxPt: 72,
    numberMinPt: 48,
    labelMaxPt: 16,
  },
  stat3: {
    kind: "bigNumber",
    rect: { ...gridCol(9, 4), y: 2.2, h: 3.0 },
    numberMaxPt: 72,
    numberMinPt: 48,
    labelMaxPt: 16,
  },
  caption: {
    kind: "text",
    role: "caption",
    rect: { x: SAFE_AREA.x + 1.5, y: 6.0, w: SAFE_AREA.w - 3.0, h: 0.8 },
    minPt: 12,
    maxPt: 15,
    maxChars: 100,
    maxLines: 2,
    align: "center",
  },
};

function decorations(ds: DesignSystemTokens, _rng: RNG): Shape[] {
  // Card backgrounds and accent underlines for each stat
  const cols = [gridCol(1, 4), gridCol(5, 4), gridCol(9, 4)];
  const shapes: Shape[] = [];
  cols.forEach((col, i) => {
    shapes.push({
      type: "rect" as const,
      id: `deco-card-bg-${i}`,
      rect: { x: col.x - 0.1, y: 2.0, w: col.w + 0.2, h: 3.4 },
      fill: { kind: "solid" as const, color: ds.palette.surface, opacity: 0.7 },
      cornerRadius: ds.shape.radius,
    });
    shapes.push({
      type: "rect" as const,
      id: `deco-underline-${i}`,
      rect: { x: col.x + col.w * 0.2, y: 5.2, w: col.w * 0.6, h: 0.05 },
      fill: { kind: "solid" as const, color: ds.palette.accent },
      cornerRadius: 0.025,
    });
  });
  return shapes;
}

function buildShapes(params: LayoutBuildParams): Shape[] {
  const { ds, slotContent, variant, slideIndex } = params;
  const shapes: Shape[] = [];
  const pal = ds.palette;
  const fonts = ds.fonts;
  const isRow = variant === 0;

  const stat3Content = slotContent["stat3"] as BigNumberSlotContent | undefined;
  const statCount = stat3Content?.number ? 3 : 2;

  // Title
  const titleContent = slotContent["title"] as TextSlotContent | undefined;
  if (titleContent?.text) {
    shapes.push({
      type: "text",
      id: sid(slideIndex, "title"),
      rect: { x: SAFE_AREA.x, y: SAFE_AREA.y + 0.2, w: SAFE_AREA.w, h: 1.0 },
      runs: [{ text: titleContent.text, bold: true, fontSize: 28, color: pal.text }],
      style: {
        fontFamily: fonts.pptxHeading,
        fontSize: 28,
        color: pal.text,
        bold: true,
        align: "center",
        valign: "middle",
      },
      zIndex: 2,
    });
  }

  // Stat layout positions
  type StatPos = { x: number; y: number; w: number; h: number };
  let positions: StatPos[];

  if (isRow) {
    // Horizontal row
    if (statCount === 3) {
      const cols = [gridCol(1, 4), gridCol(5, 4), gridCol(9, 4)];
      positions = cols.map(c => ({ x: c.x, y: 2.2, w: c.w, h: 3.2 }));
    } else {
      const cols = [gridCol(2, 5), gridCol(7, 5)];
      positions = cols.map(c => ({ x: c.x, y: 2.2, w: c.w, h: 3.2 }));
    }
  } else {
    // Stacked grid
    if (statCount === 3) {
      const col1 = gridCol(1, 6);
      const col2 = gridCol(7, 6);
      positions = [
        { x: col1.x, y: 1.8, w: col1.w, h: 2.4 },
        { x: col2.x, y: 1.8, w: col2.w, h: 2.4 },
        { x: (CANVAS.W - col1.w) / 2, y: 4.5, w: col1.w, h: 2.4 },
      ];
    } else {
      const col1 = gridCol(2, 5);
      const col2 = gridCol(7, 5);
      positions = [
        { x: col1.x, y: 2.2, w: col1.w, h: 3.2 },
        { x: col2.x, y: 2.2, w: col2.w, h: 3.2 },
      ];
    }
  }

  // Render each stat card
  const statKeys = ["stat1", "stat2", "stat3"] as const;
  for (let i = 0; i < statCount; i++) {
    const pos = positions[i];
    const content = slotContent[statKeys[i]] as BigNumberSlotContent | undefined;

    // Card background
    shapes.push({
      type: "rect",
      id: sid(slideIndex, `stat-card-${i}`),
      rect: { x: pos.x - 0.15, y: pos.y - 0.15, w: pos.w + 0.3, h: pos.h + 0.3 },
      fill: { kind: "solid", color: pal.surface },
      cornerRadius: ds.shape.radius,
      shadow: ds.shape.shadow
        ? { color: "#00000020", blur: 8, offsetX: 0, offsetY: 2 }
        : undefined,
      zIndex: 0,
    });

    // Accent underline
    shapes.push({
      type: "rect",
      id: sid(slideIndex, `deco-underline-${i}`),
      rect: {
        x: pos.x + pos.w * 0.2,
        y: pos.y + pos.h - 0.2,
        w: pos.w * 0.6,
        h: 0.05,
      },
      fill: { kind: "solid", color: pal.accent },
      cornerRadius: 0.025,
      zIndex: 1,
    });

    // Big number shape
    shapes.push({
      type: "bigNumber",
      id: sid(slideIndex, `stat-${i}`),
      rect: pos,
      number: content?.number ?? "0",
      label: content?.label ?? "",
      supporting: content?.supporting,
      numberStyle: {
        fontFamily: fonts.pptxHeading,
        fontSize: 60,
        color: pal.primary,
        bold: true,
        align: "center",
        valign: "bottom",
      },
      labelStyle: {
        fontFamily: fonts.pptxBody,
        fontSize: 15,
        color: pal.textMuted,
        align: "center",
        valign: "top",
      },
      zIndex: 2,
    });
  }

  // Caption
  const captionContent = slotContent["caption"] as TextSlotContent | undefined;
  if (captionContent?.text) {
    shapes.push({
      type: "text",
      id: sid(slideIndex, "caption"),
      rect: { x: SAFE_AREA.x + 1.5, y: 6.2, w: SAFE_AREA.w - 3.0, h: 0.7 },
      runs: [{ text: captionContent.text, fontSize: 13, color: pal.textMuted }],
      style: {
        fontFamily: fonts.pptxBody,
        fontSize: 13,
        color: pal.textMuted,
        align: "center",
        valign: "top",
        lineHeight: 1.4,
      },
      zIndex: 2,
    });
  }

  return shapes;
}

export const layout: LayoutDefinition = {
  id: "stat-hero",
  name: "Stat Hero — Multi-Number",
  roles: ["stat", "data"],
  density: "med",
  slots,
  decorations,
  variants: 2,
  buildShapes,
};
