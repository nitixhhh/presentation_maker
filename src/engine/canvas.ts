/**
 * Engine v2 — Canvas constants
 * Single source of truth for slide geometry. All emitters read from here.
 * Canvas: 13.333 × 7.5 inches (standard 16:9)
 */

export const CANVAS = {
  /** Width in inches */
  W: 13.333,
  /** Height in inches */
  H: 7.5,
  /** Aspect ratio */
  ASPECT: 16 / 9,

  /** Safe area margins (nothing except full-bleed elements may exceed these) */
  SAFE: {
    LEFT: 0.6,
    RIGHT: 0.6,
    TOP: 0.5,
    BOTTOM: 0.5,
  },

  /** 12-column grid */
  GRID: {
    COLUMNS: 12,
    GUTTER: 0.2,
  },
} as const;

/** Safe area dimensions derived from canvas */
export const SAFE_AREA = {
  x: CANVAS.SAFE.LEFT,
  y: CANVAS.SAFE.TOP,
  w: CANVAS.W - CANVAS.SAFE.LEFT - CANVAS.SAFE.RIGHT,
  h: CANVAS.H - CANVAS.SAFE.TOP - CANVAS.SAFE.BOTTOM,
} as const;

/**
 * Calculate the x position and width for a column span in the 12-col grid.
 * col and span are 1-indexed: col(1, 6) = first 6 columns.
 */
export function gridCol(startCol: number, span: number): { x: number; w: number } {
  const totalGutters = CANVAS.GRID.COLUMNS - 1;
  const totalGutterWidth = totalGutters * CANVAS.GRID.GUTTER;
  const colWidth = (SAFE_AREA.w - totalGutterWidth) / CANVAS.GRID.COLUMNS;
  const x = SAFE_AREA.x + (startCol - 1) * (colWidth + CANVAS.GRID.GUTTER);
  const w = span * colWidth + (span - 1) * CANVAS.GRID.GUTTER;
  return { x: Math.round(x * 1000) / 1000, w: Math.round(w * 1000) / 1000 };
}

/** Pixel equivalents for HTML rendering (at 96 DPI) */
export const CANVAS_PX = {
  W: 1280,
  H: 720,
  SCALE: 1280 / CANVAS.W,
} as const;

/** Convert inches to pixels */
export function inToPx(inches: number): number {
  return Math.round(inches * CANVAS_PX.SCALE);
}

