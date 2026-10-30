/**
 * /benchmark — runs the same topic through several models for ONE role (everything else uses the
 * normal routes) and compares time + QA score side by side. Protected by BENCHMARK_PASSWORD; disabled
 * when that env var is not set. Runs go through the normal job queue (owner "benchmark").
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_ROOT } from "./paths";
import { createJob, getJobViews } from "./jobs/manager";
import { loadDeck } from "@/engine-v3/store";
import { ROLES, routesFor, keysFor, modelSpec, schedulerState, type Role } from "@/engine-v3/llm";

const DIR = path.join(DATA_ROOT, "benchmarks");

export function benchmarkAuthorized(req: Request): "ok" | "disabled" | "denied" {
  const pw = process.env.BENCHMARK_PASSWORD;
  if (!pw) return "disabled";
  const given = req.headers.get("x-benchmark-password") || "";
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(pw).digest();
  return crypto.timingSafeEqual(a, b) ? "ok" : "denied";
}

export function benchmarkCatalog() {
  const roles = ROLES.map((role) => ({
    role,
    routes: routesFor(role, { all: true }).map((r) => ({
      id: `${r.provider}:${r.model}`,
      provider: r.provider,
      model: r.model,
      configured: keysFor(r.provider).length > 0,
      keys: keysFor(r.provider).length,
      vision: !!modelSpec(r.provider, r.model).vision,
    })),
  }));
  return { roles, scheduler: schedulerState() };
}

interface BenchRecord {
  id: string;
  topic: string;
  slideCount: number;
  role: Role;
  createdAt: string;
  runs: { candidate: string; jobId: string }[];
}

export async function startBenchmark(body: any): Promise<BenchRecord> {
  const role = ROLES.includes(body?.role) ? (body.role as Role) : null;
  if (!role) throw new Error("Pick a role.");
  const topic = String(body?.topic || "").trim().slice(0, 200);
  if (topic.length < 3) throw new Error("Enter a topic.");
  const slideCount = Math.min(10, Math.max(4, Number(body?.slideCount) || 6));
  const candidates: string[] = (Array.isArray(body?.candidates) ? body.candidates : []).map(String).filter((c: string) => /^[a-z0-9_-]+:.+/i.test(c)).slice(0, 6);
  if (!candidates.length) throw new Error("Pick at least one model.");
  const rec: BenchRecord = { id: `b${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`, topic, slideCount, role, createdAt: new Date().toISOString(), runs: [] };
  for (const c of candidates) {
    const i = c.indexOf(":");
    const route = { provider: c.slice(0, i), model: c.slice(i + 1) };
    const job = await createJob({ topic, slideCount, language: body?.language === "Hindi" ? "Hindi" : "English", audience: "University students", imageMode: "real-first" }, "benchmark", undefined, {
      routes: { [role]: [route] },
      visionMode: "always", // score every slide so models can be compared
      kind: "benchmark",
    });
    rec.runs.push({ candidate: c, jobId: job.id });
  }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, `${rec.id}.json`), JSON.stringify(rec));
  return rec;
}

export function listBenchmarks(): BenchRecord[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as BenchRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
}

export async function benchmarkResult(id: string) {
  if (!/^[a-z0-9]+$/i.test(id)) return null;
  const p = path.join(DIR, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  const rec: BenchRecord = JSON.parse(fs.readFileSync(p, "utf8"));
  const jobs = await getJobViews(rec.runs.map((r) => r.jobId));
  const runs = rec.runs.map((r) => {
    const job = jobs.find((j) => j.id === r.jobId);
    const deck = job?.status === "done" && job.deckId ? loadDeck(job.deckId) : null;
    let qa: number | null = null,
      clean = 0,
      calls = 0,
      failedCalls = 0,
      roleCalls = 0,
      roleMs = 0,
      servedBy: Record<string, number> = {};
    if (deck) {
      const scores = deck.slides.map((s) => s.qa?.visionScore).filter((x): x is number => typeof x === "number");
      qa = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
      clean = deck.slides.filter((s) => !(s.qa?.domIssues || []).some((i) => i.severity !== "low")).length;
      for (const c of deck.calls || []) {
        calls++;
        if (!c.ok) failedCalls++;
        if (c.role === rec.role && c.ok) {
          roleCalls++;
          roleMs += c.ms;
          servedBy[`${c.provider}:${c.model}`] = (servedBy[`${c.provider}:${c.model}`] || 0) + 1;
        }
      }
    }
    return {
      candidate: r.candidate,
      jobId: r.jobId,
      status: job?.status,
      percent: job?.progress.percent,
      error: job?.error,
      seconds: job?.elapsedSeconds,
      qaScore: qa,
      cleanSlides: deck ? `${clean}/${deck.slides.length}` : null,
      calls,
      failedCalls,
      roleCalls,
      roleAvgSeconds: roleCalls ? Math.round(roleMs / roleCalls / 100) / 10 : null,
      servedBy,
      deckId: job?.deckId,
      slides: deck ? deck.slides.map((s) => `/api/v3/deck/${deck.id}/preview/${s.n}`) : [],
    };
  });
  return { ...rec, runs };
}
