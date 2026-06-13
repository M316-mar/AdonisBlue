"use client";

/**
 * SessionSync — client-side safety net for the `adonisblue_session` proxy cookie.
 *
 * Problem: the proxy reads `adonisblue_session` to decide whether a nurse is
 * logged in.  But that cookie can disappear without the Supabase session going
 * away (e.g. browser cookie-clear, hard refresh, opening the app in a new tab
 * after the cookie expired while localStorage still holds a valid session).
 *
 * Solution: on every page mount this component checks whether the cookie is
 * present.  If it's missing but Supabase `getSession()` returns a live session,
 * we re-set the cookie immediately — before the user tries to navigate anywhere.
 * If the user has no session, we leave things alone (the proxy or the page's
 * own auth check will handle it).
 *
 * It also handles the timeout redirect: if the proxy sends ?reason=timeout the
 * cookie has already been deleted by the proxy; we honour that and do NOT
 * re-set it, so the nurse is correctly returned to /auth.
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SESSION_COOKIE = "adonisblue_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${SESSION_COOKIE}=1`));
}

function setSessionCookie() {
  const isSecure = window.location.protocol === "https:";
  document.cookie = `${SESSION_COOKIE}=1; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

export default function SessionSync() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // If the proxy already decided the session timed out, respect that — do
    // not silently re-set the cookie and let the nurse back in without logging in.
    const isTimeoutRedirect = searchParams.get("reason") === "timeout";
    if (isTimeoutRedirect) return;

    // Cookie already present — nothing to repair.
    if (getSessionCookie()) return;

    // Cookie is missing. Check whether Supabase actually has a live session in
    // localStorage before we decide to repair or leave it missing.
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session;
      if (!session) return; // No session — nurse genuinely needs to log in.

      // Supabase session is valid but cookie is gone — repair it.
      setSessionCookie();

      // If the proxy redirected to /auth?redirect=X because the cookie was
      // missing, bounce the nurse straight to where she was going.
      const redirect = searchParams.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        router.replace(redirect);
      }
    });
  }, [router, searchParams]);

  return null;
}
