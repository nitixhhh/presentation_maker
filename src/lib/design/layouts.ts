import { LayoutType } from "@/schemas/presentation";

export interface LayoutMetadata {
  id: LayoutType;
  name: string;
  category: "intro" | "content" | "data" | "comparison" | "conclusion";
  description: string;
  defaultVisualType: "image" | "chart" | "diagram" | "code" | "stat" | "cards" | "comparison" | "quote" | "none";
  maxBodyPoints: number;
  maxWordsPerPoint: number;
}

export const LAYOUT_REGISTRY: Record<LayoutType, LayoutMetadata> = {
  "hero-title": {
    id: "hero-title",
    name: "Hero Title & Impact Headline",
    category: "intro",
    description: "Full-width compelling title, punchy subtext, and thematic backdrop visual",
    defaultVisualType: "image",
    maxBodyPoints: 1,
    maxWordsPerPoint: 25,
  },
  "agenda-outline": {
    id: "agenda-outline",
    name: "Agenda & Roadmap Overview",
    category: "intro",
    description: "Structured numbered roadmap items outlining the presentation trajectory",
    defaultVisualType: "cards",
    maxBodyPoints: 5,
    maxWordsPerPoint: 15,
  },
  "split-content-image": {
    id: "split-content-image",
    name: "50/50 Split Editorial & Visual",
    category: "content",
    description: "Balanced left text narrative with right visual card",
    defaultVisualType: "image",
    maxBodyPoints: 3,
    maxWordsPerPoint: 20,
  },
  "big-stat-callout": {
    id: "big-stat-callout",
    name: "Big Metric & High-Impact Stat",
    category: "data",
    description: "Massive glowing numerical stat with contextual takeaway and narrative caption",
    defaultVisualType: "stat",
    maxBodyPoints: 2,
    maxWordsPerPoint: 18,
  },
  "three-card-grid": {
    id: "three-card-grid",
    name: "3-Pillar Feature Cards",
    category: "content",
    description: "Three glassmorphic cards highlighting key principles or features",
    defaultVisualType: "cards",
    maxBodyPoints: 3,
    maxWordsPerPoint: 15,
  },
  "four-card-grid": {
    id: "four-card-grid",
    name: "2x2 Quad Insight Grid",
    category: "content",
    description: "Four balanced quadrant cards for multi-dimensional topics",
    defaultVisualType: "cards",
    maxBodyPoints: 4,
    maxWordsPerPoint: 12,
  },
  "comparison-pros-cons": {
    id: "comparison-pros-cons",
    name: "Versus / Before & After Comparison",
    category: "comparison",
    description: "Side-by-side comparison tables contrasting legacy vs future or options",
    defaultVisualType: "comparison",
    maxBodyPoints: 4,
    maxWordsPerPoint: 14,
  },
  "horizontal-timeline": {
    id: "horizontal-timeline",
    name: "Sequential Evolution Timeline",
    category: "content",
    description: "Step-by-step chronological progress across milestones",
    defaultVisualType: "cards",
    maxBodyPoints: 4,
    maxWordsPerPoint: 12,
  },
  "vertical-process": {
    id: "vertical-process",
    name: "Vertical Phased Funnel",
    category: "content",
    description: "Vertical milestone nodes with step numbers and details",
    defaultVisualType: "cards",
    maxBodyPoints: 4,
    maxWordsPerPoint: 15,
  },
  "quote-highlight": {
    id: "quote-highlight",
    name: "Editorial Quote & Authority Voice",
    category: "content",
    description: "Prominent typographic quotation with author credit and subtle decorative quote glyph",
    defaultVisualType: "quote",
    maxBodyPoints: 1,
    maxWordsPerPoint: 35,
  },
  "full-bleed-visual": {
    id: "full-bleed-visual",
    name: "Cinematic Full-Bleed Imagery",
    category: "content",
    description: "Full slide immersive visual with floating glass text overlay",
    defaultVisualType: "image",
    maxBodyPoints: 2,
    maxWordsPerPoint: 16,
  },
  "chart-visualization": {
    id: "chart-visualization",
    name: "ECharts Interactive Data Graphic",
    category: "data",
    description: "Data chart (bar, line, pie, radar) with key takeaway insight pills",
    defaultVisualType: "chart",
    maxBodyPoints: 2,
    maxWordsPerPoint: 18,
  },
  "mermaid-diagram": {
    id: "mermaid-diagram",
    name: "Architecture & Flowchart Diagram",
    category: "data",
    description: "Mermaid rendered architectural or workflow diagram",
    defaultVisualType: "diagram",
    maxBodyPoints: 2,
    maxWordsPerPoint: 16,
  },
  "code-walkthrough": {
    id: "code-walkthrough",
    name: "Syntax-Highlighted Code Snippet",
    category: "data",
    description: "Dark terminal style code block with highlighted lines and explanation bullets",
    defaultVisualType: "code",
    maxBodyPoints: 2,
    maxWordsPerPoint: 15,
  },
  "matrix-2x2": {
    id: "matrix-2x2",
    name: "Strategic 2x2 Matrix",
    category: "comparison",
    description: "Four quadrants (e.g., Effort vs Impact, Risk vs Reward)",
    defaultVisualType: "cards",
    maxBodyPoints: 4,
    maxWordsPerPoint: 12,
  },
  "problem-solution": {
    id: "problem-solution",
    name: "Problem vs Solution Dual Card",
    category: "comparison",
    description: "High friction problem statement paired directly with seamless solution",
    defaultVisualType: "comparison",
    maxBodyPoints: 3,
    maxWordsPerPoint: 16,
  },
  "key-takeaways": {
    id: "key-takeaways",
    name: "Executive Summary & Key Takeaways",
    category: "conclusion",
    description: "High-level closing bullets summarizing the most actionable learnings",
    defaultVisualType: "cards",
    maxBodyPoints: 3,
    maxWordsPerPoint: 18,
  },
  "testimonial-social-proof": {
    id: "testimonial-social-proof",
    name: "Social Proof & Testimonial",
    category: "content",
    description: "Customer or industry testimonial card with rating stars and credential badges",
    defaultVisualType: "quote",
    maxBodyPoints: 2,
    maxWordsPerPoint: 20,
  },
  "features-breakdown": {
    id: "features-breakdown",
    name: "Deep-Dive Feature Breakdown",
    category: "content",
    description: "Asymmetrical list with accented badges and accompanying illustrative visual",
    defaultVisualType: "cards",
    maxBodyPoints: 3,
    maxWordsPerPoint: 15,
  },
  "step-by-step-guide": {
    id: "step-by-step-guide",
    name: "Numbered Action Playbook",
    category: "content",
    description: "Chronological numbered blocks for actionable implementation instructions",
    defaultVisualType: "cards",
    maxBodyPoints: 3,
    maxWordsPerPoint: 15,
  },
  "pyramid-hierarchy": {
    id: "pyramid-hierarchy",
    name: "Tiered Pyramid Hierarchy",
    category: "content",
    description: "Hierarchical tiers illustrating foundational layers up to peak objective",
    defaultVisualType: "cards",
    maxBodyPoints: 3,
    maxWordsPerPoint: 14,
  },
  "funnel-conversion": {
    id: "funnel-conversion",
    name: "Conversion Funnel Stages",
    category: "data",
    description: "Stages narrowing from top-of-funnel awareness to retention",
    defaultVisualType: "stat",
    maxBodyPoints: 4,
    maxWordsPerPoint: 12,
  },
  "team-showcase": {
    id: "team-showcase",
    name: "Leadership / Team Showcase",
    category: "content",
    description: "Member cards with roles, focus areas, and icons",
    defaultVisualType: "cards",
    maxBodyPoints: 3,
    maxWordsPerPoint: 12,
  },
  "pricing-table": {
    id: "pricing-table",
    name: "Comparative Value Tiers",
    category: "comparison",
    description: "Multi-tier packages with highlighted recommended choice",
    defaultVisualType: "cards",
    maxBodyPoints: 3,
    maxWordsPerPoint: 14,
  },
  "closing-cta": {
    id: "closing-cta",
    name: "Final Call to Action & Contact",
    category: "conclusion",
    description: "Bold closing question, contact points, QR or link button placeholder",
    defaultVisualType: "image",
    maxBodyPoints: 2,
    maxWordsPerPoint: 20,
  },
};

