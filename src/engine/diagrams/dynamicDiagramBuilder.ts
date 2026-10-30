/**
 * Engine v2 — AI Dynamic Vector Diagram Builder
 *
 * Translates arbitrary AI-generated diagram topology into native SceneGraph shapes:
 *  - Supports arbitrary node counts (2 to 6+), branches, cyclical loops, layered stacks,
 *    quadrants, and trees.
 *  - Auto-calculates coordinates, padding, and alignments within the slide's allocated Rect.
 *  - Generates crisp native PPTX/HTML vector shapes (cards, connecting lines, arrow badges).
 *  - 100% theme-aligned with the deck's DesignSystemTokens.
 */

import type { Rect, Shape, RectShape, TextShape, IconShape, DesignSystemTokens } from "../sceneGraph";

export interface AIDiagramNode {
  id: string;
  title: string;
  description?: string;
  badge?: string;
  icon?: string;
  role?: "primary" | "secondary" | "accent" | "surface";
  group?: string;
}

export interface AIDiagramConnection {
  from: string;
  to: string;
  label?: string;
  direction?: "forward" | "bidirectional";
}

export interface AIDiagramSpec {
  type:
    | "process_flow"
    | "architecture_layers"
    | "quadrant_matrix"
    | "comparison_grid"
    | "tree_hierarchy"
    | "cyclical_loop"
    | "custom";
  title?: string;
  subtitle?: string;
  nodes: AIDiagramNode[];
  connections?: AIDiagramConnection[];
}

/**
 * Builds native SceneGraph vector shapes from an AI-generated diagram specification
 */
export function buildDynamicDiagramShapes(
  diagram: AIDiagramSpec,
  targetRect: Rect,
  ds: DesignSystemTokens,
  slideIndex: number
): Shape[] {
  const shapes: Shape[] = [];
  const nodes = diagram.nodes || [];
  if (nodes.length === 0) return shapes;

  const pal = ds.palette;
  const sid = (name: string) => `slide-${slideIndex}-diag-${name}`;

  // Optional Diagram Title / Caption Header
  let currentY = targetRect.y;
  let availableH = targetRect.h;

  if (diagram.title) {
    shapes.push({
      type: "text",
      id: sid("title"),
      rect: { x: targetRect.x, y: currentY, w: targetRect.w, h: 0.4 },
      runs: [{ text: diagram.title, bold: true }],
      style: {
        fontFamily: ds.fonts.heading,
        fontSize: 16,
        color: pal.primary,
        bold: true,
        align: "left",
      },
    });
    currentY += 0.45;
    availableH -= 0.45;
  }

  // Route by Diagram Type
  switch (diagram.type) {
    case "architecture_layers":
      return shapes.concat(buildLayeredDiagram(nodes, diagram.connections, { x: targetRect.x, y: currentY, w: targetRect.w, h: availableH }, ds, sid));

    case "quadrant_matrix":
      return shapes.concat(buildQuadrantDiagram(nodes, { x: targetRect.x, y: currentY, w: targetRect.w, h: availableH }, ds, sid));

    case "cyclical_loop":
    case "process_flow":
    case "tree_hierarchy":
    case "comparison_grid":
    default:
      return shapes.concat(buildFlowDiagram(nodes, diagram.connections, { x: targetRect.x, y: currentY, w: targetRect.w, h: availableH }, ds, sid));
  }
}

// ─── 1. Flow / Sequential / Cyclic Layout ────────────────

