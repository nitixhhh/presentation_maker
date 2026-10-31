/** DeckCraft mark: two stacked slides, the front one ink with an ochre title bar. */
export function Mark({ className = "h-[26px] w-[26px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect x="8.5" y="3.5" width="17" height="13" rx="3.5" fill="#FFFDF8" stroke="#1D1913" strokeWidth="1.5" />
      <rect x="2.5" y="10" width="18" height="14" rx="3.5" fill="#1D1913" />
      <rect x="6" y="18.5" width="9" height="2" rx="1" fill="#C98A2E" />
      <rect x="6" y="14" width="5" height="2" rx="1" fill="#FFFDF8" opacity=".55" />
    </svg>
  );
}

/** compact: the name hides on very narrow phones (< 380px) so a crowded header never overflows */
export function Wordmark({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Mark />
      <span className={`${compact ? "hidden min-[380px]:inline" : ""} text-[17px] font-semibold tracking-[-0.03em] text-[var(--ink)]`}>DeckCraft</span>
    </span>
  );
}

export function GoogleG({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
