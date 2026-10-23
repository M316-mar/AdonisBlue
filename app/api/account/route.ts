import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";
import { logError } from "@/lib/logError";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.adonisblue.io";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9\s\+\-\(\)]{7,20}$/;

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await anon.auth.getUser(token);
  return user ?? null;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = serviceClient();
    const { data: bot, error } = await db
      .from("bots")
      .select("nurse_name, practice_name, location, business_hours, phone_public, alert_email, alert_email_verified, pending_alert_email, alert_phone, bot_name, greeting, slug, plan, trial_ends_at, subscription_status, frozen")
      .eq("nurse_id", user.id)
      .maybeSingle();

    if (error) {
      await logError("account", error.message, user.id);
      return NextResponse.json({ error: "Could not load account" }, { status: 500 });
    }

    return NextResponse.json({
      nurse_name: (bot as { nurse_name?: string | null } | null)?.nurse_name ?? "",
      login_email: user.email ?? "",
      practice_name: (bot as { practice_name?: string | null } | null)?.practice_name ?? "",
      location: (bot as { location?: string | null } | null)?.location ?? "",
      business_hours: (bot as { business_hours?: string | null } | null)?.business_hours ?? "",
      phone_public: (bot as { phone_public?: string | null } | null)?.phone_public ?? "",
      alert_email: (bot as { alert_email?: string | null } | null)?.alert_email ?? "",
      alert_email_verified: (bot as { alert_email_verified?: boolean | null } | null)?.alert_email_verified ?? false,
      pending_alert_email: (bot as { pending_alert_email?: string | null } | null)?.pending_alert_email ?? null,
      alert_phone: (bot as { alert_phone?: string | null } | null)?.alert_phone ?? "",
      bot_name: (bot as { bot_name?: string | null } | null)?.bot_name ?? "",
      greeting: (bot as { greeting?: string | null } | null)?.greeting ?? "",
      slug: (bot as { slug?: string | null } | null)?.slug ?? "",
      plan: (bot as { plan?: string | null } | null)?.plan ?? "trial",
      trial_ends_at: (bot as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null,
      subscription_status: (bot as { subscription_status?: string | null } | null)?.subscription_status ?? null,
      frozen: (bot as { frozen?: boolean | null } | null)?.frozen ?? false,
    });
  } catch (e) {
    await logError("account", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const section = typeof body.section === "string" ? body.section : "";
    const db = serviceClient();

    // ── Profile ──────────────────────────────────────────────────────────────
    if (section === "profile") {
      const nurseName = typeof body.nurse_name === "string" ? body.nurse_name.trim().slice(0, 100) : "";
      const { error } = await db.from("bots").update({ nurse_name: nurseName || null }).eq("nurse_id", user.id);
      if (error) { await logError("account", `profile: ${error.message}`, user.id); return NextResponse.json({ error: "Save failed" }, { status: 500 }); }
      return NextResponse.json({ ok: true });
    }

    // ── Practice ─────────────────────────────────────────────────────────────
    if (section === "practice") {
      const practice_name = typeof body.practice_name === "string" ? body.practice_name.trim().slice(0, 120) : null;
      const location = typeof body.location === "string" ? body.location.trim().slice(0, 200) : null;
      const business_hours = typeof body.business_hours === "string" ? body.business_hours.trim().slice(0, 300) : null;
      const rawPhone = typeof body.phone_public === "string" ? body.phone_public.trim() : "";
      if (rawPhone && !PHONE_REGEX.test(rawPhone)) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
      const { error } = await db.from("bots").update({ practice_name: practice_name || null, location: location || null, business_hours: business_hours || null, phone_public: rawPhone || null }).eq("nurse_id", user.id);
      if (error) { await logError("account", `practice: ${error.message}`, user.id); return NextResponse.json({ error: "Save failed" }, { status: 500 }); }
      return NextResponse.json({ ok: true });
    }

    // ── Alert phone ──────────────────────────────────────────────────────────
    if (section === "alerts_phone") {
      const rawPhone = typeof body.alert_phone === "string" ? body.alert_phone.trim() : "";
      if (rawPhone && !PHONE_REGEX.test(rawPhone)) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
      const { error } = await db.from("bots").update({ alert_phone: rawPhone || null }).eq("nurse_id", user.id);
      if (error) { await logError("account", `alerts_phone: ${error.message}`, user.id); return NextResponse.json({ error: "Save failed" }, { status: 500 }); }
      return NextResponse.json({ ok: true });
    }

    // ── Alert email: save pending + send verification ────────────────────────
    if (section === "alerts_email") {
      const rawEmail = typeof body.alert_email === "string" ? body.alert_email.trim() : "";
      if (!rawEmail) return NextResponse.json({ error: "Email is required" }, { status: 400 });
      if (!EMAIL_REGEX.test(rawEmail) || rawEmail.length > 254) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });

      // Fetch current state
      const { data: bot } = await db.from("bots").select("alert_email, practice_name").eq("nurse_id", user.id).maybeSingle();
      const currentEmail = (bot as { alert_email?: string | null } | null)?.alert_email?.trim() ?? "";
      const practiceName = (bot as { practice_name?: string | null } | null)?.practice_name ?? "your practice";

      // Save to pending_alert_email + clear verified flag while pending
      const verifyToken = crypto.randomUUID();
      const { error: saveErr } = await db.from("bots").update({
        pending_alert_email: rawEmail,
        alert_verification_token: verifyToken,
        // Only clear verified flag if email is actually changing
        ...(rawEmail !== currentEmail ? { alert_email_verified: false } : {}),
      }).eq("nurse_id", user.id);
      if (saveErr) { await logError("account", `alerts_email save: ${saveErr.message}`, user.id); return NextResponse.json({ error: "Save failed" }, { status: 500 }); }

      const verifyUrl = `${SITE_URL}/api/verify-alert?token=${encodeURIComponent(verifyToken)}&nurse_id=${encodeURIComponent(user.id)}&from=account`;
      const result = await sendEmail({
        type: "alert_verification",
        nurse_id: user.id,
        to: rawEmail,
        subject: "✅ Confirm your emergency alert email — AdonisBlue",
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">🚨 Confirm emergency alert email</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${escapeHtml(practiceName)}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 12px;font-size:15px;color:#1a2744;font-weight:600;">Almost there — one click to confirm.</p>
          <p style="margin:0 0 20px;font-size:15px;color:#475569;">When a client describes a medical emergency in your chat, you'll get an alert at this address. Click below to confirm it's correct:</p>
          <p style="margin:0 0 24px;"><a href="${verifyUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">✅ Yes, this is me</a></p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="margin:0;font-size:13px;color:#94a3b8;">This link works once. Until you confirm, emergency alerts continue going to your previous verified address. If you didn't request this, you can ignore this email safely.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">AdonisBlue &middot; hi@adonisblue.io</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        supabase: db,
      });

      if (!result.ok) {
        await logError("account", `alerts_email send: ${result.error ?? "send failed"}`, user.id);
        return NextResponse.json({ error: "Could not send verification email. Please check the address and try again." }, { status: 500 });
      }

      return NextResponse.json({ ok: true, verification_sent: true });
    }

    // ── Assistant ────────────────────────────────────────────────────────────
    if (section === "assistant") {
      const bot_name = typeof body.bot_name === "string" ? body.bot_name.trim().slice(0, 100) : null;
      const greeting = typeof body.greeting === "string" ? body.greeting.trim().slice(0, 1000) : null;
      const { error } = await db.from("bots").update({ bot_name: bot_name || null, greeting: greeting || null }).eq("nurse_id", user.id);
      if (error) { await logError("account", `assistant: ${error.message}`, user.id); return NextResponse.json({ error: "Save failed" }, { status: 500 }); }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  } catch (e) {
    await logError("account", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
