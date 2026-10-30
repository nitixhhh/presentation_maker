"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Select from "@/components/ui/Select";

type Catalog = {
  roles: { role: string; routes: { id: string; provider: string; model: string; configured: boolean; keys: number; vision: boolean }[] }[];
  scheduler: { rows: { role: string; provider: string; model: string; keys: { key: number; usedToday: number; exhausted: string | null }[] }[] };
  benchmarks: { id: string; topic: string; role: string; createdAt: string; runs: { candidate: string }[] }[];
};
type Run = {
  candidate: string;
  status?: string;
  percent?: number;
  error?: string;
  seconds?: number;
  qaScore: number | null;
  cleanSlides: string | null;
  calls: number;
  failedCalls: number;
  roleCalls: number;
  roleAvgSeconds: number | null;
  servedBy: Record<string, number>;
  slides: string[];
};
type Result = { id: string; topic: string; role: string; slideCount: number; createdAt: string; runs: Run[] };

const ROLE_HELP: Record<string, string> = {
  brief: "understands the request",
  research: "extracts cited facts from sources",
  outline: "plans the story",
  art: "deck colours, fonts, per-slide art direction",
  design: "designs every slide (most important for quality)",
  vision: "looks at each rendered slide and critiques it",
};

export default function BenchmarkPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState("design");
  const [topic, setTopic] = useState("Ohm's law and its applications");
  const [slides, setSlides] = useState(6);
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", "x-benchmark-password": pw, ...(init?.headers || {}) }, cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      return d;
    },
    [pw]
  );

  const load = useCallback(async () => {
    try {
      const d = await api("/api/benchmark");
      setCat(d);
      setAuthed(true);
      setErr(null);
      sessionStorage.setItem("bench.pw", pw);
    } catch (e: any) {
      setErr(e.message);
    }
  }, [api, pw]);

  useEffect(() => {
    const s = sessionStorage.getItem("bench.pw");
    if (s) setPw(s);
  }, []);

  useEffect(() => {
    if (!result || result.runs.every((r) => r.status === "done" || r.status === "failed")) return;
    const t = setTimeout(async () => {
      try {
        setResult(await api(`/api/benchmark/${result.id}`));
      } catch {}
    }, 5000);
    return () => clearTimeout(t);
  }, [result, api]);

  const routes = cat?.roles.find((r) => r.role === role)?.routes || [];
  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const d = await api("/api/benchmark", { method: "POST", body: JSON.stringify({ role, topic, slideCount: slides, candidates: picked }) });
      setResult(await api(`/api/benchmark/${d.benchmark.id}`));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-3 text-[15px] outline-none focus:border-[var(--accent)]";
  if (!authed)
    return (
      <div className="mx-auto max-w-sm space-y-4 px-5 py-20">
        <h1 className="text-[22px] font-semibold">Model benchmark</h1>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Benchmark password" className={input} onKeyDown={(e) => e.key === "Enter" && load()} />
        <button onClick={load} className="w-full rounded-xl bg-[var(--accent)] py-3 font-semibold text-white">
          Open
        </button>
        {err && <p className="text-[14px] text-[#9B1C1C]">{err}</p>}
      </div>
    );

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-5 py-8">
      <div>
        <h1 className="text-[24px] font-semibold">Model benchmark</h1>
        <p className="text-[14px] text-[var(--muted)]">Runs one topic through several models for one role. All other roles use the normal routes. Every slide gets a vision QA score so the decks can be compared.</p>
      </div>

      <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 md:grid-cols-2">
        <div className="space-y-3">
          <Select
            label="Role"
            value={role}
            onChange={(v) => {
              setRole(v);
              setPicked([]);
            }}
            options={(cat?.roles || []).map((r) => ({ value: r.role, label: r.role, hint: ROLE_HELP[r.role] }))}
          />
          <label className="block text-[13px] font-medium text-[var(--muted)]">Topic</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className={input} />
          <Select label="Slides" value={slides} onChange={setSlides} options={[4, 6, 8, 10].map((n) => ({ value: n, label: `${n} slides` }))} />
        </div>
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-[var(--muted)]">Models to compare (up to 6)</p>
          <div className="max-h-[300px] space-y-1 overflow-auto">
            {routes.map((r) => (
              <label key={r.id} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-[14px] ${r.configured ? "" : "opacity-40"}`}>
                <input
                  type="checkbox"
                  disabled={!r.configured}
                  checked={picked.includes(r.id)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.id].slice(0, 6) : p.filter((x) => x !== r.id)))}
                />
                <span className="font-mono text-[13px]">{r.id}</span>
                {!r.configured && <span className="text-[12px]">(no key)</span>}
              </label>
            ))}
          </div>
          <button onClick={start} disabled={busy || !picked.length} className="mt-2 w-full rounded-xl bg-[var(--accent)] py-3 font-semibold text-white disabled:opacity-40">
            {busy ? "Starting" : `Run ${picked.length || ""} deck${picked.length === 1 ? "" : "s"}`}
          </button>
          {err && <p className="text-[14px] text-[#9B1C1C]">{err}</p>}
        </div>
      </section>

      {result && (
        <section className="space-y-3">
          <h2 className="text-[18px] font-semibold">
            {result.role}: “{result.topic}”
          </h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(300px, 1fr))` }}>
            {result.runs.map((r) => (
              <div key={r.candidate} className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4">
                <p className="font-mono text-[13px] font-semibold [overflow-wrap:anywhere]">{r.candidate}</p>
                {r.status === "done" ? (
                  <dl className="grid grid-cols-2 gap-y-1 text-[13px]">
                    <dt className="text-[var(--muted)]">QA score</dt>
                    <dd className="font-semibold">{r.qaScore ?? "-"} / 10</dd>
                    <dt className="text-[var(--muted)]">Clean slides</dt>
                    <dd>{r.cleanSlides}</dd>
                    <dt className="text-[var(--muted)]">Total time</dt>
                    <dd>{r.seconds}s</dd>
                    <dt className="text-[var(--muted)]">Avg call ({result.role})</dt>
                    <dd>{r.roleAvgSeconds ?? "-"}s</dd>
                    <dt className="text-[var(--muted)]">AI calls / failed</dt>
                    <dd>
                      {r.calls} / {r.failedCalls}
                    </dd>
                  </dl>
                ) : r.status === "failed" ? (
                  <p className="text-[13px] text-[#9B1C1C]">{r.error}</p>
                ) : (
                  <p className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" /> {r.status === "queued" ? "In queue" : `${r.percent ?? 0}%`}
                  </p>
                )}
                {Object.keys(r.servedBy).length > 1 && <p className="text-[12px] text-[var(--muted)]">Note: some {result.role} calls fell back to other models: {JSON.stringify(r.servedBy)}</p>}
                <div className="grid grid-cols-2 gap-1.5">
                  {r.slides.map((s) => (
                    <a key={s} href={s} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s} alt="" loading="lazy" className="w-full rounded" style={{ aspectRatio: "16/9", objectFit: "cover" }} />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!cat?.benchmarks.length && (
        <section className="space-y-2">
          <h2 className="text-[16px] font-semibold">Earlier runs</h2>
          <ul className="space-y-1 text-[14px]">
            {cat.benchmarks.map((b) => (
              <li key={b.id}>
                <button className="text-[var(--accent)]" onClick={async () => setResult(await api(`/api/benchmark/${b.id}`))}>
                  {new Date(b.createdAt).toLocaleString()} · {b.role} · {b.topic} · {b.runs.length} models
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">Quota today</h2>
        <div className="overflow-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[var(--muted)]">
                <th className="p-2">Role</th>
                <th className="p-2">Model</th>
                <th className="p-2">Used today (per key)</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {cat?.scheduler.rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  <td className="p-2">{r.role}</td>
                  <td className="p-2 font-mono">
                    {r.provider}:{r.model}
                  </td>
                  <td className="p-2">{r.keys.map((k) => k.usedToday).join(" / ") || "no key"}</td>
                  <td className="p-2">{r.keys.map((k) => k.exhausted || "ok").join(" / ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
