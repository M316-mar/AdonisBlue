import { createClient } from "@supabase/supabase-js";

/**
 * Write a structured error entry to the app_errors table.
 * Never throws — if the write fails, falls back to console.error.
 * No client message text in `message` — pass only the technical reason.
 */
export async function logError(
  area: string,
  message: string,
  nurseId?: string | null,
): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await supabase.from("app_errors").insert({
      area,
      message: message.slice(0, 2000),
      nurse_id: nurseId ?? null,
    });
  } catch {
    console.error("[logError] write failed:", area, message);
  }
}
