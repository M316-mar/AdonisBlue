import { formatPhone } from "@/lib/formatPhone";

/**
 * Build the server-controlled emergency reply for both healing and front-desk chats.
 *
 * 🔴 "911"   → direct to emergency services immediately
 * 🟠 "nurse" → call/contact the nurse now; ER if unreachable
 *
 * "I've alerted [Nurse]" is appended only when alertSent = true.
 * Phone is formatted "(214) 717-7944". When no phone, alertEmail is shown instead.
 * If neither is available, falls back to "go to the ER now".
 */
export function buildEmergencyReply(
  level: "911" | "nurse",
  nurseFirstName: string | null,
  alertPhone: string | null | undefined,
  alertSent: boolean,
  alertEmail?: string | null
): string {
  const nurseName = nurseFirstName ?? null;
  const alertedLine = alertSent && nurseName ? ` I've alerted ${nurseName}.` : "";

  if (level === "911") {
    return `Please call 911 right now.${alertedLine}`;
  }

  // 🟠 nurse level — phone preferred, email fallback
  if (alertPhone?.trim() && nurseName) {
    const formatted = formatPhone(alertPhone.trim());
    return `This needs attention right away. Please call ${nurseName} now at ${formatted}. If you can't reach her within 15 minutes, or it gets worse, go to the nearest emergency room.${alertedLine}`;
  }
  if (alertEmail?.trim() && nurseName) {
    return `This needs attention right away. Please email ${nurseName} at ${alertEmail.trim()} and go to the nearest emergency room if it gets worse.${alertedLine}`;
  }
  return `This needs attention right away. Please go to the nearest emergency room now.${alertedLine}`;
}

/** Email subject line that shows urgency level. */
export function emergencySubject(
  level: "911" | "nurse",
  label: string,
  isUpdate = false
): string {
  if (level === "911") {
    return isUpdate
      ? `🚨 Call-911 UPDATE — ${label}`
      : `🚨 Call-911 emergency — ${label}`;
  }
  return isUpdate
    ? `⚠️ Urgent UPDATE — call her now — ${label}`
    : `⚠️ Urgent — call her now — ${label}`;
}
