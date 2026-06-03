import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "signup" | "recovery" | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/auth?error=invalid_link", origin));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    console.error("[auth/confirm] verifyOtp error:", error.message);
    return NextResponse.redirect(new URL("/auth?error=verification_failed", origin));
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/auth/reset-password", origin));
  }

  return NextResponse.redirect(new URL("/onboarding?new=1", origin));
}
