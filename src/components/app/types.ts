export type JobStatus = "queued" | "running" | "done" | "failed";
export type JobStage = "queued" | "research" | "outline" | "design" | "qa" | "export" | "done";

export interface JobView {
  id: string;
  status: JobStatus;
  topic: string;
  slideCount?: number;
  title?: string;
  deckId?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  progress: { stage: JobStage; step: string; percent: number; details?: string; notice?: string; log: { t: string; agent: string; msg: string }[]; live?: LiveDeck; plan?: PlanInfo };
  engine?: "v3" | "v5" | "v6";
  /** engine v6: "plan" while this job is the plan step */
  stage?: "plan" | "deck";
  queuePosition?: number;
  etaSeconds?: number;
  elapsedSeconds?: number;
}

export interface DeckSlide {
  n: number;
  title: string;
  role?: string;
  url: string | null;
  image: string;
  notes?: string;
}

export interface DeckSummary {
  deckId: string;
  topic: string;
  title: string;
  language: string;
  references: { n: number; text: string }[];
  slides: DeckSlide[];
  locked?: boolean;
  payments?: { provider: string; keyId?: string; testMode?: boolean; price: number; pack5: number; credits: number } | null;
  edits?: { used: number; free: number };
  engine?: string;
}

/** Standard/Advanced: slides appear one by one while the deck is being made */
export interface LiveSlide {
  n: number;
  title: string;
  state: "waiting" | "building" | "ready" | "polishing" | "done";
  statuses: string[];
  v: number;
  image?: string;
}
export interface LiveDeck {
  engine: "v5" | "v6";
  slides: LiveSlide[];
}

/** engine v6 plan step */
export interface PlanCard {
  id: string;
  title: string;
  points: string[];
  layout: string;
  beat?: string;
  sources: string[];
  fixed?: "title" | "references" | "closing";
}
export interface PlanStyle {
  id: string;
  name: string;
  why: string;
  dark: boolean;
  palette: Record<string, string>;
  font: string;
  previews: string[];
}
export interface PlanInfo {
  cards: PlanCard[];
  styles: PlanStyle[];
  previewSlide?: number;
  /** image choice preselected by the plan (Advanced: AI images) */
  defaultImages?: "real" | "ai" | "none";
}
