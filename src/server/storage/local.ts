import fs from "fs";
import path from "path";
import type { StorageAdapter } from "./types";
import type { JobRecord } from "../jobs/types";
import { DATA_ROOT } from "../paths";

const JOBS_DIR = path.join(DATA_ROOT, "jobs");

function jobPath(id: string) {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error("bad job id");
  return path.join(JOBS_DIR, `${id}.json`);
}

function readJob(p: string): JobRecord | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** Local filesystem fallback — used when Supabase is not configured. */
export class LocalStorage implements StorageAdapter {
  readonly kind = "local" as const;

  async saveJob(job: JobRecord) {
    fs.mkdirSync(JOBS_DIR, { recursive: true });
    const p = jobPath(job.id);
    const tmp = `${p}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(job));
    fs.renameSync(tmp, p); // atomic: a reader never sees half a file
  }

  async getJob(id: string) {
    try {
      return readJob(jobPath(id));
    } catch {
      return null;
    }
  }

  async getJobs(ids: string[]) {
    const out: JobRecord[] = [];
    for (const id of ids) {
      const j = await this.getJob(id);
      if (j) out.push(j);
    }
    return out;
  }

  private all(): JobRecord[] {
    if (!fs.existsSync(JOBS_DIR)) return [];
    return fs
      .readdirSync(JOBS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => readJob(path.join(JOBS_DIR, f)))
      .filter((j): j is JobRecord => !!j);
  }

  async unfinishedJobs() {
    return this.all().filter((j) => j.status === "queued" || j.status === "running");
  }

  async jobsByOwner(ownerKey: string, limit: number) {
    return this.all()
      .filter((j) => j.ownerKey === ownerKey)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async recentFinished(limit: number) {
    return this.all()
      .filter((j) => j.status === "done" && j.startedAt && j.finishedAt)
      .sort((a, b) => (b.finishedAt || "").localeCompare(a.finishedAt || ""))
      .slice(0, limit);
  }

  async persistDeck() {
    /* the working copy on disk is already the durable copy */
  }

  async restoreDeck(_deckId: string, localDir: string) {
    return fs.existsSync(path.join(localDir, "deck.json"));
  }
}
