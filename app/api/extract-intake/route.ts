import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { conversation, bot_id, nurse_id, nurse_email, practice_name } = await request.json();
    console.log("Conversation received:", conversation?.slice(0, 200));

    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Extract the intake information from this chat conversation. Return ONLY a JSON object with these fields: first_name, email, phone, service_interested, had_procedures_before (boolean), on_blood_thinners (boolean), blood_thinner_details, allergies, medication_allergies. If a field was not mentioned set it to null. Do not include any text outside the JSON.

Conversation:
${conversation}`
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const intake = JSON.parse(clean);
    console.log("Intake extracted:", JSON.stringify(intake));

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from("intakes").insert({
      bot_id,
      nurse_id,
      ...intake,
      notified_nurse: false,
    });

    await resend.emails.send({
      from: "AdonisBlue <hello@adonisblue.io>",
      to: nurse_email,
      subject: `💙 New client intake — ${intake.first_name || "A new client"} has been sent your booking link!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a2744;">New Client Intake — ${practice_name}</h2>
          <p style="color: #475569;">Great news! A new client just completed their intake and we've already sent them your booking link. Here's their information so you're ready when they come in 💙</p>
          
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0d9488; margin-top: 0;">Client Information</h3>
            <p><strong>Name:</strong> ${intake.first_name || "Not provided"}</p>
            <p><strong>Email:</strong> ${intake.email || "Not provided"}</p>
            <p><strong>Phone:</strong> ${intake.phone || "Not provided"}</p>
            <p><strong>Service interested in:</strong> ${intake.service_interested || "Not specified"}</p>
          </div>

          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0d9488; margin-top: 0;">Medical Information</h3>
            <p><strong>Had procedures before:</strong> ${intake.had_procedures_before ? "Yes" : "No"}</p>
            <p><strong>On blood thinners:</strong> ${intake.on_blood_thinners ? `Yes — ${intake.blood_thinner_details || "details not provided"}` : "No"}</p>
            <p><strong>Allergies:</strong> ${intake.allergies || "None reported"}</p>
            <p><strong>Medication allergies:</strong> ${intake.medication_allergies || "None reported"}</p>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
            We already sent them your booking link — we've got you covered 🦋
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Extract intake error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
