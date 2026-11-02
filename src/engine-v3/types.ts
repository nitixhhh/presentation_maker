/** Engine v3 — shared types */

export type DeckLanguage = "English" | "Hindi" | "Hinglish";

export interface PresenterInfo {
  names?: string; // "Rahul Das (Roll 23CSE041), Priya Sen (Roll 23CSE057)"
  rollNo?: string;
  department?: string;
  institute?: string;
  guide?: string; // "Dr. A. Kumar, Assistant Professor"
  course?: string; // "B.Tech CSE, 5th Semester"
  date?: string;
}

export interface V3Request {
  topic: string;
  /** uploaded institution logo (from /api/v3/uploads) — the designer AI places it */
  logoId?: string;
  audience?: string; // e.g. "B.Sc 2nd year chemistry class"
  slideCount?: number;
  language?: DeckLanguage;
  purpose?: string; // seminar / project review / lecture …
  formatNotes?: string; // free text: the university's required format, sample outline …
  presenter?: PresenterInfo;
  imageMode?: "real-first" | "ai-allowed" | "none";
  styleHint?: string; // e.g. "dark and modern", "clean white academic"
  /** which engine makes the deck (set by the server: ENGINE_DEFAULT, or the owner's "New engine (beta)" switch) */
  engine?: "v3" | "v5" | "v6";
  /** engine v6: the plan step ("plan") or a deck made from an approved plan ("deck"); set by the server */
  v6?: { stage: "plan" | "deck"; planJobId?: string; data?: any; cards?: any[]; styleId?: string | null; style?: any; previews?: any };
}

export interface Brief {
  title: string;
  subtitle?: string;
  deckType: string;
  subject: string;
  level: string;
  goal: string;
  language: DeckLanguage;
  slideCount: number;
  requiredSections: string[];
  titleSlideFields: { label: string; value: string }[];
  referenceStyle: string;
  tone: string;
  researchQueries: string[];
  imagery: string;
  styleHint?: string;
}

export interface Source {
  id: string; // S1…
  kind: "wikipedia" | "openalex" | "crossref" | "semanticscholar";
  title: string;
  url: string;
  authors?: string[];
  year?: number;
  venue?: string;
  doi?: string;
  text: string; // extract / abstract used for grounding
  accessed: string; // ISO date
  /** times cited (scholarly sources, when the index says) — used to skip niche papers */
  citations?: number;
}

export interface Fact {
  id: string; // F1…
  text: string;
  sources: string[]; // S ids
  kind?: string;
}

export interface ResearchPack {
  sources: Source[];
  facts: Fact[];
  keyTerms: { term: string; meaning: string }[];
}

export type VisualKind = "photo" | "generated" | "diagram" | "chart" | "none";

export interface OutlineSlide {
  n: number;
  role: string; // title, agenda, concept, process, comparison, data, case, summary, references, closing …
  title: string;
  keyMessage: string;
  points: { text: string; factIds?: string[] }[];
  visual: { kind: VisualKind; query?: string; prompt?: string; idea?: string };
  notes?: string;
}

export interface Outline {
  slides: OutlineSlide[];
}

export interface FontPair {
  id: string;
  heading: string;
  body: string;
  googleFamilies: string[]; // for the <link> tag
  pptxHeading: string;
  pptxBody: string;
  script?: "latin" | "devanagari";
}

export interface DesignSystem {
  name: string;
  mood: string;
  dark: boolean;
  palette: { bg: string; surface: string; ink: string; muted: string; primary: string; accent: string; accent2: string };
  font: FontPair;
  motif: string;
  rules: string[];
  directions?: { n: number; idea: string }[]; // per-slide art direction (AI-decided, not templates)
  css: string; // :root variables + base styles (engine-built)
  fontLink: string; // <link> markup
}

export interface Asset {
  id: string; // img1…
  file: string; // file name inside the deck asset dir
  mime: string;
  width: number;
  height: number;
  avgColor: string;
  origin: "wikimedia" | "openverse" | "nasa" | "pexels" | "pixabay" | "generated" | "wikipedia" | "upload";
  title: string;
  description: string;
  credit?: string; // "Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons"
  sourceUrl?: string;
  forSlides: number[];
}

export interface SlideDesign {
  n: number;
  html: string; // inner markup of .slide, including its <style>
  notes: string;
  provider?: string;
  model?: string;
  qa?: QaReport;
  revisions: number;
}

export interface QaIssue {
  type: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

export interface QaReport {
  domIssues: QaIssue[];
  visionScore?: number;
  visionIssues?: string[];
  autoFixes: string[];
}

export interface Deck {
  id: string;
  createdAt: string;
  request: V3Request;
  brief: Brief;
  research: ResearchPack;
  outline: Outline;
  design: DesignSystem;
  assets: Asset[];
  slides: SlideDesign[];
  references: { n: number; sourceId: string; text: string }[];
  log: { t: string; agent: string; msg: string }[];
  /** who made it ("u:<user id>" or "c:<browser key>") — set by the job manager */
  ownerKey?: string;
  /** gallery sample: anyone may see its previews */
  public?: boolean;
  /** every AI call made for this deck (role, provider, model, time) */
  calls?: { role: string; provider: string; model: string; ms: number; waitedMs: number; ok: boolean; error?: string; tokensIn?: number; tokensOut?: number }[];
  /** per-deck AI usage + estimated paid cost (USD), filled at the end of generation */
  usage?: import("./llm").UsageSummary;
}

export interface ProgressEvent {
  step: string;
  percent: number;
  details?: string;
  log?: { agent: string; action: string; timestamp: string };
}
export type ProgressFn = (p: ProgressEvent) => void;
