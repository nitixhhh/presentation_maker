import { FontPair } from "@/schemas/presentation";

export const CURATED_FONT_PAIRS: FontPair[] = [
  {
    id: "editorial-serif-inter",
    name: "Editorial Serif & Inter (Newsreader & Inter)",
    headingFont: "Newsreader",
    bodyFont: "Inter",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;0,6..72,800;1,6..72,400;1,6..72,600&display=swap",
    supportsHindi: true,
  },
  {
    id: "outfit-inter",
    name: "Outfit & Inter (Modern Tech)",
    headingFont: "Outfit",
    bodyFont: "Inter",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800;900&display=swap",
    supportsHindi: true,
  },
  {
    id: "space-grotesk-jakarta",
    name: "Space Grotesk & Plus Jakarta Sans",
    headingFont: "Space Grotesk",
    bodyFont: "Plus Jakarta Sans",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap",
    supportsHindi: false,
  },
  {
    id: "playfair-poppins",
    name: "Playfair Display & Poppins (Editorial Luxury)",
    headingFont: "Playfair Display",
    bodyFont: "Poppins",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600&family=Poppins:wght@400;500;600&display=swap",
    supportsHindi: true,
  },
  {
    id: "syne-manrope",
    name: "Syne & Manrope (Bold Creative)",
    headingFont: "Syne",
    bodyFont: "Manrope",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Syne:wght@700;800&display=swap",
    supportsHindi: false,
  },
  {
    id: "rozha-mukta-hindi",
    name: "Rozha One & Mukta (Devanagari Royal)",
    headingFont: "Rozha One",
    bodyFont: "Mukta",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Mukta:wght@400;500;600;700&family=Rozha+One&display=swap",
    supportsHindi: true,
  },
  {
    id: "poppins-noto-hindi",
    name: "Poppins & Noto Sans Devanagari (Clean Hindi/Hinglish)",
    headingFont: "Poppins",
    bodyFont: "Noto Sans Devanagari",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap",
    supportsHindi: true,
  },
  {
    id: "clash-display-satoshi",
    name: "Cabinet Grotesk & General Sans (Modern Geometric)",
    headingFont: "Cabinet Grotesk",
    bodyFont: "General Sans",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Outfit:wght@700;800&display=swap",
    supportsHindi: false,
  },
];

export function getFontPairForLanguage(language: "English" | "Hindi" | "Hinglish", seed?: number): FontPair {
  const eligible = CURATED_FONT_PAIRS.filter((f) => (language === "English" ? true : f.supportsHindi));
  const list = eligible.length > 0 ? eligible : CURATED_FONT_PAIRS;
  const index = seed !== undefined ? Math.abs(seed) % list.length : Math.floor(Math.random() * list.length);
  return list[index];
}

export function getFontPairById(id: string): FontPair | undefined {
  return CURATED_FONT_PAIRS.find((f) => f.id === id);
}
