/**
 * The three plans (tiers). Each plan is one engine; future engine work happens inside these three.
 *
 *   basic    → engine v3  (src/engine-v3)  every slide designed by AI, one at a time
 *   standard → engine v5  (src/engine-v5)  designer-made layouts filled by one planner call
 *   advanced → engine v6  (src/engine-v6)  plan → approve → generated style, diagrams, AI images on
 *
 * Until release only the owner sees plans (picker + /plans page); everyone else gets ENGINE_DEFAULT (v3 = basic).
 * PLANS_PUBLIC=true is the one switch that shows the picker and the /plans page to every visitor.
 * Prices are placeholders: set PLAN_PRICE_BASIC / PLAN_PRICE_STANDARD / PLAN_PRICE_ADVANCED (any text, e.g. "Rs 49 a deck"),
 * or fill `price` below. No payment is tied to a plan yet.
 */

export type Engine = "v3" | "v5" | "v6";
export type TierId = "basic" | "standard" | "advanced";
export type ImageChoice = "real" | "ai" | "none";

export interface Tier {
  id: TierId;
  engine: Engine;
  name: string;
  /** one line: what this plan does */
  tagline: string;
  /** what the student gets, in short plain lines */
  points: string[];
  /** rough time for one 8–10 slide deck, measured on the free models (Nov 2026) */
  approxTime: string;
  /** how much AI it uses, for the price later (low / medium / high) */
  aiUse: "low" | "medium" | "high";
  /** price placeholder; null shows "Price coming soon" */
  price: string | null;
  /** starts with the plan step (outline cards → approve → style) instead of making the deck at once */
  planFirst: boolean;
  /** image choice preselected for this plan */
  defaultImages: ImageChoice;
  /** best real slides made by this engine (static, in public/plans/<id>/) */
  preview: { src: string; alt: string }[];
}

const shots = (id: TierId, alts: string[]) => alts.map((alt, i) => ({ src: `/plans/${id}/${String(i + 1).padStart(2, "0")}.webp`, alt }));

export const TIERS: Tier[] = [
  {
    id: "basic",
    engine: "v3",
    name: "Basic",
    tagline: "Every slide designed by AI, one at a time, with its own colours and diagrams.",
    points: ["Researched facts with references", "A colour palette picked for the topic", "Flowcharts and growth charts drawn for you", "PDF and editable PowerPoint"],
    approxTime: "About 10 minutes",
    aiUse: "medium",
    price: null,
    planFirst: false,
    defaultImages: "real",
    preview: shots("basic", ["Title slide: Smart Library Management System using RFID, dark blue design", "UV-Vis spectroscopy: preparing samples and reading data, with a drawn chart", "Hindi slide: the steps of photosynthesis as a flow diagram", "System architecture diagram for the smart library", "Parts of a spectrophotometer, with real photos", "Hindi title slide: photosynthesis, with a leaf photo"]),
  },
  {
    id: "standard",
    engine: "v5",
    name: "Standard",
    tagline: "Fast, consistent decks built on designer-made layouts that always fill the slide.",
    points: ["30 designer-made layouts, picked per slide", "Peer-reviewed papers and cited numbers", "Real photos checked to match each slide", "PDF and editable PowerPoint"],
    approxTime: "About 3 minutes",
    aiUse: "low",
    price: null,
    planFirst: false,
    defaultImages: "real",
    preview: shots("standard", ["Title slide: Are we living in a simulation?, dark theme", "Timeline from Plato to Baudrillard on four cards", "Key numbers about blockchain as big figures", "Photosynthesis light reactions as numbered process steps", "Side-by-side comparison of advantages and limits of blockchain", "Hindi title slide on the freedom struggle"]),
  },
  {
    id: "advanced",
    engine: "v6",
    name: "Advanced",
    tagline: "You approve the plan first, then get a style made for your topic, drawn charts and AI images.",
    points: ["Edit and approve the outline before anything is designed", "Choose from looks made for your topic, or let it surprise you", "Charts, flowcharts and AI images in the deck's own colours", "Change any slide by chat when it is done"],
    approxTime: "About 4 minutes",
    aiUse: "high",
    price: null,
    planFirst: true,
    defaultImages: "ai",
    preview: shots("advanced", ["Hinglish title slide on AI in healthcare, with a full photo", "Trend chart drawn in the deck's own colours, with an action title", "The Calvin cycle as a three-step cycle diagram", "Title slide with a style made for a startup topic", "Blockchain architecture in four layers on a dark style", "Big number slide in a cream and plum style made for the topic"]),
  },
];

/** the one release switch */
export function plansPublic(): boolean {
  return String(process.env.PLANS_PUBLIC || "").trim().toLowerCase() === "true";
}

export function tierById(id: unknown): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function tierOfEngine(engine: unknown): Tier | undefined {
  return TIERS.find((t) => t.engine === engine);
}

/** a plan as the browser sees it (price placeholder filled from env) */
export function tierView(t: Tier) {
  const env = String(process.env[`PLAN_PRICE_${t.id.toUpperCase()}`] || "").trim();
  return { ...t, price: env || t.price };
}
