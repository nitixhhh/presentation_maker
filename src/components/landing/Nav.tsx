import Link from "next/link";
import { Wordmark } from "@/components/brand/Brand";

export default function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-[max(10px,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
      <div className="glass mx-auto flex h-[56px] max-w-[1080px] items-center justify-between rounded-full pl-4 pr-2 sm:pl-5">
        <Link href="/" aria-label="DeckCraft home" className="press">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-7 text-[14.5px] font-medium text-[var(--ink-2)] md:flex">
          <a href="#how" className="hover:text-[var(--ink)]">How it works</a>
          <a href="#compare" className="hover:text-[var(--ink)]">Before / after</a>
          <a href="#pricing" className="hover:text-[var(--ink)]">Pricing</a>
          <a href="#faq" className="hover:text-[var(--ink)]">FAQ</a>
        </nav>
        <Link href="/create" className="btn btn-ink btn-sm">
          Start free
        </Link>
      </div>
    </header>
  );
}
