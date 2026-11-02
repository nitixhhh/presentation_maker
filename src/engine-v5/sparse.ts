/** Engine v5 — when a rendered slide looks unfinished (content stops high, or a panel / card is mostly empty). */
import type { FitResult } from "./fit";
import { templateById } from "./templates";

// ── sparse slides ─────────────────────────────────────────────────────────
/** templates whose calm, airy look is the design (hero / closing / quote / one big number) — never "filled up" */
const SPARSE_OK = /^(title-.*|references|closing|section|quote|big-stat|photo-full|agenda)$/;

/** what makes a fitted slide look unfinished: content that stops high, or a panel / card with a big empty band */
export function sparseProblems(template: string, fit: Pick<FitResult, "fill" | "holes" | "s">): string[] {
  if (SPARSE_OK.test(template)) return [];
  const out: string[] = [];
  if (fit.fill < 0.6) out.push(`content stops at ${Math.round(fit.fill * 100)}% of the slide height`);
  for (const h of fit.holes || []) out.push(`a ${h.where.replace(/^v5-/, "").replace(/\./g, " ")} is ${Math.round(h.gap * 100)}% empty`);
  return out;
}
export const sparseScore = (template: string, fit: FitResult) => (SPARSE_OK.test(template) ? 0 : Math.max(0, 0.6 - fit.fill) + (fit.holes || []).reduce((a, h) => a + Math.max(0.05, h.gap - 0.4), 0)) + fit.overflow.length * 0.5;

/** the card / list layout that fits a given number of items (for a slide still sparse after re-filling) */
export function fittingTemplate(template: string, n: number, neighbours: string[] = []): string | null {
  const byCount = n <= 2 ? ["cards-2", "comparison"] : n === 3 ? ["cards-3", "process"] : n === 4 ? ["cards-4", "process"] : ["takeaways", "process"];
  for (const id of byCount) {
    const t = templateById(id);
    if (!t || id === template || neighbours.includes(id)) continue;
    if (id === "comparison") continue; // needs left/right sides, not items
    if ((t.minItems && n < t.minItems) || (t.maxItems && n > t.maxItems)) continue;
    return id;
  }
  return null;
}

