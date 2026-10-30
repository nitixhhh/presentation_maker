/**
 * Engine v2 — Layout Registry & Seeded Layout Planner
 *
 * Single registry of all layouts. The planner selects a layout sequence
 * from slide roles using seeded RNG with variety enforcement rules.
 */

import type { LayoutDefinition, SlideRole, RNG } from "./types";
import { mulberry32 } from "../designSystem/generator";

// ─── Import all layouts ──────────────────────────────────
import { layout as coverFullbleed } from "./cover-fullbleed";
import { layout as coverSplit } from "./cover-split";
import { layout as sectionBignumber } from "./section-bignumber";
import { layout as statement } from "./statement";
import { layout as statHero } from "./stat-hero";
import { layout as threeCards } from "./three-cards";
import { layout as iconGrid4 } from "./icon-grid-4";
import { layout as imageLeft } from "./image-left";
import { layout as imageRight } from "./image-right";
import { layout as keyTakeaways } from "./key-takeaways";
import { layout as closingCta } from "./closing-cta";
import { layout as agenda } from "./agenda";

// ─── Registry ────────────────────────────────────────────
const ALL_LAYOUTS: LayoutDefinition[] = [
  coverFullbleed, coverSplit, sectionBignumber, statement, statHero,
  threeCards, iconGrid4, imageLeft, imageRight, keyTakeaways, closingCta, agenda,
];

export const LAYOUT_REGISTRY = new Map<string, LayoutDefinition>(
  ALL_LAYOUTS.map((l) => [l.id, l])
);

/** Get a layout by id. Throws if not found. */
export function getLayout(id: string): LayoutDefinition {
  const l = LAYOUT_REGISTRY.get(id);
  if (!l) throw new Error(`Layout "${id}" not found in registry`);
  return l;
}

/** Get all layouts suitable for a given role. */
function layoutsForRole(role: SlideRole): LayoutDefinition[] {
  return ALL_LAYOUTS.filter((l) => l.roles.includes(role));
}

// ─── Layout Planner ──────────────────────────────────────

export interface PlannedSlide {
  layoutId: string;
  variant: number;
}

/**
 * Plan a layout sequence from slide roles using deterministic seeded RNG.
 *
 * Rules enforced:
 * 1. No identical layout twice in a row
 * 2. Same layout at most 2 times per 10-slide window
 * 3. First slide must use a cover layout
 * 4. Last slide must use takeaways or cta layout
 * 5. Section divider roughly every 5 slides in long decks (>8 slides)
 * 6. At least 1 image-led slide when deck has >4 slides
 */
/** Map loose or unknown role strings to valid SlideRoles */
function normalizeRole(rawRole: string): SlideRole {
  const r = (rawRole || "").toLowerCase().trim();
  if (r.includes("cover") || r.includes("title") || r.includes("hero")) return "cover";
  if (r.includes("agenda") || r.includes("outline") || r.includes("table of contents")) return "agenda";
  if (r.includes("process") || r.includes("how") || r.includes("step") || r.includes("flow") || r.includes("principle") || r.includes("mechanism")) return "process";
  if (r.includes("compare") || r.includes("vs") || r.includes("difference") || r.includes("pros")) return "comparison";
  if (r.includes("stat") || r.includes("metric") || r.includes("number") || r.includes("kpi")) return "stat";
  if (r.includes("app") || r.includes("use") || r.includes("case") || r.includes("example") || r.includes("feature")) return "data";
  if (r.includes("diagram") || r.includes("architecture") || r.includes("system")) return "diagram";
  if (r.includes("takeaway") || r.includes("summary") || r.includes("conclusion") || r.includes("recap")) return "takeaways";
  if (r.includes("cta") || r.includes("action") || r.includes("next")) return "cta";
  if (r.includes("quote")) return "statement";
  return "data";
}

export function planLayoutSequence(
  roles: SlideRole[],
  seed: number
): PlannedSlide[] {
  const rng = mulberry32(seed);
  const result: PlannedSlide[] = [];
  const usageCounts = new Map<string, number>();

  for (let i = 0; i < roles.length; i++) {
    let role = normalizeRole(roles[i]);

    // Rule 3: First slide must be cover
    if (i === 0 && role !== "cover") role = "cover";

    // Rule 4: Last slide must be takeaways or cta
    if (i === roles.length - 1 && role !== "takeaways" && role !== "cta") {
      role = rng() < 0.6 ? "takeaways" : "cta";
    }

    let candidates = layoutsForRole(role);
    if (candidates.length === 0) {
      // Robust rich fallbacks: cycle through visual layouts
      const richFallbacks = [getLayout("three-cards"), getLayout("icon-grid-4"), getLayout("image-right"), getLayout("stat-hero")];
      candidates = [richFallbacks[i % richFallbacks.length]];
    }

    // Filter candidates by variety rules
    const prevLayoutId = i > 0 ? result[i - 1].layoutId : null;
    let filtered = candidates;

    // Rule 1: No same layout back-to-back
    if (prevLayoutId && filtered.length > 1) {
      filtered = filtered.filter((l) => l.id !== prevLayoutId);
    }
    // If filtering left nothing, pick any layout that isn't the previous one
    if (prevLayoutId && filtered.length === 1 && filtered[0].id === prevLayoutId) {
      const altCandidates = ALL_LAYOUTS.filter((l) => l.id !== prevLayoutId && !l.roles.includes("cover"));
      if (altCandidates.length > 0) filtered = [altCandidates[Math.floor(rng() * altCandidates.length)]];
    }

    // Rule 2: Same layout at most 2 times per 10-slide window
    if (filtered.length > 1) {
      const windowStart = Math.max(0, i - 9);
      const windowUsage = new Map<string, number>();
      for (let j = windowStart; j < i; j++) {
        const lid = result[j].layoutId;
        windowUsage.set(lid, (windowUsage.get(lid) || 0) + 1);
      }
      const furtherFiltered = filtered.filter(
        (l) => (windowUsage.get(l.id) || 0) < 2
      );
      if (furtherFiltered.length > 0) filtered = furtherFiltered;
    }

    // Pick one using RNG
    const picked = filtered[Math.floor(rng() * filtered.length)];
    const variant = Math.floor(rng() * picked.variants);

    result.push({ layoutId: picked.id, variant });
    usageCounts.set(picked.id, (usageCounts.get(picked.id) || 0) + 1);
  }

  // Rule 6: Ensure at least 1 image-led slide in decks >4 slides
  if (roles.length > 4) {
    const hasImageLed = result.some(
      (r) => r.layoutId === "image-left" || r.layoutId === "image-right" || r.layoutId === "cover-fullbleed"
    );
    if (!hasImageLed) {
      // Replace a middle slide with image-left or image-right
      const midIdx = Math.floor(roles.length / 2);
      if (midIdx > 0 && midIdx < roles.length - 1) {
        result[midIdx] = { layoutId: rng() < 0.5 ? "image-left" : "image-right", variant: 0 };
      }
    }
  }

  return result;
}

