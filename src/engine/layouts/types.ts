/**
 * Engine v2 — Layout type definitions
 *
 * Layouts live in code. LLMs NEVER output coordinates or geometry.
 * Each layout defines named slots with strict constraints.
 */

import type { Rect, Fill, Shape, TextAlign, TextValign } from "../sceneGraph";
import type { DesignSystemTokens } from "../sceneGraph";

// ─── Seeded RNG type ─────────────────────────────────────
export type RNG = () => number; // Returns 0..1

// ─── Slot roles ──────────────────────────────────────────
export type TextRole = "title" | "subtitle" | "body" | "caption" | "stat" | "label" | "kicker";

export type SlotKind = "text" | "list" | "image" | "chart" | "diagram" | "icon" | "bigNumber";

// ─── Slot definitions ────────────────────────────────────

export interface TextSlot {
  kind: "text";
  role: TextRole;
  rect: Rect;
  minPt: number;
  maxPt: number;
  maxChars: number;
  maxLines: number;
  align: TextAlign;
  valign?: TextValign;
  bold?: boolean;
  italic?: boolean;
  textTransform?: "uppercase" | "none";
}

export interface ListSlot {
  kind: "list";
  rect: Rect;
  minPt: number;
  maxPt: number;
  maxItems: number;
  maxCharsPerItem: number;
  bulletStyle: "disc" | "number" | "dash" | "none";
}

export interface ImageSlot {
  kind: "image";
  rect: Rect;
  aspectRatio: number; // w/h
  cornerRadius?: number;
  objectFit: "cover" | "contain";
  /** If true, this image extends beyond safe area (full-bleed) */
  fullBleed?: boolean;
}

export interface ChartSlot {
  kind: "chart";
  rect: Rect;
}

export interface DiagramSlot {
  kind: "diagram";
  rect: Rect;
  diagramKind?: string;
}

export interface IconSlot {
  kind: "icon";
  rect: Rect;
  iconSize: number; // in pt
}

export interface BigNumberSlot {
  kind: "bigNumber";
  rect: Rect;
  numberMaxPt: number;
  numberMinPt: number;
  labelMaxPt: number;
}

export type Slot = TextSlot | ListSlot | ImageSlot | ChartSlot | DiagramSlot | IconSlot | BigNumberSlot;

// ─── Slide role (what the Director assigns) ──────────────
export type SlideRole =
  | "cover"
  | "agenda"
  | "section"
  | "statement"
  | "stat"
  | "comparison"
  | "process"
  | "timeline"
  | "data"
  | "diagram"
  | "quote"
  | "gallery"
  | "takeaways"
  | "cta";

// ─── Layout density ──────────────────────────────────────
export type LayoutDensity = "low" | "med" | "high";

// ─── Layout definition ──────────────────────────────────
export interface LayoutDefinition {
  id: string;
  name: string;
  /** Which slide roles this layout is suitable for */
  roles: SlideRole[];
  density: LayoutDensity;
  /** Named slots that SlideWriter fills with content */
  slots: Record<string, Slot>;
  /**
   * Generate decoration shapes (accent bars, blobs, background patterns, etc.)
   * These are purely visual and are NOT filled by the LLM.
   */
  decorations: (ds: DesignSystemTokens, rng: RNG) => Shape[];
  /** Number of geometry variants (image left/right, dark/light bg, alignment flip) */
  variants: number;
  /**
   * Build the scene graph shapes for this layout.
   * Takes the design system, the slot content, the variant index, and an RNG.
   * Returns all shapes to place on the slide.
   */
  buildShapes: (params: LayoutBuildParams) => Shape[];
}

export interface LayoutBuildParams {
  ds: DesignSystemTokens;
  slotContent: Record<string, SlotContent>;
  variant: number;
  rng: RNG;
  slideIndex: number;
}

// ─── Slot content (what SlideWriter provides) ─────────────
export interface TextSlotContent {
  kind: "text";
  text: string;
}

export interface ListSlotContent {
  kind: "list";
  items: string[];
}

export interface ImageSlotContent {
  kind: "image";
  src: string;
  alt: string;
  credit?: string;
}

export interface ChartSlotContent {
  kind: "chart";
  chartPng: string;
  title?: string;
}

export interface DiagramSlotContent {
  kind: "diagram";
  data: Record<string, unknown>;
  mermaidSyntax?: string;
  renderedPng?: string;
}

export interface IconSlotContent {
  kind: "icon";
  iconName: string;
}

export interface BigNumberSlotContent {
  kind: "bigNumber";
  number: string;
  label: string;
  supporting?: string;
}

export type SlotContent =
  | TextSlotContent
  | ListSlotContent
  | ImageSlotContent
  | ChartSlotContent
  | DiagramSlotContent
  | IconSlotContent
  | BigNumberSlotContent;

