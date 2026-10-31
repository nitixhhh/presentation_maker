"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const QA: { q: string; a: React.ReactNode }[] = [
  { q: "Is the preview really free?", a: "Yes. You can see the whole deck with a watermark for free. Pay only when you want the clean PDF and editable PPTX." },
  { q: "How long does it take?", a: "Usually 6 to 10 minutes, a little longer at busy times. You can close the app: the deck keeps building on the server and will be waiting in My decks." },
  { q: "Can it make decks in Hindi or Hinglish?", a: "Yes. English, Hindi and Hinglish are all supported." },
  { q: "My college's title slide and format?", a: "Give your name, roll no., guide, department, college and logo, and the title slide is made that way. You can also list required sections (Introduction, Methodology, References)." },
  { q: "Can I edit the PowerPoint?", a: "Yes, the PPTX is fully editable. After unlocking you can redo 2 slides for free: pick a slide and say what should change." },
  { q: "Where do the facts come from?", a: "From real sources, listed on the references slide. Still, read it once before you submit: AI can make mistakes." },
  {
    q: "Is my data safe?",
    a: (
      <>
        Google sign-in is used only for your account and your decks. Your topic and details are sent to AI models only to make the deck, so don't include personal or confidential information.{" "}
        <a href="/privacy" className="font-medium text-[var(--accent-ink)] underline decoration-[var(--rule-2)] underline-offset-4">
          Read the privacy policy
        </a>
      </>
    ),
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="panel divide-y divide-[var(--rule)] rounded-[var(--r-lg)]">
      {QA.map((x, i) => {
        const on = open === i;
        return (
          <div key={x.q} data-open={on}>
            <button
              type="button"
              aria-expanded={on}
              onClick={() => setOpen(on ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-[18px] text-left text-[16px] font-medium text-[var(--ink)] sm:px-6"
            >
              {x.q}
              <ChevronDown className="chev h-5 w-5 shrink-0 text-[var(--muted)]" />
            </button>
            <div className="fold" data-open={on} inert={!on}>
              <div>
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-[var(--muted)] sm:px-6">{x.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
