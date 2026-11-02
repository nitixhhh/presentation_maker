/**
 * Engine v7 — Google Fonts resolver. The concept names any Google Fonts families; this fetches their CSS once (trying
 * the richest weight axes first, since a request for a weight a family lacks fails the whole request) and inlines the
 * @font-face rules into every slide. A family Google does not know is replaced by a safe pairing and logged.
 */
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const cache = new Map<string, string | null>();

async function fetchCss(family: string, axes: string): Promise<string | null> {
  const fam = encodeURIComponent(family.trim()).replace(/%20/g, "+");
  const url = `https://fonts.googleapis.com/css2?family=${fam}${axes ? ":" + axes : ""}&display=block`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const t = await r.text();
    return t.includes("@font-face") ? t : null;
  } catch {
    return null;
  }
}

export async function familyCss(family: string): Promise<string | null> {
  const key = family.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  let css: string | null = null;
  for (const axes of ["ital,wght@0,100..900;1,100..900", "wght@100..900", "ital,wght@0,400;0,700;1,400", "wght@300;400;500;600;700;800", "wght@400;700", ""]) {
    css = await fetchCss(family, axes);
    if (css) break;
  }
  cache.set(key, css);
  return css;
}

/** Resolved @font-face CSS for the deck's families + the families that actually resolved (fallbacks applied). */
export async function resolveFonts(fonts: { display: string; body: string; accent?: string }, log: (m: string) => void) {
  const out: { display: string; body: string; accent?: string } = { ...fonts };
  const fallback: Record<string, string> = { display: "Fraunces", body: "Source Sans 3", accent: "JetBrains Mono" };
  const parts: string[] = [];
  for (const k of ["display", "body", "accent"] as const) {
    const fam = out[k];
    if (!fam) continue;
    let css = await familyCss(fam);
    if (!css) {
      log(`font "${fam}" not on Google Fonts — using ${fallback[k]}`);
      out[k] = fallback[k];
      css = await familyCss(fallback[k]);
    }
    if (css) parts.push(css);
  }
  return { css: [...new Set(parts)].join("\n"), fonts: out };
}
