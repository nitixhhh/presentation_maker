/**
 * Engine v2 — Font Pair System
 *
 * Curated font pairs with PPTX-safe fallbacks and Hindi support.
 * Each pair maps to system-installed fonts for reliable PPTX rendering.
 */

import type { FontTokens } from "@/engine/sceneGraph";

// ─── Font pair definition ───────────────────────────────

/** Internal definition for a curated font pair */
interface FontPairDef {
  /** Unique identifier for the pair */
  id: string;
  /** Display-friendly name */
  name: string;
  /** Google Font for headings */
  heading: string;
  /** Google Font for body text */
  body: string;
  /** Monospace font */
  mono: string;
  /** PPTX-safe heading fallback */
  pptxHeading: string;
  /** PPTX-safe body fallback */
  pptxBody: string;
  /** Google Fonts embed URL */
  googleFontUrl: string;
  /** Whether this pair has good Hindi/Devanagari support */
  supportsHindi: boolean;
  /** Style families this pair suits best */
  affinities: string[];
}

// ─── Curated font pairs ─────────────────────────────────

/**
 * 14 curated font pair definitions.
 * Each pairs a distinctive heading font with a readable body font,
 * maps to PPTX-safe system fonts, and notes Hindi support.
 */
export const FONT_PAIRS: readonly FontPairDef[] = [
  {
    id: "inter-jakarta",
    name: "Inter + Jakarta Sans",
    heading: "Inter",
    body: "Plus Jakarta Sans",
    mono: "JetBrains Mono",
    pptxHeading: "Calibri",
    pptxBody: "Calibri",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["minimal-swiss", "bento-grid", "bold-geometric"],
  },
  {
    id: "playfair-source",
    name: "Playfair Display + Source Sans 3",
    heading: "Playfair Display",
    body: "Source Sans 3",
    mono: "Source Code Pro",
    pptxHeading: "Georgia",
    pptxBody: "Calibri",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Sans+3:wght@400;600&family=Source+Code+Pro:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["editorial-serif", "magazine-photo-led", "soft-pastel-organic"],
  },
  {
    id: "space-grotesk-dm",
    name: "Space Grotesk + DM Sans",
    heading: "Space Grotesk",
    body: "DM Sans",
    mono: "DM Mono",
    pptxHeading: "Trebuchet MS",
    pptxBody: "Arial",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Sans:wght@400;500&family=DM+Mono:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["dark-tech-neon", "glass-gradient", "bold-geometric"],
  },
  {
    id: "bebas-roboto",
    name: "Bebas Neue + Roboto",
    heading: "Bebas Neue",
    body: "Roboto",
    mono: "Roboto Mono",
    pptxHeading: "Arial",
    pptxBody: "Arial",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["neo-brutalist", "bold-geometric", "retro-print"],
  },
  {
    id: "cormorant-fira",
    name: "Cormorant Garamond + Fira Sans",
    heading: "Cormorant Garamond",
    body: "Fira Sans",
    mono: "Fira Code",
    pptxHeading: "Times New Roman",
    pptxBody: "Calibri",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Fira+Sans:wght@400;500&family=Fira+Code:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["editorial-serif", "magazine-photo-led"],
  },
  {
    id: "poppins-nunito",
    name: "Poppins + Nunito",
    heading: "Poppins",
    body: "Nunito",
    mono: "JetBrains Mono",
    pptxHeading: "Verdana",
    pptxBody: "Verdana",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Nunito:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["soft-pastel-organic", "bento-grid", "glass-gradient"],
  },
  {
    id: "sora-outfit",
    name: "Sora + Outfit",
    heading: "Sora",
    body: "Outfit",
    mono: "IBM Plex Mono",
    pptxHeading: "Calibri",
    pptxBody: "Calibri",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Outfit:wght@400;500&family=IBM+Plex+Mono:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["minimal-swiss", "dark-tech-neon", "bento-grid"],
  },
  {
    id: "fraunces-cabinet",
    name: "Fraunces + Cabinet Grotesk",
    heading: "Fraunces",
    body: "Cabinet Grotesk",
    mono: "JetBrains Mono",
    pptxHeading: "Cambria",
    pptxBody: "Calibri",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,900&family=JetBrains+Mono:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["retro-print", "editorial-serif", "soft-pastel-organic"],
  },
  {
    id: "archivo-work",
    name: "Archivo Black + Work Sans",
    heading: "Archivo Black",
    body: "Work Sans",
    mono: "Fira Code",
    pptxHeading: "Arial",
    pptxBody: "Arial",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Work+Sans:wght@400;500;600&family=Fira+Code:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["neo-brutalist", "bold-geometric", "magazine-photo-led"],
  },
  {
    id: "lora-raleway",
    name: "Lora + Raleway",
    heading: "Lora",
    body: "Raleway",
    mono: "Source Code Pro",
    pptxHeading: "Georgia",
    pptxBody: "Trebuchet MS",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=Raleway:wght@400;500;600&family=Source+Code+Pro:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["editorial-serif", "soft-pastel-organic", "magazine-photo-led"],
  },
  {
    id: "urbanist-figtree",
    name: "Urbanist + Figtree",
    heading: "Urbanist",
    body: "Figtree",
    mono: "JetBrains Mono",
    pptxHeading: "Calibri",
    pptxBody: "Calibri",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Urbanist:wght@400;600;700&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap",
    supportsHindi: false,
    affinities: ["glass-gradient", "minimal-swiss", "bento-grid"],
  },
  // ── Hindi-supporting pairs ─────────────────────────────
  {
    id: "noto-hindi-sans",
    name: "Noto Sans Devanagari + Noto Sans",
    heading: "Noto Sans Devanagari",
    body: "Noto Sans",
    mono: "Noto Sans Mono",
    pptxHeading: "Nirmala UI",
    pptxBody: "Nirmala UI",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans:wght@400;500;600&family=Noto+Sans+Mono:wght@400&display=swap",
    supportsHindi: true,
    affinities: [
      "minimal-swiss",
      "bento-grid",
      "bold-geometric",
      "soft-pastel-organic",
    ],
  },
  {
    id: "mukta-hind",
    name: "Mukta + Hind",
    heading: "Mukta",
    body: "Hind",
    mono: "Noto Sans Mono",
    pptxHeading: "Mangal",
    pptxBody: "Mangal",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Mukta:wght@400;600;700&family=Hind:wght@400;500;600&family=Noto+Sans+Mono:wght@400&display=swap",
    supportsHindi: true,
    affinities: [
      "editorial-serif",
      "neo-brutalist",
      "dark-tech-neon",
      "retro-print",
    ],
  },
  {
    id: "tiro-devnag-laila",
    name: "Tiro Devanagari Hindi + Laila",
    heading: "Tiro Devanagari Hindi",
    body: "Laila",
    mono: "Noto Sans Mono",
    pptxHeading: "Nirmala UI",
    pptxBody: "Nirmala UI",
    googleFontUrl:
      "https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi:wght@400&family=Laila:wght@400;500;600&family=Noto+Sans+Mono:wght@400&display=swap",
    supportsHindi: true,
    affinities: [
      "editorial-serif",
      "magazine-photo-led",
      "glass-gradient",
      "soft-pastel-organic",
    ],
  },
] as const;

