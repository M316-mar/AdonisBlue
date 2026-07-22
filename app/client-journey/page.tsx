"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_BEFORE = `Please arrive with a clean face — no makeup, moisturiser, or SPF.
Avoid alcohol for 24 hours before your appointment.
Avoid blood thinners, aspirin, and ibuprofen for 24 hours.
Stay hydrated — drink plenty of water in the days leading up.
Arrive 5–10 minutes early so we can get started on time.`;

const DEFAULT_AFTERCARE = `Hi [client_name],

Thank you so much for coming in today for your [procedure]! 💙 Here are your personalised aftercare instructions to keep your results looking gorgeous:

• Avoid touching or rubbing the treated area for 24 hours
• Stay out of direct sunlight and avoid heat (saunas, hot showers) for 48 hours
• Avoid strenuous exercise for 24 hours
• Do not apply makeup or skincare to the area for 24 hours
• Stay hydrated and get plenty of rest

If you have any concerns or unexpected reactions, please don't hesitate to reach out.

With love,
[practice_name]`;

const DEFAULT_FOLLOWUP = `Hi [Client Name],

I just wanted to check in and see how you're glowing since your last visit! 💕

If you're ready to maintain your results or try something new, I'd love to see you again. You can book your next appointment here: [booking link]

As always, don't hesitate to reach out if you have any questions.

