import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { substitutePlaceholdersSafeHtml } from "@/lib/substitutePlaceholders";
import { sendEmail } from "@/lib/sendAndLog";
import { getClientSender } from "@/lib/clientEmailSender";
import { firstName } from "@/lib/firstName";
import { buildAftercareEmail, escapeHtml } from "@/lib/buildAftercareEmail";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      supabase.from("bots").select("practice_name, nurse_name, alert_phone, phone_public, alert_email, alert_email_verified, notification_email").eq("nurse_id", user.id).single(),
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

    // Build one content entry per procedure; skip empty instructions (log + to-do)
    const emailProcs: Array<{ name: string; contentHtml: string; tabParam: string }> = [];
    for (const ap of allProcedures) {
      const rawInstr = (ap.aftercare_instructions ?? "").trim();
      if (!rawInstr) {
        await logError("aftercare-now", `procedure "${ap.name}" has no aftercare for treatment ${id}`);
        const { error: todoErr } = await supabase.from("message_log").insert({
          type: "action_needed",
          channel: "nurse",
          nurse_id: user.id,
          treatment_id: id,
          intake_id: treatment.intake_id,
          status: "pending",
          error: `Aftercare for ${ap.name} is empty, so ${intake.first_name || "your client"} didn't get instructions for it.`,
        });
        if (todoErr) await logError("aftercare-now", `action_needed insert failed: ${todoErr.message}`);
        continue;
      }
      const instrHtml = substitutePlaceholdersSafeHtml(rawInstr, nurseDisplayName, nursePhone);
      emailProcs.push({ name: ap.name, contentHtml: instrHtml, tabParam: encodeURIComponent(ap.name) });
    }

    if (emailProcs.length === 0) {
      return NextResponse.json({ error: "No aftercare instructions are set for this treatment's procedures. A to-do has been added to your assistant." }, { status: 422 });
    }

    const nurseFirst = nurseDisplayName.split(/\s+/)[0] || nurseDisplayName || "your nurse";
    const html = buildAftercareEmail({
      clientFirstName: firstName(intake.first_name, ""),
      escapedPracticeName: escapeHtml(practiceName),
      treatmentId: id,
      procedures: emailProcs,
      nurseFirstName: nurseFirst,
      nursePhone,
      siteUrl: SITE_URL,
    });

    const { from_name, reply_to } = getClientSender(bot ?? {});
    const result = await sendEmail({
      type: "aftercare",
      nurse_id: user.id,
      treatment_id: id,
      intake_id: treatment.intake_id,
      to: intake.email,
      subject: `Your aftercare instructions from ${practiceName} 💙`,
      html,
      supabase,
      from_name,
      reply_to,
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
