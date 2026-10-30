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
  progress: { stage: JobStage; step: string; percent: number; details?: string; notice?: string; log: { t: string; agent: string; msg: string }[] };
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
}
