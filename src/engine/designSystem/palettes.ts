/**
 * Engine v2 — OKLCH-based Palette Generator
 *
 * Generates deterministic color palettes using OKLCH color space with
 * harmony schemes. All colors are output as hex strings.
 * Includes inline OKLCH→sRGB conversion (zero external deps).
 */

import type { PaletteTokens } from "@/engine/sceneGraph";

// ─── Public types ────────────────────────────────────────

/** Supported color harmony schemes */
export type HarmonyScheme =
  | "analogous"
  | "complementary"
  | "triadic"
  | "split-complementary"
  | "mono-plus-accent";

// ─── OKLCH → sRGB Math ──────────────────────────────────

/**
 * Convert OKLCH (L: 0-1, C: 0-0.4, H: 0-360) to linear sRGB.
 * Uses the OKLab intermediary with the standard matrix transforms.
 */
function oklchToLinearRgb(
  L: number,
  C: number,
  H: number
): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab → LMS (cube-root domain)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  // Cube to get LMS
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS → linear sRGB
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [r, g, bl];
}

/** sRGB gamma companding (linear → gamma) */
function linearToGamma(c: number): number {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Clamp a value between 0 and 1 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Convert OKLCH to a hex color string.
 * Out-of-gamut colors are clamped to sRGB by reducing chroma iteratively.
 */
function oklchToHex(L: number, C: number, H: number): string {
  // Normalize hue to 0-360
  const hue = ((H % 360) + 360) % 360;

  // Gamut-map by reducing chroma until in-gamut
  let c = C;
  let rgb: [number, number, number];
  for (let i = 0; i < 20; i++) {
    rgb = oklchToLinearRgb(L, c, hue);
    const inGamut = rgb.every((v) => v >= -0.001 && v <= 1.001);
    if (inGamut) break;
    c *= 0.9;
  }
  rgb = oklchToLinearRgb(L, c, hue);

  const r = Math.round(clamp01(linearToGamma(clamp01(rgb[0]))) * 255);
  const g = Math.round(clamp01(linearToGamma(clamp01(rgb[1]))) * 255);
  const b = Math.round(clamp01(linearToGamma(clamp01(rgb[2]))) * 255);

  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  ).toUpperCase();
}

// ─── Relative Luminance & Contrast ──────────────────────

/**
 * Parse a hex color string to [r, g, b] in 0-255.
 * Supports both "#RGB" and "#RRGGBB".
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Convert an sRGB channel (0-255) to linear light */
function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Compute WCAG relative luminance from a hex color */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/**
 * Compute the WCAG 2.x contrast ratio between two hex colors.
 * Returns a value ≥ 1 (e.g. 4.5 means 4.5:1).
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Lightness ladders ──────────────────────────────────

/**
 * Fixed lightness ladders for dark and light modes.
 * Each role gets a specific OKLCH L value.
 */
interface LightnessLadder {
  bg: number;
  bgAlt: number;
  surface: number;
  primary: number;
  secondary: number;
  accent: number;
  text: number;
  textMuted: number;
  onPrimary: number;
  gradC1: number;
  gradC2: number;
}

const DARK_LADDER: LightnessLadder = {
  bg: 0.15,
  bgAlt: 0.18,
  surface: 0.22,
  primary: 0.68,
  secondary: 0.58,
  accent: 0.75,
  text: 0.95,
  textMuted: 0.7,
  onPrimary: 0.13,
  gradC1: 0.55,
  gradC2: 0.7,
};

const LIGHT_LADDER: LightnessLadder = {
  bg: 0.97,
  bgAlt: 0.94,
  surface: 0.99,
  primary: 0.5,
  secondary: 0.55,
  accent: 0.6,
  text: 0.17,
  textMuted: 0.45,
  onPrimary: 0.97,
  gradC1: 0.55,
  gradC2: 0.42,
};

// ─── Harmony hue derivation ─────────────────────────────

/**
 * Derive secondary and accent hues from a base hue using
 * the selected harmony scheme.
 */
