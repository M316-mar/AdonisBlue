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

// ── Route classification ───────────────────────────────────────────────────

/**
 * Routes the proxy NEVER touches — always NextResponse.next().
 *
 * /api/*              — ALL API routes handle their own auth server-side.
 *                       This explicitly includes (but is not limited to):
 *                         /api/booking-webhook  — receives unauthenticated
 *                           POST requests from external booking software
 *                           (Vagaro, Jane, Square, Acuity, Mindbody, etc.)
 *                         /api/chat             — public bot chat endpoint
 *                         /api/bot              — public bot config endpoint
 *                         /api/intake           — public lead-capture endpoint
 *                         /api/healing          — public client healing chat
 *                       None of these should ever be blocked by this proxy.
 *                       The matcher already excludes api/ entirely (see below)
 *                       but we also guard in-function for absolute safety.
 *
 * /auth/*             — login, callback, confirm, reset-password — nurses must
 *                       always be able to reach the login page.
 *
 * /healing/*          — public client-facing recovery chat pages
 * /chat/*             — public bot chat pages
 * /ref/*              — public referral pages
 * /survey/*           — public survey pages
 * /                   — landing page
 */
const ALWAYS_PUBLIC_PREFIXES = [
  "/api/",
  "/auth",
  "/healing",
  "/chat",
  "/ref",
  "/survey",
];

// Routes that require a valid `adonisblue_session` cookie
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/aftercare",
  "/loyalty",
  "/insights",
  "/blueroom",
  "/onboarding",
  "/booking-connect",
  "/offers",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function isAlwaysPublic(pathname: string): boolean {
  return ALWAYS_PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
}

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

  // ── Gate 1: Always-public routes — pass through unconditionally ────────
  // This is the definitive list of routes this proxy will NEVER block.
  // /api/* is excluded by the matcher below too, so API routes get a
  // double guarantee: the proxy function is never even called for them,
  // and even if it were, this guard fires first.
  if (isAlwaysPublic(pathname)) {
    return NextResponse.next();
  }

  const protected_ = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const loggedIn = isLoggedIn(request);

  // ── Gate 2: Inactivity timeout ─────────────────────────────────────────
  // Only fires on protected pages for logged-in users who haven't interacted
  // with the app for 30 minutes. ActivityTracker resets sb_last_active on
  // every click/keypress/scroll so active nurses are never timed out.
  if (loggedIn && protected_ && isInactive(request)) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("reason", "timeout");
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    res.cookies.delete(LAST_ACTIVE_COOKIE);
    return res;
  }

  // ── Gate 3: Unauthenticated access to protected page ──────────────────
  // SessionSync (client component) will repair a missing cookie if Supabase
  // has a live session in localStorage — the user is then redirected to their
  // original destination without seeing the login form.
  if (!loggedIn && protected_) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // ── All other requests pass through ────────────────────────────────────
  return NextResponse.next();
}

// ── Matcher ────────────────────────────────────────────────────────────────
// ALLOWLIST — the proxy only runs on the paths listed here.
// Every route NOT in this list (all /api/* routes, /healing/*, /chat/*,
// public pages, static assets, etc.) never reaches this function at all.
//
// This is intentionally an allowlist, not a denylist.  A denylist regex
// that tries to exclude /api/ can have edge-case failures in the runtime;
// an allowlist is unambiguous — if a path isn't listed, the proxy is silent.
//
// Routes the proxy guards:
//   /dashboard, /aftercare, /loyalty, /insights,
//   /blueroom, /onboarding, /booking-connect  — protected (need session cookie)
//   /auth and sub-paths                        — safe-pass-through (handled
//                                                by isAlwaysPublic guard above)
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/aftercare/:path*",
    "/loyalty/:path*",
    "/insights/:path*",
    "/blueroom/:path*",
    "/onboarding/:path*",
    "/booking-connect/:path*",
    "/dashboard",
    "/aftercare",
    "/loyalty",
    "/insights",
    "/blueroom",
    "/onboarding",
    "/booking-connect",
    "/offers/:path*",
    "/offers",
    "/auth/:path*",
    "/auth",
  ],
};
