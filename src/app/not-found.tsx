import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Brand";

export const metadata: Metadata = { title: "Page not found — DeckCraft" };

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[680px] px-5 pb-20 pt-[max(24px,env(safe-area-inset-top))]">
      <Link href="/" className="press inline-block py-3">
        <Wordmark />
      </Link>
      <div className="panel mt-6 rounded-[var(--r-lg)] p-6 text-center sm:p-9">
        <span className="eyebrow">404</span>
        <h1 className="display mt-3 text-[34px] sm:text-[44px]">
          This page <span className="accent-serif">doesn&apos;t exist.</span>
        </h1>
        <p className="mt-3 text-[15.5px] text-[var(--muted)]">The link may be old or mistyped.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/create" className="btn btn-ink">
            Make a deck
          </Link>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
