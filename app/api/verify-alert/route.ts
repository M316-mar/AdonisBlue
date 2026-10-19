import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.adonisblue.io";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const nurse_id = url.searchParams.get("nurse_id");

  if (!token || !nurse_id) {
    return new Response(errorPage("This link is missing required information."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: bot, error: findErr } = await db
    .from("bots")
    .select("nurse_id, alert_verification_token, alert_email_verified")
    .eq("nurse_id", nurse_id)
    .maybeSingle();

  if (findErr || !bot) {
    return new Response(errorPage("This link has expired or is invalid."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const row = bot as { alert_verification_token?: string | null; alert_email_verified?: boolean };

  // Already verified — just redirect to success
  if (row.alert_email_verified === true) {
    return NextResponse.redirect(`${SITE_URL}/onboarding?verified=1`);
  }

  if (row.alert_verification_token !== token) {
    return new Response(errorPage("This link has already been used or has expired. Go back to onboarding and click Resend."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const { error: updateErr } = await db
    .from("bots")
    .update({ alert_email_verified: true, alert_verification_token: null })
    .eq("nurse_id", nurse_id);

  if (updateErr) {
    return new Response(errorPage("Something went wrong confirming your email. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  return NextResponse.redirect(`${SITE_URL}/onboarding?verified=1`);
}

function errorPage(msg: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>AdonisBlue</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9;margin:0;">
  <div style="max-width:400px;text-align:center;padding:32px;">
    <p style="font-size:48px;margin:0 0 16px;">⚠️</p>
    <h1 style="color:#1a2744;font-size:20px;margin:0 0 8px;">Something went wrong</h1>
    <p style="color:#475569;margin:0 0 20px;">${msg}</p>
    <a href="${SITE_URL}/onboarding" style="color:#0d9488;font-weight:600;text-decoration:none;">← Back to setup</a>
  </div>
</body></html>`;
}
