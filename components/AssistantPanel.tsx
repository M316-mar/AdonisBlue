"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseTreatmentDate } from "@/lib/formatTreatmentDate";
import CancelAftercarePopup from "@/components/CancelAftercarePopup";

type AlertMessage = { message: string; level: "911" | "nurse"; timestamp: string };

type Alert = {
  id: string;
  source: "healing" | "chatbot";
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  flagged_message: string | null;
  alert_level: "911" | "nurse" | null;
  alert_messages: AlertMessage[];
  timestamp: string;
  healing_ids?: string[];
};

type UnsentAftercare = {
  treatment_id: string;
  intake_id: string;
  procedure_id: string | null;
  client_name: string;
  client_email: string | null;
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
  phone: string | null;
  email: string | null;
  script: string | null;
};

type PrepReminder = {
  treatment_id: string;
  intake_id: string;
  client_name: string;
  treatment_date: string;
  procedure_name: string;
};

type ActionNeededItem = {
  id: string;
  treatment_id: string | null;
  intake_id: string | null;
  message: string;
  created_at: string;
};

type Context = {
  unhandledAlerts: Alert[];
  unsentAftercares: UnsentAftercare[];
  scheduledAftercares: ScheduledAftercare[];
  checkinsOverdue: CheckinOverdue[];
  prepReminders: PrepReminder[];
  actionNeeded: ActionNeededItem[];
};