With love,
[practice_name]`;

// ─── Types ────────────────────────────────────────────────────────────────────

type Treatment = {
  id: string;
  intake_id: string | null;
  procedure_name: string;
  treatment_date: string;
  aftercare_sent: boolean;
  notes: string | null;
  came_via_bot: boolean;
  archived: boolean;
  intakes: {
    first_name: string;
    email: string;
    phone: string;
    prep_guide_sent: boolean;
    followup_sent: boolean;
  } | null;
};

type Bot = {
  pre_appointment_instructions: string | null;
  aftercare_template: string | null;
  followup_template: string | null;
  webhook_secret: string | null;
};

type Procedure = {
  id: string;
  name: string;
};

// ─── Email Preview helpers ────────────────────────────────────────────────────

function BeforePreview({ text }: { text: string }) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-[#1a2744] to-[#0d3d38] px-5 py-4 text-center">
        <p className="text-white font-bold text-base">Your Appointment is Coming Up! 💙</p>
        <p className="text-white/70 text-xs mt-0.5">Your Practice Name</p>
      </div>
      <div className="p-5">
        <p className="font-semibold text-[#1a2744] mb-1">Hi [Client Name]! 👋</p>
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">We're so excited to see you! To make sure you get the best results, here's how to prepare:</p>
        <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 mb-4">
          <p className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2">Pre-Appointment Checklist</p>
          {lines.length > 0 ? lines.map((l, i) => (
            <p key={i} className="text-sm text-[#1a2744] py-1">✅ {l}</p>
          )) : (
            <p className="text-sm text-slate-400 italic">Enter instructions above to preview them here.</p>
          )}
        </div>
        <p className="text-xs text-slate-500">We can&apos;t wait to see you! 🦋</p>
      </div>
      <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 text-center">
        <p className="text-xs text-slate-400">Sent with love by AdonisBlue 💙</p>
      </div>
    </div>
  );
}

function AftercarePreview({ text }: { text: string }) {
  const display = text.trim() || DEFAULT_AFTERCARE;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-[#1a2744] px-5 py-4 text-center">
        <p className="text-white font-bold text-base">You&apos;re glowing, [Client Name]! 🌸</p>
        <p className="text-white/60 text-xs mt-0.5">Your Practice Name</p>
      </div>
      <div className="p-5">
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">Thank you so much for trusting us with your beauty. Here are your aftercare instructions.</p>
        <div className="rounded-xl bg-teal-50 border-l-4 border-teal-500 px-4 py-3 mb-4">
          <p className="text-xs font-bold text-teal-700 mb-2">📋 Your Aftercare Instructions</p>
          <p className="text-sm text-[#1a2744] whitespace-pre-wrap leading-relaxed">{display}</p>
        </div>
        <p className="text-xs text-slate-500">Questions? Reply to this email anytime. We can&apos;t wait to see you again! 💕</p>
      </div>
      <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 text-center">
        <p className="text-xs text-slate-400">Sent with care by Your Practice via AdonisBlue</p>
      </div>
    </div>
  );
}

function FollowupPreview({ text }: { text: string }) {
  const display = text.trim() || DEFAULT_FOLLOWUP;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-[#1a2744] px-5 py-4 text-center">
        <p className="text-white font-bold text-base">We miss you! 💜</p>
        <p className="text-white/70 text-xs mt-0.5">Your Practice Name</p>
      </div>
      <div className="p-5">
        <p className="text-sm text-[#1a2744] whitespace-pre-wrap leading-relaxed">{display}</p>
      </div>
      <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 text-center">
        <p className="text-xs text-slate-400">Sent with love by AdonisBlue 💙</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientJourneyPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"charts" | "before" | "aftercare" | "followup">("charts");
  const [showPreview, setShowPreview] = useState(false);

  // Bot templates
  const [beforeText, setBeforeText] = useState("");
  const [aftercareText, setAftercareText] = useState("");
  const [followupText, setFollowupText] = useState("");
  const [saving, setSaving] = useState(false);
  const [botConnected, setBotConnected] = useState(false);

  // Client charts
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [expandedClientKeys, setExpandedClientKeys] = useState<Set<string>>(new Set());

  // Procedures for Aftercare tab
  const [procedures, setProcedures] = useState<Procedure[]>([]);

  // Custom aftercare composer state
  const [acSelectedProcedure, setAcSelectedProcedure] = useState("");
  const [acCustomProcedure, setAcCustomProcedure] = useState("");
  const [acGenerating, setAcGenerating] = useState(false);
  const [acGeneratedText, setAcGeneratedText] = useState("");
  const [acSelectedIntakeId, setAcSelectedIntakeId] = useState("");
  const [acSending, setAcSending] = useState(false);

  // Per-session send tracking (optimistic UI before page refresh)
  const [prepSending, setPrepSending] = useState<string | null>(null);
  const [prepSentIds, setPrepSentIds] = useState<Set<string>>(new Set());
  const [aftercareSending, setAftercareSending] = useState<string | null>(null);
  const [aftercareSentIds, setAftercareSentIds] = useState<Set<string>>(new Set());
  const [followupSending, setFollowupSending] = useState<string | null>(null);
  const [followupSentIds, setFollowupSentIds] = useState<Set<string>>(new Set());

  const [successMsg, setSuccessMsg] = useState("");
  function flash(msg: string, ms = 3500) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), ms);
  }

  // ── Auth + load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) { router.replace("/auth"); return; }
      const t = data.session.access_token;
      setToken(t);

      const [botRes, treatRes, procRes] = await Promise.all([
        fetch("/api/mybot", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/treatments", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/procedures", { headers: { Authorization: `Bearer ${t}` } }),
      ]);

      if (!cancelled) {
        if (botRes.ok) {
          const j = await botRes.json();
          const b: Bot = j.bot ?? {};
          setBeforeText(b.pre_appointment_instructions ?? DEFAULT_BEFORE);
          setAftercareText(b.aftercare_template ?? DEFAULT_AFTERCARE);
          setFollowupText(b.followup_template ?? DEFAULT_FOLLOWUP);
          setBotConnected(!!b.webhook_secret);
        }
        if (treatRes.ok) {
          const j = await treatRes.json();
          setTreatments((j.treatments ?? []).filter((t: Treatment) => !t.archived));
        }
        if (procRes.ok) {
          const j = await procRes.json();
          setProcedures(j.procedures ?? []);
        }
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // ── Save a single field to bots table ──────────────────────────────────────
  const saveField = useCallback(async (field: string, value: string) => {
    setSaving(true);
    try {
      await fetch("/api/savebot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: value }),
      });
      flash("Saved ✅");
    } finally {
      setSaving(false);
    }
  }, [token]);

  // ── Send helpers ────────────────────────────────────────────────────────────
  const sendPrepGuide = useCallback(async (intakeId: string, clientName: string) => {
    setPrepSending(intakeId);
    try {
      const res = await fetch("/api/send-prep-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intake_id: intakeId }),
      });
      if (res.ok) {
        setPrepSentIds(prev => new Set([...prev, intakeId]));
        setTreatments(prev => prev.map(t =>
          t.intake_id === intakeId ? { ...t, intakes: t.intakes ? { ...t.intakes, prep_guide_sent: true } : null } : t
        ));
        flash(`📋 Prep guide sent to ${clientName}!`);
      } else {
        const j = await res.json().catch(() => ({}));
        flash(`Failed: ${j.error ?? "unknown error"}`);
      }
    } finally {
      setPrepSending(null);
    }
  }, [token]);

  const sendAftercareEmail = useCallback(async (intakeId: string, clientName: string) => {
    setAftercareSending(intakeId);
    try {
      const res = await fetch("/api/send-aftercare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake_id: intakeId }),
      });
      if (res.ok) {
        setAftercareSentIds(prev => new Set([...prev, intakeId]));
        setTreatments(prev => prev.map(t =>
          t.intake_id === intakeId ? { ...t, aftercare_sent: true } : t
        ));
        flash(`💙 Aftercare sent to ${clientName}!`);
      } else {
        const j = await res.json().catch(() => ({}));
        flash(`Failed: ${j.error ?? "unknown error"}`);
      }
    } finally {
      setAftercareSending(null);
    }
  }, []);

  const sendFollowup = useCallback(async (intakeId: string, treatmentId: string, clientName: string) => {
    setFollowupSending(intakeId);
    try {
      const res = await fetch("/api/send-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ treatment_ids: [treatmentId] }),
      });
      if (res.ok) {
        setFollowupSentIds(prev => new Set([...prev, intakeId]));
        setTreatments(prev => prev.map(t =>
          t.intake_id === intakeId ? { ...t, intakes: t.intakes ? { ...t.intakes, followup_sent: true } : null } : t
        ));
        flash(`🔄 Follow-up sent to ${clientName}!`);
      } else {
        const j = await res.json().catch(() => ({}));
        flash(`Failed: ${j.error ?? "unknown error"}`);
      }
    } finally {
      setFollowupSending(null);
    }
  }, [token]);

  // ── AI generate aftercare for a procedure ──────────────────────────────────
  const generateAftercareForProcedure = useCallback(async () => {
    const procedure = acCustomProcedure.trim() || acSelectedProcedure;
    if (!procedure) return;
    setAcGenerating(true);
    setAcGeneratedText("");
    try {
      const res = await fetch("/api/generate-aftercare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ procedure }),
      });
      if (res.ok) {
        const j = await res.json();
        setAcGeneratedText(j.instructions ?? "");
      } else {
        flash("Failed to generate aftercare — please try again.");
      }
    } finally {
      setAcGenerating(false);
    }
  }, [token, acCustomProcedure, acSelectedProcedure]);

  // ── Send custom aftercare to a specific client ──────────────────────────────
  const sendCustomAftercareToClient = useCallback(async () => {
    if (!acSelectedIntakeId || !acGeneratedText.trim()) return;
    setAcSending(true);
    try {
      const res = await fetch("/api/send-aftercare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake_id: acSelectedIntakeId, custom_body: acGeneratedText.trim() }),
      });
      if (res.ok) {
        setAftercareSentIds(prev => new Set([...prev, acSelectedIntakeId]));
        setTreatments(prev => prev.map(t =>
          t.intake_id === acSelectedIntakeId ? { ...t, aftercare_sent: true } : t
        ));
        flash("💙 Custom aftercare sent!");
        setAcGeneratedText("");
        setAcCustomProcedure("");
        setAcSelectedProcedure("");
        setAcSelectedIntakeId("");
      } else {
        const j = await res.json().catch(() => ({}));
        flash(`Failed: ${j.error ?? "unknown error"}`);
      }
    } finally {
      setAcSending(false);
    }
  }, [token, acSelectedIntakeId, acGeneratedText]);

  // ── Client grouping ─────────────────────────────────────────────────────────
  const clientGroups = (() => {
    const groups = new Map<string, Treatment[]>();
    for (const t of treatments) {
      const key = t.intake_id ?? `anon-${t.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    for (const [, group] of groups) {
      group.sort((a, b) => new Date(b.treatment_date).getTime() - new Date(a.treatment_date).getTime());
    }
    return Array.from(groups.entries());
  })();

  const toggleClient = (key: string) => {
    setExpandedClientKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Unique clients with email for the custom-send dropdown
  const clientsWithEmail: { intakeId: string; name: string }[] = (() => {
    const seen = new Set<string>();
    const result: { intakeId: string; name: string }[] = [];
    for (const t of treatments) {
      if (t.intake_id && t.intakes?.email && !seen.has(t.intake_id)) {
        seen.add(t.intake_id);
        result.push({ intakeId: t.intake_id, name: t.intakes.first_name || "Client" });
      }
    }
    return result;
  })();

  const TABS = [
    { id: "charts" as const,   label: "Clients",             emoji: "👤" },
    { id: "before" as const,   label: "Before Appointment",  emoji: "📋" },
    { id: "aftercare" as const, label: "Aftercare Email",    emoji: "💌" },
    { id: "followup" as const, label: "Follow-up",           emoji: "🔁" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link href="/dashboard">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[#1a2744] sm:text-base truncate">🗺️ Client Journey</h1>
            <p className="hidden text-xs text-slate-500 sm:block">Manage every touchpoint in your client&apos;s experience</p>
          </div>
        </div>
      </header>

      {/* Flash message */}
      {successMsg && (
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <div className="rounded-2xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm font-semibold text-teal-700">
            {successMsg}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setShowPreview(false); }}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition whitespace-nowrap ${tab === t.id ? "bg-[#1a2744] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4 pb-16">

        {/* ── Clients Tab ───────────────────────────────────────────────── */}
        {tab === "charts" && (
          <div className="space-y-3">
            {clientGroups.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-4xl mb-3">👤</p>
                <p className="font-bold text-[#1a2744]">No client records yet</p>
                <p className="mt-1 text-sm text-slate-500">Log a treatment in the Client Hub to see client history here.</p>
              </div>
            )}
            {clientGroups.map(([key, clientTreatments]) => {
              const rep = clientTreatments[0];
              const clientName = rep.intakes?.first_name ?? "Walk-in Client";
              const clientEmail = rep.intakes?.email ?? "";
              const intakeId = rep.intake_id;
              const isExpanded = expandedClientKeys.has(key);
              const hasIntake = !!intakeId && !!clientEmail;

              // Email status — DB value OR optimistic local state
              const prepSent = (rep.intakes?.prep_guide_sent ?? false) || (intakeId ? prepSentIds.has(intakeId) : false);
              const aftercareSent = clientTreatments.some(t => t.aftercare_sent) || (intakeId ? aftercareSentIds.has(intakeId) : false);
              const followupSent = (rep.intakes?.followup_sent ?? false) || (intakeId ? followupSentIds.has(intakeId) : false);

              // Most recent non-rebook treatment ID (for follow-up)
              const mostRecentTreatment = clientTreatments.find(t => t.notes !== "Rebooked appointment") ?? clientTreatments[0];

              // Upcoming rebooked appointments (future dates)
              const upcomingRebooks = clientTreatments.filter(t =>
                t.notes === "Rebooked appointment" &&
                new Date(t.treatment_date).getTime() >= today.getTime()
              );

              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* Client header — click anywhere to expand */}
                  <button
                    type="button"
                    onClick={() => toggleClient(key)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-teal-400 to-[#1a2744] flex items-center justify-center text-white text-sm font-bold">
                        {clientName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#1a2744] truncate">{clientName}</p>
                        {clientEmail && <p className="text-xs text-slate-500 truncate">{clientEmail}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                        {clientTreatments.length} visit{clientTreatments.length !== 1 ? "s" : ""}
                      </span>
                      {/* Arrow: ▶ collapsed, ▼ expanded */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">

                      {/* Upcoming rebooked appointments */}
                      {upcomingRebooks.length > 0 && (
                        <div className="px-5 py-3 bg-violet-50 border-b border-violet-100">
                          <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">📅 Upcoming appointment{upcomingRebooks.length !== 1 ? "s" : ""}</p>
                          <div className="space-y-2">
                            {upcomingRebooks.map(t => (
                              <div key={t.id} className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-[#1a2744]">{t.procedure_name}</p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(t.treatment_date).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                                  </p>
                                </div>
                                {hasIntake && !prepSent && (
                                  <button
                                    type="button"
                                    disabled={prepSending === intakeId}
                                    onClick={() => void sendPrepGuide(intakeId, clientName)}
                                    className="shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                                  >
                                    {prepSending === intakeId ? "Sending…" : "Send prep guide"}
                                  </button>
                                )}
                                {prepSent && (
                                  <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">📋 Prep guide sent</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Email status rows */}
                      {hasIntake && (
                        <div className="px-5 py-4 border-b border-slate-100 space-y-3">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email status</p>

                          {/* Before Appointment */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">📋</span>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold text-[#1a2744]">Before Appointment</p>
                                  {botConnected
                                    ? <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-semibold text-green-700">🤖 Automatic</span>
                                    : <a href="/booking-connect" className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 transition">⚙️ Set up auto</a>
                                  }
                                </div>
                                <p className={`text-xs font-semibold ${prepSent ? "text-teal-600" : "text-slate-400"}`}>
                                  {prepSent ? "✅ Sent" : "❌ Not sent"}
                                </p>
                              </div>
                            </div>
                            {!prepSent && (
                              <button
                                type="button"
                                disabled={prepSending === intakeId}
                                onClick={() => void sendPrepGuide(intakeId, clientName)}
                                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                {prepSending === intakeId ? "Sending…" : "Send"}
                              </button>
                            )}
                          </div>

                          {/* Aftercare */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="text-base mt-0.5">💙</span>
                              <div>
                                <p className="text-sm font-semibold text-[#1a2744]">Aftercare</p>
                                <p className={`text-xs font-semibold ${aftercareSent ? "text-teal-600" : "text-slate-400"}`}>
                                  {aftercareSent ? "✅ Sent" : "❌ Not sent"}
                                </p>
                                <p className="text-xs text-slate-400 italic mt-0.5">Aftercare is customized per procedure — send manually from the Aftercare Email tab.</p>
                              </div>
                            </div>
                            {!aftercareSent && (
                              <button
                                type="button"
                                disabled={aftercareSending === intakeId}
                                onClick={() => void sendAftercareEmail(intakeId, clientName)}
                                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                {aftercareSending === intakeId ? "Sending…" : "Send"}
                              </button>
                            )}
                          </div>

                          {/* Follow-up */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">🔄</span>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold text-[#1a2744]">Follow-up</p>
                                  {botConnected
                                    ? <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-semibold text-green-700">🤖 Automatic</span>
                                    : <a href="/booking-connect" className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 transition">⚙️ Set up auto</a>
                                  }
                                </div>
                                <p className={`text-xs font-semibold ${followupSent ? "text-teal-600" : "text-slate-400"}`}>
                                  {followupSent ? "✅ Sent" : "❌ Not sent"}
                                </p>
                              </div>
                            </div>
                            {!followupSent && (
                              <button
                                type="button"
                                disabled={followupSending === intakeId}
                                onClick={() => void sendFollowup(intakeId, mostRecentTreatment.id, clientName)}
                                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                {followupSending === intakeId ? "Sending…" : "Send"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Treatment history */}
                      <div className="divide-y divide-slate-100">
                        {clientTreatments.map((t, idx) => (
                          <div key={t.id} className="px-5 py-4">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{t.procedure_name}</span>
                              {t.came_via_bot && (
                                <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-700">🤖 Via bot</span>
                              )}
                              {t.notes === "Rebooked appointment" && (
                                <span className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-semibold text-purple-700">📅 Rebooked</span>
                              )}
                              {t.aftercare_sent ? (
                                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">✅ Aftercare</span>
                              ) : (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">⏳ No aftercare</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {new Date(t.treatment_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                              {idx === 0 && <span className="ml-1 text-teal-600 font-semibold">· Latest</span>}
                            </p>
                            {t.notes && t.notes !== "Rebooked appointment" && (
                              <p className="mt-1 text-xs text-slate-600 italic">{t.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Before Appointment Tab ─────────────────────────────────────── */}
        {tab === "before" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-[#1a2744] mb-1">📋 Pre-appointment instructions</h2>
              <p className="text-sm text-slate-500 mb-4">
                These instructions are sent to clients before their appointment. One instruction per line.
              </p>
              <textarea
                value={beforeText}
                onChange={e => setBeforeText(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveField("pre_appointment_instructions", beforeText)}
                  className="rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save instructions"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(p => !p)}
                  className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {showPreview ? "Hide preview" : "👁 Preview email"}
                </button>
              </div>
            </div>
            {showPreview && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Email preview — what your client sees</p>
                <BeforePreview text={beforeText} />
              </div>
            )}
          </div>
        )}

        {/* ── Aftercare Email Tab ────────────────────────────────────────── */}
        {tab === "aftercare" && (
          <div className="space-y-4">

            {/* Default template card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-[#1a2744] mb-1">💌 Default aftercare template</h2>
              <p className="text-sm text-slate-500 mb-3">
                This is sent automatically when you log a treatment. Use{" "}
                <code className="bg-slate-100 px-1 rounded text-xs">[client_name]</code>,{" "}
                <code className="bg-slate-100 px-1 rounded text-xs">[procedure]</code>, and{" "}
                <code className="bg-slate-100 px-1 rounded text-xs">[practice_name]</code> as placeholders.
              </p>
              <textarea
                value={aftercareText}
                onChange={e => setAftercareText(e.target.value)}
                rows={10}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveField("aftercare_template", aftercareText)}
                  className="rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save template"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(p => !p)}
                  className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {showPreview ? "Hide preview" : "👁 Preview email"}
                </button>
              </div>
            </div>
            {showPreview && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Email preview — what your client sees</p>
                <AftercarePreview text={aftercareText} />
              </div>
            )}

            {/* Custom / one-off aftercare composer */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-[#1a2744] mb-1">✨ Custom aftercare email</h2>
                <p className="text-sm text-slate-500">
                  💡 If you perform a procedure not in your bot, you can create a custom aftercare email here and send it directly to your client.
                </p>
              </div>

              {/* Procedure chips */}
              {procedures.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Your procedures</p>
                  <div className="flex flex-wrap gap-2">
                    {procedures.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setAcSelectedProcedure(p.name);
                          setAcCustomProcedure("");
                          setAcGeneratedText("");
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          acSelectedProcedure === p.name && !acCustomProcedure
                            ? "bg-[#1a2744] text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom procedure input + Generate button */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Or type a custom procedure</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={acCustomProcedure}
                    onChange={e => {
                      setAcCustomProcedure(e.target.value);
                      setAcSelectedProcedure("");
                      setAcGeneratedText("");
                    }}
                    placeholder="e.g. PRP Facial, Dermaplaning…"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition"
                  />
                  <button
                    type="button"
                    disabled={acGenerating || (!acCustomProcedure.trim() && !acSelectedProcedure)}
                    onClick={() => void generateAftercareForProcedure()}
                    className="shrink-0 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    {acGenerating ? "Generating…" : "✨ Generate with AI"}
                  </button>
                </div>
              </div>

              {/* Generated / editable textarea */}
              {acGeneratedText && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Review & edit before sending</p>
                    <textarea
                      value={acGeneratedText}
                      onChange={e => setAcGeneratedText(e.target.value)}
                      rows={10}
                      className="w-full resize-none rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:bg-white transition"
                    />
                  </div>

                  {/* Client selector */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Send to</p>
                    {clientsWithEmail.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No clients with email addresses found. Log a treatment first.</p>
                    ) : (
                      <select
                        value={acSelectedIntakeId}
                        onChange={e => setAcSelectedIntakeId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition"
                      >
                        <option value="">— Select a client —</option>
                        {clientsWithEmail.map(c => (
                          <option key={c.intakeId} value={c.intakeId}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={acSending || !acSelectedIntakeId}
                    onClick={() => void sendCustomAftercareToClient()}
                    className="w-full rounded-full bg-[#0d9488] px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                  >
                    {acSending ? "Sending…" : "💙 Send to client"}
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── Follow-up Tab ──────────────────────────────────────────────── */}
        {tab === "followup" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-[#1a2744] mb-1">🔁 Follow-up message template</h2>
              <p className="text-sm text-slate-500 mb-3">
                Sent as a rebooking reminder or check-in. Use{" "}
                <code className="bg-slate-100 px-1 rounded text-xs">[Client Name]</code>,{" "}
                <code className="bg-slate-100 px-1 rounded text-xs">[booking link]</code>, and{" "}
                <code className="bg-slate-100 px-1 rounded text-xs">[practice_name]</code> as placeholders.
              </p>
              <textarea
                value={followupText}
                onChange={e => setFollowupText(e.target.value)}
                rows={12}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveField("followup_template", followupText)}
                  className="rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save template"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(p => !p)}
                  className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {showPreview ? "Hide preview" : "👁 Preview email"}
                </button>
              </div>
            </div>
            {showPreview && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Email preview — what your client sees</p>
                <FollowupPreview text={followupText} />
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
