"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import PopMenu from "@/components/ui/PopMenu";

/** The first screen is the product: type a topic here and it carries over to the real form on /create. */
export default function HeroComposer() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [slides, setSlides] = useState(10);
  const [lang, setLang] = useState("English");
  const go = () => {
    const q = new URLSearchParams({ slides: String(slides), lang });
    if (topic.trim()) q.set("topic", topic.trim());
    router.push(`/create?${q}`);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="glass rounded-[var(--r-xl)] p-2 text-left"
    >
      <div className="rounded-[26px] border border-[rgba(255,255,255,.7)] bg-[rgba(255,253,248,.72)] px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <label htmlFor="hero-topic" className="sr-only">
          Topic
        </label>
        <textarea
          id="hero-topic"
          rows={2}
          maxLength={300}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go();
            }
          }}
          placeholder="What is your presentation about? e.g. Photosynthesis"
          className="w-full resize-none bg-transparent text-[17px] leading-[1.4] text-[var(--ink)] outline-none placeholder:text-[var(--faint)] sm:text-[19px]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <PopMenu label="Slides" value={slides} onChange={setSlides} options={[6, 8, 10, 12, 15, 18, 20].map((n) => ({ value: n, label: `${n} slides` }))} />
            <PopMenu
              label="Language"
              value={lang}
              onChange={setLang}
              options={[
                { value: "English", label: "English" },
                { value: "Hindi", label: "Hindi" },
                { value: "Hinglish", label: "Hinglish" },
              ]}
            />
          </div>
          <button type="submit" aria-label="Continue" className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[#fbf6ec] shadow-[0_10px_22px_-12px_rgba(29,25,19,.8)]">
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-3 pb-1.5 pt-2.5 text-[12.5px] font-medium text-[var(--muted)]">
        <span>Free during beta</span>
        <span className="h-1 w-1 rounded-full bg-[var(--rule-2)]" />
        <span>PDF + PPTX</span>
      </div>
    </form>
  );
}
