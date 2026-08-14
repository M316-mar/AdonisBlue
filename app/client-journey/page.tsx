"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ─── Seed data ────────────────────────────────────────────────────────────────

const DEFAULT_PROCEDURES = [
  { name: "Lip Filler", reminder_days: 180, aftercare_instructions: "You did great today. Lips swell more than anywhere else, so here's what's coming and what to do about it.\n\nToday and tomorrow\nUse a cold compress — 15 minutes on, then a break. Always wrap it in a clean cloth, never ice directly on your lips. Sleep with your head slightly elevated tonight if you can.\nHands off. Don't press or massage, and if you feel a small lump, don't try to work it out yourself — message me and I'll look at it.\n\nFor the next 24 hours\nNo hot showers, saunas, steam rooms, or hot tubs — lukewarm only\nNo hard workouts; a walk is fine\nSkip alcohol\nSkip makeup and lipstick for the first 12 hours\nDrink water and go easy on salty food, it helps the swelling\n\nFor the next 2 weeks\nNo facials, peels, laser, or facial massage. Reschedule routine dental work if you can.\n\nWhat's normal\nReal swelling. Your lips will look bigger than the final result — that's expected, and it peaks around 24 to 48 hours before it starts coming down. Bruising, tenderness, and small lumps you can feel are all normal early on. Give it two full weeks before you judge the result, and don't panic on day two. Everyone does, and everyone's fine.\n\nCall me right away if\nThe skin on or around your lips turns white, pale, or blotchy\nThe pain is severe and getting worse instead of better\nYou see any change in your vision\nYou notice increasing redness, warmth, or a fever\n\n[YOUR PHONE] — call me any time, including nights and weekends. These are rare, but I want to hear about them immediately, not tomorrow.\n\nYour healing chat below is open 24/7 too. If something feels off and you're not sure, ask. That's what it's for.\n\n— [YOUR NAME]" },
  { name: "Botox / Neuromodulator", reminder_days: 90, aftercare_instructions: "Thank you for coming in today. Here's everything you need for the next couple of days — nothing complicated, just the things that actually matter.\n\nFor the next 4 hours\nStay upright. Sitting, standing, walking, driving — all fine. Just no lying flat, no naps, and nothing that puts your head below your heart for long stretches (think downward dog or leaning way over a laptop).\nDon't rub, press, or massage the treated areas. If you're putting makeup back on, be gentle.\n\nFor the next 24 hours\nSkip the gym, running, and anything that gets your heart rate up\nSkip alcohol — it can make bruising worse\nAvoid ibuprofen, aspirin, fish oil, and vitamin E if you can, for the same reason\nKeep hats, headbands, and goggles off your forehead\n\nFor the next 48 hours\nNo saunas, steam rooms, hot tubs, or hot yoga. Keep showers lukewarm.\n\nFor the next 2 weeks\nHold off on facials, peels, microneedling, and facial massage.\n\nWhat's normal\nSmall bumps right after that settle within a few hours. Mild redness or a little bruising at the injection points. You'll start seeing results around day 3 to 5, and the full effect lands around day 10 to 14. If it looks uneven at day 5, that's usually just it settling — give it the full two weeks.\n\nCall me if\nYou have any change in your vision, or pain around your eyes\nYou have trouble breathing or swallowing\nYou notice drooping of an eyelid or eyebrow\nAnything feels wrong and you want a real answer\n\n[YOUR PHONE] — text or call, I'd genuinely rather hear from you than have you sitting at home wondering.\n\nYou can also reply right here in your healing chat any time, day or night, and you'll get an answer.\n\n— [YOUR NAME]" },
  { name: "Cheek Filler", reminder_days: 270, aftercare_instructions: "Thanks for trusting me with this today. Here's what to do over the next couple of days.\n\nToday and tomorrow\nCool compress if you're swollen — 15 minutes at a time, wrapped in a cloth, never ice directly on skin. Try to sleep on your back tonight so you're not pressing your cheeks into the pillow.\nDon't massage or press the treated areas. If you feel a firm spot, leave it alone and tell me about it.\n\nFor the next 24 hours\nKeep showers and baths lukewarm — no saunas, steam, or hot tubs\nNo strenuous exercise; light walking is fine\nSkip alcohol\nHold off on makeup for the first 12 hours\n\nFor the next 2 weeks\nNo facials, chemical peels, microdermabrasion, laser, or facial massage. If you have dental work scheduled, push it out if you can.\n\nWhat's normal\nSwelling that peaks around 24 to 48 hours, some bruising, and a firm or slightly uneven feel early on. Cheeks often look fuller than the final result for the first week. Two weeks is when you'll see what you actually paid for.\n\nCall me right away if\nThe skin looks white, pale, blotchy, or dusky\nThe pain is severe or getting worse\nYou have any vision changes or eye pain\nYou see spreading redness, warmth, pus, or you're running a fever\n\n[YOUR PHONE] — any hour. Don't wait until morning.\n\nOr just reply in your healing chat and I'll get back to you.\n\n— [YOUR NAME]" },
  { name: "Nose Filler", reminder_days: 270, aftercare_instructions: "Nose filler is beautiful work but it's the area I watch most closely, so please read this whole thing.\n\nToday and tomorrow\nNothing touches your nose. No pressing, no massaging, no picking at it. Sleep on your back with your head elevated.\nIf you wear glasses or sunglasses, keep them off your nose for at least 48 hours — ask me about taping them up if you need them for work.\nCool compress nearby, not directly on the bridge, 15 minutes at a time with a cloth barrier.\n\nFor the next 24 to 48 hours\nNo hot showers, saunas, steam, or hot tubs\nNo exercise\nSkip alcohol\nNo makeup on the area for the first 12 hours\n\nFor the next 2 weeks\nNo facials, peels, laser, or massage anywhere near the area. No other injectables in the same region until we've talked.\n\nWhat's normal\nMild swelling, tenderness, and small bruises. The shape settles over about two weeks.\n\nStop and call me immediately if\nThe skin on your nose or between your eyes turns white, pale, or grey\nYou have blurred vision, double vision, or any pain behind your eyes\nThe pain is severe or getting noticeably worse\nThe skin looks mottled or develops a dusky, bruise-like pattern that keeps spreading\n\n[YOUR PHONE] — call, don't text, and call at any hour. If you can't reach me and you have vision changes, go to the emergency room. I will never be annoyed that you called. I would be devastated if you waited.\n\nYour healing chat is also open 24/7 for anything that doesn't feel urgent.\n\n— [YOUR NAME]" },
  { name: "Skin Booster", reminder_days: 28, aftercare_instructions: "Easy one — skin boosters have the gentlest recovery of anything I do. Here's the short version.\n\nToday\nYou'll likely have small raised bumps where the product went in. They're normal and usually settle within 24 to 48 hours. Don't massage them unless I specifically told you to.\nKeep the area clean, skip makeup for the first 12 hours, and use a cool compress if you feel puffy.\n\nFor the next 24 hours\nNo strenuous exercise or heavy sweating\nNo saunas, steam rooms, or hot tubs\nSkip alcohol\nLukewarm water only when you wash your face\n\nFor the next 3 to 5 days\nPause retinol, exfoliating acids, and scrubs. Go gentle with your skincare and wear SPF 30 or higher — your skin's a little more sensitive right now.\n\nFor the next 2 weeks\nNo facials, peels, microneedling, or laser.\n\nWhat's normal\nSmall bumps, mild redness, occasional pinpoint bruising. Hydration and glow build gradually — most people see the real difference around week 2 to 4, and it keeps improving if we do the full series.\n\nCall me if\nRedness, warmth, or swelling gets worse after day 2 instead of better\nYou develop pus, or a fever\nAny bump is painful rather than just visible\nAnything at all feels wrong\n\n[YOUR PHONE], or reply in your healing chat below any time.\n\n— [YOUR NAME]" },
];

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_BEFORE = `Please arrive with a clean face — no makeup, moisturiser, or SPF.
Avoid alcohol for 24 hours before your appointment.
Avoid blood thinners, aspirin, and ibuprofen for 24 hours.
Stay hydrated — drink plenty of water in the days leading up.
Arrive 5–10 minutes early so we can get started on time.`;

