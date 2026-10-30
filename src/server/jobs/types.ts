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
  queuePosition?: number; // 1 = next to start
  etaSeconds?: number; // until the deck is ready
  elapsedSeconds?: number;
}
