import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  try {
    const { email, full_name } = await request.json();
    const safeName = typeof full_name === "string" && full_name.trim() ? escapeHtml(full_name.trim()) : "Not provided";
    const safeEmail = typeof email === "string" ? escapeHtml(email) : "Not provided";

    await resend.emails.send({
      from: "AdonisBlue <hi@adonisblue.io>",
      to: "hi@adonisblue.io",
      subject: `🎉 New AdonisBlue signup — ${safeName !== "Not provided" ? safeName : safeEmail}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a2744;">Someone just created an AdonisBlue account!</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch {
    // Never let a failed notification break the actual signup flow
    return NextResponse.json({ success: false });
  }
}
