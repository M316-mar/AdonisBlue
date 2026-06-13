import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * IMPORTANT: Supabase JS is configured to use localStorage (not HTTP cookies)
 * for session storage in this project, so the Supabase auth cookie is never
 * present on incoming requests. We therefore maintain our own lightweight
 * session marker cookie — `adonisblue_session` — that the client sets after a
 * successful login and clears on logout.
 *
 * A companion client component (SessionSync) re-sets this cookie automatically
 * whenever Supabase has a valid session in localStorage but the cookie is
 * absent (e.g. after a browser cookie clear or a hard refresh).
 *
 * Actual authentication / authorisation is enforced server-side inside every
 * API route using the Bearer token + Supabase getUser().  The proxy is an
 * optimistic UX layer only (fast redirects, inactivity timeout).
 */
const SESSION_COOKIE = "adonisblue_session";
const LAST_ACTIVE_COOKIE = "sb_last_active";
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Routes that require a logged-in session
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/aftercare",
  "/loyalty",
  "/insights",
  "/blueroom",
  "/onboarding",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function isLoggedIn(request: NextRequest): boolean {
  return request.cookies.get(SESSION_COOKIE)?.value === "1";
}

function isInactive(request: NextRequest): boolean {
  const raw = request.cookies.get(LAST_ACTIVE_COOKIE)?.value;
  if (!raw) return false; // Cookie not yet written — treat as just-logged-in
  const lastActive = parseInt(raw, 10);
  if (isNaN(lastActive)) return false;
  return Date.now() - lastActive > INACTIVITY_TIMEOUT_MS;
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// ── Proxy ──────────────────────────────────────────────────────────────────
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Safety gate ────────────────────────────────────────────────────────
  // /auth and every sub-path (/auth/callback, /auth/confirm, /auth/reset-password)
  // always pass through unconditionally — no matter what, nurses can always
  // reach the login page. This must be the very first check.
  if (pathname === "/auth" || pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  const protected_ = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const loggedIn = isLoggedIn(request);

  // 1. Inactivity timeout — only fires on protected pages for logged-in users
  if (loggedIn && protected_ && isInactive(request)) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("reason", "timeout");
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    res.cookies.delete(LAST_ACTIVE_COOKIE);
    return res;
  }

  // 2. Unauthenticated user hitting a protected page → send to /auth
  //    The SessionSync client component will repair a missing cookie if Supabase
  //    actually has a valid session; the user is then redirected to /dashboard
  //    client-side without ever seeing the login form.
  if (!loggedIn && protected_) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 3. All other requests (public pages, /healing, /chat, etc.) pass through
  return NextResponse.next();
}

// ── Matcher ────────────────────────────────────────────────────────────────
// Narrow matcher — never runs on API routes, static files, or asset paths so
// Supabase auth callbacks and all fetch requests are never intercepted.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|api/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|css|js)$).*)",
  ],
};
