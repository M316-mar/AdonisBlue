import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type AdminUser = { userId: string; email: string };

/**
 * Verify the request comes from a logged-in Supabase user whose email is in
 * the ADMIN_EMAILS env var (comma-separated, server-only — no NEXT_PUBLIC_).
 *
 * Usage:
 *   const admin = await requireAdmin(request);
 *   if (admin instanceof NextResponse) return admin;
 *   // admin.userId, admin.email are available here
 */
export async function requireAdmin(request: Request): Promise<AdminUser | NextResponse> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    // Misconfigured — fail closed
    return NextResponse.json({ error: "Admin access not configured" }, { status: 403 });
  }

  if (!adminEmails.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id, email: user.email };
}
