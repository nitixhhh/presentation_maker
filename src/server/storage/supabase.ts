import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StorageAdapter } from "./types";
import type { JobRecord } from "../jobs/types";

const BUCKET = process.env.SUPABASE_DECKS_BUCKET || "decks";

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".html": "text/html",
};

/** DB row <-> JobRecord */
function toRow(j: JobRecord) {
  return {
    id: j.id,
    owner_key: j.ownerKey,
    user_id: j.userId || null,
    status: j.status,
    request: j.request,
    progress: j.progress,
    title: j.title || null,
    deck_id: j.deckId || null,
    error: j.error || null,
    attempt: j.attempt,
    created_at: j.createdAt,
    started_at: j.startedAt || null,
    finished_at: j.finishedAt || null,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(r: any): JobRecord {
  return {
    id: r.id,
    ownerKey: r.owner_key,
    userId: r.user_id || undefined,
    status: r.status,
    request: r.request,
    progress: r.progress || { stage: "queued", step: "", percent: 0, log: [] },
    title: r.title || undefined,
    deckId: r.deck_id || undefined,
    error: r.error || undefined,
    attempt: r.attempt || 0,
    createdAt: r.created_at,
    startedAt: r.started_at || undefined,
    finishedAt: r.finished_at || undefined,
  };
}

/**
 * Supabase adapter: `jobs` table + private `decks` bucket (see supabase/schema.sql).
 * Server-only: needs SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Never import from client code.
 */
export class SupabaseStorage implements StorageAdapter {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async saveJob(job: JobRecord) {
    const { error } = await this.db.from("jobs").upsert(toRow(job));
    if (error) throw new Error(`supabase saveJob: ${error.message}`);
  }

  async getJob(id: string) {
    const { data, error } = await this.db.from("jobs").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`supabase getJob: ${error.message}`);
    return data ? fromRow(data) : null;
  }

  async getJobs(ids: string[]) {
    if (!ids.length) return [];
    const { data, error } = await this.db.from("jobs").select("*").in("id", ids);
    if (error) throw new Error(`supabase getJobs: ${error.message}`);
    return (data || []).map(fromRow);
  }

  async unfinishedJobs() {
    const { data, error } = await this.db.from("jobs").select("*").in("status", ["queued", "running"]).order("created_at");
    if (error) throw new Error(`supabase unfinishedJobs: ${error.message}`);
    return (data || []).map(fromRow);
  }

  async recentFinished(limit: number) {
    const { data, error } = await this.db
      .from("jobs")
      .select("*")
      .eq("status", "done")
      .order("finished_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data || []).map(fromRow);
  }

  async persistDeck(deckId: string, localDir: string) {
    const files: string[] = [];
    const walk = (rel: string) => {
      const abs = path.join(localDir, rel);
      if (!fs.existsSync(abs)) return;
      for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const r = path.join(rel, e.name);
        if (e.isDirectory()) {
          if (e.name === "render") continue; // scratch renders are rebuilt on demand
          walk(r);
        } else files.push(r);
      }
    };
    walk("");
    // deck.json last, so its presence means "complete upload"
    files.sort((a, b) => (a === "deck.json" ? 1 : b === "deck.json" ? -1 : 0));
    for (const rel of files) {
      const buf = fs.readFileSync(path.join(localDir, rel));
      const { error } = await this.db.storage
        .from(BUCKET)
        .upload(`${deckId}/${rel.split(path.sep).join("/")}`, buf, { upsert: true, contentType: MIME[path.extname(rel).toLowerCase()] || "application/octet-stream" });
      if (error) throw new Error(`supabase upload ${rel}: ${error.message}`);
    }
  }

  async restoreDeck(deckId: string, localDir: string) {
    if (fs.existsSync(path.join(localDir, "deck.json"))) return true;
    const get = async (rel: string) => {
      const { data, error } = await this.db.storage.from(BUCKET).download(`${deckId}/${rel}`);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    };
    const deckJson = await get("deck.json");
    if (!deckJson) return false;
    for (const sub of ["assets", "exports", "previews"]) {
      const { data } = await this.db.storage.from(BUCKET).list(`${deckId}/${sub}`, { limit: 1000 });
      for (const f of data || []) {
        const buf = await get(`${sub}/${f.name}`);
        if (!buf) continue;
        fs.mkdirSync(path.join(localDir, sub), { recursive: true });
        fs.writeFileSync(path.join(localDir, sub, f.name), buf);
      }
    }
    fs.mkdirSync(localDir, { recursive: true });
    fs.writeFileSync(path.join(localDir, "deck.json"), deckJson);
    return true;
  }
}
