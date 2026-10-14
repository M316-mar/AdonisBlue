import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logError";

export async function GET(request: Request) {
  const html = (message: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Unsubscribed</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="padding:40px 32px;text-align:center;">
          <p style="margin:0;color:#1a2744;font-size:18px;font-weight:600;">${message}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse(html("Invalid unsubscribe link."), { headers: { "Content-Type": "text/html" } });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: updated, error } = await supabase
      .from("intakes")
      .update({
        marketing_opt_out: true,
        opted_out_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id");

    if (error || !updated?.length) {
      await supabase.from("message_log").insert({
        type: "unsubscribe",
        channel: "email",
        intake_id: id,
        status: "failed",
        error: error?.message ?? "no matching intake row",
      }).then(() => {}, () => {});
      // Still show success page — don't expose internal errors to the client
      console.error("[unsubscribe] failed for intake", id, error?.message ?? "no row");
    }

    return new NextResponse(
      html("You've been unsubscribed from reminder and review emails. 💙"),
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (e) {
    console.error("[unsubscribe] unexpected error:", e);
    await logError("unsubscribe", String(e));
    return new NextResponse(html("Something went wrong. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}
