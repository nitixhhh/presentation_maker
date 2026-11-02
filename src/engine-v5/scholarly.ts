/**
 * Engine v5 — peer-reviewed sources the deck can stand on. v3/v4 research leans on Wikipedia (the deeper step adds
 * Wikipedia pages of people and works) and the paper search matches title words only, so a references slide could be
 * mostly encyclopedia entries plus an off-topic paper that happened to share words with the topic (live re-run
 * 2026-11-02: an anaemia survey cited on an economics deck). This step
 *   1. checks every paper already found against the topic (one short AI call) and drops the off-topic ones,
 *   2. when fewer than three papers remain, searches OpenAlex / arXiv / Europe PMC / Crossref for more, checks them
 *      the same way, and extracts cited facts from their abstracts,
 * so the planner can build slides on papers first and the references slide is not an encyclopedia list.
 */
import { chatJson } from "../engine-v3/llm";
import { crossref } from "../engine-v3/research/sources";
import type { Brief, ResearchPack, Source } from "../engine-v3/types";
import { FACTS_SYSTEM, scholarlySources } from "../engine-v4/deepen";

type Cand = Omit<Source, "id"> & { id?: string };

/** ids (or indexes) of the papers that are really about the topic; on any failure keeps all (never blocks a deck) */
export async function onTopicPapers(topic: string, brief: Brief, papers: Cand[]): Promise<Set<number>> {
  if (!papers.length) return new Set();
  try {
    const list = papers.map((p, i) => `${i + 1}. ${p.title}${p.venue ? ` — ${p.venue}` : ""}${p.year ? ` (${p.year})` : ""}\n   ${String(p.text || "").slice(0, 280)}`).join("\n");
    const { data } = await chatJson<{ keep: number[] }>("research", [
      {
        role: "user",
        content: `A ${brief.level || "university"} presentation is about: "${topic}" (subject: ${brief.subject || "?"}).\nWhich of these papers are directly about that subject and useful as a cited source for it? A paper that only shares words with the topic but studies something else (another field, a disease, a single unrelated case) is NOT useful.\n${list}\nReply ONLY JSON: {"keep":[numbers of the useful papers]}`,
      },
    ], { temperature: 0, maxTokens: 200, timeoutMs: 30_000, label: "v5 paper check" });
    const keep = new Set((Array.isArray(data?.keep) ? data.keep : []).map((n: any) => Number(n) - 1).filter((n: number) => n >= 0 && n < papers.length));
    return keep;
  } catch {
    return new Set(papers.map((_, i) => i));
  }
}

export async function boostScholarly(brief: Brief, pack: ResearchPack, topic: string, log: (m: string) => void): Promise<ResearchPack> {
  let sources = pack.sources;
  let facts = pack.facts;
  // 1. drop papers that only share words with the topic
  const have = sources.filter((s) => s.kind !== "wikipedia");
  if (have.length) {
    const keep = await onTopicPapers(topic, brief, have);
    const drop = have.filter((_, i) => !keep.has(i));
    if (drop.length) {
      const ids = new Set(drop.map((s) => s.id));
      sources = sources.filter((s) => !ids.has(s.id));
      facts = facts.map((f) => ({ ...f, sources: f.sources.filter((sid) => !ids.has(sid)) })).filter((f) => f.sources.length);
      log(`dropped ${drop.length} off-topic paper(s): ${drop.map((s) => s.title.slice(0, 60)).join(" | ")}`);
    }
  }
  const papers = sources.filter((s) => s.kind !== "wikipedia");
  if (papers.length >= 3) return { ...pack, sources, facts };
  // 2. more papers
  try {
    const [a, b] = await Promise.all([
      scholarlySources(brief, topic, sources, brief.researchQueries.slice(1, 4)).catch(() => [] as Cand[]),
      crossref(String(topic).replace(/[?:!]/g, " "), 4).catch(() => [] as Cand[]),
    ]);
    const seen = new Set(sources.map((s) => s.title.toLowerCase().replace(/[^a-z0-9]/g, "")));
    const cands: Cand[] = [];
    for (const c of [...a, ...b]) {
      const k = c.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!c.title || seen.has(k) || String(c.text || "").length < 200) continue;
      seen.add(k);
      cands.push(c);
    }
    const ok = await onTopicPapers(topic, brief, cands);
    const found = cands.filter((_, i) => ok.has(i)).slice(0, 3 - papers.length);
    if (!found.length) {
      log(`no further on-topic paper with an abstract was found (${cands.length} checked)`);
      return { ...pack, sources, facts };
    }
    const maxN = Math.max(0, ...sources.map((s) => Number(s.id.slice(1)) || 0));
    const fresh: Source[] = found.map((s, i) => ({ ...(s as Source), id: `S${maxN + i + 1}` }));
    const blocks = fresh.map((s) => `[${s.id}] (paper) ${s.title} — ${(s.authors || []).slice(0, 2).join(", ")}${s.year ? ` (${s.year})` : ""}${s.venue ? `, ${s.venue}` : ""}\n${s.text.slice(0, 3500)}`).join("\n\n---\n\n");
    const r = await chatJson<{ facts: any[] }>("research", [{ role: "system", content: FACTS_SYSTEM }, { role: "user", content: `TOPIC: ${brief.title}\n\nSOURCES:\n\n${blocks}` }], { temperature: 0.2, maxTokens: 2500, timeoutMs: 90_000, label: "v5 paper facts" });
    const ids = new Set(fresh.map((s) => s.id));
    let next = Math.max(0, ...facts.map((f) => Number(f.id.slice(1)) || 0));
    const nf = (r.data?.facts || [])
      .filter((f: any) => f?.text)
      .map((f: any) => ({ id: `F${++next}`, text: String(f.text), sources: (Array.isArray(f.sources) ? f.sources : [f.sources]).map(String).filter((x: string) => ids.has(x)), kind: f.kind }))
      .filter((f: any) => f.sources.length);
    const used = new Set(nf.flatMap((f: any) => f.sources));
    const keepNew = fresh.filter((s) => used.has(s.id));
    if (keepNew.length) log(`papers: +${keepNew.length} (${keepNew.map((s) => `${s.title.slice(0, 60)}${s.year ? `, ${s.year}` : ""}`).join(" | ")}), +${nf.length} cited facts`);
    return { ...pack, sources: [...sources, ...keepNew], facts: [...facts, ...nf] };
  } catch (e: any) {
    log(`paper search skipped (${String(e?.message || e).slice(0, 80)})`);
    return { ...pack, sources, facts };
  }
}
