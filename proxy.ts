import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Constants ──────────────────────────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const LAST_ACTIVE_COOKIE = "sb_last_active";
const AUTH_COOKIE = "sb-zbhxtpxfyvgzgelqlpzq-auth-token";

const PROTECTED_PATHS = [
  "/dashboard",
  "/aftercare",
  "/loyalty",
  "/insights",
  "/blueroom",
  "/onboarding",
  "/healing",
];

const AUTH_PATHS = ["/auth"];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Decode a JWT payload without verifying the signature (Edge-safe). */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // atob is available in Edge runtime
    const raw = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(raw) as { exp?: number };
  } catch {
    return null;
  }
}

/** Return the access_token string from the Supabase auth cookie, or null. */
function getAccessToken(request: NextRequest): string | null {
  const raw = request.cookies.get(AUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    // Supabase stores the session as a JSON string: { access_token, refresh_token, ... }
    const session = JSON.parse(raw) as { access_token?: string };
    return session.access_token ?? null;
  } catch {
    // Some Supabase versions store the token directly as a string
    return raw;
  }
}

/** True if the access_token is present and its `exp` hasn't passed. */
function isTokenValid(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 > Date.now();
}

/** True if the user has been inactive for longer than INACTIVITY_TIMEOUT_MS. */
function isSessionInactive(request: NextRequest): boolean {
  const raw = request.cookies.get(LAST_ACTIVE_COOKIE)?.value;
  if (!raw) return false; // No cookie yet — treat as active (will be set below)
  const lastActive = parseInt(raw, 10);
  if (isNaN(lastActive)) return false;
  return Date.now() - lastActive > INACTIVITY_TIMEOUT_MS;
}

// ── Proxy ──────────────────────────────────────────────────────────────────
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isAuthPage = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const token = getAccessToken(request);
  const loggedIn = token !== null && isTokenValid(token);

  // ── Inactive session check ───────────────────────────────────────────────
  if (loggedIn && isProtected && isSessionInactive(request)) {
    // Inactivity timeout — redirect to auth, clear activity cookie
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("reason", "timeout");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(LAST_ACTIVE_COOKIE);
    return response;
  }

  // ── Auth redirect rules ──────────────────────────────────────────────────
  if (!loggedIn && isProtected) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (loggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── Update last-active timestamp for authenticated users ─────────────────
  const response = NextResponse.next();

  if (loggedIn) {
    response.cookies.set(LAST_ACTIVE_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // keep cookie alive for 24h (inactivity logic handles timeout)
    });
  }

  return response;
}

// ── Matcher ────────────────────────────────────────────────────────────────
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, robots.txt, sitemap.xml
     * - /api/* (API routes handle their own auth)
     * - /public files (png, jpg, svg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|css|js)$).*)",
  ],
};
