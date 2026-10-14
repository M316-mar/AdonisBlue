import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;

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

    // Fetch review and verify ownership
    const { data: review, error: fetchError } = await supabase
      .from("reviews")
      .select("id, nurse_id, ok_to_share, featured, reported_at")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("[api/reviews/[id]] Fetch error:", JSON.stringify(fetchError));
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (review.nurse_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json() as {
      action: string;
      featured?: boolean;
      remove_reason?: string;
    };

    const update: Record<string, unknown> = {};

    if (body.action === "feature") {
      // Only allow featuring if client consented
      if (!review.ok_to_share) {
        return NextResponse.json({ error: "Client has not consented to sharing" }, { status: 400 });
      }
      update.featured = body.featured === true;
    } else if (body.action === "reach_out") {
      update.reached_out_at = new Date().toISOString();
    } else if (body.action === "remove") {
      const reason = typeof body.remove_reason === "string" ? body.remove_reason.trim() : "";
      if (!reason) return NextResponse.json({ error: "Removal reason required" }, { status: 400 });
      update.removed_at = new Date().toISOString();
      update.removed_reason = reason.slice(0, 500);
    } else if (body.action === "report") {
      update.reported_at = new Date().toISOString();
      // Email AdonisBlue with review ID only — no review content
      sendEmail({
        type: "review_reported",
        to: "hi@adonisblue.io",
        subject: `Review reported by nurse`,
        html: `<p>A review has been reported by a nurse.</p><p><strong>Review ID:</strong> ${id}</p>`,
        supabase,
      }).catch((e) => console.error("[api/reviews/[id]] Failed to send report email:", e));
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("reviews")
      .update(update)
      .eq("id", id)
      .eq("nurse_id", user.id);

    if (updateError) {
      console.error("[api/reviews/[id]] Update error:", JSON.stringify(updateError));
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[api/reviews/[id]] Unexpected error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
