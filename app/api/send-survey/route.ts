import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { intake_id } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: intake } = await supabase
      .from("intakes")
      .select("*")
      .eq("id", intake_id)
      .single();

    if (!intake) return NextResponse.json({ error: "Intake not found" }, { status: 404 });

    const surveyUrl = `https://www.adonisblue.io/survey/${intake_id}`;

    if (intake.email) {
      await resend.emails.send({
        from: "AdonisBlue <hello@adonisblue.io>",
        to: intake.email,
        subject: "How was your experience? 💙",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a2744;">How did it go, ${intake.first_name || "lovely"}? 🌸</h2>
            <p style="color: #475569;">We hope your appointment was everything you hoped for! We'd love to hear how it went — it only takes 30 seconds.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${surveyUrl}" style="background: #0d9488; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Rate my experience ⭐
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 12px;">Your feedback helps us improve and helps your nurse grow 💙</p>
          </div>
        `,
      });
    }

    await supabase
      .from("intakes")
      .update({ survey_sent: true })
      .eq("id", intake_id);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
