import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { substitutePlaceholdersSafeHtml } from "@/lib/substitutePlaceholders";
import { sendEmail } from "@/lib/sendAndLog";
import { firstName } from "@/lib/firstName";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid treatment id" }, { status: 400 });
    }

    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
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

    // Fetch treatment with ownership check
    const { data: treatment, error: tErr } = await supabase
      .from("treatments")
      .select("id, nurse_id, intake_id, procedure_id, procedure_name, aftercare_sent_at")
      .eq("id", id)
      .eq("nurse_id", user.id)
      .single();

    if (tErr || !treatment) return NextResponse.json({ error: "Treatment not found" }, { status: 404 });

    if (treatment.aftercare_sent_at) {
      return NextResponse.json({ ok: true, sent_at: treatment.aftercare_sent_at, already_sent: true });
    }

    // Build and send immediately
    const [intakeRes, botRes, junctionRes] = await Promise.all([
      treatment.intake_id
        ? supabase.from("intakes").select("first_name, email").eq("id", treatment.intake_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("bots").select("practice_name, nurse_name, alert_phone, phone_public").eq("nurse_id", user.id).single(),
      supabase.from("treatment_procedures").select("procedure_id, procedure_name, sort_order").eq("treatment_id", id).order("sort_order", { ascending: true }),
    ]);

    const intake = intakeRes.data;
    const bot = botRes.data;
    const jProcs = (junctionRes as any).data ?? [];

    if (!intake?.email) {
      return NextResponse.json({ error: "No client email on file" }, { status: 422 });
    }

    const practiceName = bot?.practice_name || "your provider";
    const nurseDisplayName = bot?.nurse_name || bot?.practice_name || "";
    const nursePhone = bot?.phone_public || bot?.alert_phone || "";
    const clientName = firstName(intake.first_name, "beautiful");

    // Resolve all procedures
    let allProcedures: Array<{ procedure_id: string; name: string; aftercare_instructions: string }>;
    if (jProcs.length > 0) {
      const procIds = jProcs.map((p: any) => p.procedure_id);
      const { data: procData } = await supabase.from("procedures").select("id, name, aftercare_instructions").in("id", procIds);
      const procMap = new Map((procData ?? []).map((p: any) => [p.id, p]));
      allProcedures = jProcs.map((jp: any) => ({
        procedure_id: jp.procedure_id,
        name: (procMap.get(jp.procedure_id) as any)?.name || jp.procedure_name,
        aftercare_instructions: (procMap.get(jp.procedure_id) as any)?.aftercare_instructions ?? "",
      }));
    } else if (treatment.procedure_id) {
      const { data: sp } = await supabase.from("procedures").select("name, aftercare_instructions").eq("id", treatment.procedure_id).single();
      allProcedures = [{ procedure_id: treatment.procedure_id, name: sp?.name || treatment.procedure_name || "your treatment", aftercare_instructions: sp?.aftercare_instructions ?? "" }];
    } else {
      allProcedures = treatment.procedure_name ? [{ procedure_id: "", name: treatment.procedure_name, aftercare_instructions: "" }] : [];
    }

    // Build one HTML section per procedure; skip empty instructions (log + to-do)
    const sectionsHtml: string[] = [];
    for (const ap of allProcedures) {
      const rawInstr = (ap.aftercare_instructions ?? "").trim();
      if (!rawInstr) {
        await logError("aftercare-now", `procedure "${ap.name}" has no aftercare for treatment ${id}`);
        await supabase.from("message_log").insert({
          type: "action_needed",
          channel: "nurse",
          nurse_id: user.id,
          treatment_id: id,
          intake_id: treatment.intake_id,
          status: "pending",
          error: `Aftercare for ${ap.name} is empty, so ${intake.first_name || "your client"} didn't get instructions for it.`,
        });
        continue;
      }
      const instrHtml = substitutePlaceholdersSafeHtml(rawInstr, nurseDisplayName, nursePhone);
      sectionsHtml.push(`          <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #0d9488;">
            <h3 style="margin:0 0 10px;color:#0d9488;font-size:15px;font-weight:600;">📋 ${escapeHtml(ap.name)} Aftercare</h3>
            <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${instrHtml}</p>
          </div>`);
    }

    if (sectionsHtml.length === 0) {
      return NextResponse.json({ error: "No aftercare instructions are set for this treatment's procedures. A to-do has been added to your assistant." }, { status: 422 });
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${escapeHtml(practiceName)}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">You're glowing, ${escapeHtml(clientName)}! 🌸</h1>
          <p style="margin:0 0 8px;color:#475569;font-size:14px;">Thank you for your visit today. Here are your aftercare instructions:</p>
          ${sectionsHtml.join("\n          ")}
          <div style="background:#1a2744;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Have recovery questions? 💙</p>
            <a href="${SITE_URL}/healing/${id}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">💬 Open recovery chat</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${escapeHtml(practiceName)} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const result = await sendEmail({
      type: "aftercare",
      nurse_id: user.id,
      treatment_id: id,
      intake_id: treatment.intake_id,
      to: intake.email,
      subject: `Your aftercare instructions from ${practiceName} 💙`,
      html,
      supabase,
    });

    if (!result.ok) {
      await logError("aftercare-now", result.error ?? "send failed");
      return NextResponse.json({ error: "Failed to send aftercare email" }, { status: 500 });
    }

    const sentAt = new Date().toISOString();

    await supabase
      .from("treatments")
      .update({ aftercare_sent: true, aftercare_sent_at: sentAt, aftercare_send_at: null, aftercare_claimed_at: null, aftercare_canceled_at: null })
      .eq("id", id);

    if (treatment.intake_id) {
      await supabase
        .from("intakes")
        .update({ aftercare_sent_at: sentAt })
        .eq("id", treatment.intake_id);
    }

    return NextResponse.json({ ok: true, sent_at: sentAt });
  } catch (e) {
    await logError("aftercare-now", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
