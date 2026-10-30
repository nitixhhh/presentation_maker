/**
 * Engine v2 — Layout: Three Cards
 *
 * 3 equal-width cards in a row. Each has icon, title, body.
 * Variants: 0 = vertical cards, 1 = horizontal cards
 */

import type { Shape } from "../sceneGraph";
import type { DesignSystemTokens } from "../sceneGraph";
import type {
  LayoutDefinition,
  LayoutBuildParams,
  RNG,
  Slot,
  TextSlotContent,
  IconSlotContent,
} from "./types";
import { CANVAS, SAFE_AREA, gridCol } from "../canvas";

function sid(slideIndex: number, name: string): string {
  return `slide-${slideIndex}-${name}`;
}

const col1 = gridCol(1, 4);
const col2 = gridCol(5, 4);
const col3 = gridCol(9, 4);

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
  card1_icon: { kind: "icon", rect: { x: col1.x + col1.w / 2 - 0.25, y: 2.0, w: 0.5, h: 0.5 }, iconSize: 28 },
  card1_title: {
    kind: "text", role: "label",
    rect: { x: col1.x, y: 2.7, w: col1.w, h: 0.6 },
    minPt: 16, maxPt: 20, maxChars: 40, maxLines: 2, align: "center", bold: true,
  },
  card1_body: {
    kind: "text", role: "body",
    rect: { x: col1.x, y: 3.4, w: col1.w, h: 1.8 },
    minPt: 12, maxPt: 14, maxChars: 150, maxLines: 5, align: "center",
  },
  card2_icon: { kind: "icon", rect: { x: col2.x + col2.w / 2 - 0.25, y: 2.0, w: 0.5, h: 0.5 }, iconSize: 28 },
  card2_title: {
    kind: "text", role: "label",
    rect: { x: col2.x, y: 2.7, w: col2.w, h: 0.6 },
    minPt: 16, maxPt: 20, maxChars: 40, maxLines: 2, align: "center", bold: true,
  },
  card2_body: {
    kind: "text", role: "body",
    rect: { x: col2.x, y: 3.4, w: col2.w, h: 1.8 },
    minPt: 12, maxPt: 14, maxChars: 150, maxLines: 5, align: "center",
  },
  card3_icon: { kind: "icon", rect: { x: col3.x + col3.w / 2 - 0.25, y: 2.0, w: 0.5, h: 0.5 }, iconSize: 28 },
  card3_title: {
    kind: "text", role: "label",
    rect: { x: col3.x, y: 2.7, w: col3.w, h: 0.6 },
    minPt: 16, maxPt: 20, maxChars: 40, maxLines: 2, align: "center", bold: true,
  },
  card3_body: {
    kind: "text", role: "body",
    rect: { x: col3.x, y: 3.4, w: col3.w, h: 1.8 },
    minPt: 12, maxPt: 14, maxChars: 150, maxLines: 5, align: "center",
  },
};

function decorations(ds: DesignSystemTokens, _rng: RNG): Shape[] {
  const cols = [gridCol(1, 4), gridCol(5, 4), gridCol(9, 4)];
  const shapes: Shape[] = [];
  cols.forEach((col, i) => {
    // Card background
    shapes.push({
      type: "rect" as const,
      id: `deco-card-bg-${i}`,
      rect: { x: col.x - 0.15, y: 1.7, w: col.w + 0.3, h: 3.8 },
      fill: { kind: "solid" as const, color: ds.palette.surface },
      cornerRadius: ds.shape.radius,
    });
    // Icon circle
    shapes.push({
      type: "rect" as const,
      id: `deco-icon-circle-${i}`,
      rect: { x: col.x + col.w / 2 - 0.35, y: 1.85, w: 0.7, h: 0.7 },
      fill: { kind: "solid" as const, color: ds.palette.primary, opacity: 0.12 },
      cornerRadius: 0.35,
    });
  });
  return shapes;
}

