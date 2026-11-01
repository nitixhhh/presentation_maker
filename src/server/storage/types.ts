/**
 * Storage adapter for jobs + deck files.
 *
 * - LocalStorage  (default): JSON + files on the server disk (DECKCRAFT_DATA_DIR).
 * - SupabaseStorage: Postgres table `jobs` + private Storage bucket `decks`.
 *   Used automatically when NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and
 *   SUPABASE_SERVICE_ROLE_KEY are set. The service-role key is only ever read on the server.
 *
 * Generation always works on a local working copy of the deck (Chromium renders from disk);
 * the adapter makes the result durable so it survives server restarts / redeploys.
 */
import type { JobRecord } from "../jobs/types";

export interface StorageAdapter {
  readonly kind: "local" | "supabase";
  saveJob(job: JobRecord): Promise<void>;
  getJob(id: string): Promise<JobRecord | null>;
  getJobs(ids: string[]): Promise<JobRecord[]>;
  /** jobs still queued/running (used to resume after a restart) */
  unfinishedJobs(): Promise<JobRecord[]>;
  /** a signed-in user's decks (newest first) */
  jobsByOwner(ownerKey: string, limit: number): Promise<JobRecord[]>;
  /** recent finished jobs (for queue ETA statistics) */
  recentFinished(limit: number): Promise<JobRecord[]>;
  /** copy a finished deck directory (deck.json, assets/, exports/) to durable storage */
  persistDeck(deckId: string, localDir: string): Promise<void>;
  /** make sure a deck exists locally (download from durable storage if needed); false if unknown */
  restoreDeck(deckId: string, localDir: string): Promise<boolean>;
  /** delete a job record for good */
  deleteJob(id: string): Promise<void>;
  /** delete a deck's durable files (deck.json, assets, exports, previews) */
  deleteDeck(deckId: string): Promise<void>;
  /** small engine bookkeeping that must survive restarts/redeploys (e.g. the daily AI-image budget); null if absent */
  getMeta(key: string): Promise<any | null>;
  putMeta(key: string, value: unknown): Promise<void>;
}
