"use client";
import { useEffect } from "react";
import { rememberReferral } from "@/lib/client/auth";

/**
 * The app used to live at "/". Old links (/?job=…, /?view=decks) and a Google sign-in that returns to the site root
 * (?code=…) move on to /create with everything intact; ?ref=CODE is remembered here as before.
 */
export default function LegacyRedirect() {
  useEffect(() => {
    rememberReferral();
    const q = window.location.search;
    if (/[?&](job|view|code|error|error_description)=/.test(q)) window.location.replace(`/create${q}${window.location.hash}`);
  }, []);
  return null;
}