function buildShapes(params: LayoutBuildParams): Shape[] {
  const { ds, slotContent, variant, slideIndex } = params;
  const shapes: Shape[] = [];
  const pal = ds.palette;
  const fonts = ds.fonts;
  const isVertical = variant === 0;

  // Title
  const titleContent = slotContent["title"] as TextSlotContent | undefined;
  if (titleContent?.text) {
    shapes.push({
      type: "text",
      id: sid(slideIndex, "title"),
      rect: { x: SAFE_AREA.x, y: SAFE_AREA.y + 0.1, w: SAFE_AREA.w, h: 0.9 },
      runs: [{ text: titleContent.text, bold: true, fontSize: 28, color: pal.text }],
      style: {
        fontFamily: fonts.pptxHeading, fontSize: 28, color: pal.text,
        bold: true, align: "center", valign: "middle",
      },
      zIndex: 3,
    });
  }

  // Cards
  const cardKeys = [
    { icon: "card1_icon", title: "card1_title", body: "card1_body" },
    { icon: "card2_icon", title: "card2_title", body: "card2_body" },
    { icon: "card3_icon", title: "card3_title", body: "card3_body" },
  ];

  let cardPositions: Array<{ x: number; y: number; w: number; h: number }>;
  if (isVertical) {
    const cols = [gridCol(1, 4), gridCol(5, 4), gridCol(9, 4)];
    cardPositions = cols.map(c => ({ x: c.x, y: 1.7, w: c.w, h: 4.0 }));
  } else {
    // Horizontal stacked cards
    const g = gridCol(1, 12);
    cardPositions = [
      { x: g.x, y: 1.7, w: g.w, h: 1.2 },
      { x: g.x, y: 3.1, w: g.w, h: 1.2 },
      { x: g.x, y: 4.5, w: g.w, h: 1.2 },
    ];
  }

  cardKeys.forEach((card, i) => {
    const pos = cardPositions[i];
    const iconContent = slotContent[card.icon] as IconSlotContent | undefined;
    const titleC = slotContent[card.title] as TextSlotContent | undefined;
    const bodyC = slotContent[card.body] as TextSlotContent | undefined;

    // Card background
    shapes.push({
      type: "rect",
      id: sid(slideIndex, `card-bg-${i}`),
      rect: { x: pos.x - 0.15, y: pos.y, w: pos.w + 0.3, h: pos.h },
      fill: { kind: "solid", color: pal.surface },
      cornerRadius: ds.shape.radius,
      shadow: ds.shape.shadow
        ? { color: "#00000015", blur: 6, offsetX: 0, offsetY: 2 }
        : undefined,
      zIndex: 0,
    });

    if (isVertical) {
      // Icon circle bg
      shapes.push({
        type: "rect",
        id: sid(slideIndex, `icon-circle-${i}`),
        rect: { x: pos.x + pos.w / 2 - 0.35, y: pos.y + 0.2, w: 0.7, h: 0.7 },
        fill: { kind: "solid", color: pal.primary, opacity: 0.1 },
        cornerRadius: 0.35,
        zIndex: 1,
      });
      // Icon
      shapes.push({
        type: "icon",
        id: sid(slideIndex, `icon-${i}`),
        rect: { x: pos.x + pos.w / 2 - 0.2, y: pos.y + 0.35, w: 0.4, h: 0.4 },
        iconName: iconContent?.iconName ?? "star",
        color: pal.primary,
        size: 28,
        zIndex: 2,
      });
      // Card title
      shapes.push({
        type: "text",
        id: sid(slideIndex, `card-title-${i}`),
        rect: { x: pos.x, y: pos.y + 1.1, w: pos.w, h: 0.6 },
        runs: [{ text: titleC?.text ?? "", bold: true, fontSize: 18, color: pal.text }],
        style: {
          fontFamily: fonts.pptxHeading, fontSize: 18, color: pal.text,
          bold: true, align: "center", valign: "middle",
        },
        zIndex: 2,
      });
      // Card body
      shapes.push({
        type: "text",
        id: sid(slideIndex, `card-body-${i}`),
        rect: { x: pos.x + 0.2, y: pos.y + 1.7, w: pos.w - 0.4, h: 1.8 },
        runs: [{ text: bodyC?.text ?? "", fontSize: 13, color: pal.textMuted }],
        style: {
          fontFamily: fonts.pptxBody, fontSize: 13, color: pal.textMuted,
          align: "center", valign: "top", lineHeight: 1.5,
        },
        zIndex: 2,
      });
    } else {
      // Horizontal layout: icon left, text right
      shapes.push({
        type: "rect",
        id: sid(slideIndex, `icon-circle-${i}`),
        rect: { x: pos.x + 0.2, y: pos.y + 0.2, w: 0.7, h: 0.7 },
        fill: { kind: "solid", color: pal.primary, opacity: 0.1 },
        cornerRadius: 0.35,
        zIndex: 1,
      });
      shapes.push({
        type: "icon",
        id: sid(slideIndex, `icon-${i}`),
        rect: { x: pos.x + 0.35, y: pos.y + 0.35, w: 0.4, h: 0.4 },
        iconName: iconContent?.iconName ?? "star",
        color: pal.primary,
        size: 28,
        zIndex: 2,
      });
      shapes.push({
        type: "text",
        id: sid(slideIndex, `card-title-${i}`),
        rect: { x: pos.x + 1.2, y: pos.y + 0.15, w: 3.5, h: 0.45 },
        runs: [{ text: titleC?.text ?? "", bold: true, fontSize: 17, color: pal.text }],
        style: {
          fontFamily: fonts.pptxHeading, fontSize: 17, color: pal.text,
          bold: true, align: "left", valign: "middle",
        },
        zIndex: 2,
      });
      shapes.push({
        type: "text",
        id: sid(slideIndex, `card-body-${i}`),
        rect: { x: pos.x + 1.2, y: pos.y + 0.6, w: pos.w - 1.6, h: 0.5 },
        runs: [{ text: bodyC?.text ?? "", fontSize: 13, color: pal.textMuted }],
        style: {
          fontFamily: fonts.pptxBody, fontSize: 13, color: pal.textMuted,
          align: "left", valign: "top", lineHeight: 1.4,
        },
        zIndex: 2,
      });
    }
  });

  return shapes;
}

export const layout: LayoutDefinition = {
  id: "three-cards",
  name: "Three Cards",
  roles: ["comparison", "process", "data"],
  density: "med",
  slots,
  decorations,
  variants: 2,
  buildShapes,
};
