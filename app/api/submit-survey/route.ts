import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { intake_id, rating, comment } = await request.json();

    if (!intake_id || rating == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: intake, error: intakeError } = await supabase
      .from("intakes")
      .select("id, nurse_id, bot_id, first_name, service_interested")
      .eq("id", intake_id)
      .single();

    if (intakeError || !intake) {
      return NextResponse.json({ error: "Intake not found" }, { status: 404 });
    }

    const { data: nurseData } = await supabase.auth.admin.getUserById(intake.nurse_id);
    const nurse_email = nurseData?.user?.email ?? null;

    const { error: reviewError } = await supabase.from("reviews").insert({
      intake_id,
      nurse_id: intake.nurse_id,
      rating: Number(rating),
      comment: typeof comment === "string" ? comment.trim() || null : null,
    });

    if (reviewError) {
      return NextResponse.json({ error: reviewError.message }, { status: 500 });
    }

    const ratingNum = Math.min(5, Math.max(1, Math.round(Number(rating))));
    const starDisplay = "⭐".repeat(ratingNum) + "☆".repeat(5 - ratingNum);
    const clientName = intake.first_name || "A client";
    const service = intake.service_interested || "Not specified";

    if (nurse_email) {
      await resend.emails.send({
        from: "AdonisBlue <hello@adonisblue.io>",
        to: nurse_email,
        subject: `⭐ New review — ${ratingNum}/5 stars!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a2744;">New Client Review</h2>
            <p style="color: #475569;">${clientName} left you a review after their visit.</p>

            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #0d9488; margin-top: 0;">Rating</h3>
              <p style="font-size: 24px; margin: 8px 0;">${starDisplay}</p>
              <p style="color: #1a2744; font-weight: 600; margin: 0;">${ratingNum} out of 5 stars</p>
            </div>

            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #0d9488; margin-top: 0;">Details</h3>
              <p><strong>Client:</strong> ${clientName}</p>
              <p><strong>Service:</strong> ${service}</p>
              <p><strong>Comment:</strong> ${typeof comment === "string" && comment.trim() ? comment.trim() : "No comment provided"}</p>
            </div>

            <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
              Sent by AdonisBlue 💙
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Submit survey error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