// ─── Font pair selector ─────────────────────────────────

/**
 * Select a font pair by family ID and language.
 *
 * If the language is "hi" (Hindi) and the requested pair doesn't support
 * Hindi, falls back to the best Hindi pair. If familyId is not found,
 * returns the first pair (or first Hindi pair for Hindi language).
 *
 * @param familyId - Unique identifier of the desired font pair
 * @param language - ISO 639-1 language code (e.g. "en", "hi")
 * @returns FontTokens ready for use in the design system
 */
export function selectFontPair(familyId: string, language: string): FontTokens {
  const isHindi = language.toLowerCase().startsWith("hi");

  // Try exact match first
  let pair = FONT_PAIRS.find((p) => p.id === familyId);

  // If Hindi needed but pair doesn't support it, find a Hindi pair
  if (isHindi && pair && !pair.supportsHindi) {
    pair = FONT_PAIRS.find((p) => p.supportsHindi) ?? pair;
  }

  // If no exact match, pick default
  if (!pair) {
    pair = isHindi
      ? FONT_PAIRS.find((p) => p.supportsHindi) ?? FONT_PAIRS[0]
      : FONT_PAIRS[0];
  }

  return {
    heading: pair.heading,
    body: pair.body,
    mono: pair.mono,
    pptxHeading: pair.pptxHeading,
    pptxBody: pair.pptxBody,
    googleFontUrl: pair.googleFontUrl,
  };
}

/**
 * Get the best font pair ID for a given style family and language.
 * Searches by affinity match; falls back to default if none found.
 *
 * @param styleFamilyId - The style family ID to match against
 * @param language - ISO 639-1 language code
 * @returns The best-matching font pair ID
 */
export function bestFontPairForFamily(
  styleFamilyId: string,
  language: string
): string {
  const isHindi = language.toLowerCase().startsWith("hi");
  const candidates = FONT_PAIRS.filter(
    (p) => (!isHindi || p.supportsHindi) && p.affinities.includes(styleFamilyId)
  );

  if (candidates.length > 0) return candidates[0].id;

  // Fallback: first Hindi-supporting or first overall
  if (isHindi) {
    return FONT_PAIRS.find((p) => p.supportsHindi)?.id ?? FONT_PAIRS[0].id;
  }
  return FONT_PAIRS[0].id;
}
