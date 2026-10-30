/**
 * Engine v2 — Design System Generator (code-only, no LLM)
 *
 * Input: seed, mood, language.
 * Output: complete DesignSystemTokens with deterministic, reproducible results.
 */

import type { DesignSystemTokens } from "@/engine/sceneGraph";
import { generatePalette, type HarmonyScheme } from "./palettes";
import { selectFontPair, bestFontPairForFamily } from "./fonts";
import { STYLE_FAMILIES, familiesForMood } from "./styleFamilies";

// ─── Mood enum ───────────────────────────────────────────
export type Mood =
  | "corporate"
  | "playful"
  | "elegant"
  | "bold"
  | "calm"
  | "techy"
  | "warm"
  | "editorial";

// ─── Seeded RNG (Mulberry32) ─────────────────────────────
/** Fast 32-bit seeded PRNG with uniform distribution */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Mood → base hue mapping ─────────────────────────────
const MOOD_HUE_RANGES: Record<Mood, [number, number]> = {
  corporate: [210, 240],  // Blue family
  playful: [30, 60],      // Orange-yellow
  elegant: [280, 320],    // Purple-magenta
  bold: [0, 30],          // Red-orange
  calm: [160, 200],       // Teal-cyan
  techy: [230, 270],      // Indigo-blue
  warm: [15, 45],         // Warm amber
  editorial: [25, 55],    // Cream-sand tones
};

// ─── Mood → preferred harmony schemes ────────────────────
const MOOD_HARMONIES: Record<Mood, HarmonyScheme[]> = {
  corporate: ["analogous", "mono-plus-accent"],
  playful: ["triadic", "split-complementary", "complementary"],
  elegant: ["analogous", "mono-plus-accent"],
  bold: ["complementary", "split-complementary", "triadic"],
  calm: ["analogous", "mono-plus-accent"],
  techy: ["complementary", "triadic", "split-complementary"],
  warm: ["analogous", "mono-plus-accent", "split-complementary"],
  editorial: ["mono-plus-accent", "analogous"],
};

// ─── Background treatment selection by family ────────────
function pickBgTreatment(
  treatments: readonly string[],
  rng: () => number
): string {
  return treatments[Math.floor(rng() * treatments.length)];
}

function pickDecoSet(
  primitives: readonly string[],
  rng: () => number
): string {
  // Pick 2-3 primitives as a comma-joined set
  const count = 2 + Math.floor(rng() * 2);
  const shuffled = [...primitives].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).join(",");
}

function pickImageTreatment(
  treatments: readonly string[],
  rng: () => number
): string {
  return treatments[Math.floor(rng() * treatments.length)];
}

/**
 * Generate a complete DesignSystem from seed + mood + language.
 * Fully deterministic: same inputs always produce the same output.
 */
export function generateDesignSystem(
  seed: number,
  mood: Mood,
  language: string
): DesignSystemTokens {
  const rng = mulberry32(seed);

  // 1. Pick style family based on mood affinity
  const candidates = familiesForMood(mood);
  const family =
    candidates.length > 0
      ? candidates[Math.floor(rng() * candidates.length)]
      : STYLE_FAMILIES[Math.floor(rng() * STYLE_FAMILIES.length)];

  // 2. Determine dark/light mode
  const isDark = family.prefersDark || rng() < 0.3;

  // 3. Generate palette
  const hueRange = MOOD_HUE_RANGES[mood];
  const baseHue = hueRange[0] + rng() * (hueRange[1] - hueRange[0]);
  const harmonies = MOOD_HARMONIES[mood];
  const harmony = harmonies[Math.floor(rng() * harmonies.length)];
  const palette = generatePalette(baseHue, harmony, isDark);

  // 4. Select fonts
  const fontPairId = bestFontPairForFamily(family.id, language);
  const fonts = selectFontPair(fontPairId, language);

  // 5. Shape tokens from family
  const shape = {
    radius: family.shapeLanguage.radius,
    stroke: family.shapeLanguage.stroke,
    shadow: family.shapeLanguage.shadow,
  };

  // 6. Select treatments
  const bgTreatment = pickBgTreatment(family.bgTreatments, rng);
  const decorSet = pickDecoSet(family.decorationPrimitives, rng);
  const imageTreatment = pickImageTreatment(family.imageTreatments, rng);
  const iconStyle = family.iconStyle;

  return {
    styleFamily: family.id,
    isDark,
    palette,
    fonts,
    shape,
    bgTreatment,
    decorSet,
    imageTreatment,
    iconStyle,
  };
}

