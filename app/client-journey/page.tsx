"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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
  intakes: { first_name: string; email: string; phone: string } | null;
};

type Bot = {
  pre_appointment_instructions: string | null;
  aftercare_template: string | null;
  followup_template: string | null;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientJourneyPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"before" | "aftercare" | "followup" | "charts">("before");

  // Bot templates
  const [bot, setBot] = useState<Bot>({ pre_appointment_instructions: null, aftercare_template: null, followup_template: null });
  const [beforeText, setBeforeText] = useState("");
  const [aftercareText, setAftercareText] = useState("");
  const [followupText, setFollowupText] = useState("");
  const [saving, setSaving] = useState(false);

  // Client charts
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [expandedClientKeys, setExpandedClientKeys] = useState<Set<string>>(new Set());

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

      const [botRes, treatRes] = await Promise.all([
        fetch("/api/mybot", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/treatments", { headers: { Authorization: `Bearer ${t}` } }),
      ]);

      if (!cancelled) {
        if (botRes.ok) {
          const j = await botRes.json();
          const b = j.bot ?? {};
          setBot(b);
          setBeforeText(b.pre_appointment_instructions ?? "");
          setAftercareText(b.aftercare_template ?? "");
          setFollowupText(b.followup_template ?? "");
        }
        if (treatRes.ok) {
          const j = await treatRes.json();
          setTreatments((j.treatments ?? []).filter((t: Treatment) => !t.archived));
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

  // ── Client grouping for Charts tab ─────────────────────────────────────────
  const clientGroups = (() => {
    const groups = new Map<string, Treatment[]>();
    for (const t of treatments) {
      const key = t.intake_id ?? `anon-${t.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
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

  const TABS = [
    { id: "before" as const, label: "Before Appointment", emoji: "📋" },
    { id: "aftercare" as const, label: "Aftercare Email", emoji: "💌" },
    { id: "followup" as const, label: "Follow-up", emoji: "🔁" },
    { id: "charts" as const, label: "Client Charts", emoji: "👤" },
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
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition whitespace-nowrap ${tab === t.id ? "bg-[#1a2744] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4 pb-16">

        {/* ── Before Appointment Tab ─────────────────────────────────────── */}
        {tab === "before" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-[#1a2744] mb-1">📋 Pre-appointment instructions</h2>
              <p className="text-sm text-slate-500 mb-4">
                These instructions are sent to clients before their appointment. Edit them to match your practice&apos;s requirements.
              </p>
              <textarea
                value={beforeText}
                onChange={e => setBeforeText(e.target.value)}
                rows={10}
                placeholder={"Come with a clean face — no makeup\nAvoid alcohol 24 hours before your appointment\nAvoid blood thinners and ibuprofen for 24 hours\nStay hydrated — drink plenty of water\nArrive 10 minutes early"}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition"
              />
              <p className="mt-2 text-xs text-slate-400">One instruction per line. These are used when you send a prep guide from the Client Hub.</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveField("pre_appointment_instructions", beforeText)}
                className="mt-4 rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save instructions"}
              </button>
            </div>
          </div>
        )}

        {/* ── Aftercare Email Tab ────────────────────────────────────────── */}
        {tab === "aftercare" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-[#1a2744] mb-1">💌 Aftercare email template</h2>
              <p className="text-sm text-slate-500 mb-4">
                Customise the aftercare message sent to clients after their appointment. Use placeholders like <code className="bg-slate-100 px-1 rounded text-xs">[client_name]</code> and <code className="bg-slate-100 px-1 rounded text-xs">[procedure]</code>.
              </p>
              <textarea
                value={aftercareText}
                onChange={e => setAftercareText(e.target.value)}
                rows={12}
                placeholder={"Hi [client_name],\n\nThank you so much for coming in today for your [procedure]! Here are your aftercare instructions...\n\nWith love,\n[practice_name]"}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition"
              />
              <p className="mt-2 text-xs text-slate-400">This template will be used as the base for automated aftercare emails.</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveField("aftercare_template", aftercareText)}
                className="mt-4 rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save template"}
              </button>
            </div>
          </div>
        )}

        {/* ── Follow-up Tab ──────────────────────────────────────────────── */}
        {tab === "followup" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-[#1a2744] mb-1">🔁 Follow-up message template</h2>
              <p className="text-sm text-slate-500 mb-4">
                This message is sent to clients as a rebooking reminder or check-in. Personalise it to fit your tone.
              </p>
              <textarea
                value={followupText}
                onChange={e => setFollowupText(e.target.value)}
                rows={12}
                placeholder={"Hi [client_name],\n\nIt's been a while since your last visit — just wanted to check in and see how you're glowing! 💙\n\nIt might be time to refresh your [procedure]. Book your next appointment here: [booking_link]\n\nWith love,\n[practice_name]"}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition"
              />
              <p className="mt-2 text-xs text-slate-400">Used for automated rebooking reminders.</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveField("followup_template", followupText)}
                className="mt-4 rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save template"}
              </button>
            </div>
          </div>
        )}

        {/* ── Client Charts Tab ──────────────────────────────────────────── */}
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
              const isExpanded = expandedClientKeys.has(key);
              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* Client header */}
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
                        {clientTreatments.length} treatment{clientTreatments.length !== 1 ? "s" : ""}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>

                  {/* Treatment history */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
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
                              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">✅ Aftercare sent</span>
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
