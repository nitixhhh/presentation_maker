import type { V3Request } from "@/engine-v3/types";

export type JobStatus = "queued" | "running" | "done" | "failed";
/** The five steps the user sees. */
export type JobStage = "queued" | "research" | "outline" | "design" | "qa" | "export" | "done";

export interface JobProgress {
  stage: JobStage;
  step: string; // human sentence, e.g. "Designing slides"
  percent: number; // 0..100, never goes backwards
  details?: string;
  /** temporary note such as "Waiting for free AI capacity" */
  notice?: string;
  noticeAt?: number;
  log: { t: string; agent: string; msg: string }[]; // last ~40 lines
  /** Standard/Advanced: live slide-by-slide state (each slide appears the moment it is rendered) */
  live?: LiveDeck;
  /** engine v6 plan step: the outline cards and the three styles made for this topic (with preview images) */
  plan?: { cards: any[]; styles: { id: string; name: string; why: string; dark: boolean; palette: Record<string, string>; font: string; previews: string[] }[]; previewSlide?: number; defaultImages?: "real" | "ai" | "none" };
}

export interface LiveSlide {
  n: number;
  title: string;
  state: "waiting" | "building" | "ready" | "polishing" | "done";
  /** the agent's latest real steps, newest last (the UI rotates through them) */
  statuses: string[];
  /** preview version — bumps every time a new render is written */
  v: number;
  /** signed preview URL (added to the view; not stored) */
  image?: string;
}

export interface LiveDeck {
  engine: "v5" | "v6";
  slides: LiveSlide[];
}

export interface JobRecord {
  id: string;
  ownerKey: string; // anonymous browser key today; user id once auth is on
  userId?: string;
  status: JobStatus;
  request: V3Request;
  progress: JobProgress;
  title?: string;
  deckId?: string;
  error?: string;
  attempt: number; // restarts after a server restart
  /** internal: forced model routes (benchmark runs) */
  routes?: Record<string, { provider: string; model: string }[]>;
  visionMode?: "smart" | "always" | "off";
  kind?: "user" | "benchmark" | "edit";
  /** edit jobs: redo one slide of an existing deck */
  edit?: { deckId: string; n: number; instruction: string };
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

/** What the client receives (adds live queue info). */
export interface JobView extends Omit<JobRecord, "ownerKey" | "userId" | "request"> {
  topic: string;
  slideCount?: number;
  engine?: "v3" | "v5" | "v6";
  /** engine v6: "plan" while this job is the plan step */
  stage?: "plan" | "deck";
  queuePosition?: number; // 1 = next to start
  etaSeconds?: number; // until the deck is ready
  elapsedSeconds?: number;
}
