/**
 * Engine v2 — Asset Pipeline: Dual Visual Generator
 *
 * Systematically delivers professional visual assets:
 *  1. Wikimedia Commons Public API: Returns authentic 1280px high-resolution photography
 *     for science, technology, history, and business topics.
 *  2. Gemini 2.5 Flash Vector SVG Generator: Produces bespoke 1280x720 vector SVG illustrations
 *     with custom gradients, lighting, and topic geometry.
 *
 * Guaranteed 0 empty visual slots, 0 blurred stock fallbacks.
 */

import { AIClient } from "@/lib/ai/client";

export interface ImageGenerationOptions {
  prompt: string;
  topic?: string;
  seed?: number;
  width?: number;
  height?: number;
  preferredStyle?: "photo" | "illustration" | "auto";
}

export interface ImageGenerationResult {
  src: string; // base64 data URI or verified high-res image URL
  alt: string;
  isAiGenerated: boolean;
  source: "wikimedia" | "gemini_svg" | "vector_geometric";
}

/**
 * Searches Wikimedia Commons for authentic, high-resolution educational & scientific photography
 */
async function searchWikimediaPhoto(query: string): Promise<string | null> {
  try {
    const cleanQuery = query.replace(/[^\w\s-]/g, " ").trim().split(" ").slice(0, 3).join(" ");
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanQuery
    )}&gsrlimit=4&prop=pageimages&pithumbsize=1280&format=json`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      headers: { "User-Agent": "DeckCraft-AI/2.0 (Executive Presentation Studio)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      const pages = Object.values(json.query?.pages || {}) as any[];
      const validImages = pages
        .map((p) => p.thumbnail?.source)
        .filter((src) => src && !src.includes(".svg.") && !src.endsWith(".svg"));

      if (validImages.length > 0) {
        return validImages[0];
      }
    }
  } catch (err) {
    console.warn("[VisualGenerator] Wikimedia fetch bypassed:", err);
  }
  return null;
}

/**
 * Generates a bespoke 1280x720 vector SVG illustration using Gemini 2.5 Flash
 */
async function generateGeminiVectorSvg(prompt: string, topic?: string): Promise<string | null> {
  const systemPrompt = `You are an elite Vector Graphic & Scientific Illustrator for Apple & McKinsey keynote slides.
Generate a clean, modern, visually stunning SVG illustration.

RULES:
1. Output ONLY valid, standalone <svg ...>...</svg> XML. NO markdown fences, no explanatory text.
2. viewBox="0 0 1280 720" width="100%" height="100%".
3. Use modern color palettes: dark backdrop (e.g. #0F172A or #18181B), elegant linear gradients, crisp vector geometry, glowing accents.
4. Draw concrete, recognizable subject matter (e.g. laboratory glassware, light spectrums, circuit nodes, server networks, charts, architectural blocks) based on the prompt.
5. Include subtle grid lines or ambient depth.`;

  const userPrompt = `TOPIC: "${topic || prompt}"
SCENE TO ILLUSTRATE: "${prompt}"

Generate the complete standalone SVG illustration.`;

  try {
    const response = await AIClient.complete("SlideWriter", [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], { temperature: 0.3 });

    let raw = response.text.replace(/```xml/gi, "").replace(/```svg/gi, "").replace(/```/gi, "").trim();
    const svgStart = raw.indexOf("<svg");
    const svgEnd = raw.lastIndexOf("</svg>");

    if (svgStart !== -1 && svgEnd !== -1) {
      raw = raw.slice(svgStart, svgEnd + 6);
      const base64 = Buffer.from(raw, "utf-8").toString("base64");
      return `data:image/svg+xml;base64,${base64}`;
    }
  } catch (err) {
    console.warn("[VisualGenerator] Gemini SVG generation bypassed:", err);
  }
  return null;
}

/**
 * Main entry point: Generates or retrieves a high-impact presentation visual
 */
export async function generateAIImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { prompt, topic, seed = 42, width = 1280, height = 720, preferredStyle = "auto" } = options;

  console.log(`[VisualGenerator] Synthesizing visual for: "${prompt.slice(0, 50)}..." (style=${preferredStyle})`);

  // 1. Try Wikimedia Commons if photo or auto
  if (preferredStyle === "photo" || preferredStyle === "auto") {
    const photoUrl = await searchWikimediaPhoto(topic || prompt);
    if (photoUrl) {
      console.log(`[VisualGenerator] ✓ Found high-res Wikimedia photo: ${photoUrl.slice(0, 60)}...`);
      return {
        src: photoUrl,
        alt: prompt,
        isAiGenerated: false,
        source: "wikimedia",
      };
    }
  }

  // 2. Try Gemini 2.5 Flash Vector SVG Generation
  const svgDataUri = await generateGeminiVectorSvg(prompt, topic);
  if (svgDataUri) {
    console.log(`[VisualGenerator] ✓ Generated bespoke Gemini Vector SVG illustration`);
    return {
      src: svgDataUri,
      alt: prompt,
      isAiGenerated: true,
      source: "gemini_svg",
    };
  }

  // 3. Deterministic High-Impact Vector Geometry (Never empty)
  console.log(`[VisualGenerator] Using deterministic geometric vector pattern`);
  return {
    src: generateHighImpactGeometricSvg(prompt, width, height, seed),
    alt: prompt,
    isAiGenerated: false,
    source: "vector_geometric",
  };
}

/**
 * Deterministic modern vector geometry fallback with actual structural grids and badges
 */
function generateHighImpactGeometricSvg(
  label: string,
  width: number,
  height: number,
  seed: number
): string {
  const hues = [215, 265, 335, 30, 165];
  const h = hues[seed % hues.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${h}, 45%, 12%)" />
      <stop offset="100%" stop-color="hsl(${(h + 35) % 360}, 50%, 6%)" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
    </pattern>
    <linearGradient id="beam" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="hsl(${h}, 90%, 60%)" stop-opacity="0.8" />
      <stop offset="100%" stop-color="hsl(${(h + 50) % 360}, 90%, 55%)" stop-opacity="0.1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)" />
  <rect width="100%" height="100%" fill="url(#grid)" />
  <!-- Visual Structure -->
  <polygon points="180,${height / 2} 480,180 480,540" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
  <line x1="180" y1="${height / 2}" x2="1100" y2="280" stroke="url(#beam)" stroke-width="6" />
  <line x1="180" y1="${height / 2}" x2="1100" y2="${height / 2}" stroke="url(#beam)" stroke-width="4" />
  <line x1="180" y1="${height / 2}" x2="1100" y2="440" stroke="url(#beam)" stroke-width="6" />
  <!-- Central Badge -->
  <rect x="${width / 2 - 200}" y="${height - 120}" width="400" height="48" rx="24" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.2)" />
  <text x="${width / 2}" y="${height - 88}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="white" opacity="0.9">${escapeXml(
    label.slice(0, 42)
  )}</text>
</svg>`;

  const base64 = Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}
