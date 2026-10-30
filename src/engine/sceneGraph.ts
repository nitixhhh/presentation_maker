/**
 * Engine v2 — Scene Graph
 *
 * ONE geometry source. All emitters (HTML, PDF, PPTX) read from this.
 * Coordinates are in INCHES (matching PPTX native units).
 */

// ─── Rect ────────────────────────────────────────────────
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Color ───────────────────────────────────────────────
/** Hex string like "#6366F1" or gradient spec */
export interface SolidFill { kind: "solid"; color: string; opacity?: number }
export interface GradientFill {
  kind: "gradient";
  type: "linear" | "radial";
  angle?: number;
  stops: Array<{ color: string; pos: number }>;
}
export interface NoFill { kind: "none" }
export type Fill = SolidFill | GradientFill | NoFill;

// ─── Text ────────────────────────────────────────────────
export type TextAlign = "left" | "center" | "right";
export type TextValign = "top" | "middle" | "bottom";

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  lineHeight?: number;
  align?: TextAlign;
  valign?: TextValign;
  charSpacing?: number;
  textTransform?: "uppercase" | "none";
}

// ─── Shape types ─────────────────────────────────────────
export interface BaseShape {
  id: string;
  rect: Rect;
  zIndex?: number;
  rotation?: number;
  opacity?: number;
}

export interface RectShape extends BaseShape {
  type: "rect";
  fill: Fill;
  cornerRadius?: number;
  stroke?: { color: string; width: number };
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
}

export interface TextShape extends BaseShape {
  type: "text";
  runs: TextRun[];
  style: TextStyle;
  /** If text measurement shows overflow, set this so the fix loop can shorten */
  needsShorten?: boolean;
}

export interface BulletListShape extends BaseShape {
  type: "bulletList";
  items: string[];
  bulletStyle: "disc" | "number" | "dash" | "none";
  bulletColor: string;
  style: TextStyle;
  itemSpacing?: number;
}

export interface ImageShape extends BaseShape {
  type: "image";
  /** Local file path or base64 data URI — NEVER a remote URL */
  src: string;
  alt: string;
  objectFit: "cover" | "contain";
  cornerRadius?: number;
  /** Gradient scrim overlay for text readability on photo backgrounds */
  overlay?: GradientFill;
  credit?: string;
}

export interface IconShape extends BaseShape {
  type: "icon";
  /** Lucide icon name (e.g. "zap", "globe", "chart-bar") */
  iconName: string;
  color: string;
  size: number;
}

export interface ChartShape extends BaseShape {
  type: "chart";
  /** PNG bytes (base64) rendered from ECharts */
  chartPng: string;
  title?: string;
}

export interface DiagramShape extends BaseShape {
  type: "diagram";
  /** For native diagrams (process, cycle, pyramid, etc.) drawn by code */
  diagramKind: "process" | "cycle" | "pyramid" | "funnel" | "timeline" | "matrix" | "flowchart" | "sequence";
  /** Simple JSON data for native diagrams */
  data: Record<string, unknown>;
  /** Fallback: Mermaid syntax for complex flowcharts/sequence diagrams */
  mermaidSyntax?: string;
  /** Rendered PNG (base64) for PPTX embedding */
  renderedPng?: string;
}

export interface BigNumberShape extends BaseShape {
  type: "bigNumber";
  number: string;
  label: string;
  supporting?: string;
  numberStyle: TextStyle;
  labelStyle: TextStyle;
}

// ─── Shape union ─────────────────────────────────────────
export type Shape =
  | RectShape
  | TextShape
  | BulletListShape
  | ImageShape
  | IconShape
  | ChartShape
  | DiagramShape
  | BigNumberShape;

// ─── Scene Graph Slide ───────────────────────────────────
export interface SceneGraphSlide {
  index: number;
  layoutId: string;
  layoutVariant: number;
  background: Fill;
  shapes: Shape[];
  speakerNotes: string;
}

// ─── Full Scene Graph ────────────────────────────────────
export interface SceneGraph {
  deckId: string;
  topic: string;
  slideCount: number;
  slides: SceneGraphSlide[];
  /** Design system tokens used — emitters reference this for global styles */
  designSystem: DesignSystemTokens;
}

// ─── Design System Tokens (referenced by scene graph) ────
export interface DesignSystemTokens {
  styleFamily: string;
  isDark: boolean;
  palette: PaletteTokens;
  fonts: FontTokens;
  shape: ShapeTokens;
  bgTreatment: string;
  decorSet: string;
  imageTreatment: string;
  iconStyle: string;
}

export interface PaletteTokens {
  bg: string;
  bgAlt: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textMuted: string;
  onPrimary: string;
  gradient: { c1: string; c2: string; angle: number };
}

export interface FontTokens {
  heading: string;
  body: string;
  mono: string;
  /** PPTX-safe fallback fonts (installed on typical Windows/Mac) */
  pptxHeading: string;
  pptxBody: string;
  googleFontUrl: string;
}

export interface ShapeTokens {
  radius: number;
  stroke: number;
  shadow: boolean;
}

