import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Brand";

export const metadata: Metadata = { title: "Privacy — DeckCraft" };

const CONTACT = "nitish.gowala@mail.tab.bot";

/* DRAFT (2026-10-31): short plain-language notice; to be reviewed by the owner before launch. */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-[680px] px-5 pb-20 pt-[max(24px,env(safe-area-inset-top))]">
      <Link href="/" className="press inline-block py-3">
        <Wordmark />
      </Link>
      <article className="panel mt-6 rounded-[var(--r-lg)] p-6 sm:p-9">
        <span className="eyebrow">Privacy</span>
        <h1 className="display mt-3 text-[34px] sm:text-[44px]">
          Your data, <span className="accent-serif">in plain words.</span>
        </h1>
        <p className="mt-2 text-[13px] text-[var(--muted)]">Last updated 31 October 2026</p>
        <div className="mt-7 space-y-6 text-[15.5px] leading-relaxed text-[var(--ink-2)]">
          <section>
            <h2 className="mb-1.5 text-[17px] font-semibold text-[var(--ink)]">Login</h2>
            <p>You sign in with Google. We receive your name, email address and profile picture from Google, and use them only to keep your decks and credits in your account.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-[17px] font-semibold text-[var(--ink)]">What we store</h2>
            <p>Your account, the details you type in the form (topic, class, title-slide details, logo) and the decks we make are stored with Supabase, our database and file storage provider. Write to us any time to have your account and decks deleted.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-[17px] font-semibold text-[var(--ink)]">AI models</h2>
            <p>Decks are researched, written and designed by AI models from third-party providers (for example Google Gemini and models reached through OpenRouter and NVIDIA). Your topic and form details are sent to them only to make your deck. Some free AI services may use what is sent to improve their models, so please do not enter personal or confidential information.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-[17px] font-semibold text-[var(--ink)]">Payments</h2>
            <p>Payments are handled by the payment provider. We do not see or store your card or UPI details.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-[17px] font-semibold text-[var(--ink)]">Age</h2>
            <p>DeckCraft is for people aged 18 and over.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-[17px] font-semibold text-[var(--ink)]">Contact</h2>
            <p>
              Questions or deletion requests:{" "}
              <a href={`mailto:${CONTACT}`} className="font-medium text-[var(--accent-ink)] underline decoration-[var(--rule-2)] underline-offset-4">
                {CONTACT}
              </a>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