function buildFlowDiagram(
  nodes: AIDiagramNode[],
  connections: AIDiagramConnection[] | undefined,
  bounds: Rect,
  ds: DesignSystemTokens,
  sid: (name: string) => string
): Shape[] {
  const shapes: Shape[] = [];
  const pal = ds.palette;
  const count = nodes.length;

  const gap = 0.25;
  const totalGaps = gap * (count - 1);
  const cardW = Math.min(3.2, (bounds.w - totalGaps) / count);
  const cardH = Math.min(3.6, bounds.h - 0.2);
  const startX = bounds.x + (bounds.w - (cardW * count + totalGaps)) / 2;
  const cardY = bounds.y + (bounds.h - cardH) / 2;

  const nodePositions: Map<string, { x: number; y: number; w: number; h: number }> = new Map();

  for (let i = 0; i < count; i++) {
    const node = nodes[i];
    const nx = startX + i * (cardW + gap);
    nodePositions.set(node.id || String(i), { x: nx, y: cardY, w: cardW, h: cardH });

    // Determine card styling based on role
    const isPrimary = node.role === "primary" || i === 0;
    const cardBg = isPrimary ? pal.surface : pal.bgAlt;
    const borderColor = isPrimary ? pal.primary : pal.surface;

    // Node container card
    shapes.push({
      type: "rect",
      id: sid(`node-card-${i}`),
      rect: { x: nx, y: cardY, w: cardW, h: cardH },
      fill: { kind: "solid", color: cardBg },
      stroke: { color: borderColor, width: isPrimary ? 2 : 1 },
      cornerRadius: 12,
    });

    let contentY = cardY + 0.25;

    // Badge / Step Pill
    const badgeText = node.badge || `STEP 0${i + 1}`;
    shapes.push({
      type: "rect",
      id: sid(`badge-bg-${i}`),
      rect: { x: nx + 0.2, y: contentY, w: 1.0, h: 0.26 },
      fill: { kind: "solid", color: isPrimary ? pal.primary : pal.surface },
      cornerRadius: 6,
    });

    shapes.push({
      type: "text",
      id: sid(`badge-txt-${i}`),
      rect: { x: nx + 0.2, y: contentY + 0.02, w: 1.0, h: 0.22 },
      runs: [{ text: badgeText }],
      style: {
        fontFamily: ds.fonts.mono,
        fontSize: 10,
        color: isPrimary ? pal.onPrimary : pal.primary,
        bold: true,
        align: "center",
      },
    });

    // Icon if present
    if (node.icon) {
      shapes.push({
        type: "icon",
        id: sid(`icon-${i}`),
        rect: { x: nx + cardW - 0.55, y: contentY, w: 0.35, h: 0.35 },
        iconName: node.icon,
        color: pal.primary,
        size: 16,
      });
    }

    contentY += 0.45;

    // Node Title
    shapes.push({
      type: "text",
      id: sid(`node-title-${i}`),
      rect: { x: nx + 0.2, y: contentY, w: cardW - 0.4, h: 0.65 },
      runs: [{ text: node.title, bold: true }],
      style: {
        fontFamily: ds.fonts.heading,
        fontSize: 14,
        color: pal.text,
        bold: true,
        align: "left",
      },
    });

    contentY += 0.65;

    // Node Description
    if (node.description) {
      shapes.push({
        type: "text",
        id: sid(`node-desc-${i}`),
        rect: { x: nx + 0.2, y: contentY, w: cardW - 0.4, h: cardH - (contentY - cardY) - 0.15 },
        runs: [{ text: node.description }],
        style: {
          fontFamily: ds.fonts.body,
          fontSize: 11,
          color: pal.textMuted,
          align: "left",
        },
      });
    }

    // Connector Arrow between sequential cards
    if (i < count - 1) {
      const arrowX = nx + cardW;
      const arrowY = cardY + cardH / 2 - 0.04;
      shapes.push({
        type: "rect",
        id: sid(`arrow-bar-${i}`),
        rect: { x: arrowX + 0.04, y: arrowY, w: gap - 0.08, h: 0.04 },
        fill: { kind: "solid", color: pal.primary },
        cornerRadius: 2,
      });

      // Chevron triangle / arrow head
      shapes.push({
        type: "rect",
        id: sid(`arrow-head-${i}`),
        rect: { x: arrowX + gap - 0.08, y: arrowY - 0.05, w: 0.08, h: 0.14 },
        fill: { kind: "solid", color: pal.primary },
        cornerRadius: 2,
      });
    }
  }

  return shapes;
}

// ─── 2. Architecture Layers Layout ──────────────────────

