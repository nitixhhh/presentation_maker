"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { GoogleG } from "@/components/brand/Brand";
import { accessToken, signInWithGoogle } from "@/lib/client/auth";

/** "Start with Google": signed in -> straight to /create; else the existing Google sign-in, returning to /create. */
export default function GoogleStart({ className = "", label = "Start with Google" }: { className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const dest = `${window.location.origin}/create`;
        try {
          if (await accessToken()) return window.location.assign(dest);
          await signInWithGoogle(dest);
        } catch {
          window.location.assign(dest); // sign-in not set up here: the form still works
        }
      }}
      className={`btn btn-ink ${className}`}
    >
      {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#fffdf8]"><GoogleG className="h-[14px] w-[14px]" /></span>}
      {label}
    </button>
  );
}
