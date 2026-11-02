import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logError";

/** Seconds in 10 minutes — the standard rate-limit window. */
export const RATE_WINDOW_SECONDS = 600;

/** Normal per-IP per-route limits. */
export const RATE_LIMITS = {
  chat: 30,
  healing: 20,
  productChat: 40,
} as const;

/** Separate ceiling for emergency messages — stops alert flooding. */
export const EMERGENCY_RATE_LIMIT = 60;

/**
 * Extract the best-available client IP from Vercel/proxy headers.
 * Returns "unknown" when no IP can be determined.
 */
export function getClientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  return "unknown";
}

/**
 * Check the rate limit for a given key.
 *
 * Returns true  → request is allowed.
 * Returns false → rate-limited.
 *
 * Fails open on DB error (so a real client is never blocked by an outage),
 * but always calls logError() so the health report catches it.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number = RATE_WINDOW_SECONDS,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    await logError("rate-limit", error.message);
    return true; // fail open
  }

  return data === true;
}

/** Build a service-role Supabase client (used inside the rate-limit helper). */
export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