function deriveHues(
  baseHue: number,
  scheme: HarmonyScheme
): { secondary: number; accent: number } {
  const wrap = (h: number) => ((h % 360) + 360) % 360;
  switch (scheme) {
    case "analogous":
      return { secondary: wrap(baseHue + 30), accent: wrap(baseHue - 30) };
    case "complementary":
      return { secondary: wrap(baseHue + 180), accent: wrap(baseHue + 210) };
    case "triadic":
      return { secondary: wrap(baseHue + 120), accent: wrap(baseHue + 240) };
    case "split-complementary":
      return { secondary: wrap(baseHue + 150), accent: wrap(baseHue + 210) };
    case "mono-plus-accent":
      return { secondary: wrap(baseHue + 15), accent: wrap(baseHue + 180) };
  }
}

// ─── Contrast enforcement ───────────────────────────────

/**
 * Adjust a text color to meet WCAG contrast requirements against a background.
 * Iteratively increases/decreases lightness until the ratio threshold is met.
 * @param textL - starting OKLCH lightness for text
 * @param textC - OKLCH chroma for text
 * @param textH - OKLCH hue for text
 * @param bgHex - background hex color
 * @param minRatio - minimum contrast ratio (4.5 for body, 3 for large)
 * @param isDark - if true, push text lighter; if false, push text darker
 */
function enforceContrast(
  textL: number,
  textC: number,
  textH: number,
  bgHex: string,
  minRatio: number,
  isDark: boolean
): string {
  let L = textL;
  const step = isDark ? 0.03 : -0.03;

  for (let i = 0; i < 30; i++) {
    const hex = oklchToHex(L, textC, textH);
    if (contrastRatio(hex, bgHex) >= minRatio) return hex;
    L = clamp01(L + step);
  }
  // Fallback: pure white or black
  return isDark ? "#FFFFFF" : "#000000";
}

// ─── Main palette generator ─────────────────────────────

/**
 * Generate a full color palette from a base hue, harmony scheme, and mode.
 *
 * @param hue - Base OKLCH hue (0-360)
 * @param harmony - Color harmony scheme
 * @param isDark - Whether to generate a dark-mode palette
 * @returns PaletteTokens with all roles as hex strings
 *
 * Guarantees:
 * - WCAG ≥4.5:1 contrast for `text` on `bg`
 * - WCAG ≥3:1 contrast for `textMuted` on `bg` (large text threshold)
 * - ≥4 visually distinct palette roles
 */
export function generatePalette(
  hue: number,
  harmony: HarmonyScheme,
  isDark: boolean
): PaletteTokens {
  const ladder = isDark ? DARK_LADDER : LIGHT_LADDER;
  const { secondary: secHue, accent: accHue } = deriveHues(hue, harmony);

  // Standard chroma values
  const lowC = 0.02; // near-neutral for bg/surface
  const midC = 0.14; // moderate for secondary
  const highC = 0.18; // vivid for primary/accent

  // Generate base colors
  const bg = oklchToHex(ladder.bg, lowC, hue);
  const bgAlt = oklchToHex(ladder.bgAlt, lowC, hue);
  const surface = oklchToHex(ladder.surface, lowC, hue);

  const primary = oklchToHex(ladder.primary, highC, hue);
  const secondary = oklchToHex(ladder.secondary, midC, secHue);
  const accent = oklchToHex(ladder.accent, highC, accHue);

  // Text colors with WCAG enforcement
  const text = enforceContrast(ladder.text, 0.01, hue, bg, 4.5, isDark);
  const textMuted = enforceContrast(
    ladder.textMuted,
    0.03,
    hue,
    bg,
    3.0,
    isDark
  );

  // onPrimary: text on primary-colored backgrounds
  const onPrimary = enforceContrast(
    ladder.onPrimary,
    0.01,
    hue,
    primary,
    4.5,
    !isDark
  );

  // Gradient
  const gradient = {
    c1: oklchToHex(ladder.gradC1, highC, hue),
    c2: oklchToHex(ladder.gradC2, midC, accHue),
    angle: 135,
  };

  return {
    bg,
    bgAlt,
    surface,
    primary,
    secondary,
    accent,
    text,
    textMuted,
    onPrimary,
    gradient,
  };
}
