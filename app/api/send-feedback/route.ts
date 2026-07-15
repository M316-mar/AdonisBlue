import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { feedback, nurse_name, nurse_id } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Save to Supabase so we can see it in admin
    await supabase.from("feedback").insert({
      nurse_name: nurse_name || "Unknown",
      nurse_id: nurse_id || null,
      message: feedback || "",
    });

    // Also email us
    await resend.emails.send({
      from: "AdonisBlue <hello@adonisblue.io>",
      to: "hi@adonisblue.io",
      subject: `💬 New feedback from ${nurse_name || "a nurse"}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a2744;">New Feedback 💙</h2>
          <p><strong>From:</strong> ${nurse_name || "Unknown"}</p>
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="color: #1a2744;">${feedback || "(no message)"}</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
