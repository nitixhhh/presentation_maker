/**
 * Engine v2 — Style Families
 *
 * 10 distinct visual style families that define shape language,
 * background treatments, decorations, image treatments, and mood affinities.
 * Each family represents a cohesive visual identity for presentations.
 */

// ─── Types ───────────────────────────────────────────────

/** Shape language tokens for a style family */
export interface StyleFamilyShape {
  /** Border radius in CSS px (0 = sharp corners) */
  radius: number;
  /** Stroke width in px (0 = no stroke) */
  stroke: number;
  /** Whether drop shadows are used */
  shadow: boolean;
}

/** Full definition of a style family */
export interface StyleFamily {
  /** Unique identifier (kebab-case) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Shape language parameters */
  shapeLanguage: StyleFamilyShape;
  /** Supported background treatments */
  bgTreatments: string[];
  /** Decorative primitives used in layouts */
  decorationPrimitives: string[];
  /** Image treatment options */
  imageTreatments: string[];
  /** Icon rendering style */
  iconStyle: string;
  /** Divider line style */
  dividerStyle: string;
  /** Whether this family defaults to dark mode */
  prefersDark: boolean;
  /** Mood keywords this family is best suited for */
  moodAffinities: string[];
}

// ─── Style Family Definitions ───────────────────────────

/**
 * All 10 style families.
 * Each family defines a complete visual language for presentations.
 */
export const STYLE_FAMILIES: readonly StyleFamily[] = [
  {
    id: "editorial-serif",
    name: "Editorial Serif",
    shapeLanguage: { radius: 0, stroke: 1, shadow: false },
    bgTreatments: ["solid", "gradient"],
    decorationPrimitives: ["accent-bar", "big-numeral", "diagonal-cut"],
    imageTreatments: ["full-bleed-scrim", "framed", "duotone"],
    iconStyle: "outlined",
    dividerStyle: "thin-line",
    prefersDark: false,
    moodAffinities: ["editorial", "elegant", "corporate"],
  },
  {
    id: "bold-geometric",
    name: "Bold Geometric",
    shapeLanguage: { radius: 8, stroke: 3, shadow: false },
    bgTreatments: ["solid", "gradient", "pattern"],
    decorationPrimitives: ["circle", "diagonal-cut", "big-numeral", "accent-bar"],
    imageTreatments: ["rounded-mask", "circle-crop", "framed"],
    iconStyle: "filled",
    dividerStyle: "thick-bar",
    prefersDark: false,
    moodAffinities: ["bold", "playful", "corporate"],
  },
  {
    id: "glass-gradient",
    name: "Glass Gradient",
    shapeLanguage: { radius: 16, stroke: 1, shadow: true },
    bgTreatments: ["gradient", "mesh"],
    decorationPrimitives: ["blob", "circle", "dot-grid"],
    imageTreatments: ["rounded-mask", "circle-crop", "duotone"],
    iconStyle: "duotone",
    dividerStyle: "gradient-fade",
    prefersDark: true,
    moodAffinities: ["techy", "elegant", "calm"],
  },
  {
    id: "bento-grid",
    name: "Bento Grid",
    shapeLanguage: { radius: 12, stroke: 0, shadow: true },
    bgTreatments: ["solid", "gradient"],
    decorationPrimitives: ["accent-bar", "dot-grid", "big-numeral"],
    imageTreatments: ["rounded-mask", "framed", "full-bleed-scrim"],
    iconStyle: "filled",
    dividerStyle: "none",
    prefersDark: false,
    moodAffinities: ["techy", "corporate", "bold"],
  },
  {
    id: "neo-brutalist",
    name: "Neo-Brutalist",
    shapeLanguage: { radius: 0, stroke: 4, shadow: true },
    bgTreatments: ["solid", "pattern", "noise"],
    decorationPrimitives: [
      "accent-bar",
      "big-numeral",
      "diagonal-cut",
      "dot-grid",
    ],
    imageTreatments: ["framed", "full-bleed-scrim", "duotone"],
    iconStyle: "filled",
    dividerStyle: "thick-bar",
    prefersDark: false,
    moodAffinities: ["bold", "playful", "editorial"],
  },
  {
    id: "soft-pastel-organic",
    name: "Soft Pastel Organic",
    shapeLanguage: { radius: 24, stroke: 0, shadow: true },
    bgTreatments: ["solid", "gradient", "mesh"],
    decorationPrimitives: ["blob", "circle", "dot-grid"],
    imageTreatments: ["rounded-mask", "circle-crop", "duotone"],
    iconStyle: "outlined",
    dividerStyle: "dotted",
    prefersDark: false,
    moodAffinities: ["calm", "warm", "playful"],
  },
  {
    id: "dark-tech-neon",
    name: "Dark Tech Neon",
    shapeLanguage: { radius: 4, stroke: 1, shadow: true },
    bgTreatments: ["solid", "gradient", "noise"],
    decorationPrimitives: [
      "accent-bar",
      "dot-grid",
      "diagonal-cut",
      "big-numeral",
    ],
    imageTreatments: ["duotone", "full-bleed-scrim", "rounded-mask"],
    iconStyle: "outlined",
    dividerStyle: "glow-line",
    prefersDark: true,
    moodAffinities: ["techy", "bold", "elegant"],
  },
  {
    id: "minimal-swiss",
    name: "Minimal Swiss",
    shapeLanguage: { radius: 0, stroke: 1, shadow: false },
    bgTreatments: ["solid"],
    decorationPrimitives: ["accent-bar", "big-numeral"],
    imageTreatments: ["full-bleed-scrim", "framed", "rounded-mask"],
    iconStyle: "outlined",
    dividerStyle: "thin-line",
    prefersDark: false,
    moodAffinities: ["corporate", "elegant", "calm"],
  },
  {
    id: "retro-print",
    name: "Retro Print",
    shapeLanguage: { radius: 4, stroke: 3, shadow: true },
    bgTreatments: ["solid", "pattern", "noise"],
    decorationPrimitives: [
      "accent-bar",
      "big-numeral",
      "circle",
      "diagonal-cut",
    ],
    imageTreatments: ["duotone", "framed", "circle-crop"],
    iconStyle: "filled",
    dividerStyle: "dashed",
    prefersDark: false,
    moodAffinities: ["playful", "warm", "editorial"],
  },
  {
    id: "magazine-photo-led",
    name: "Magazine Photo-Led",
    shapeLanguage: { radius: 0, stroke: 0, shadow: false },
    bgTreatments: ["solid", "gradient"],
    decorationPrimitives: ["accent-bar", "big-numeral", "diagonal-cut"],
    imageTreatments: ["full-bleed-scrim", "duotone", "framed"],
    iconStyle: "outlined",
    dividerStyle: "thin-line",
    prefersDark: false,
    moodAffinities: ["editorial", "elegant", "bold", "warm"],
  },
] as const;

/**
 * Find a style family by its ID.
 *
 * @param id - The style family ID (kebab-case)
 * @returns The matching StyleFamily, or undefined if not found
 */
export function getStyleFamily(id: string): StyleFamily | undefined {
  return STYLE_FAMILIES.find((f) => f.id === id);
}

/**
 * Get all style families that have affinity for a given mood.
 *
 * @param mood - The mood keyword to match
 * @returns Array of matching style families (may be empty)
 */
export function familiesForMood(mood: string): StyleFamily[] {
  return STYLE_FAMILIES.filter((f) => f.moodAffinities.includes(mood));
}
