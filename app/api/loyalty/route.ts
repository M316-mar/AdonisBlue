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

    const { data: loyalty } = await supabase
      .from("loyalty_points")
      .select("*")
      .eq("nurse_id", user.id)
      .order("points", { ascending: false });

    return NextResponse.json({ loyalty: loyalty ?? [] });
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

    const { client_email, client_name, points_to_add, send_email, practice_name } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing } = await supabase
      .from("loyalty_points")
      .select("*")
      .eq("nurse_id", user.id)
      .eq("client_email", client_email)
      .single();

    let updated;
    if (existing) {
      const { data } = await supabase
        .from("loyalty_points")
        .update({
          points: existing.points + (points_to_add || 10),
          total_visits: existing.total_visits + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      updated = data;
    } else {
      const { data } = await supabase
        .from("loyalty_points")
        .insert({
          nurse_id: user.id,
          client_email,
          client_name,
          points: points_to_add || 10,
          total_visits: 1,
        })
        .select()
        .single();
      updated = data;
    }

    if (send_email && client_email) {
      await resend.emails.send({
        from: "AdonisBlue <hello@adonisblue.io>",
        to: client_email,
        subject: `You earned loyalty points at ${practice_name}! 🌟`,
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${practice_name}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">🌟</div>
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:24px;font-weight:700;">You earned ${points_to_add || 10} points!</h1>
          <p style="margin:0 0 16px;color:#475569;font-size:15px;">Thank you for visiting ${practice_name}! Your loyalty means everything to us.</p>
          <div style="background:#f0fdf4;border-radius:16px;padding:24px;margin:20px 0;display:inline-block;min-width:200px;">
            <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Your total points</p>
            <p style="margin:0;color:#0d9488;font-size:40px;font-weight:800;">${updated?.points ?? points_to_add}</p>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:13px;">Points can be redeemed for discounts on your next visit 💙</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with love by ${practice_name} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });
    }

    return NextResponse.json({ loyalty: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