type Props = {
  nurseFirstName: string;
  token: string;
  bot: { launched?: boolean | null; ready_at?: string | null; rebooking_link?: string | null } | null;
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

// Format a UTC ISO timestamp (e.g. aftercare_send_at) using the browser's local
// timezone so the nurse sees "Tonight at 11:04 PM" instead of the UTC date.
function fmtScheduledTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const afterTomorrowStart = new Date(tomorrowStart.getTime() + 86400000);
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const hour = d.getHours();
  if (dStart.getTime() === todayStart.getTime()) {
    const dayLabel = hour >= 18 ? "Tonight" : "Today";
    return `${dayLabel} at ${timeStr}`;
  }
  if (dStart.getTime() === tomorrowStart.getTime()) return `Tomorrow at ${timeStr}`;
  if (dStart.getTime() < afterTomorrowStart.getTime()) return `Tomorrow at ${timeStr}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` at ${timeStr}`;
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
  // Aftercare send
  const [aftercareSending, setAftercareSending] = useState<string | null>(null);
  const [aftercareAlreadySent, setAftercareAlreadySent] = useState<Record<string, { sent_at?: string; scheduled_at?: string }>>({});
  const [aftercareError, setAftercareError] = useState<Record<string, string>>({});
  // Scheduled aftercare actions
  const [scheduledSendingNow, setScheduledSendingNow] = useState<string | null>(null);
  const [scheduledError, setScheduledError] = useState<Record<string, string>>({});
  const [cancelPopupItem, setCancelPopupItem] = useState<ScheduledAftercare | null>(null);
  // Prep error
  const [prepError, setPrepError] = useState<Record<string, string>>({});
  // Mark-handled error
  const [markHandledError, setMarkHandledError] = useState<Record<string, string>>({});
  // To-do list collapse
  const [todoExpanded, setTodoExpanded] = useState(false);
  // Check-in actions
  const [checkinNoteOpen, setCheckinNoteOpen] = useState<Set<string>>(new Set());
  const [checkinNoteText, setCheckinNoteText] = useState<Record<string, string>>({});
  const [checkinSkipConfirm, setCheckinSkipConfirm] = useState<Set<string>>(new Set());
  const [checkinDoing, setCheckinDoing] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<Record<string, string>>({});
  // Rebooking link setup nudge
  const [rebookingDismissed, setRebookingDismissed] = useState(() => {
    try {
      const ts = localStorage.getItem("ab-rebooking-nudge-dismissed");
      if (!ts) return false;
      const daysSince = (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 14;
    } catch { return false; }
  });
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
      // For grouped healing alerts, send all merged ids so every row is resolved
      const ids = alert.healing_ids && alert.healing_ids.length > 1
        ? alert.healing_ids
        : undefined;
      const res = await fetch("/api/incidents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...(ids ? { ids } : { id: alert.id }),
          source: alert.source,
          field: "status",
          value: "resolved",
          ...(note ? { nurse_notes: note } : {}),
        }),
      });
      if (res.ok) {
        setHandledAlerts((prev) => new Set([...prev, alert.id]));
        setMarkHandledError(prev => { const n = { ...prev }; delete n[alert.id]; return n; });
        setExpandedAlert(null);
        window.dispatchEvent(new Event("alert-handled"));
      } else {
        let msg = "Couldn't save — please try again";
        try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
        setMarkHandledError(prev => ({ ...prev, [alert.id]: msg }));
      }
    } finally {
      setHandlingAlert(null);
    }
  };

  const handleSendAftercare = async (a: UnsentAftercare) => {
    setAftercareSending(a.treatment_id);
    setAftercareError(prev => { const n = { ...prev }; delete n[a.treatment_id]; return n; });
    try {
      const res = await fetch("/api/send-aftercare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ treatment_id: a.treatment_id }),
      });
      const j = await res.json() as { success?: boolean; already_sent?: boolean; already_scheduled?: boolean; sent_at?: string; scheduled_at?: string; error?: string };
      if (res.status === 409 && (j.already_sent || j.already_scheduled)) {
        setAftercareAlreadySent(prev => ({ ...prev, [a.treatment_id]: { sent_at: j.sent_at, scheduled_at: j.scheduled_at } }));
      } else if (j.success) {
        setCtx(prev => prev ? { ...prev, unsentAftercares: prev.unsentAftercares.filter(x => x.treatment_id !== a.treatment_id) } : prev);
      } else {
        const msg = j.error ?? "Failed to send — please try again";
        setAftercareError(prev => ({ ...prev, [a.treatment_id]: msg }));
      }
    } finally {
      setAftercareSending(null);
    }
  };

  const handleCheckinDone = async (c: CheckinOverdue) => {
    if (checkinDoing) return;
    setCheckinDoing(c.id);
    setCheckinError(prev => { const n = { ...prev }; delete n[c.id]; return n; });
    try {
      const res = await fetch("/api/checkin-reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: c.id, action: "complete", note: checkinNoteText[c.id] ?? "" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setCheckinError(prev => ({ ...prev, [c.id]: j.error ?? "Could not save check-in. Please try again." }));
        return;
      }
      setCtx(prev => prev ? { ...prev, checkinsOverdue: prev.checkinsOverdue.filter(x => x.id !== c.id) } : prev);
      setCheckinNoteOpen(prev => { const n = new Set(prev); n.delete(c.id); return n; });
      setCheckinNoteText(prev => { const n = { ...prev }; delete n[c.id]; return n; });
    } finally {
      setCheckinDoing(null);
    }
  };

  const handleCheckinSkip = async (c: CheckinOverdue) => {
    if (checkinDoing) return;
    setCheckinDoing(c.id);
    setCheckinError(prev => { const n = { ...prev }; delete n[c.id]; return n; });
    try {
      const res = await fetch("/api/checkin-reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: c.id, action: "skip" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setCheckinError(prev => ({ ...prev, [c.id]: j.error ?? "Could not skip check-in. Please try again." }));
        return;
      }
      setCtx(prev => prev ? { ...prev, checkinsOverdue: prev.checkinsOverdue.filter(x => x.id !== c.id) } : prev);
      setCheckinSkipConfirm(prev => { const n = new Set(prev); n.delete(c.id); return n; });
    } finally {
      setCheckinDoing(null);
    }
  };

  const handleSendPrep = async (p: PrepReminder) => {
    setSendingPrep(p.intake_id);
    setPrepError(prev => { const n = { ...prev }; delete n[p.intake_id]; return n; });
    try {
      const res = await fetch("/api/send-prep-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intake_id: p.intake_id }),
      });
      if (res.ok) {
        setSentPrep((prev) => new Set([...prev, p.intake_id]));
      } else {
        let msg = "Failed to send — please try again";
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
        setPrepError(prev => ({ ...prev, [p.intake_id]: msg }));
      }
    } finally {
      setSendingPrep(null);
    }
  };

  const handleDismissActionNeeded = async (id: string) => {
    const res = await fetch("/api/assistant/action-needed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setCtx(prev => prev ? { ...prev, actionNeeded: prev.actionNeeded.filter(x => x.id !== id) } : prev);
    }
  };

  const handleScheduledSendNow = async (a: ScheduledAftercare) => {
    setScheduledSendingNow(a.treatment_id);
    setScheduledError(prev => { const n = { ...prev }; delete n[a.treatment_id]; return n; });
    try {
      const res = await fetch(`/api/treatments/${a.treatment_id}/aftercare-now`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json() as { ok?: boolean; error?: string };
      if (j.ok) {
        setCtx(prev => prev ? { ...prev, scheduledAftercares: prev.scheduledAftercares.filter(x => x.treatment_id !== a.treatment_id) } : prev);
      } else {
        setScheduledError(prev => ({ ...prev, [a.treatment_id]: j.error ?? "Failed to send — please try again" }));
      }
    } finally {
      setScheduledSendingNow(null);
    }
  };


  const launched = bot?.ready_at != null || bot?.launched === true;
  const unbookedReturn = returnClients.filter((c) => !c.rebooked_at).length;

  const hasAlerts = visibleAlerts.length > 0;
  const hasUnsent = (ctx?.unsentAftercares.length ?? 0) > 0;
  const hasCheckins = (ctx?.checkinsOverdue.length ?? 0) > 0;
  const hasReturn = unbookedReturn > 0;
  const hasPrep = (ctx?.prepReminders.length ?? 0) > 0;
  const hasActionNeeded = (ctx?.actionNeeded?.length ?? 0) > 0;
  const needsSetup = !launched;
  const showRebookingNudge = launched && !bot?.rebooking_link && !rebookingDismissed;
  const allDone = !loading && !hasAlerts && !hasUnsent && !hasCheckins && !hasReturn && !hasPrep && !hasActionNeeded && !needsSetup && !showRebookingNudge;

  return (
    <section id="assistant-panel" className="rounded-2xl border border-[#1a2744]/20 bg-white shadow-lg overflow-hidden">
      <div className="flex items-center gap-2 bg-[#1a2744] px-4 py-3 sm:px-5">
        <span className="text-lg">🦋</span>
        <span className="text-sm font-semibold text-white">Your to-do list</span>
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
                    {(() => {
                      const name = alert.client_name && alert.client_name !== "Client"
                        ? alert.client_name : "a new visitor";
                      const count = alert.alert_messages.length;
                      return (
                        <>
                          <p className="text-sm font-semibold text-[#1a2744]">
                            {alert.alert_level === "911"
                              ? `🚨 Call-911 emergency from ${name}`
                              : alert.alert_level === "nurse"
                              ? `⚠️ Urgent from ${name}`
                              : `🚨 Emergency from ${name}`}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {count > 1
                              ? `${count} flagged messages`
                              : alert.flagged_message
                              ? `"${alert.flagged_message}"`
                              : null}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                  <span className="shrink-0 text-slate-400 text-xs">{expandedAlert === alert.id ? "▲" : "▼"}</span>
                </button>

                {expandedAlert === alert.id && (
                  <div className="border-t border-red-100 px-3 pb-3 pt-2 space-y-3">
                    {alert.alert_messages.length > 0 ? (
                      <div className="space-y-2">
                        {alert.alert_messages.map((am, idx) => (
                          <div key={idx} className="rounded-lg bg-white border border-red-100 px-3 py-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-red-600">
                                {am.level === "911" ? "🚨 Call 911" : "⚠️ Urgent"}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(am.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">&ldquo;{am.message}&rdquo;</p>
                          </div>
                        ))}
                      </div>
                    ) : alert.flagged_message ? (
                      <div className="rounded-lg bg-white border border-red-100 px-3 py-2">
                        <p className="text-xs text-slate-600 leading-relaxed">&ldquo;{alert.flagged_message}&rdquo;</p>
                      </div>
                    ) : null}
                    {(alert.client_phone || alert.client_email) && (
                      <div className="flex gap-2 flex-wrap">
                        {alert.client_phone && (
                          <a
                            href={`tel:${alert.client_phone}`}
                            className="flex-1 rounded-full bg-[#1a2744] px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-[#243552]"
                          >
                            📞 Call
                          </a>
                        )}
                        {alert.client_phone && (
                          <a
                            href={`sms:${alert.client_phone}`}
                            className="flex-1 rounded-full border border-[#1a2744] bg-white px-3 py-2 text-center text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50"
                          >
                            💬 Text
                          </a>
                        )}
                        {alert.client_email && (
                          <a
                            href={`mailto:${alert.client_email}`}
                            className="flex-1 rounded-full border border-teal-600 bg-white px-3 py-2 text-center text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                          >
                            ✉️ Email
                          </a>
                        )}
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
                    {markHandledError[alert.id] && (
                      <p className="text-xs text-red-600">{markHandledError[alert.id]}</p>
                    )}
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

            {/* 2–8. Non-alert to-do items — first 3 shown, rest collapsible */}
            {(() => {
              const todos: React.ReactNode[] = [];

              // 2. Aftercare to send
              for (const a of (ctx?.unsentAftercares ?? [])) {
                const alreadyInfo = aftercareAlreadySent[a.treatment_id];
                const isSending = aftercareSending === a.treatment_id;
                const sendErr = aftercareError[a.treatment_id];
                const hasEmail = !!a.client_email;
                todos.push(
                  <div key={`unsent-${a.treatment_id}`} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="shrink-0 text-base">💌</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-[#1a2744]">Send aftercare to {a.client_name}</p>
                        <p className="truncate text-xs text-slate-500">{a.procedure_name} · {fmtDate(a.treatment_date)}</p>
                      </div>
                      {!alreadyInfo && hasEmail && (
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => void handleSendAftercare(a)}
                          className="shrink-0 min-h-[44px] rounded-full bg-[#1a2744] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#243552] disabled:opacity-50"
                        >
                          {isSending ? "Sending…" : "Send →"}
                        </button>
                      )}
                      {!alreadyInfo && !hasEmail && (
                        <button
                          type="button"
                          onClick={() => router.push(`/client-journey?aftercare=${a.intake_id}`)}
                          className="shrink-0 min-h-[44px] rounded-full border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                        >
                          Add email
                        </button>
                      )}
                    </div>
                    {!alreadyInfo && !hasEmail && (
                      <p className="mt-1.5 text-xs text-amber-700">No email on file — add one to send aftercare.</p>
                    )}
                    {sendErr && (
                      <p className="mt-1.5 text-xs text-red-600">{sendErr}</p>
                    )}
                    {alreadyInfo && (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-teal-50 border border-teal-200 px-3 py-2">
                        <p className="text-xs font-semibold text-teal-800">
                          {alreadyInfo.sent_at
                            ? `✅ Already sent on ${fmtDate(alreadyInfo.sent_at)}`
                            : `⏳ Scheduled for ${fmtDate(alreadyInfo.scheduled_at ?? "")}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => router.push(`/client-journey?aftercare=${a.intake_id}&treatment_id=${a.treatment_id}&treatment_date=${a.treatment_date}${a.procedure_id ? `&procedure_id=${a.procedure_id}` : ""}`)}
                          className="shrink-0 text-xs font-semibold text-teal-700 underline"
                        >
                          Send again
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              // 3. Scheduled aftercares
              for (const a of (ctx?.scheduledAftercares ?? [])) {
                todos.push(
                  <div key={`sched-${a.treatment_id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="shrink-0 text-base">⏳</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-[#1a2744]">Aftercare to {a.client_name}</p>
                        <p className="truncate text-xs text-slate-500">{a.procedure_name} · {fmtScheduledTime(a.aftercare_send_at)}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={scheduledSendingNow === a.treatment_id}
                          onClick={() => void handleScheduledSendNow(a)}
                          className="min-h-[44px] rounded-full bg-[#1a2744] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#243552] disabled:opacity-50"
                        >
                          {scheduledSendingNow === a.treatment_id ? "Sending…" : "Send now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelPopupItem(a)}
                          className="min-h-[44px] rounded-full border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    {scheduledError[a.treatment_id] && (
                      <p className="mt-1.5 text-xs text-red-600">{scheduledError[a.treatment_id]}</p>
                    )}
                    {cancelPopupItem?.treatment_id === a.treatment_id && (
                      <CancelAftercarePopup
                        treatmentId={a.treatment_id}
                        token={token}
                        onCanceled={() => {
                          setCtx(prev => prev ? { ...prev, scheduledAftercares: prev.scheduledAftercares.filter(x => x.treatment_id !== a.treatment_id) } : prev);
                          setCancelPopupItem(null);
                        }}
                        onChangeIt={() => {
                          setCtx(prev => prev ? { ...prev, scheduledAftercares: prev.scheduledAftercares.filter(x => x.treatment_id !== a.treatment_id) } : prev);
                          setCancelPopupItem(null);
                          router.push(`/client-journey?aftercare=${a.intake_id}&treatment_id=${a.treatment_id}`);
                        }}
                        onDismiss={() => setCancelPopupItem(null)}
                      />
                    )}
                  </div>
                );
              }

              // 4. Check-ins overdue / due today
              for (const c of (ctx?.checkinsOverdue ?? [])) {
                const noteOpen = checkinNoteOpen.has(c.id);
                const skipConfirm = checkinSkipConfirm.has(c.id);
                const doing = checkinDoing === c.id;
                const err = checkinError[c.id];
                const hasContact = !!(c.phone || c.email);
                todos.push(
                <div key={c.id} className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-base pt-0.5">📞</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1a2744] truncate">Check in with {c.client_name}</p>
                      <p className="text-xs text-slate-500">Due {fmtDate(c.due_date)}</p>
                    </div>
                  </div>

                  {/* Contact links — stacked so long emails never overflow */}
                  {hasContact ? (
                    <div className="flex flex-col gap-1.5 text-xs">
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 font-medium text-[#1a2744] hover:bg-orange-50"
                        >
                          <span className="shrink-0">📱</span>
                          <span className="truncate">{c.phone}</span>
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 font-medium text-[#1a2744] hover:bg-orange-50"
                        >
                          <span className="shrink-0">✉️</span>
                          <span className="truncate">{c.email}</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>No phone or email on file</span>
                      <button
                        type="button"
                        onClick={() => router.push(`/client-journey?aftercare=${c.intake_id}`)}
                        className="min-h-[44px] rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1a2744] transition hover:bg-orange-100"
                      >
                        Add contact
                      </button>
                    </div>
                  )}

                  {/* Script */}
                  {c.script && (
                    <p className="break-words text-xs text-slate-600 italic border-l-2 border-orange-200 pl-2">
                      {c.script}
                    </p>
                  )}

                  {/* Error */}
                  {err && <p className="break-words text-xs text-red-600">{err}</p>}

                  {/* Note box (shown when Done was tapped) */}
                  {noteOpen && (
                    <div className="space-y-1.5">
                      <textarea
                        rows={2}
                        placeholder="Add a note (optional)"
                        value={checkinNoteText[c.id] ?? ""}
                        onChange={e => setCheckinNoteText(prev => ({ ...prev, [c.id]: e.target.value }))}
                        className="w-full rounded-lg border border-orange-200 bg-white px-2 py-1.5 text-base text-[#1a2744] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={doing}
                          onClick={() => handleCheckinDone(c)}
                          className="flex-1 min-h-[44px] rounded-full bg-[#1a2744] px-3 text-xs font-semibold text-white transition hover:bg-[#243552] disabled:opacity-50"
                        >
                          {doing ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={doing}
                          onClick={() => {
                            setCheckinNoteOpen(prev => { const n = new Set(prev); n.delete(c.id); return n; });
                            setCheckinNoteText(prev => { const n = { ...prev }; delete n[c.id]; return n; });
                          }}
                          className="min-h-[44px] rounded-full border border-slate-200 px-3 text-xs font-semibold text-[#1a2744] transition hover:bg-orange-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Skip confirm */}
                  {skipConfirm && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-600">Skip this check-in?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={doing}
                          onClick={() => handleCheckinSkip(c)}
                          className="flex-1 min-h-[44px] rounded-full bg-orange-500 px-3 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                        >
                          {doing ? "Skipping…" : "Yes, skip"}
                        </button>
                        <button
                          type="button"
                          disabled={doing}
                          onClick={() => setCheckinSkipConfirm(prev => { const n = new Set(prev); n.delete(c.id); return n; })}
                          className="min-h-[44px] rounded-full border border-slate-200 px-3 text-xs font-semibold text-[#1a2744] transition hover:bg-orange-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons — each full-width on narrow screens, row on wider */}
                  {!noteOpen && !skipConfirm && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        disabled={doing}
                        onClick={() => setCheckinNoteOpen(prev => new Set(prev).add(c.id))}
                        className="w-full min-h-[44px] rounded-full bg-[#1a2744] px-3 text-xs font-semibold text-white transition hover:bg-[#243552] disabled:opacity-50 sm:w-auto sm:flex-1"
                      >
                        ✅ Done
                      </button>
                      <button
                        type="button"
                        disabled={doing}
                        onClick={() => setCheckinSkipConfirm(prev => new Set(prev).add(c.id))}
                        className="w-full min-h-[44px] rounded-full border border-slate-200 px-3 text-xs font-semibold text-[#1a2744] transition hover:bg-orange-100 disabled:opacity-50 sm:w-auto"
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/client-journey?aftercare=${c.intake_id}`)}
                        className="w-full min-h-[44px] rounded-full border border-slate-200 px-3 text-xs font-semibold text-[#1a2744] transition hover:bg-orange-100 sm:w-auto"
                      >
                        Open client
                      </button>
                    </div>
                  )}
                </div>
                );
              }

              // 5. Clients due back soon
              if (hasReturn) {
                todos.push(
                  <div key="return" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
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
                      className="shrink-0 min-h-[44px] rounded-full border border-slate-200 px-3 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50"
                    >
                      See all →
                    </button>
                  </div>
                );
              }

              // 6. Prep reminders
              for (const p of (ctx?.prepReminders ?? [])) {
                const sent = sentPrep.has(p.intake_id);
                const sending = sendingPrep === p.intake_id;
                if (sent) {
                  todos.push(
                    <div key={`prep-${p.treatment_id}`} className="rounded-xl border border-green-100 bg-green-50 px-3 py-3">
                      <p className="text-sm text-green-700">✅ Prep guide sent to {p.client_name}</p>
                    </div>
                  );
                } else {
                  todos.push(
                    <div key={`prep-${p.treatment_id}`} className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 text-base">📋</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1a2744]">Send prep guide to {p.client_name}</p>
                          <p className="text-xs text-slate-500">{p.procedure_name} · {fmtDate(p.treatment_date)}</p>
                        </div>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => void handleSendPrep(p)}
                          className="shrink-0 min-h-[44px] rounded-full bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                        >
                          {sending ? "Sending…" : "Send →"}
                        </button>
                      </div>
                      {prepError[p.intake_id] && (
                        <p className="mt-1.5 text-xs text-red-600">{prepError[p.intake_id]}</p>
                      )}
                    </div>
                  );
                }
              }

              // 7. Action-needed to-dos
              for (const item of (ctx?.actionNeeded ?? [])) {
                todos.push(
                  <div key={`action-${item.id}`} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                    <span className="shrink-0 text-base mt-0.5">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-800">Action needed</p>
                      <p className="text-xs text-amber-700 mt-0.5">{item.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDismissActionNeeded(item.id)}
                      className="shrink-0 text-xs text-amber-500 hover:text-amber-700 transition min-h-[44px] px-2"
                      aria-label="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                );
              }

              // 8. Rebooking link nudge
              if (showRebookingNudge) {
                todos.push(
                  <div key="rebooking" className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
                    <span className="shrink-0 text-base mt-0.5">📅</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1a2744]">Set up a spot for returning clients</p>
                      <p className="text-xs text-slate-500 mt-0.5">Add a booking link just for clients coming back and we&apos;ll include it in every return reminder.</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => router.push("/account#practice")}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#1a2744] px-3 text-xs font-semibold text-white transition hover:bg-[#243552]"
                      >
                        Take me there →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRebookingDismissed(true);
                          try { localStorage.setItem("ab-rebooking-nudge-dismissed", new Date().toISOString()); } catch { /* ignore */ }
                        }}
                        className="inline-flex min-h-[44px] w-full items-center justify-center text-xs text-slate-400 hover:text-slate-600 transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              }

              // 9. Setup — if not launched
              if (needsSetup) {
                todos.push(
                  <div key="setup" className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3">
                    <span className="shrink-0 text-base">⚙️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1a2744]">Finish setting up your care assistant</p>
                      <p className="text-xs text-slate-500">Go live to start capturing clients automatically</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/onboarding")}
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-teal-600 px-3 text-xs font-semibold text-white transition hover:bg-teal-700"
                    >
                      Continue →
                    </button>
                  </div>
                );
              }

              // Render: show first 3, collapse the rest
              const LIMIT = 3;
              const visible = todoExpanded ? todos : todos.slice(0, LIMIT);
              const hiddenCount = todos.length - LIMIT;

              return (
                <>
                  {visible}
                  {todos.length > LIMIT && (
                    <button
                      type="button"
                      onClick={() => setTodoExpanded(e => !e)}
                      className="flex w-full min-h-[44px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50"
                    >
                      {todoExpanded
                        ? "Show less ↑"
                        : `See all (${hiddenCount + LIMIT}) ↓`}
                    </button>
                  )}
                </>
              );
            })()}

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
              className="inline-flex min-h-[44px] w-full items-center text-left text-xs text-slate-400 transition hover:text-teal-600"
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
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
