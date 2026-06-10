import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: treatments } = await supabase
      .from("treatments")
      .select("*, intakes(first_name, email, phone, service_interested)")
      .eq("nurse_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ treatments: treatments ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Save treatment
    const { data: treatment, error } = await supabase
      .from("treatments")
      .insert({ ...body, nurse_id: user.id })
      .select("*, intakes(first_name, email, phone)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get procedure aftercare
    const { data: procedure } = await supabase
      .from("procedures")
      .select("*")
      .eq("id", body.procedure_id)
      .single();

    // Get bot info for practice name
    const { data: bot } = await supabase
      .from("bots")
      .select("practice_name, booking_link")
      .eq("nurse_id", user.id)
      .single();

    const practiceName = bot?.practice_name || "your provider";
    const clientEmail = treatment.intakes?.email;
    const clientName = treatment.intakes?.first_name || "Beautiful";
    const aftercare = procedure?.aftercare_instructions || "";
    const procedureName = body.procedure_name || "your treatment";

    // Send aftercare email if client has email and procedure has instructions
    if (clientEmail && aftercare) {
      await resend.emails.send({
        from: "AdonisBlue <hello@adonisblue.io>",
        to: clientEmail,
        subject: `Your ${procedureName} aftercare from ${practiceName} 💙`,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${practiceName}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">You're glowing, ${clientName}! 🌸</h1>
          <p style="margin:0 0 8px;color:#475569;font-size:14px;">Thank you for trusting us with your <strong>${procedureName}</strong> today.</p>
          <div style="background:#f0fdf4;border-radius:14px;padding:24px;margin:20px 0;border-left:4px solid #0d9488;">
            <h2 style="margin:0 0 12px;color:#0d9488;font-size:16px;font-weight:600;">📋 Your ${procedureName} Aftercare</h2>
            <p style="margin:0;color:#1a2744;font-size:15px;line-height:1.75;white-space:pre-wrap;">${aftercare}</p>
          </div>
          <p style="margin:0;color:#475569;font-size:14px;">Questions? Reply to this email anytime 💙</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });

      await supabase
        .from("treatments")
        .update({ aftercare_sent: true, aftercare_sent_at: new Date().toISOString() })
        .eq("id", treatment.id);
    }

    return NextResponse.json({ treatment, aftercare_sent: !!clientEmail && !!aftercare });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
