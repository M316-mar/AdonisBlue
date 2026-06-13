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

    // Handle walk-in — create intake first
    let intakeId = body.intake_id;
    let clientEmail = null;
    let clientName = null;
    let clientPhone = null;

    if (body.is_walkin && body.walkin_name) {
      const { data: newIntake } = await supabase
        .from("intakes")
        .insert({
          nurse_id: user.id,
          first_name: body.walkin_name,
          email: body.walkin_email || null,
          phone: body.walkin_phone || null,
          service_interested: body.procedure_name || "Walk-in",
        })
        .select()
        .single();
      intakeId = newIntake?.id;
      clientEmail = body.walkin_email;
      clientName = body.walkin_name;
      clientPhone = body.walkin_phone;
    } else if (intakeId) {
      const { data: intake } = await supabase
        .from("intakes")
        .select("first_name, email, phone")
        .eq("id", intakeId)
        .single();
      clientEmail = intake?.email;
      clientName = intake?.first_name;
      clientPhone = intake?.phone;
    }

    // Save treatment
    const { data: treatment, error } = await supabase
      .from("treatments")
      .insert({
        nurse_id: user.id,
        intake_id: intakeId || null,
        procedure_id: body.procedure_id || null,
        procedure_name: body.procedure_name,
        treatment_date: body.treatment_date,
        notes: body.notes || null,
        came_via_bot: body.came_via_bot ?? false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get bot info
    const { data: bot } = await supabase
      .from("bots")
      .select("practice_name, booking_link")
      .eq("nurse_id", user.id)
      .single();

    const practiceName = bot?.practice_name || "your provider";

    // Get all selected procedures and their aftercare
    const procedureIds = body.procedure_ids || [body.procedure_id];
    const { data: selectedProcedures } = await supabase
      .from("procedures")
      .select("*")
      .in("id", procedureIds.filter(Boolean));

    // Send combined aftercare email
    let aftercareSent = false;
    if (clientEmail && selectedProcedures && selectedProcedures.length > 0 && body.send_aftercare !== false) {
      const combinedAftercareHtml = selectedProcedures.map(proc => `
        <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #0d9488;">
          <h3 style="margin:0 0 10px;color:#0d9488;font-size:15px;font-weight:600;">📋 ${proc.name} Aftercare</h3>
          <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${proc.aftercare_instructions}</p>
        </div>
      `).join("");

      const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

      await resend.emails.send({
        from: "AdonisBlue <hello@adonisblue.io>",
        to: clientEmail,
        subject: `Your aftercare instructions from ${practiceName} 💙`,
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
          <p style="margin:0 0 8px;color:#475569;font-size:14px;">Thank you for your visit today. Here are your aftercare instructions for everything we did:</p>
          ${combinedAftercareHtml}
          <div style="background:#1a2744;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Have recovery questions? 💙</p>
            <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;">Our 24/7 recovery chat is here for you.</p>
            <a href="${SITE_URL}/healing/${treatment.id}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">💬 Open recovery chat</a>
          </div>
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

      aftercareSent = true;
    }

    return NextResponse.json({ treatment, aftercare_sent: aftercareSent });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