/**
 * Generates a diverse, non-repetitive layout sequence based on slide count and feature toggles.
 * Rules:
 * 1. First slide is hero-title.
 * 2. Last slide is closing-cta or key-takeaways.
 * 3. Max 2 consecutive slides with the same layout.
 * 4. Diverse distribution across cards, charts, diagrams, stats, and split layouts.
 */
export function generateLayoutSequence(
  count: number,
  toggles: {
    charts?: boolean;
    diagrams?: boolean;
    codeBlocks?: boolean;
  } = {}
): LayoutType[] {
  if (count <= 1) return ["hero-title"];
  if (count === 2) return ["hero-title", "closing-cta"];

  const sequence: LayoutType[] = ["hero-title"];
  const middleCount = count - 2;

  // Build a candidate pool of layouts based on toggles
  const pool: LayoutType[] = [
    "split-content-image",
    "three-card-grid",
    "big-stat-callout",
    "problem-solution",
    "horizontal-timeline",
    "features-breakdown",
    "comparison-pros-cons",
    "quote-highlight",
  ];

  if (toggles.charts) pool.push("chart-visualization");
  if (toggles.diagrams) pool.push("mermaid-diagram");
  if (toggles.codeBlocks) pool.push("code-walkthrough");

  let lastLayout: LayoutType = "hero-title";
  let secondLastLayout: LayoutType | null = null;

  for (let i = 0; i < middleCount; i++) {
    // Filter out options that would cause 2 consecutive identical layouts
    const allowed = pool.filter((l) => !(l === lastLayout && l === secondLastLayout));
    const chosen = allowed[Math.floor(Math.random() * allowed.length)];
    sequence.push(chosen);
    secondLastLayout = lastLayout;
    lastLayout = chosen;
  }

  // Final slide
  sequence.push(count > 4 ? "closing-cta" : "key-takeaways");
  return sequence;
}
