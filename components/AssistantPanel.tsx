"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseTreatmentDate } from "@/lib/formatTreatmentDate";

type Alert = {
  id: string;
  source: "healing" | "chatbot";
  client_name: string | null;
  client_phone: string | null;
  flagged_message: string | null;
  timestamp: string;
};

type UnsentAftercare = {
  treatment_id: string;
  intake_id: string;
  client_name: string;
  procedure_name: string;
  treatment_date: string;
};

type ScheduledAftercare = {
  treatment_id: string;
  intake_id: string;
  client_name: string;
  procedure_name: string;
  aftercare_send_at: string;
};

type CheckinOverdue = {
  id: string;
  intake_id: string;
  client_name: string;
  due_date: string;
};

type PrepReminder = {
  treatment_id: string;
  intake_id: string;
  client_name: string;
  treatment_date: string;
  procedure_name: string;
};

type Context = {
  unhandledAlerts: Alert[];
  unsentAftercares: UnsentAftercare[];
  scheduledAftercares: ScheduledAftercare[];
  checkinsOverdue: CheckinOverdue[];
  prepReminders: PrepReminder[];
};

type Props = {
  nurseFirstName: string;
  token: string;
  bot: { launched?: boolean | null; ready_at?: string | null } | null;
  returnClients: { treatment_id: string; rebooked_at: string | null }[];
  onAlertCountChange?: (count: number) => void;
};

