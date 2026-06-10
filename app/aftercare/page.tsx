"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Procedure = {
  id: string;
  name: string;
  aftercare_instructions: string;
  reminder_days: number;
  created_at: string;
};

type Treatment = {
  id: string;
  procedure_name: string;
  treatment_date: string;
  aftercare_sent: boolean;
  notes: string;
  intakes: { first_name: string; email: string; phone: string; service_interested: string } | null;
};

type Intake = {
  id: string;
  first_name: string;
  email: string;
  phone: string;
  service_interested: string;
};

const DEFAULT_PROCEDURES = [
  { name: "Lip Filler", aftercare_instructions: "Avoid touching or pressing your lips for 24 hours.\nApply ice wrapped in a cloth to reduce swelling — 10 minutes on, 10 minutes off.\nStay hydrated and avoid salty foods.\nAvoid strenuous exercise for 24-48 hours.\nSleep on your back with your head elevated.\nAvoid alcohol for 24 hours.\nAvoid extreme heat (saunas, hot yoga) for 2 weeks.\nDo not massage the area unless instructed.\nResults settle in 2 weeks — follow up if concerned.", reminder_days: 180 },
  { name: "Botox / Neuromodulator", aftercare_instructions: "Do not touch, rub, or massage the treated area for 4 hours.\nStay upright for 4 hours after treatment.\nAvoid strenuous exercise for 24 hours.\nAvoid alcohol for 24 hours.\nAvoid extreme heat for 24 hours.\nDo not lie face down for 4 hours.\nResults appear in 3-14 days — full effect at 2 weeks.\nFollow up in 2 weeks if needed.", reminder_days: 90 },
  { name: "Cheek Filler", aftercare_instructions: "Avoid touching the treated area for 6 hours.\nApply ice gently to reduce swelling.\nAvoid strenuous exercise for 24-48 hours.\nSleep elevated for the first night.\nAvoid alcohol and blood thinners for 24 hours.\nAvoid extreme heat for 2 weeks.\nResults settle fully in 2-4 weeks.", reminder_days: 180 },
  { name: "PRP / Biostimulator", aftercare_instructions: "Keep the area clean and dry for 24 hours.\nAvoid makeup for 24 hours.\nDo not exercise strenuously for 24 hours.\nAvoid direct sun exposure for 1 week.\nUse SPF 30+ daily.\nExpect some redness and swelling for 1-3 days — this is normal.\nResults improve over 4-6 weeks.", reminder_days: 120 },
  { name: "Skin Booster", aftercare_instructions: "Avoid touching the area for 6 hours.\nStay hydrated — drink plenty of water.\nAvoid makeup for 12 hours.\nAvoid strenuous exercise for 24 hours.\nExpect small bumps to resolve within 24-48 hours.\nUse gentle skincare for 48 hours.\nGlow check-in in 4 weeks!", reminder_days: 28 },
];