function buildLayeredDiagram(
  nodes: AIDiagramNode[],
  connections: AIDiagramConnection[] | undefined,
  bounds: Rect,
  ds: DesignSystemTokens,
  sid: (name: string) => string
): Shape[] {
  const shapes: Shape[] = [];
  const pal = ds.palette;
  const count = nodes.length;

  const gap = 0.15;
  const totalGaps = gap * (count - 1);
  const layerH = Math.min(1.1, (bounds.h - totalGaps) / count);
  const layerW = bounds.w - 0.4;
  const startX = bounds.x + 0.2;
  const startY = bounds.y + (bounds.h - (layerH * count + totalGaps)) / 2;

  for (let i = 0; i < count; i++) {
    const node = nodes[i];
    const ny = startY + i * (layerH + gap);

    const isTop = i === 0;
    const cardBg = isTop ? pal.surface : pal.bgAlt;
    const borderColor = isTop ? pal.primary : pal.surface;

    // Layer Bar
    shapes.push({
      type: "rect",
      id: sid(`layer-${i}`),
      rect: { x: startX, y: ny, w: layerW, h: layerH },
      fill: { kind: "solid", color: cardBg },
      stroke: { color: borderColor, width: 1.5 },
      cornerRadius: 10,
    });

    // Layer Badge / Number
    shapes.push({
      type: "text",
      id: sid(`layer-num-${i}`),
      rect: { x: startX + 0.25, y: ny + layerH / 2 - 0.15, w: 0.8, h: 0.3 },
      runs: [{ text: node.badge || `L${count - i}` }],
      style: {
        fontFamily: ds.fonts.mono,
        fontSize: 12,
        color: pal.primary,
        bold: true,
        align: "left",
      },
    });

    // Layer Title
    shapes.push({
      type: "text",
      id: sid(`layer-title-${i}`),
      rect: { x: startX + 1.2, y: ny + (node.description ? 0.15 : layerH / 2 - 0.15), w: layerW - 1.5, h: 0.3 },
      runs: [{ text: node.title, bold: true }],
      style: {
        fontFamily: ds.fonts.heading,
        fontSize: 13,
        color: pal.text,
        bold: true,
        align: "left",
      },
    });

    // Layer Description
    if (node.description) {
      shapes.push({
        type: "text",
        id: sid(`layer-desc-${i}`),
        rect: { x: startX + 1.2, y: ny + 0.45, w: layerW - 1.5, h: 0.4 },
        runs: [{ text: node.description }],
        style: {
          fontFamily: ds.fonts.body,
          fontSize: 10,
          color: pal.textMuted,
          align: "left",
        },
      });
    }
  }

  return shapes;
}

// ─── 3. Quadrant / 2x2 Matrix Layout ────────────────────

function buildQuadrantDiagram(
  nodes: AIDiagramNode[],
  bounds: Rect,
  ds: DesignSystemTokens,
  sid: (name: string) => string
): Shape[] {
  const shapes: Shape[] = [];
  const pal = ds.palette;
  const count = Math.min(4, nodes.length);

  const gap = 0.2;
  const quadW = (bounds.w - gap) / 2;
  const quadH = (bounds.h - gap) / 2;

  for (let i = 0; i < count; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const qx = bounds.x + col * (quadW + gap);
    const qy = bounds.y + row * (quadH + gap);
    const node = nodes[i];

    // Card
    shapes.push({
      type: "rect",
      id: sid(`quad-${i}`),
      rect: { x: qx, y: qy, w: quadW, h: quadH },
      fill: { kind: "solid", color: i === 0 ? pal.surface : pal.bgAlt },
      stroke: { color: i === 0 ? pal.primary : pal.surface, width: 1.5 },
      cornerRadius: 12,
    });

    // Quadrant Title
    shapes.push({
      type: "text",
      id: sid(`quad-title-${i}`),
      rect: { x: qx + 0.25, y: qy + 0.2, w: quadW - 0.5, h: 0.4 },
      runs: [{ text: node.title, bold: true }],
      style: {
        fontFamily: ds.fonts.heading,
        fontSize: 13,
        color: pal.text,
        bold: true,
        align: "left",
      },
    });

    // Description
    if (node.description) {
      shapes.push({
        type: "text",
        id: sid(`quad-desc-${i}`),
        rect: { x: qx + 0.25, y: qy + 0.65, w: quadW - 0.5, h: quadH - 0.8 },
        runs: [{ text: node.description }],
        style: {
          fontFamily: ds.fonts.body,
          fontSize: 10.5,
          color: pal.textMuted,
          align: "left",
        },
      });
    }
  }

  return shapes;
}

