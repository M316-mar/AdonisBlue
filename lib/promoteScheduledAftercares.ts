import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logError";

/**
 * Promotes scheduled aftercare emails that Resend has (or should have) delivered.
 *
 * Rule: treatment.aftercare_send_at <= now() AND aftercare_sent_at IS NULL
 *   → set aftercare_sent_at = aftercare_send_at, aftercare_sent = true
 *   → set intakes.aftercare_sent_at = aftercare_send_at
 *   → insert message_log "sent" row for each
 *
 * Call this before any read that counts or filters on aftercare_sent_at.
 */
export async function promoteScheduledAftercares(supabase: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();

  const { data: dueRows, error: fetchErr } = await supabase
    .from("treatments")
    .select("id, intake_id, nurse_id, aftercare_send_at")
    .not("aftercare_send_at", "is", null)
    .lte("aftercare_send_at", now)
    .is("aftercare_sent_at", null);

  if (fetchErr) {
    await logError("promote-scheduled-aftercares", fetchErr.message);
    return;
  }
  if (!dueRows?.length) return;

  for (const row of dueRows) {
    const sentAt = row.aftercare_send_at as string;

    // Promote treatment
    const { error: tErr } = await supabase
      .from("treatments")
      .update({ aftercare_sent_at: sentAt, aftercare_sent: true })
      .eq("id", row.id);
    if (tErr) { await logError("promote-scheduled-aftercares", tErr.message); continue; }

    // Promote intake (matches send-aftercare behaviour)
    if (row.intake_id) {
      const { error: iErr } = await supabase
        .from("intakes")
        .update({ aftercare_sent_at: sentAt })
        .eq("id", row.intake_id);
      if (iErr) await logError("promote-scheduled-aftercares", iErr.message);
    }

    // Log the promotion as "sent"
    await supabase.from("message_log").insert({
      type: "aftercare",
      channel: "email",
      nurse_id: row.nurse_id ?? null,
      intake_id: row.intake_id ?? null,
      treatment_id: row.id,
      status: "sent",
      error: "promoted from scheduled",
    }).then(() => {}, () => {});
  }
}
