import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      bot_id,
      nurse_id,
      nurse_email,
      practice_name,
      first_name,
      email,
      phone,
      had_procedures_before,
      on_blood_thinners,
      blood_thinner_details,
      allergies,
      medication_allergies,
      service_interested,
    } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Save intake to Supabase
    await supabase.from("intakes").insert({
      bot_id,
      nurse_id,
      first_name,
      email,
      phone,
      had_procedures_before,
      on_blood_thinners,
      blood_thinner_details,
      allergies,
      medication_allergies,
      service_interested,
      notified_nurse: false,
    });

    // Email the nurse
    await resend.emails.send({
      from: "AdonisBlue <hello@adonisblue.io>",
      to: nurse_email,
      subject: `💙 New client intake — ${first_name} is ready to book!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a2744;">New Client Intake — ${practice_name}</h2>
          <p style="color: #475569;">A new client just completed their intake form and is ready to book!</p>
          
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0d9488; margin-top: 0;">Client Information</h3>
            <p><strong>Name:</strong> ${first_name}</p>
            <p><strong>Email:</strong> ${email || "Not provided"}</p>
            <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
            <p><strong>Service interested in:</strong> ${service_interested || "Not specified"}</p>
          </div>

          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0d9488; margin-top: 0;">Medical Information</h3>
            <p><strong>Had procedures before:</strong> ${had_procedures_before ? "Yes" : "No"}</p>
            <p><strong>On blood thinners:</strong> ${on_blood_thinners ? `Yes — ${blood_thinner_details || "details not provided"}` : "No"}</p>
            <p><strong>Allergies:</strong> ${allergies || "None reported"}</p>
            <p><strong>Medication allergies:</strong> ${medication_allergies || "None reported"}</p>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
            Sent by AdonisBlue — your client is waiting 💙
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Intake error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}