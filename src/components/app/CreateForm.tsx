"use client";
import { useState } from "react";
import { ChevronDown, ArrowRight, Loader2 } from "lucide-react";

export interface CreateRequest {
  topic: string;
  audience: string;
  slideCount: number;
  language: "English" | "Hindi" | "Hinglish";
  purpose: string;
  formatNotes: string;
  presenter: { names: string; rollNo: string; department: string; institute: string; guide: string; course: string };
}

const EMPTY: CreateRequest = {
  topic: "",
  audience: "",
  slideCount: 10,
  language: "English",
  purpose: "Seminar",
  formatNotes: "",
  presenter: { names: "", rollNo: "", department: "", institute: "", guide: "", course: "" },
};

const PURPOSES = ["Seminar", "Project review", "Class presentation", "Lab report", "Lecture"];

export const field =
  "w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-3 text-[15px] text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)] outline-none";
const label = "block text-[13px] font-medium text-[var(--muted)] mb-1.5";

export default function CreateForm({ onSubmit, busy, error }: { onSubmit: (r: CreateRequest) => void; busy: boolean; error: string | null }) {
  const [r, setR] = useState<CreateRequest>(EMPTY);
  const [more, setMore] = useState(false);
  const set = <K extends keyof CreateRequest>(k: K, v: CreateRequest[K]) => setR((x) => ({ ...x, [k]: v }));
  const setP = (k: keyof CreateRequest["presenter"], v: string) => setR((x) => ({ ...x, presenter: { ...x.presenter, [k]: v } }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (r.topic.trim().length >= 3 && !busy) onSubmit(r);
      }}
      className="space-y-5"
    >
      <div>
        <label htmlFor="topic" className={label}>
          Topic
        </label>
        <textarea
          id="topic"
          rows={2}
          value={r.topic}
          onChange={(e) => set("topic", e.target.value)}
          placeholder="e.g. UV-Visible Spectroscopy: principle and applications"
          className={`${field} resize-none leading-snug`}
          maxLength={300}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="slides" className={label}>
            Slides
          </label>
          <select id="slides" value={r.slideCount} onChange={(e) => set("slideCount", Number(e.target.value))} className={field}>
            {[6, 8, 10, 12, 15, 18, 20].map((n) => (
              <option key={n} value={n}>
                {n} slides
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lang" className={label}>
            Language
          </label>
          <select id="lang" value={r.language} onChange={(e) => set("language", e.target.value as CreateRequest["language"])} className={field}>
            <option>English</option>
            <option>Hindi</option>
            <option>Hinglish</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="aud" className={label}>
          Class / audience
        </label>
        <input id="aud" value={r.audience} onChange={(e) => set("audience", e.target.value)} placeholder="e.g. B.Tech CSE, 3rd semester" className={field} maxLength={160} />
      </div>

      <div>
        <span className={label}>Type</span>
        <div className="flex flex-wrap gap-2">
          {PURPOSES.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => set("purpose", p)}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-medium ${
                r.purpose === p ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-white text-[var(--muted)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white">
        <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
          <span>
            <span className="block text-[15px] font-medium text-[var(--ink)]">Title slide and college format</span>
            <span className="block text-[13px] text-[var(--muted)]">Name, roll no., guide, department, required sections</span>
          </span>
          <ChevronDown className={`h-5 w-5 text-[var(--muted)] transition-transform ${more ? "rotate-180" : ""}`} />
        </button>
        {more && (
          <div className="space-y-3 border-t border-[var(--line)] p-4">
            <input value={r.presenter.names} onChange={(e) => setP("names", e.target.value)} placeholder="Presented by (names)" className={field} />
            <div className="grid grid-cols-2 gap-3">
              <input value={r.presenter.rollNo} onChange={(e) => setP("rollNo", e.target.value)} placeholder="Roll no." className={field} />
              <input value={r.presenter.course} onChange={(e) => setP("course", e.target.value)} placeholder="Course / semester" className={field} />
            </div>
            <input value={r.presenter.guide} onChange={(e) => setP("guide", e.target.value)} placeholder="Guide / supervisor" className={field} />
            <input value={r.presenter.department} onChange={(e) => setP("department", e.target.value)} placeholder="Department" className={field} />
            <input value={r.presenter.institute} onChange={(e) => setP("institute", e.target.value)} placeholder="College / university" className={field} />
            <textarea
              rows={3}
              value={r.formatNotes}
              onChange={(e) => set("formatNotes", e.target.value)}
              placeholder="Required format, if any (e.g. Introduction, Objectives, Methodology, Results, Conclusion, References in IEEE style)"
              className={`${field} resize-none`}
              maxLength={2000}
            />
          </div>
        )}
      </div>

      {error && <p className="rounded-xl border border-[#F3C7C7] bg-[#FDF2F2] px-4 py-3 text-[14px] text-[#9B1C1C]">{error}</p>}

      <button
        type="submit"
        disabled={busy || r.topic.trim().length < 3}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-4 text-[16px] font-semibold text-white shadow-sm disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {busy ? "Starting" : "Create presentation"}
        {!busy && <ArrowRight className="h-5 w-5" />}
      </button>
      <p className="text-center text-[13px] text-[var(--muted)]">Takes a few minutes. You can close the app while it works.</p>
    </form>
  );
}