export default function AftercarePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<"procedures" | "treatments" | "emergency">("procedures");
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [editingProcedure, setEditingProcedure] = useState<Partial<Procedure> | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTreatment, setNewTreatment] = useState({ intake_id: "", procedure_id: "", procedure_name: "", treatment_date: new Date().toISOString().slice(0, 10), notes: "" });
  const [addingTreatment, setAddingTreatment] = useState(false);
  const [treatmentSaving, setTreatmentSaving] = useState(false);
  const [emergencyKeywords, setEmergencyKeywords] = useState<{ id: string; keyword: string }[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordSaving, setKeywordSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) { router.replace("/auth"); return; }
      const t = data.session.access_token;
      setToken(t);

      const [procRes, treatRes, intakeRes, kwRes] = await Promise.all([
        fetch("/api/procedures", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/treatments", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/intakes", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/emergency-keywords", { headers: { Authorization: `Bearer ${t}` } }),
      ]);

      if (!cancelled) {
        if (procRes.ok) { const j = await procRes.json(); setProcedures(j.procedures ?? []); }
        if (treatRes.ok) { const j = await treatRes.json(); setTreatments(j.treatments ?? []); }
        if (intakeRes.ok) { const j = await intakeRes.json(); setIntakes(j.intakes ?? []); }
        if (kwRes.ok) { const j = await kwRes.json(); setEmergencyKeywords(j.keywords ?? []); }
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleSeedDefaults = useCallback(async () => {
    setSaving(true);
    for (const p of DEFAULT_PROCEDURES) {
      const res = await fetch("/api/procedures", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(p),
      });
      if (res.ok) {
        const j = await res.json();
        setProcedures(prev => [j.procedure, ...prev]);
      }
    }
    setSaving(false);
    setSuccessMsg("Default procedures added! Edit them to customize your aftercare instructions.");
    setTimeout(() => setSuccessMsg(""), 4000);
  }, [token]);

  const handleSaveProcedure = useCallback(async () => {
    if (!editingProcedure?.name?.trim()) return;
    setSaving(true);
    const res = await fetch("/api/procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(editingProcedure),
    });
    if (res.ok) {
      const j = await res.json();
      setProcedures(prev => {
        const exists = prev.find(p => p.id === j.procedure.id);
        return exists ? prev.map(p => p.id === j.procedure.id ? j.procedure : p) : [j.procedure, ...prev];
      });
      setEditingProcedure(null);
      setSuccessMsg("Procedure saved!");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
    setSaving(false);
  }, [editingProcedure, token]);

  const handleDeleteProcedure = useCallback(async (id: string) => {
    await fetch("/api/procedures", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    setProcedures(prev => prev.filter(p => p.id !== id));
  }, [token]);

  const handleLogTreatment = useCallback(async () => {
    if (!newTreatment.intake_id || !newTreatment.procedure_id) return;
    setTreatmentSaving(true);
    const selectedProcedure = procedures.find(p => p.id === newTreatment.procedure_id);
    const res = await fetch("/api/treatments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...newTreatment, procedure_name: selectedProcedure?.name || newTreatment.procedure_name }),
    });
    if (res.ok) {
      const j = await res.json();
      setTreatments(prev => [j.treatment, ...prev]);
      setNewTreatment({ intake_id: "", procedure_id: "", procedure_name: "", treatment_date: new Date().toISOString().slice(0, 10), notes: "" });
      setAddingTreatment(false);
      setSuccessMsg(j.aftercare_sent ? "Treatment logged and aftercare email sent! 💙" : "Treatment logged! No aftercare email sent (client email or aftercare instructions missing).");
      setTimeout(() => setSuccessMsg(""), 5000);
    }
    setTreatmentSaving(false);
  }, [newTreatment, procedures, token]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading aftercare dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-[#1a2744]">Aftercare Dashboard 🩹</h1>
              <p className="text-xs text-slate-500">Procedure-specific aftercare for every client</p>
            </div>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {successMsg && (
          <div className="mb-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700">
            ✅ {successMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button type="button" onClick={() => setTab("procedures")} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "procedures" ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            📋 My Procedures ({procedures.length})
          </button>
          <button type="button" onClick={() => setTab("treatments")} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "treatments" ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            💉 Treatment Log ({treatments.length})
          </button>
          <button type="button" onClick={() => setTab("emergency")} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "emergency" ? "bg-red-500 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            ⚠️ Emergency Keywords
          </button>
        </div>

        {/* Procedures Tab */}
        {tab === "procedures" && (
          <div className="space-y-4">
            {procedures.length === 0 && !editingProcedure && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-4xl mb-3">🩹</p>
                <p className="font-bold text-[#1a2744]">No procedures yet</p>
                <p className="mt-1 text-sm text-slate-500">Add your procedures and aftercare instructions so clients get the right info every time.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button type="button" onClick={() => void handleSeedDefaults()} disabled={saving} className="rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50">
                    {saving ? "Adding…" : "✨ Add default procedures"}
                  </button>
                  <button type="button" onClick={() => setEditingProcedure({ name: "", aftercare_instructions: "", reminder_days: 180 })} className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-[#1a2744] transition hover:bg-slate-50">
                    + Add custom procedure
                  </button>
                </div>
              </div>
            )}

            {procedures.length > 0 && (
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingProcedure({ name: "", aftercare_instructions: "", reminder_days: 180 })} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50">
                  + Add procedure
                </button>
              </div>
            )}

            {editingProcedure && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
                <h3 className="mb-4 text-base font-bold text-[#1a2744]">{editingProcedure.id ? "Edit procedure" : "New procedure"}</h3>
                <div className="space-y-3">
                  <input value={editingProcedure.name ?? ""} onChange={e => setEditingProcedure(p => ({ ...p, name: e.target.value }))} placeholder="Procedure name (e.g. Lip Filler)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                  <textarea value={editingProcedure.aftercare_instructions ?? ""} onChange={e => setEditingProcedure(p => ({ ...p, aftercare_instructions: e.target.value }))} placeholder="Aftercare instructions — write exactly what you want your client to receive in their email…" rows={8} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-slate-600">Reminder after (days):</label>
                    <input type="number" value={editingProcedure.reminder_days ?? 180} onChange={e => setEditingProcedure(p => ({ ...p, reminder_days: parseInt(e.target.value) }))} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                    <span className="text-xs text-slate-400">e.g. 90 for Botox, 180 for filler</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={saving} onClick={() => void handleSaveProcedure()} className="rounded-full bg-[#0d9488] px-6 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50">
                      {saving ? "Saving…" : "Save procedure"}
                    </button>
                    <button type="button" onClick={() => setEditingProcedure(null)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {procedures.map(procedure => (
              <div key={procedure.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-[#1a2744]">{procedure.name}</h3>
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">Reminder: {procedure.reminder_days} days</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap line-clamp-3">{procedure.aftercare_instructions || "No aftercare instructions yet."}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setEditingProcedure(procedure)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Edit</button>
                    <button type="button" onClick={() => void handleDeleteProcedure(procedure.id)} className="rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Treatments Tab */}
        {tab === "treatments" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button type="button" onClick={() => setAddingTreatment(true)} className="rounded-full bg-[#0d9488] px-5 py-2 text-sm font-bold text-white transition hover:bg-teal-700">
                + Log a treatment
              </button>
            </div>

            {addingTreatment && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
                <h3 className="mb-4 text-base font-bold text-[#1a2744]">Log a treatment 💉</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Select client</label>
                    <select value={newTreatment.intake_id} onChange={e => setNewTreatment(p => ({ ...p, intake_id: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]">
                      <option value="">Choose a client…</option>
                      {intakes.map(i => (
                        <option key={i.id} value={i.id}>{i.first_name} — {i.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Select procedure</label>
                    <select value={newTreatment.procedure_id} onChange={e => { const p = procedures.find(p => p.id === e.target.value); setNewTreatment(prev => ({ ...prev, procedure_id: e.target.value, procedure_name: p?.name || "" })); }} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]">
                      <option value="">Choose a procedure…</option>
                      {procedures.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Treatment date</label>
                    <input type="date" value={newTreatment.treatment_date} onChange={e => setNewTreatment(p => ({ ...p, treatment_date: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Notes (optional)</label>
                    <textarea value={newTreatment.notes} onChange={e => setNewTreatment(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. 0.5ml lip filler, 1 syringe Juvederm Ultra" rows={3} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">💡 Logging this treatment will automatically send the aftercare email to the client if they have an email address on file.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={treatmentSaving || !newTreatment.intake_id || !newTreatment.procedure_id} onClick={() => void handleLogTreatment()} className="rounded-full bg-[#0d9488] px-6 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50">
                      {treatmentSaving ? "Saving…" : "Log treatment & send aftercare 💙"}
                    </button>
                    <button type="button" onClick={() => setAddingTreatment(false)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {treatments.length === 0 && !addingTreatment && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-4xl mb-3">💉</p>
                <p className="font-bold text-[#1a2744]">No treatments logged yet</p>
                <p className="mt-1 text-sm text-slate-500">Log a treatment to automatically send the right aftercare to your client.</p>
              </div>
            )}

            {treatments.map(treatment => (
              <div key={treatment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-[#1a2744]">{treatment.intakes?.first_name ?? "Client"}</p>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{treatment.procedure_name}</span>
                      {treatment.aftercare_sent ? (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">✅ Aftercare sent</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">⏳ No aftercare sent</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{treatment.intakes?.email} · {new Date(treatment.treatment_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                    {treatment.notes && <p className="mt-1 text-xs text-slate-600 italic">{treatment.notes}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Emergency Keywords Tab */}
        {tab === "emergency" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
              <h3 className="text-base font-bold text-red-700 mb-2">⚠️ Emergency Keywords</h3>
              <p className="text-sm text-red-600 leading-relaxed">When a client mentions any of these words in their recovery chat, you will receive an immediate email alert so you can reach out right away.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Built-in emergency keywords (always active)</p>
              <div className="flex flex-wrap gap-2">
                {["purple", "blue lips", "can't breathe", "severe pain", "fever", "infection", "allergic", "emergency", "911", "necrosis", "vascular", "blindness"].map(kw => (
                  <span key={kw} className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-600">{kw}</span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Your custom keywords</p>
              <div className="flex gap-2 mb-4">
                <input
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  placeholder="Add a keyword e.g. swelling getting worse"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]"
                  onKeyDown={e => { if (e.key === "Enter") void (async () => {
                    if (!newKeyword.trim()) return;
                    setKeywordSaving(true);
                    const res = await fetch("/api/emergency-keywords", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ keyword: newKeyword.trim() }),
                    });
                    if (res.ok) {
                      const j = await res.json();
                      setEmergencyKeywords(prev => [...prev, j.keyword]);
                      setNewKeyword("");
                    }
                    setKeywordSaving(false);
                  })(); }}
                />
                <button
                  type="button"
                  disabled={keywordSaving || !newKeyword.trim()}
                  onClick={() => void (async () => {
                    if (!newKeyword.trim()) return;
                    setKeywordSaving(true);
                    const res = await fetch("/api/emergency-keywords", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ keyword: newKeyword.trim() }),
                    });
                    if (res.ok) {
                      const j = await res.json();
                      setEmergencyKeywords(prev => [...prev, j.keyword]);
                      setNewKeyword("");
                    }
                    setKeywordSaving(false);
                  })()}
                  className="rounded-full bg-[#0d9488] px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {emergencyKeywords.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No custom keywords yet — add words specific to your procedures.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {emergencyKeywords.map(kw => (
                    <div key={kw.id} className="flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-3 py-1">
                      <span className="text-xs font-semibold text-orange-700">{kw.keyword}</span>
                      <button type="button" onClick={() => void (async () => {
                        await fetch("/api/emergency-keywords", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ id: kw.id }),
                        });
                        setEmergencyKeywords(prev => prev.filter(k => k.id !== kw.id));
                      })()} className="ml-1 text-orange-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