const DEFAULT_FOLLOWUP = `Hi [Client Name],

I just wanted to check in and see how you're glowing since your last visit! 💕

If you're ready to maintain your results or try something new, I'd love to see you again. You can book your next appointment here: [booking link]

As always, don't hesitate to reach out if you have any questions.

With love,
[practice_name]`;

// ─── Types ────────────────────────────────────────────────────────────────────

type Procedure = {
  id: string;
  name: string;
  aftercare_instructions: string;
  reminder_days: number;
  created_at: string;
  approved_at: string | null;
};

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
    service_interested?: string;
  } | null;
};

type Intake = {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  phone: string;
  service_interested: string;
  came_via_bot?: boolean;
  created_at: string;
};

type Bot = {
  pre_appointment_instructions: string | null;
  followup_template: string | null;
  webhook_secret: string | null;
};

type Incident = {
  id: string;
  source: "healing" | "chatbot";
  client_name: string | null;
  client_phone: string | null;
  flagged_message: string | null;
  status: string;
  nurse_notes: string | null;
  timestamp: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function intakesForProcedure(intakes: Intake[], procedureName: string): Intake[] {
  const needle = procedureName.toLowerCase();
  return intakes.filter(i =>
    i.service_interested?.toLowerCase().includes(needle) ||
    needle.includes((i.service_interested ?? "").toLowerCase().split(" ")[0])
  );
}

function treatmentsForProcedure(treatments: Treatment[], procedure: Procedure): Treatment[] {
  return treatments.filter(
    t => t.procedure_name?.toLowerCase().includes(procedure.name.toLowerCase())
  );
}

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
  const display = text.trim() || "Your aftercare instructions will appear here.";
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
  const [tab, setTab] = useState<"charts" | "before" | "aftercare" | "followup" | "emergency" | "alerts">("charts");
  const [showPreview, setShowPreview] = useState(false);

  // Bot templates
  const [beforeText, setBeforeText] = useState("");
  const [followupText, setFollowupText] = useState("");
  const [saving, setSaving] = useState(false);
  const [botConnected, setBotConnected] = useState(false);

  // Client charts
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [expandedClientKeys, setExpandedClientKeys] = useState<Set<string>>(new Set());

  // Intakes (for Procedures Clients sub-tab)
  const [intakes, setIntakes] = useState<Intake[]>([]);

  // ── Procedure state ────────────────────────────────────────────────────────
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [editingProcedure, setEditingProcedure] = useState<Partial<Procedure> | null>(null);
  const [procedureSaving, setProcedureSaving] = useState(false);
  const [expandedProcedureId, setExpandedProcedureId] = useState<string | null>(null);
  const [procedureSubTab, setProcedureSubTab] = useState<"aftercare" | "clients" | "followup">("aftercare");
  const [procedurePreviewOpen, setProcedurePreviewOpen] = useState(false);

  // Clients sub-tab state (within Procedures)
  const [addingClient, setAddingClient] = useState(false);
  const [newClient, setNewClient] = useState({ first_name: "", email: "", phone: "" });
  const [clientSaving, setClientSaving] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [addProcedureDropdownKey, setAddProcedureDropdownKey] = useState<string | null>(null);
  const [addProcedureLoadingKey, setAddProcedureLoadingKey] = useState<string | null>(null);

  // Follow-up sub-tab state (within Procedures)
  const [selectedFollowupIds, setSelectedFollowupIds] = useState<Set<string>>(new Set());
  const [bulkFollowupSending, setBulkFollowupSending] = useState(false);

  // ── Incident feed state ────────────────────────────────────────────────────
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentsAccidental, setIncidentsAccidental] = useState<Incident[]>([]);
  const [incidentView, setIncidentView] = useState<"active" | "accidental">("active");
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState<Record<string, boolean>>({});
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});
  const [noteSaving, setNoteSaving] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [incidentActionLoading, setIncidentActionLoading] = useState<Record<string, boolean>>({});

  // Emergency keywords state
  const [emergencyKeywords, setEmergencyKeywords] = useState<{ id: string; keyword: string }[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordSaving, setKeywordSaving] = useState(false);

  // Alert settings state
  const [alertEmail, setAlertEmail] = useState("");
  const [alertPhone, setAlertPhone] = useState("");
  const [alertSaving, setAlertSaving] = useState(false);

  // Per-session send tracking
  const [prepSending, setPrepSending] = useState<string | null>(null);
  const [prepSentIds, setPrepSentIds] = useState<Set<string>>(new Set());
  const [aftercareSending, setAftercareSending] = useState<string | null>(null);
  const [aftercareSentIds, setAftercareSentIds] = useState<Set<string>>(new Set());
  const [followupSending, setFollowupSending] = useState<string | null>(null);
  const [followupSentIds, setFollowupSentIds] = useState<Set<string>>(new Set());

  // Review request
  const [reviewClientId, setReviewClientId] = useState("");
  const [reviewSending, setReviewSending] = useState(false);

  const [successMsg, setSuccessMsg] = useState("");
  function flash(msg: string, ms = 3500) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), ms);
  }

  // ── Load incidents ─────────────────────────────────────────────────────────
  const loadIncidents = useCallback(async (t: string) => {
    setIncidentLoading(true);
    try {
      const [activeRes, accidentalRes] = await Promise.all([
        fetch("/api/incidents?status=active", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/incidents?status=accidental", { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (activeRes.ok) { const j = await activeRes.json(); setIncidents(j.incidents ?? []); }
      if (accidentalRes.ok) { const j = await accidentalRes.json(); setIncidentsAccidental(j.incidents ?? []); }
    } finally {
      setIncidentLoading(false);
    }
  }, []);

  // ── Auth + load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) { router.replace("/auth"); return; }
      const t = data.session.access_token;
      setToken(t);

      const [botRes, treatRes, procRes, intakeRes, kwRes, alertRes] = await Promise.all([
        fetch("/api/mybot", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/treatments", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/procedures", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/intakes", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/emergency-keywords", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/alert-settings", { headers: { Authorization: `Bearer ${t}` } }),
      ]);

      if (!cancelled) {
        if (botRes.ok) {
          const j = await botRes.json();
          const b: Bot = j.bot ?? {};
          setBeforeText(b.pre_appointment_instructions ?? DEFAULT_BEFORE);
          setFollowupText(b.followup_template ?? DEFAULT_FOLLOWUP);
          setBotConnected(!!b.webhook_secret);
        }
        if (treatRes.ok) {
          const j = await treatRes.json();
          setTreatments((j.treatments ?? []).filter((t: Treatment) => !t.archived));
        }
        if (procRes.ok) { const j = await procRes.json(); setProcedures(j.procedures ?? []); }
        if (intakeRes.ok) { const j = await intakeRes.json(); setIntakes(j.intakes ?? []); }
        if (kwRes.ok) { const j = await kwRes.json(); setEmergencyKeywords(j.keywords ?? []); }
        if (alertRes.ok) {
          const j = await alertRes.json();
          setAlertEmail(j.alert_email ?? "");
          setAlertPhone(j.alert_phone ?? "");
        }
        void loadIncidents(t);
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router, loadIncidents]);

  // ── Save a bot field ────────────────────────────────────────────────────────
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

  // ── Procedure handlers ─────────────────────────────────────────────────────
  const handleSeedDefaults = useCallback(async () => {
    setProcedureSaving(true);
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
    setProcedureSaving(false);
    flash("Default procedures added! Edit them to customize your aftercare instructions.");
  }, [token]);

  const handleSaveProcedure = useCallback(async () => {
    if (!editingProcedure?.name?.trim()) return;
    if (!editingProcedure?.reminder_days) {
      flash("Please set a reminder interval (in days) before saving.");
      return;
    }
    setProcedureSaving(true);
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
      flash("Procedure saved!");
    }
    setProcedureSaving(false);
  }, [editingProcedure, token]);

  const handleDeleteProcedure = useCallback(async (id: string) => {
    await fetch("/api/procedures", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    setProcedures(prev => prev.filter(p => p.id !== id));
    if (expandedProcedureId === id) setExpandedProcedureId(null);
  }, [token, expandedProcedureId]);

  const handleAddClient = useCallback(async (procedureName: string) => {
    if (!newClient.first_name.trim()) return;
    setClientSaving(true);
    setClientError(null);
    const res = await fetch("/api/intakes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        first_name: newClient.first_name,
        email: newClient.email,
        phone: newClient.phone,
        service_interested: procedureName,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setIntakes(prev => [j.intake, ...prev]);
      setNewClient({ first_name: "", email: "", phone: "" });
      setAddingClient(false);
      flash("Client added!");
    } else {
      const j = await res.json().catch(() => ({}));
      setClientError(j.error ?? "Couldn't add this client. Please try again.");
    }
    setClientSaving(false);
  }, [newClient, token]);

  const handleAddToAnotherProcedure = useCallback(async (
    intake: Intake,
    targetProcedure: Procedure,
    dropdownKey: string,
  ) => {
    const loadingKey = `${dropdownKey}-${targetProcedure.id}`;
    setAddProcedureLoadingKey(loadingKey);
    const res = await fetch("/api/treatments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intake_id: intake.id,
        procedure_id: targetProcedure.id,
        procedure_ids: [targetProcedure.id],
        procedure_name: targetProcedure.name,
        treatment_date: new Date().toISOString().slice(0, 10),
        send_aftercare: true,
        came_via_bot: intake.came_via_bot ?? false,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setTreatments(prev => [j.treatment, ...prev]);
      setAddProcedureDropdownKey(null);
      flash(`Aftercare sent for ${targetProcedure.name}! ✅`);
    }
    setAddProcedureLoadingKey(null);
  }, [token]);

  const handleSendFollowup = useCallback(async () => {
    if (selectedFollowupIds.size === 0) return;
    setBulkFollowupSending(true);
    const res = await fetch("/api/send-followup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ treatment_ids: Array.from(selectedFollowupIds) }),
    });
    if (res.ok) {
      const j = await res.json();
      setSelectedFollowupIds(new Set());
      flash(`Follow-up sent to ${j.sent} client${j.sent !== 1 ? "s" : ""}! 💙`);
    }
    setBulkFollowupSending(false);
  }, [selectedFollowupIds, token]);

  // ── Keyword handlers ───────────────────────────────────────────────────────
  const handleAddKeyword = useCallback(async () => {
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
  }, [newKeyword, token]);

  const handleDeleteKeyword = useCallback(async (id: string) => {
    await fetch("/api/emergency-keywords", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    setEmergencyKeywords(prev => prev.filter(k => k.id !== id));
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

  // ── Client grouping ─────────────────────────────────────────────────────────
  const clientGroups = (() => {
    const groups = new Map<string, Treatment[]>();
    for (const t of treatments) {
      const key = t.intake_id ?? t.intakes?.email ?? `anon-${t.id}`;
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

  // Clients with email (for review request dropdown)
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

  const TABS_GROUP1 = [
    { id: "charts" as const,   label: "Clients",            emoji: "👤" },
    { id: "before" as const,   label: "Before Appointment", emoji: "📋" },
    { id: "aftercare" as const, label: "Aftercare Email",   emoji: "💌" },
    { id: "followup" as const, label: "Follow-up",          emoji: "🔁" },
  ];
  const TABS_GROUP2 = [
    { id: "emergency" as const, label: "Emergency Keywords", emoji: "🚨" },
    { id: "alerts" as const,    label: "Alerts to You",      emoji: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link href="/dashboard">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-[#1a2744] sm:text-base truncate">📋 Send Emails &amp; Alerts</h1>
            <p className="hidden text-xs text-slate-500 sm:block">Manage every client touchpoint and safety alert</p>
          </div>
          <Link href="/dashboard" className="shrink-0 text-sm font-semibold text-[#1a2744] hover:text-[#0d9488]">
            ← Dashboard
          </Link>
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
          {TABS_GROUP1.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setShowPreview(false); setProcedurePreviewOpen(false); }}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition whitespace-nowrap ${tab === t.id ? "bg-[#1a2744] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
          {/* Visual gap between groups */}
          <div className="w-3 shrink-0" />
          {TABS_GROUP2.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setShowPreview(false); setProcedurePreviewOpen(false); }}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition whitespace-nowrap ${tab === t.id ? (t.id === "emergency" ? "bg-red-500 text-white" : "bg-[#1a2744] text-white") : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
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
                <p className="mt-1 text-sm text-slate-500">Log a treatment to see client history here.</p>
                <Link
                  href="/aftercare"
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  Log a treatment →
                </Link>
              </div>
            )}
            {clientGroups.map(([key, clientTreatments]) => {
              const rep = clientTreatments[0];
              const clientName = rep.intakes?.first_name ?? "Walk-in Client";
              const clientEmail = rep.intakes?.email ?? "";
              const intakeId = rep.intake_id;
              const isExpanded = expandedClientKeys.has(key);
              const hasIntake = !!intakeId && !!clientEmail;

              const prepSent = (rep.intakes?.prep_guide_sent ?? false) || (intakeId ? prepSentIds.has(intakeId) : false);
              const aftercareSent = clientTreatments.some(t => t.aftercare_sent) || (intakeId ? aftercareSentIds.has(intakeId) : false);
              const followupSent = (rep.intakes?.followup_sent ?? false) || (intakeId ? followupSentIds.has(intakeId) : false);

              const mostRecentTreatment = clientTreatments.find(t => t.notes !== "Rebooked appointment") ?? clientTreatments[0];

              const upcomingRebooks = clientTreatments.filter(t =>
                t.notes === "Rebooked appointment" &&
                new Date(t.treatment_date).getTime() >= today.getTime()
              );

              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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

                  {isExpanded && (
                    <div className="border-t border-slate-100">
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

                      {hasIntake && (
                        <div className="px-5 py-4 border-b border-slate-100 space-y-3">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email status</p>

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

        {/* ── Aftercare Email Tab (Procedures) ──────────────────────────── */}
        {tab === "aftercare" && (
          <div className="space-y-4">
            {procedures.length === 0 && !editingProcedure && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-4xl mb-3">🩹</p>
                <p className="font-bold text-[#1a2744]">No procedures yet</p>
                <p className="mt-1 text-sm text-slate-500">Add your procedures and aftercare instructions so clients get the right info every time.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => void handleSeedDefaults()}
                    disabled={procedureSaving}
                    style={{ touchAction: "manipulation" }}
                    className="min-h-[48px] rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
                  >
                    {procedureSaving ? "Adding…" : "✨ Add default procedures"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProcedure({ name: "", aftercare_instructions: "", reminder_days: 0 })}
                    style={{ touchAction: "manipulation" }}
                    className="min-h-[48px] rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-[#1a2744] transition hover:bg-slate-50 active:scale-[0.97]"
                  >
                    + Add custom procedure
                  </button>
                </div>
              </div>
            )}

            {procedures.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditingProcedure({ name: "", aftercare_instructions: "", reminder_days: 0 })}
                  style={{ touchAction: "manipulation" }}
                  className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50 active:scale-[0.97]"
                >
                  + Add procedure
                </button>
              </div>
            )}

            {/* Edit / new procedure form */}
            {editingProcedure && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
                <h3 className="mb-4 text-base font-bold text-[#1a2744]">{editingProcedure.id ? "Edit procedure" : "New procedure"}</h3>
                <div className="space-y-3">
                  <input
                    value={editingProcedure.name ?? ""}
                    onChange={e => setEditingProcedure(p => ({ ...p, name: e.target.value }))}
                    placeholder="Procedure name (e.g. Lip Filler)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                  />
                  <textarea
                    value={editingProcedure.aftercare_instructions ?? ""}
                    onChange={e => setEditingProcedure(p => ({ ...p, aftercare_instructions: e.target.value, approved: false }))}
                    placeholder="Aftercare instructions — write exactly what you want your client to receive in their email…"
                    rows={8}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs font-semibold text-slate-600 shrink-0">Reminder after (days):</label>
                    <input
                      type="number"
                      value={editingProcedure.reminder_days || ""}
                      onChange={e => setEditingProcedure(p => ({ ...p, reminder_days: parseInt(e.target.value) || 0 }))}
                      placeholder="e.g. 90"
                      className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                    />
                    <span className="text-xs text-slate-400">Required — e.g. 90 for Botox, 180 for filler, 28 for skin boosters</span>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(editingProcedure as Partial<Procedure> & { approved?: boolean })?.approved}
                      onChange={e => setEditingProcedure(p => ({ ...p, approved: e.target.checked } as typeof p & { approved?: boolean }))}
                      disabled={!editingProcedure?.aftercare_instructions?.trim()}
                      className="mt-1 h-4 w-4 rounded"
                    />
                    <span className="text-sm leading-relaxed">
                      <span className="font-semibold text-slate-700">I&apos;ve reviewed this and it matches how I care for my clients.</span>
                      <br />
                      <span className="text-slate-500">This is what your client receives. We save the date you approved it.</span>
                    </span>
                  </label>
                  {/* Email preview toggle */}
                  {editingProcedure.aftercare_instructions?.trim() && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setProcedurePreviewOpen(p => !p)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        {procedurePreviewOpen ? "Hide preview" : "👁 Preview email"}
                      </button>
                      {procedurePreviewOpen && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email preview — what your client sees</p>
                          <AftercarePreview text={editingProcedure.aftercare_instructions ?? ""} />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={procedureSaving || !editingProcedure?.reminder_days}
                      onClick={() => void handleSaveProcedure()}
                      style={{ touchAction: "manipulation" }}
                      className="min-h-[44px] rounded-full bg-[#0d9488] px-6 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
                    >
                      {procedureSaving ? "Saving…" : "Save procedure"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingProcedure(null); setProcedurePreviewOpen(false); }}
                      style={{ touchAction: "manipulation" }}
                      className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 active:scale-[0.97]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Procedure cards */}
            {procedures.map(procedure => {
              const isExpanded = expandedProcedureId === procedure.id;
              const matchedIntakes = intakesForProcedure(intakes, procedure.name);
              const matchedTreatments = treatmentsForProcedure(treatments, procedure);

              return (
                <div key={procedure.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedProcedureId(isExpanded ? null : procedure.id);
                      if (!isExpanded) setProcedureSubTab("aftercare");
                      setAddingClient(false);
                      setAddProcedureDropdownKey(null);
                    }}
                    style={{ touchAction: "manipulation" }}
                    className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-slate-50 transition active:bg-slate-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[#1a2744]">{procedure.name}</h3>
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                          {procedure.reminder_days}d reminder
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          {matchedIntakes.length} client{matchedIntakes.length !== 1 ? "s" : ""}
                        </span>
                        {!procedure.aftercare_instructions?.trim() ? (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">Needs setup</span>
                        ) : !procedure.approved_at ? (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">Needs review</span>
                        ) : (
                          <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-semibold text-green-700">
                            Approved {new Date(procedure.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      {!isExpanded && (
                        <p className="mt-1.5 text-sm text-slate-500 line-clamp-2 leading-relaxed">
                          {procedure.aftercare_instructions || "No aftercare instructions yet."}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-slate-400 text-sm">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      <div className="flex border-b border-slate-100 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                        {(
                          [
                            { id: "aftercare", label: "📋 Aftercare" },
                            { id: "clients", label: `👥 Clients (${matchedIntakes.length})` },
                            { id: "followup", label: `📧 Follow-up (${matchedTreatments.length})` },
                          ] as const
                        ).map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => { setProcedureSubTab(st.id); setAddingClient(false); setAddProcedureDropdownKey(null); }}
                            style={{ touchAction: "manipulation" }}
                            className={`shrink-0 min-h-[44px] px-4 py-3 text-xs font-semibold border-b-2 transition ${
                              procedureSubTab === st.id
                                ? "border-[#0d9488] text-[#0d9488]"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                        <div className="flex items-center gap-2 ml-auto px-4 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setEditingProcedure({ ...procedure, approved: !!procedure.approved_at } as typeof procedure & { approved: boolean }); setExpandedProcedureId(null); }}
                            style={{ touchAction: "manipulation" }}
                            className="min-h-[36px] rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.97]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteProcedure(procedure.id)}
                            style={{ touchAction: "manipulation" }}
                            className="min-h-[36px] rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 active:scale-[0.97]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {procedureSubTab === "aftercare" && (
                        <div className="px-5 py-4">
                          {procedure.aftercare_instructions ? (
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {procedure.aftercare_instructions}
                            </p>
                          ) : (
                            <p className="text-sm text-slate-400 text-center py-4">No aftercare instructions yet.</p>
                          )}
                        </div>
                      )}

                      {procedureSubTab === "clients" && (
                        <div className="px-5 py-4 space-y-4">
                          {matchedIntakes.length === 0 && !addingClient && (
                            <p className="text-sm text-slate-400 text-center py-3">
                              No clients interested in {procedure.name} yet.
                            </p>
                          )}
                          {matchedIntakes.map(intake => {
                            const dropdownKey = `${procedure.id}-${intake.id}`;
                            const otherProcedures = procedures.filter(p => p.id !== procedure.id);
                            return (
                              <div key={intake.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-semibold text-[#1a2744] text-sm">{intake.first_name} {intake.last_name || ""}</p>
                                      {intake.came_via_bot && (
                                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-600">🤖 Via bot</span>
                                      )}
                                    </div>
                                    {intake.email && <p className="text-xs text-slate-500 mt-0.5">{intake.email}</p>}
                                    {intake.phone && <p className="text-xs text-slate-400">{intake.phone}</p>}
                                  </div>
                                  <p className="text-xs text-slate-400 shrink-0">
                                    {new Date(intake.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </p>
                                </div>
                                {otherProcedures.length > 0 && (
                                  <div className="relative mt-3">
                                    <button
                                      type="button"
                                      onClick={() => setAddProcedureDropdownKey(prev => prev === dropdownKey ? null : dropdownKey)}
                                      style={{ touchAction: "manipulation" }}
                                      className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                                    >
                                      + Add to another procedure
                                    </button>
                                    {addProcedureDropdownKey === dropdownKey && (
                                      <div className="absolute left-0 top-full z-10 mt-1 min-w-[220px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                        {otherProcedures.map(p => (
                                          <button
                                            key={p.id}
                                            type="button"
                                            disabled={addProcedureLoadingKey === `${dropdownKey}-${p.id}`}
                                            onClick={() => void handleAddToAnotherProcedure(intake, p, dropdownKey)}
                                            style={{ touchAction: "manipulation" }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-teal-50 disabled:opacity-50"
                                          >
                                            {addProcedureLoadingKey === `${dropdownKey}-${p.id}` ? "Sending…" : p.name}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {addingClient ? (
                            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3">
                              <p className="text-sm font-bold text-[#1a2744]">Add client manually</p>
                              <input
                                value={newClient.first_name}
                                onChange={e => setNewClient(p => ({ ...p, first_name: e.target.value }))}
                                placeholder="Full name *"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                              />
                              <input
                                type="email"
                                value={newClient.email}
                                onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))}
                                placeholder="Email (optional)"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                              />
                              <input
                                type="tel"
                                value={newClient.phone}
                                onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))}
                                placeholder="Phone (optional)"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                              />
                              {clientError && (
                                <p className="text-xs font-semibold text-red-600">{clientError}</p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={clientSaving || !newClient.first_name.trim()}
                                  onClick={() => void handleAddClient(procedure.name)}
                                  style={{ touchAction: "manipulation" }}
                                  className="min-h-[44px] flex-1 rounded-full bg-[#0d9488] px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
                                >
                                  {clientSaving ? "Saving…" : "Add client"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setAddingClient(false); setNewClient({ first_name: "", email: "", phone: "" }); setClientError(null); }}
                                  style={{ touchAction: "manipulation" }}
                                  className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 active:scale-[0.97]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAddingClient(true)}
                              style={{ touchAction: "manipulation" }}
                              className="w-full min-h-[44px] rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition hover:border-[#0d9488] hover:text-[#0d9488] active:scale-[0.97]"
                            >
                              + Add client manually
                            </button>
                          )}
                        </div>
                      )}

                      {procedureSubTab === "followup" && (
                        <div className="px-5 py-4 space-y-4">
                          {matchedTreatments.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-3">
                              No treatments logged for {procedure.name} yet.
                            </p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-xs text-slate-500">
                                  Toggle clients to include in the follow-up email.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allIds = matchedTreatments
                                      .filter(t => t.intakes?.email)
                                      .map(t => t.id);
                                    setSelectedFollowupIds(
                                      selectedFollowupIds.size === allIds.length
                                        ? new Set()
                                        : new Set(allIds)
                                    );
                                  }}
                                  style={{ touchAction: "manipulation" }}
                                  className="min-h-[36px] rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.97]"
                                >
                                  {selectedFollowupIds.size === matchedTreatments.filter(t => t.intakes?.email).length
                                    ? "Deselect all"
                                    : "Select all"}
                                </button>
                              </div>

                              <div className="space-y-2">
                                {matchedTreatments.map(t => {
                                  const hasEmail = Boolean(t.intakes?.email);
                                  const isSelected = selectedFollowupIds.has(t.id);
                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      disabled={!hasEmail}
                                      onClick={() => {
                                        if (!hasEmail) return;
                                        setSelectedFollowupIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(t.id)) next.delete(t.id);
                                          else next.add(t.id);
                                          return next;
                                        });
                                      }}
                                      style={{ touchAction: "manipulation" }}
                                      className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                                        isSelected
                                          ? "border-[#0d9488] bg-teal-50"
                                          : "border-slate-100 bg-slate-50 hover:border-slate-200"
                                      } ${!hasEmail ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"}`}
                                    >
                                      <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-[#1a2744] text-sm">
                                              {t.intakes?.first_name ?? "Client"}
                                            </p>
                                            {t.came_via_bot && (
                                              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-600">🤖 Via bot</span>
                                            )}
                                            {!hasEmail && (
                                              <span className="text-xs text-slate-400">(no email)</span>
                                            )}
                                          </div>
                                          <p className="text-xs text-slate-500 mt-0.5">
                                            {t.intakes?.email} · {new Date(t.treatment_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                          </p>
                                        </div>
                                        {hasEmail && (
                                          <div className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-[#0d9488] bg-[#0d9488]" : "border-slate-300"}`}>
                                            {isSelected && <span className="text-white text-xs">✓</span>}
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {selectedFollowupIds.size > 0 && (
                                <button
                                  type="button"
                                  disabled={bulkFollowupSending}
                                  onClick={() => void handleSendFollowup()}
                                  style={{ touchAction: "manipulation" }}
                                  className="w-full min-h-[48px] rounded-full bg-[#0d9488] px-6 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
                                >
                                  {bulkFollowupSending
                                    ? "Sending…"
                                    : `📧 Send follow-up to ${selectedFollowupIds.size} client${selectedFollowupIds.size !== 1 ? "s" : ""}`}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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

            {/* Review request */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-[#1a2744] mb-1">⭐ Request a review</h2>
                <p className="text-sm text-slate-500">Pick a client and send them a review request right now.</p>
              </div>
              {clientsWithEmail.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No clients with email addresses found. Log a treatment first.</p>
              ) : (
                <select
                  value={reviewClientId}
                  onChange={e => setReviewClientId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition"
                >
                  <option value="">— Select a client —</option>
                  {clientsWithEmail.map(c => (
                    <option key={c.intakeId} value={c.intakeId}>{c.name}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={reviewSending || !reviewClientId}
                onClick={async () => {
                  setReviewSending(true);
                  try {
                    await fetch("/api/send-survey", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ intake_id: reviewClientId }),
                    });
                    flash("⭐ Review request sent!");
                    setReviewClientId("");
                  } finally {
                    setReviewSending(false);
                  }
                }}
                className="w-full rounded-full bg-[#1a2744] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0d9488] disabled:opacity-50"
              >
                {reviewSending ? "Sending…" : "⭐ Send review request"}
              </button>
            </div>
          </div>
        )}

        {/* ── Emergency Keywords Tab ─────────────────────────────────────── */}
        {tab === "emergency" && (
          <div className="space-y-4">

            {!alertEmail && (
              <div className="rounded-2xl border-2 border-red-500 bg-red-100 px-5 py-4 text-sm text-red-900 shadow-md">
                <p className="font-bold mb-1">⚠️ No alert address set — you will not be notified.</p>
                <p className="leading-relaxed">
                  Emergency keywords typed by a client will NOT reach you until you add an alert email.{" "}
                  <button type="button" onClick={() => setTab("alerts")} className="underline font-bold hover:text-red-950">Add one now in the Alerts tab →</button>
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
              <p className="font-semibold mb-1">🚨 How emergency monitoring works</p>
              <p className="leading-relaxed">Emergency keywords are monitored in your healing chat and AI assistant. When a client types any of the keywords below, you will be immediately notified by email at your alert address. Make sure your alert email is set in the <button type="button" onClick={() => setTab("alerts")} className="underline font-semibold hover:text-red-900">Alerts tab</button>.</p>
            </div>

            {/* Incident Feed */}
            <div className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between bg-red-50 px-5 py-4 border-b border-red-100">
                <div>
                  <h3 className="text-base font-bold text-red-700">🚨 Flagged Incidents</h3>
                  <p className="text-xs text-red-500 mt-0.5">Clients who used emergency keywords — review and follow up.</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIncidentView("active")}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${incidentView === "active" ? "bg-red-500 text-white" : "border border-red-200 text-red-500 bg-white hover:bg-red-50"}`}
                  >
                    Active {incidents.length > 0 && `(${incidents.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncidentView("accidental")}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${incidentView === "accidental" ? "bg-slate-500 text-white" : "border border-slate-200 text-slate-500 bg-white hover:bg-slate-50"}`}
                  >
                    Accidental {incidentsAccidental.length > 0 && `(${incidentsAccidental.length})`}
                  </button>
                </div>
              </div>

              {incidentLoading ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">Loading incidents…</p>
              ) : (incidentView === "active" ? incidents : incidentsAccidental).length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">
                  {incidentView === "active"
                    ? "No active incidents — great news! 🎉 Emergency flags will appear here when detected."
                    : "No incidents marked as accidental."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {(incidentView === "active" ? incidents : incidentsAccidental).map((inc) => {
                    const isNoteOpen = noteExpanded[inc.id] ?? false;
                    const noteVal = noteValues[inc.id] ?? (inc.nurse_notes ?? "");
                    const isPendingDelete = deleteConfirm === inc.id;
                    const isActioning = incidentActionLoading[inc.id] ?? false;

                    const handleMarkAccidental = async () => {
                      setIncidentActionLoading(prev => ({ ...prev, [inc.id]: true }));
                      await fetch("/api/incidents", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ id: inc.id, source: inc.source, field: "status", value: incidentView === "active" ? "accidental" : "active" }),
                      });
                      await loadIncidents(token);
                      setIncidentActionLoading(prev => ({ ...prev, [inc.id]: false }));
                    };

                    const handleDelete = async () => {
                      setIncidentActionLoading(prev => ({ ...prev, [inc.id]: true }));
                      await fetch("/api/incidents", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ id: inc.id, source: inc.source }),
                      });
                      setDeleteConfirm(null);
                      await loadIncidents(token);
                      setIncidentActionLoading(prev => ({ ...prev, [inc.id]: false }));
                    };

                    const handleSaveNote = async () => {
                      setNoteSaving(prev => ({ ...prev, [inc.id]: true }));
                      await fetch("/api/incidents", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ id: inc.id, source: inc.source, field: "nurse_notes", value: noteVal }),
                      });
                      setNoteSaving(prev => ({ ...prev, [inc.id]: false }));
                      setNoteExpanded(prev => ({ ...prev, [inc.id]: false }));
                      if (incidentView === "active") {
                        setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, nurse_notes: noteVal } : i));
                      } else {
                        setIncidentsAccidental(prev => prev.map(i => i.id === inc.id ? { ...i, nurse_notes: noteVal } : i));
                      }
                      flash("Note saved ✅");
                    };

                    return (
                      <li key={inc.id} className="p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-[#1a2744]">
                                {inc.client_name ?? <span className="font-normal italic text-slate-400">Name not provided</span>}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${inc.source === "healing" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                                {inc.source === "healing" ? "Recovery chat" : "AI assistant"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              📱 {inc.client_phone ?? <em className="text-slate-400">Phone not provided</em>}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(inc.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>

                        {inc.flagged_message && (
                          <div className="rounded-lg bg-red-50 border-l-4 border-red-400 px-4 py-3">
                            <p className="text-xs font-semibold text-red-500 mb-1">What they said:</p>
                            <p className="text-sm text-red-700 italic">&ldquo;{inc.flagged_message}&rdquo;</p>
                          </div>
                        )}

                        {inc.nurse_notes && !isNoteOpen && (
                          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                            <p className="text-xs font-semibold text-slate-500 mb-1">Your note:</p>
                            <p className="text-sm text-slate-700">{inc.nurse_notes}</p>
                          </div>
                        )}

                        {isNoteOpen && (
                          <div className="space-y-2">
                            <textarea
                              value={noteVal}
                              onChange={e => setNoteValues(prev => ({ ...prev, [inc.id]: e.target.value }))}
                              placeholder="e.g. Called client at 3pm — she's doing better, advised ice and rest."
                              rows={3}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488] resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={noteSaving[inc.id]}
                                onClick={() => void handleSaveNote()}
                                className="rounded-full bg-[#0d9488] px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                              >
                                {noteSaving[inc.id] ? "Saving…" : "Save note"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setNoteExpanded(prev => ({ ...prev, [inc.id]: false }))}
                                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {isPendingDelete && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3 flex-wrap">
                            <p className="text-sm font-semibold text-red-700 flex-1">Delete this incident record permanently?</p>
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => void handleDelete()}
                              className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              {isActioning ? "Deleting…" : "Yes, delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {!isPendingDelete && (
                          <div className="flex gap-2 flex-wrap pt-1">
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => void handleMarkAccidental()}
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {isActioning ? "…" : incidentView === "active" ? "🔕 Mark as accidental" : "↩ Restore to active"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNoteValues(prev => ({ ...prev, [inc.id]: inc.nurse_notes ?? "" }));
                                setNoteExpanded(prev => ({ ...prev, [inc.id]: !isNoteOpen }));
                              }}
                              className="rounded-full border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                            >
                              📝 {inc.nurse_notes ? "Edit note" : "Add note"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(inc.id)}
                              className="rounded-full border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-50"
                            >
                              🗑 Delete
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Emergency Keywords */}
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
              <h3 className="text-base font-bold text-red-700 mb-2">⚠️ Emergency Keywords</h3>
              <p className="text-sm text-red-600 leading-relaxed">When a client mentions any of these words in their recovery chat, you will receive an immediate email alert so you can reach out right away.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Built-in keywords (always active)</p>
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
                  onKeyDown={e => { if (e.key === "Enter") void handleAddKeyword(); }}
                  placeholder="e.g. swelling getting worse"
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                />
                <button
                  type="button"
                  disabled={keywordSaving || !newKeyword.trim()}
                  onClick={() => void handleAddKeyword()}
                  style={{ touchAction: "manipulation" }}
                  className="min-h-[44px] rounded-full bg-[#0d9488] px-5 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
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
                      <button
                        type="button"
                        onClick={() => void handleDeleteKeyword(kw.id)}
                        style={{ touchAction: "manipulation" }}
                        className="ml-1 min-h-[24px] min-w-[24px] flex items-center justify-center text-orange-400 hover:text-red-600 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Alerts to You Tab ──────────────────────────────────────────── */}
        {tab === "alerts" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-sky-50 p-5">
              <h3 className="font-bold text-[#1a2744] mb-1">⚙️ Alert Settings</h3>
              <p className="text-sm text-slate-600 leading-relaxed">This is where we contact you when a client reports an emergency symptom in their healing chat or AI assistant. Set your preferred email and phone number below so we can reach you immediately when it matters most.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#1a2744] mb-1">Alert email address</label>
                <p className="text-xs text-slate-500 mb-2">We&apos;ll send you an immediate email when an emergency keyword is detected.</p>
                <input
                  type="email"
                  value={alertEmail}
                  onChange={e => setAlertEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1a2744] mb-1">Alert phone number</label>
                <p className="text-xs text-slate-500 mb-2">For faster response — we&apos;ll text you when an emergency is detected.</p>
                <input
                  type="tel"
                  value={alertPhone}
                  onChange={e => setAlertPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                />
              </div>
              <button
                type="button"
                disabled={alertSaving}
                onClick={() => void (async () => {
                  setAlertSaving(true);
                  await fetch("/api/alert-settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ alert_email: alertEmail, alert_phone: alertPhone }),
                  });
                  setAlertSaving(false);
                  flash("Alert settings saved! ✅");
                })()}
                style={{ touchAction: "manipulation" }}
                className="w-full min-h-[48px] rounded-full bg-[#0d9488] px-6 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
              >
                {alertSaving ? "Saving…" : "Save alert settings ⚙️"}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