function greeting(name: string): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${timeOfDay}, ${name} 🦋`;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  // parseTreatmentDate extracts YYYY-MM-DD and builds a LOCAL Date, preventing
  // the UTC-midnight shift that makes "2026-10-21" display as "Oct 20" in UTC-5.
  const d = parseTreatmentDate(iso);
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AssistantPanel({
  nurseFirstName,
  token,
  bot,
  returnClients,
  onAlertCountChange,
}: Props) {
  const router = useRouter();
  const [ctx, setCtx] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [alertNotes, setAlertNotes] = useState<Record<string, string>>({});
  const [handledAlerts, setHandledAlerts] = useState<Set<string>>(new Set());
  const [handlingAlert, setHandlingAlert] = useState<string | null>(null);
  const [sentPrep, setSentPrep] = useState<Set<string>>(new Set());
  const [sendingPrep, setSendingPrep] = useState<string | null>(null);
  // Help & ideas
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [helpSending, setHelpSending] = useState(false);
  const [helpSent, setHelpSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/assistant/context", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const data = await res.json() as Context;
          setCtx(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Biweekly proactive feedback prompt
  useEffect(() => {
    try {
      const last = localStorage.getItem("ab-feedback-last-asked");
      if (!last) return;
      const daysSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= 14) {
        setHelpOpen(true);
        localStorage.setItem("ab-feedback-last-asked", new Date().toISOString());
      }
    } catch { /* localStorage may be unavailable */ }
  }, []);

  const visibleAlerts = (ctx?.unhandledAlerts ?? []).filter((a) => !handledAlerts.has(a.id));

  useEffect(() => {
    onAlertCountChange?.(visibleAlerts.length);
  }, [visibleAlerts.length, onAlertCountChange]);

  const handleMarkHandled = async (alert: Alert) => {
    setHandlingAlert(alert.id);
    try {
      const note = alertNotes[alert.id]?.trim() ?? "";
      const res = await fetch("/api/incidents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: alert.id,
          source: alert.source,
          field: "status",
          value: "resolved",
          ...(note ? { nurse_notes: note } : {}),
        }),
      });
      if (res.ok) {
        setHandledAlerts((prev) => new Set([...prev, alert.id]));
        setExpandedAlert(null);
      }
    } finally {
      setHandlingAlert(null);
    }
  };

  const handleSendPrep = async (p: PrepReminder) => {
    setSendingPrep(p.intake_id);
    try {
      const res = await fetch("/api/send-prep-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intake_id: p.intake_id }),
      });
      if (res.ok) setSentPrep((prev) => new Set([...prev, p.intake_id]));
    } finally {
      setSendingPrep(null);
    }
  };

  const launched = bot?.ready_at != null || bot?.launched === true;
  const unbookedReturn = returnClients.filter((c) => !c.rebooked_at).length;

  const hasAlerts = visibleAlerts.length > 0;
  const hasUnsent = (ctx?.unsentAftercares.length ?? 0) > 0;
  const hasScheduled = (ctx?.scheduledAftercares.length ?? 0) > 0;
  const hasCheckins = (ctx?.checkinsOverdue.length ?? 0) > 0;
  const hasReturn = unbookedReturn > 0;
  const hasPrep = (ctx?.prepReminders.length ?? 0) > 0;
  const needsSetup = !launched;
  const allDone = !loading && !hasAlerts && !hasUnsent && !hasCheckins && !hasReturn && !hasPrep && !needsSetup;

  return (
    <section id="assistant-panel" className="rounded-2xl border border-[#1a2744]/20 bg-white shadow-lg overflow-hidden">
      <div className="flex items-center gap-2 bg-[#1a2744] px-4 py-3 sm:px-5">
        <span className="text-lg">🦋</span>
        <span className="text-sm font-semibold text-white">Your Assistant</span>
        {visibleAlerts.length > 0 && (
          <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {visibleAlerts.length}
          </span>
        )}
      </div>

      <div className="px-4 py-4 sm:px-5">
        <p className="text-base font-semibold text-[#1a2744] mb-4">{greeting(nurseFirstName)}</p>

        {loading && (
          <p className="text-sm text-slate-400 py-2">Checking your schedule…</p>
        )}

        {!loading && allDone && (
          <div className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-3 text-sm text-teal-700">
            ✅ You&apos;re all caught up! Nothing needs you right now.
          </div>
        )}

        {!loading && (
          <div className="space-y-3">

            {/* 1. Emergency alerts — highest priority */}
            {visibleAlerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                  className="flex w-full items-start gap-3 px-3 py-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a2744]">
                      🚨 Emergency from{" "}
                      {alert.client_name && alert.client_name !== "Client"
                        ? alert.client_name
                        : "a new visitor"}
                    </p>
                    {alert.flagged_message && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">&ldquo;{alert.flagged_message}&rdquo;</p>
                    )}
                  </div>
                  <span className="shrink-0 text-slate-400 text-xs">{expandedAlert === alert.id ? "▲" : "▼"}</span>
                </button>

                {expandedAlert === alert.id && (
                  <div className="border-t border-red-100 px-3 pb-3 pt-2 space-y-3">
                    {alert.flagged_message && (
                      <div className="rounded-lg bg-white border border-red-100 px-3 py-2">
                        <p className="text-xs text-slate-600 leading-relaxed">&ldquo;{alert.flagged_message}&rdquo;</p>
                      </div>
                    )}
                    {alert.client_phone && (
                      <div className="flex gap-2">
                        <a
                          href={`tel:${alert.client_phone}`}
                          className="flex-1 rounded-full bg-[#1a2744] px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-[#243552]"
                        >
                          📞 Call
                        </a>
                        <a
                          href={`sms:${alert.client_phone}`}
                          className="flex-1 rounded-full border border-[#1a2744] bg-white px-3 py-2 text-center text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50"
                        >
                          💬 Text
                        </a>
                      </div>
                    )}
                    <textarea
                      rows={2}
                      value={alertNotes[alert.id] ?? ""}
                      onChange={(e) =>
                        setAlertNotes((prev) => ({ ...prev, [alert.id]: e.target.value }))
                      }
                      placeholder="Add a note (optional)…"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#1a2744] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    <button
                      type="button"
                      disabled={handlingAlert === alert.id}
                      onClick={() => void handleMarkHandled(alert)}
                      className="w-full rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      {handlingAlert === alert.id ? "Saving…" : "✅ Handled"}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* 2. Aftercare to send (last 3 days, intended) */}
            {(ctx?.unsentAftercares ?? []).map((a) => (
              <div key={a.treatment_id} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
                <span className="shrink-0 text-base">💌</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a2744]">Send aftercare to {a.client_name}</p>
                  <p className="text-xs text-slate-500">{a.procedure_name} · {fmtDate(a.treatment_date)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/client-journey?aftercare=${a.intake_id}`)}
                  className="shrink-0 rounded-full bg-[#1a2744] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#243552]"
                >
                  Send →
                </button>
              </div>
            ))}

            {/* 3. Scheduled aftercares (info) */}
            {hasScheduled && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Scheduled to send</p>
                <div className="space-y-1.5">
                  {(ctx?.scheduledAftercares ?? []).map((a) => (
                    <div key={a.treatment_id} className="flex items-center justify-between gap-2">
                      <p className="text-sm text-[#1a2744] truncate">{a.client_name} — {a.procedure_name}</p>
                      <p className="shrink-0 text-xs text-slate-400">{fmtDate(a.aftercare_send_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Check-ins overdue / due today */}
            {(ctx?.checkinsOverdue ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50 px-3 py-3">
                <span className="shrink-0 text-base">📞</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a2744]">Check in with {c.client_name}</p>
                  <p className="text-xs text-slate-500">Due {fmtDate(c.due_date)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/checkin?client=${c.intake_id}`)}
                  className="shrink-0 rounded-full bg-[#1a2744] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#243552]"
                >
                  Open →
                </button>
              </div>
            ))}

            {/* 5. Clients due back soon */}
            {hasReturn && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                <span className="shrink-0 text-base">🔁</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a2744]">
                    {unbookedReturn} client{unbookedReturn !== 1 ? "s" : ""} due back soon
                  </p>
                  <p className="text-xs text-slate-500">Save them a slot before it fills up</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("return-clients");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50"
                >
                  See all →
                </button>
              </div>
            )}

            {/* 6. Prep reminders */}
            {(ctx?.prepReminders ?? []).map((p) => {
              const sent = sentPrep.has(p.intake_id);
              const sending = sendingPrep === p.intake_id;
              if (sent) {
                return (
                  <div key={p.treatment_id} className="rounded-xl border border-green-100 bg-green-50 px-3 py-3">
                    <p className="text-sm text-green-700">✅ Prep guide sent to {p.client_name}</p>
                  </div>
                );
              }
              return (
                <div key={p.treatment_id} className="flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50 px-3 py-3">
                  <span className="shrink-0 text-base">📋</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1a2744]">Send prep guide to {p.client_name}</p>
                    <p className="text-xs text-slate-500">{p.procedure_name} · {fmtDate(p.treatment_date)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void handleSendPrep(p)}
                    className="shrink-0 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send →"}
                  </button>
                </div>
              );
            })}

            {/* 7. Setup — if not launched */}
            {needsSetup && (
              <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3">
                <span className="shrink-0 text-base">⚙️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a2744]">Finish setting up your assistant</p>
                  <p className="text-xs text-slate-500">Go live to start capturing clients automatically</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/onboarding")}
                  className="shrink-0 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700"
                >
                  Continue →
                </button>
              </div>
            )}

          </div>
        )}

        {/* Help & ideas */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          {!helpOpen ? (
            <button
              type="button"
              onClick={() => {
                setHelpOpen(true);
                try {
                  localStorage.setItem("ab-feedback-last-asked", new Date().toISOString());
                } catch { /* ignore */ }
              }}
              className="w-full text-left text-xs text-slate-400 transition hover:text-teal-600"
            >
              💡 Share an idea or contact support
            </button>
          ) : helpSent ? (
            <p className="text-xs font-semibold text-teal-700">✅ Message sent! We&apos;ll get back to you shortly.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-[#1a2744]">💡 Help &amp; ideas</p>
              <p className="text-xs text-slate-500">Got a question, an issue, or a feature idea? Let us know.</p>
              <textarea
                rows={3}
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="What&apos;s on your mind?"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#1a2744] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={helpSending || !helpText.trim()}
                  onClick={() => {
                    setHelpSending(true);
                    void fetch("/api/send-feedback", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ feedback: helpText.trim(), nurse_name: nurseFirstName }),
                    })
                      .then(() => { setHelpSent(true); setHelpSending(false); })
                      .catch(() => setHelpSending(false));
                  }}
                  className="flex-1 rounded-full bg-[#0d9488] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  {helpSending ? "Sending…" : "Send"}
                </button>
                <button
                  type="button"
                  onClick={() => { setHelpOpen(false); setHelpText(""); }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
