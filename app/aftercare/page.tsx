"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Procedure = {
  id: string;
  name: string;
  aftercare_instructions: string;
  reminder_days: number;
  created_at: string;
};

type Treatment = {
  id: string;
  intake_id: string | null;
  procedure_name: string;
  procedure_id: string | null;
  treatment_date: string;
  aftercare_sent: boolean;
  notes: string;
  came_via_bot: boolean;
  archived: boolean;
  intakes: { first_name: string; email: string; phone: string; service_interested: string } | null;
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

// ─── Seed data ────────────────────────────────────────────────────────────────

const DEFAULT_PROCEDURES = [
  { name: "Lip Filler", aftercare_instructions: "Avoid touching or pressing your lips for 24 hours.\nApply ice wrapped in a cloth to reduce swelling — 10 minutes on, 10 minutes off.\nStay hydrated and avoid salty foods.\nAvoid strenuous exercise for 24-48 hours.\nSleep on your back with your head elevated.\nAvoid alcohol for 24 hours.\nAvoid extreme heat (saunas, hot yoga) for 2 weeks.\nDo not massage the area unless instructed.\nResults settle in 2 weeks — follow up if concerned.", reminder_days: 180 },
  { name: "Botox / Neuromodulator", aftercare_instructions: "Do not touch, rub, or massage the treated area for 4 hours.\nStay upright for 4 hours after treatment.\nAvoid strenuous exercise for 24 hours.\nAvoid alcohol for 24 hours.\nAvoid extreme heat for 24 hours.\nDo not lie face down for 4 hours.\nResults appear in 3-14 days — full effect at 2 weeks.\nFollow up in 2 weeks if needed.", reminder_days: 90 },
  { name: "Cheek Filler", aftercare_instructions: "Avoid touching the treated area for 6 hours.\nApply ice gently to reduce swelling.\nAvoid strenuous exercise for 24-48 hours.\nSleep elevated for the first night.\nAvoid alcohol and blood thinners for 24 hours.\nAvoid extreme heat for 2 weeks.\nResults settle fully in 2-4 weeks.", reminder_days: 180 },
  { name: "PRP / Biostimulator", aftercare_instructions: "Keep the area clean and dry for 24 hours.\nAvoid makeup for 24 hours.\nDo not exercise strenuously for 24 hours.\nAvoid direct sun exposure for 1 week.\nUse SPF 30+ daily.\nExpect some redness and swelling for 1-3 days — this is normal.\nResults improve over 4-6 weeks.", reminder_days: 120 },
  { name: "Skin Booster", aftercare_instructions: "Avoid touching the area for 6 hours.\nStay hydrated — drink plenty of water.\nAvoid makeup for 12 hours.\nAvoid strenuous exercise for 24 hours.\nExpect small bumps to resolve within 24-48 hours.\nUse gentle skincare for 48 hours.\nGlow check-in in 4 weeks!", reminder_days: 28 },
];

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
    t =>
      t.procedure_id === procedure.id ||
      t.procedure_name?.toLowerCase().includes(procedure.name.toLowerCase())
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`flex-1 min-w-0 rounded-2xl border p-4 text-center ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs font-semibold leading-tight">{label}</p>
    </div>
  );
}

// ─── Prep guide helpers ────────────────────────────────────────────────────────

function defaultPrepInstructions(procedureName: string): string {
  const lower = procedureName.toLowerCase();
  if (lower.includes("lip")) {
    return "Come with clean lips — no lip liner or lipstick.\nAvoid alcohol 24 hours before your appointment.\nAvoid blood thinners and ibuprofen for 24 hours.\nStay hydrated — drink plenty of water.\nArrive 10 minutes early.";
  }
  if (lower.includes("botox") || lower.includes("neuromodulator") || lower.includes("dysport") || lower.includes("xeomin")) {
    return "Come with a clean face — no makeup.\nAvoid alcohol 24 hours before your appointment.\nAvoid blood thinners and ibuprofen for 24 hours.\nDon't exercise heavily the day of your appointment.\nArrive 10 minutes early.";
  }
  if (lower.includes("cheek") || lower.includes("filler") || lower.includes("jawline") || lower.includes("chin") || lower.includes("temple") || lower.includes("under eye") || lower.includes("tear")) {
    return "Come with a clean face — no makeup.\nAvoid alcohol 24 hours before your appointment.\nAvoid blood thinners and ibuprofen for 24 hours.\nStay hydrated — drink plenty of water.\nArrive 10 minutes early.";
  }
  if (lower.includes("prp") || lower.includes("biostimulator") || lower.includes("sculptra") || lower.includes("radiesse")) {
    return "Come with a clean face — no makeup.\nAvoid alcohol 48 hours before your appointment.\nAvoid blood thinners and ibuprofen for 48 hours.\nStay hydrated — drink plenty of water.\nArrive 10 minutes early.";
  }
  if (lower.includes("skin") || lower.includes("booster") || lower.includes("hydra") || lower.includes("microneedling")) {
    return "Come with a clean face — no makeup or active skincare.\nAvoid alcohol 24 hours before your appointment.\nAvoid retinol and acids for 3 days before.\nStay hydrated — drink plenty of water.\nArrive 10 minutes early.";
  }
  // Generic default
  return "Come with a clean face — no makeup.\nAvoid alcohol 24 hours before your appointment.\nAvoid blood thinners and ibuprofen for 24 hours.\nStay hydrated — drink plenty of water.\nArrive 10 minutes early.";
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AftercarePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");

  // Top-level tab
  const [tab, setTab] = useState<"procedures" | "treatments" | "emergency" | "alerts">("treatments");

  // Procedure state
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [editingProcedure, setEditingProcedure] = useState<Partial<Procedure> | null>(null);
  const [saving, setSaving] = useState(false);
  // Which procedure card is expanded + which sub-tab is active
  const [expandedProcedureId, setExpandedProcedureId] = useState<string | null>(null);
  const [procedureSubTab, setProcedureSubTab] = useState<"aftercare" | "clients" | "followup">("aftercare");

  // Clients sub-tab state
  const [addingClient, setAddingClient] = useState(false);
  const [newClient, setNewClient] = useState({ first_name: "", email: "", phone: "" });
  const [clientSaving, setClientSaving] = useState(false);
  const [addProcedureDropdownKey, setAddProcedureDropdownKey] = useState<string | null>(null);
  const [addProcedureLoadingKey, setAddProcedureLoadingKey] = useState<string | null>(null);

  // Follow-up sub-tab state
  const [selectedFollowupIds, setSelectedFollowupIds] = useState<Set<string>>(new Set());
  const [followupSending, setFollowupSending] = useState(false);

  // Treatment state
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [newTreatment, setNewTreatment] = useState({
    intake_id: "",
    procedure_ids: [] as string[],
    procedure_name: "",
    treatment_date: new Date().toISOString().slice(0, 10),
    notes: "",
    is_walkin: false,
    walkin_name: "",
    walkin_email: "",
    walkin_phone: "",
    send_aftercare: true,
    came_via_bot: false,
  });
  const [addingTreatment, setAddingTreatment] = useState(false);
  const [treatmentSaving, setTreatmentSaving] = useState(false);
  const [walkinCustomProcedure, setWalkinCustomProcedure] = useState("");
  // Post-treatment prep guide prompt
  const [prepPrompt, setPrepPrompt] = useState<{
    intakeId: string | null;
    clientName: string;
    procedureName: string;
    instructions: string;
    appointmentDate?: string; // ISO date string for rebook appointments
  } | null>(null);
  const [prepTab, setPrepTab] = useState<"auto" | "custom">("auto");
  const [prepCustomText, setPrepCustomText] = useState("");
  const [prepSending, setPrepSending] = useState(false);
  const [prepSentDone, setPrepSentDone] = useState(false);
  // Rebook state (shown after logging a treatment)
  const [rebookChecked, setRebookChecked] = useState(false);
  const [rebookDate, setRebookDate] = useState("");
  const [rebookProcedureIds, setRebookProcedureIds] = useState<string[]>([]);

  // Archive state
  const [archivedTreatments, setArchivedTreatments] = useState<Treatment[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // ── Incident feed state ────────────────────────────────────────────────────
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
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentsAccidental, setIncidentsAccidental] = useState<Incident[]>([]);
  const [incidentView, setIncidentView] = useState<"active" | "accidental">("active");
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState<Record<string, boolean>>({});
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});
  const [noteSaving, setNoteSaving] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // incident id pending confirm
  const [incidentActionLoading, setIncidentActionLoading] = useState<Record<string, boolean>>({});

  // Emergency keywords state
  const [emergencyKeywords, setEmergencyKeywords] = useState<{ id: string; keyword: string }[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordSaving, setKeywordSaving] = useState(false);

  // Alert settings state
  const [alertEmail, setAlertEmail] = useState("");
  const [alertPhone, setAlertPhone] = useState("");
  const [alertSaving, setAlertSaving] = useState(false);

  // Aftercare send state (Treatments tab)
  const [aftercareSendingId, setAftercareSendingId] = useState<string | null>(null);
  const [aftercareSentIds, setAftercareSentIds] = useState<Set<string>>(new Set());

  const [successMsg, setSuccessMsg] = useState("");

  function flash(msg: string, ms = 4000) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), ms);
  }

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

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) { router.replace("/auth"); return; }
      const t = data.session.access_token;
      setToken(t);

      const [procRes, treatRes, intakeRes, kwRes, alertRes] = await Promise.all([
        fetch("/api/procedures", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/treatments", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/intakes", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/emergency-keywords", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/alert-settings", { headers: { Authorization: `Bearer ${t}` } }),
      ]);

      if (!cancelled) {
        if (procRes.ok) { const j = await procRes.json(); setProcedures(j.procedures ?? []); }
        if (treatRes.ok) { const j = await treatRes.json(); setTreatments(j.treatments ?? []); }
        if (intakeRes.ok) {
          const j = await intakeRes.json();
          setIntakes(j.intakes ?? []);
        }
        if (kwRes.ok) { const j = await kwRes.json(); setEmergencyKeywords(j.keywords ?? []); }
        if (alertRes.ok) {
          const j = await alertRes.json();
          setAlertEmail(j.alert_email ?? "");
          setAlertPhone(j.alert_phone ?? "");
        }
        void loadIncidents(t);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router, loadIncidents]);

  // ── Procedure handlers ─────────────────────────────────────────────────────
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
    flash("Default procedures added! Edit them to customize your aftercare instructions.");
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
      flash("Procedure saved!");
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
    if (expandedProcedureId === id) setExpandedProcedureId(null);
  }, [token, expandedProcedureId]);

  // ── Manually add client to procedure ──────────────────────────────────────
  const handleAddClient = useCallback(async (procedureName: string) => {
    if (!newClient.first_name.trim()) return;
    setClientSaving(true);
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

  // ── Follow-up sender ───────────────────────────────────────────────────────
  const handleSendFollowup = useCallback(async () => {
    if (selectedFollowupIds.size === 0) return;
    setFollowupSending(true);
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
    setFollowupSending(false);
  }, [selectedFollowupIds, token]);

  // ── Treatment handler ──────────────────────────────────────────────────────
  const handleLogTreatment = useCallback(async () => {
    // ── Snapshot all state values NOW, before any awaits or resets ────────────
    // This is the fix for the prep guide not appearing: React 18 batches state
    // updates, so reading newTreatment.*  after setState calls can be unreliable.
    // By capturing upfront into plain locals, we're immune to any stale closure issues.
    const capturedIntakeId = newTreatment.intake_id;
    const capturedIsWalkin = newTreatment.is_walkin;
    const capturedWalkinName = newTreatment.walkin_name;
    const capturedRebookChecked = rebookChecked;
    const capturedRebookDate = rebookDate;
    const capturedRebookProcedureIds = rebookProcedureIds;
    const capturedCustomProcedure = walkinCustomProcedure.trim();
    const capturedClientName = intakes.find(i => i.id === capturedIntakeId)?.first_name
      || capturedWalkinName
      || "Client";

    const hasCustom = capturedIsWalkin && capturedCustomProcedure;
    if ((!capturedIntakeId && !capturedIsWalkin) || (newTreatment.procedure_ids.length === 0 && !hasCustom)) return;
    setTreatmentSaving(true);

    // Resolve procedure name — prefer selected procedures, fall back to custom input
    const selectedProcedures = procedures.filter(p => newTreatment.procedure_ids.includes(p.id));
    const procedureNames = selectedProcedures.length > 0
      ? selectedProcedures.map(p => p.name).join(", ")
      : capturedCustomProcedure;

    console.log("[handleLogTreatment] capturedIntakeId:", capturedIntakeId, "capturedIsWalkin:", capturedIsWalkin, "procedureNames:", procedureNames, "rebookChecked:", capturedRebookChecked);

    // If custom procedure was typed, call AI to generate aftercare instructions
    let customAftercareInstructions: string | null = null;
    if (hasCustom && selectedProcedures.length === 0) {
      try {
        const aiRes = await fetch("/api/generate-aftercare", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ procedure_name: capturedCustomProcedure }),
        });
        if (aiRes.ok) {
          const aiJ = await aiRes.json();
          customAftercareInstructions = aiJ.instructions ?? null;
        }
      } catch { /* fall through — will use default aftercare */ }
    }

    const res = await fetch("/api/treatments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intake_id: capturedIntakeId || null,
        procedure_id: newTreatment.procedure_ids[0] ?? null,
        procedure_ids: newTreatment.procedure_ids,
        procedure_name: procedureNames,
        custom_aftercare_instructions: customAftercareInstructions,
        treatment_date: newTreatment.treatment_date,
        notes: newTreatment.notes,
        is_walkin: capturedIsWalkin,
        walkin_name: capturedWalkinName,
        walkin_email: newTreatment.walkin_email,
        walkin_phone: newTreatment.walkin_phone,
        send_aftercare: newTreatment.send_aftercare,
        came_via_bot: newTreatment.came_via_bot,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setTreatments(prev => [j.treatment, ...prev]);
      setNewTreatment({ intake_id: "", procedure_ids: [], procedure_name: "", treatment_date: new Date().toISOString().slice(0, 10), notes: "", is_walkin: false, walkin_name: "", walkin_email: "", walkin_phone: "", send_aftercare: true, came_via_bot: false });
      setWalkinCustomProcedure("");
      setAddingTreatment(false);
      flash(j.aftercare_sent ? `Treatment logged and aftercare sent for ${procedureNames}! 💙` : "Treatment logged!");

      if (capturedRebookChecked && capturedRebookDate && (capturedIntakeId || capturedIsWalkin)) {
        // ── Rebook: create second treatment for future appointment ─────────────
        const rebookProcNames = procedures
          .filter(p => capturedRebookProcedureIds.includes(p.id))
          .map(p => p.name).join(", ");
        const rebookRes = await fetch("/api/treatments", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            intake_id: capturedIntakeId || null,
            procedure_id: capturedRebookProcedureIds[0] ?? null,
            procedure_ids: capturedRebookProcedureIds,
            procedure_name: rebookProcNames || procedureNames,
            treatment_date: capturedRebookDate,
            notes: "Rebooked appointment",
            is_walkin: capturedIsWalkin,
            walkin_name: capturedWalkinName,
            walkin_email: newTreatment.walkin_email,
            walkin_phone: newTreatment.walkin_phone,
            send_aftercare: false,
            came_via_bot: newTreatment.came_via_bot,
          }),
        });
        setRebookChecked(false);
        setRebookDate("");
        setRebookProcedureIds([]);
        if (rebookRes.ok) {
          const rj = await rebookRes.json();
          setTreatments(prev => [rj.treatment, ...prev]);
          // Show prep guide for the FUTURE (rebooked) appointment
          if (capturedIntakeId && !capturedIsWalkin) {
            const rebookProcName = rebookProcNames || procedureNames;
            const instructions = defaultPrepInstructions(rebookProcName);
            const formattedDate = new Date(capturedRebookDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
            console.log("[handleLogTreatment] showing rebook prep guide for", capturedClientName, rebookProcName, formattedDate);
            setPrepPrompt({ intakeId: capturedIntakeId, clientName: capturedClientName, procedureName: rebookProcName, instructions, appointmentDate: formattedDate });
            setPrepTab("auto");
            setPrepCustomText(instructions);
            setPrepSentDone(false);
          }
        }
      } else if (capturedIntakeId && !capturedIsWalkin) {
        // ── Regular (non-rebook) scheduled client: show prep guide ────────────
        const instructions = defaultPrepInstructions(procedureNames);
        console.log("[handleLogTreatment] showing prep guide for", capturedClientName, procedureNames, "intakeId:", capturedIntakeId);
        setPrepPrompt({
          intakeId: capturedIntakeId,
          clientName: capturedClientName,
          procedureName: procedureNames,
          instructions,
        });
        setPrepTab("auto");
        setPrepCustomText(instructions);
        setPrepSentDone(false);
      }
    }
    setTreatmentSaving(false);
  }, [newTreatment, walkinCustomProcedure, rebookChecked, rebookDate, rebookProcedureIds, procedures, token, intakes]);

  // ── Archive handlers ───────────────────────────────────────────────────────
  const loadArchivedTreatments = useCallback(async () => {
    if (!token) return;
    const res = await fetch("/api/treatments?archived=true", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const j = await res.json();
      setArchivedTreatments(j.treatments ?? []);
    }
  }, [token]);

  const handleArchive = useCallback(async (id: string) => {
    setArchivingId(id);
    const res = await fetch("/api/treatments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setTreatments(prev => prev.filter(t => t.id !== id));
      // Refresh archived count if panel is open
      if (showArchived) await loadArchivedTreatments();
    }
    setArchiveConfirmId(null);
    setArchivingId(null);
  }, [token, showArchived, loadArchivedTreatments]);

  // Auto-detect came_via_bot when nurse picks an existing intake
  const handleIntakeSelect = useCallback((intakeId: string) => {
    const intake = intakes.find(i => i.id === intakeId);
    setNewTreatment(p => ({
      ...p,
      intake_id: intakeId,
      came_via_bot: intake?.came_via_bot === true ? true : p.came_via_bot,
    }));
  }, [intakes]);

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

  // ── Treatment stats ────────────────────────────────────────────────────────
  const totalTreatments = treatments.length;
  const viaBotCount = treatments.filter(t => t.came_via_bot).length;
  const conversionPct = totalTreatments > 0
    ? Math.round((viaBotCount / totalTreatments) * 100)
    : 0;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500 animate-pulse">Loading aftercare dashboard…</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-slate-50 font-sans antialiased" style={{ overflowX: "hidden" }}>

      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div
          className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/dashboard" className="shrink-0">
              <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-[#1a2744] sm:text-base truncate">Client Hub 🩹</h1>
              <p className="hidden text-xs text-slate-500 sm:block">Procedure-specific aftercare for every client</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            style={{ touchAction: "manipulation" }}
            className="shrink-0 min-h-[44px] flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50 active:scale-[0.97]"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main
        className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Success banner */}
        {successMsg && (
          <div className="mb-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700">
            ✅ {successMsg}
          </div>
        )}

        {/* Top-level tabs */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {(
            [
              { id: "treatments", label: `💉 Treatments (${treatments.length})` },
              { id: "procedures", label: `📋 Procedures (${procedures.length})` },
              { id: "emergency", label: `⚠️ Emergency${incidents.length > 0 ? ` (${incidents.length})` : ""}` },
              { id: "alerts", label: "⚙️ Alerts" },
            ] as const
          ).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{ touchAction: "manipulation" }}
              className={`shrink-0 min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${
                tab === t.id
                  ? t.id === "emergency" ? "bg-red-500 text-white" : "bg-[#0d9488] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Procedures Tab ─────────────────────────────────────────────── */}
        {tab === "procedures" && (
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
                    disabled={saving}
                    style={{ touchAction: "manipulation" }}
                    className="min-h-[48px] rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
                  >
                    {saving ? "Adding…" : "✨ Add default procedures"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProcedure({ name: "", aftercare_instructions: "", reminder_days: 180 })}
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
                  onClick={() => setEditingProcedure({ name: "", aftercare_instructions: "", reminder_days: 180 })}
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
                    onChange={e => setEditingProcedure(p => ({ ...p, aftercare_instructions: e.target.value }))}
                    placeholder="Aftercare instructions — write exactly what you want your client to receive in their email…"
                    rows={8}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs font-semibold text-slate-600 shrink-0">Reminder after (days):</label>
                    <input
                      type="number"
                      value={editingProcedure.reminder_days ?? 180}
                      onChange={e => setEditingProcedure(p => ({ ...p, reminder_days: parseInt(e.target.value) }))}
                      className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                    />
                    <span className="text-xs text-slate-400">e.g. 90 for Botox, 180 for filler</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSaveProcedure()}
                      style={{ touchAction: "manipulation" }}
                      className="min-h-[44px] rounded-full bg-[#0d9488] px-6 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
                    >
                      {saving ? "Saving…" : "Save procedure"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProcedure(null)}
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
                  {/* Card header — tap to expand */}
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

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {/* Sub-tab bar */}
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
                        {/* Edit / Delete pushed to right */}
                        <div className="flex items-center gap-2 ml-auto px-4 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setEditingProcedure(procedure); setExpandedProcedureId(null); }}
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

                      {/* Aftercare sub-tab */}
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

                      {/* Clients sub-tab */}
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

                          {/* Add client form */}
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
                                  onClick={() => { setAddingClient(false); setNewClient({ first_name: "", email: "", phone: "" }); }}
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

                      {/* Follow-up sub-tab */}
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
                                  disabled={followupSending}
                                  onClick={() => void handleSendFollowup()}
                                  style={{ touchAction: "manipulation" }}
                                  className="w-full min-h-[48px] rounded-full bg-[#0d9488] px-6 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
                                >
                                  {followupSending
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

        {/* ── Treatments Tab ─────────────────────────────────────────────── */}
        {tab === "treatments" && (
          <div className="space-y-4">
            {/* Post-treatment prep guide prompt */}
            {prepPrompt && (
              <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-5 shadow-sm">
                {prepSentDone ? (
                  <div className="text-center py-2">
                    <p className="text-2xl mb-1">✅</p>
                    <p className="font-semibold text-teal-800">Sent to {prepPrompt.clientName}!</p>
                    <button type="button" onClick={() => setPrepPrompt(null)} className="mt-2 text-xs text-slate-500 underline">Dismiss</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <p className="text-sm font-semibold text-[#1a2744]">
                        {prepPrompt.appointmentDate
                          ? `💌 Send a prep guide to ${prepPrompt.clientName} for their ${prepPrompt.procedureName} on ${prepPrompt.appointmentDate}?`
                          : `💌 Send a pre-appointment prep guide to ${prepPrompt.clientName}?`}
                      </p>
                      <button type="button" onClick={() => setPrepPrompt(null)} className="shrink-0 text-xs text-slate-400 hover:text-slate-600 underline">Skip</button>
                    </div>
                    {/* Auto / Customize tabs */}
                    <div className="flex gap-2 mb-3">
                      {([["auto", "✨ Auto"], ["custom", "✏️ Customize"]] as const).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPrepTab(id)}
                          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${prepTab === id ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {prepTab === "auto" ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-teal-200 bg-white px-4 py-3">
                          {prepPrompt.instructions.split("\n").map((line, i) => (
                            <p key={i} className="text-sm text-slate-700 py-0.5">✅ {line}</p>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={prepSending}
                          onClick={async () => {
                            setPrepSending(true);
                            try {
                              const res = await fetch("/api/send-prep-guide", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ intake_id: prepPrompt.intakeId, custom_instructions: prepPrompt.instructions }),
                              });
                              if (res.ok) setPrepSentDone(true);
                              else flash("Could not send prep guide — please try again.");
                            } finally {
                              setPrepSending(false);
                            }
                          }}
                          className="rounded-full bg-[#0d9488] px-6 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                        >
                          {prepSending ? "Sending…" : "Send 💌"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <textarea
                          value={prepCustomText}
                          onChange={e => setPrepCustomText(e.target.value)}
                          rows={6}
                          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]/40 focus:ring-2 focus:ring-[#0d9488]/20"
                        />
                        <button
                          type="button"
                          disabled={prepSending}
                          onClick={async () => {
                            setPrepSending(true);
                            try {
                              const res = await fetch("/api/send-prep-guide", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ intake_id: prepPrompt.intakeId, custom_instructions: prepCustomText }),
                              });
                              if (res.ok) setPrepSentDone(true);
                              else flash("Could not send prep guide — please try again.");
                            } finally {
                              setPrepSending(false);
                            }
                          }}
                          className="rounded-full bg-[#0d9488] px-6 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                        >
                          {prepSending ? "Sending…" : "Send 💌"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {/* Results summary */}
            <div className="flex gap-3">
              <StatBadge
                label="Total treatments"
                value={totalTreatments}
                color="border-slate-200 bg-white text-[#1a2744]"
              />
              <StatBadge
                label="Via AdonisBlue 🤖"
                value={viaBotCount}
                color="border-blue-200 bg-blue-50 text-blue-700"
              />
              <StatBadge
                label="Conversion rate"
                value={`${conversionPct}%`}
                color="border-teal-200 bg-teal-50 text-teal-700"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAddingTreatment(true)}
                style={{ touchAction: "manipulation" }}
                className="min-h-[44px] rounded-full bg-[#0d9488] px-5 py-2 text-sm font-bold text-white transition hover:bg-teal-700 active:scale-[0.97]"
              >
                + Log a treatment
              </button>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔁</span>
                <div>
                  <p className="text-sm font-bold text-[#1a2744] mb-1">Rebooking reminders run automatically</p>
                  <p className="text-sm text-slate-600 leading-relaxed">When you log a treatment, AdonisBlue schedules a rebooking reminder based on the procedure. Your client gets a &quot;time to refresh?&quot; email automatically — you don&apos;t have to do anything.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { proc: "Botox", days: "90 days" },
                      { proc: "Lip Filler", days: "180 days" },
                      { proc: "Cheek Filler", days: "180 days" },
                      { proc: "Skin Booster", days: "28 days" },
                      { proc: "PRP", days: "120 days" },
                    ].map(item => (
                      <span key={item.proc} className="rounded-full bg-white border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-700">
                        {item.proc} → {item.days}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Log treatment form */}
            {addingTreatment && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
                <h3 className="mb-4 text-base font-bold text-[#1a2744]">Log a treatment 💉</h3>
                <div className="space-y-3">
                  {/* Client selector */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Select client</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setNewTreatment(p => ({ ...p, is_walkin: false }))}
                        style={{ touchAction: "manipulation" }}
                        className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${!newTreatment.is_walkin ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                      >
                        Existing client
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTreatment(p => ({ ...p, is_walkin: true }))}
                        style={{ touchAction: "manipulation" }}
                        className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${newTreatment.is_walkin ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                      >
                        🚶 Walk-in
                      </button>
                    </div>

                    {!newTreatment.is_walkin ? (
                      <div>
                        <select
                          value={newTreatment.intake_id}
                          onChange={e => handleIntakeSelect(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                        >
                          <option value="">Choose a client…</option>
                          {intakes.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.first_name} {i.last_name || ""} — {i.email}
                              {i.came_via_bot ? " 🤖" : ""}
                            </option>
                          ))}
                        </select>
                        {newTreatment.intake_id && intakes.find(i => i.id === newTreatment.intake_id)?.came_via_bot && (
                          <p className="mt-1 text-xs text-blue-600 font-semibold">🤖 This client came via AdonisBlue bot — auto-detected!</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          value={newTreatment.walkin_name}
                          onChange={e => setNewTreatment(p => ({ ...p, walkin_name: e.target.value }))}
                          placeholder="Client name"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                        />
                        <input
                          type="email"
                          value={newTreatment.walkin_email}
                          onChange={e => setNewTreatment(p => ({ ...p, walkin_email: e.target.value }))}
                          placeholder="Email (for aftercare)"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                        />
                        <input
                          type="tel"
                          value={newTreatment.walkin_phone}
                          onChange={e => setNewTreatment(p => ({ ...p, walkin_phone: e.target.value }))}
                          placeholder="Phone (optional)"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Procedures */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Select procedures (can choose multiple)</label>
                    <div className="flex flex-wrap gap-2">
                      {procedures.filter((p, i, self) => i === self.findIndex(t => t.name === p.name)).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setNewTreatment(prev => ({
                            ...prev,
                            procedure_ids: prev.procedure_ids.includes(p.id)
                              ? prev.procedure_ids.filter(id => id !== p.id)
                              : [...prev.procedure_ids, p.id],
                          }))}
                          style={{ touchAction: "manipulation" }}
                          className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${newTreatment.procedure_ids.includes(p.id) ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                        >
                          {newTreatment.procedure_ids.includes(p.id) ? "✓ " : ""}{p.name}
                        </button>
                      ))}
                    </div>
                    {newTreatment.procedure_ids.length > 0 && (
                      <p className="mt-2 text-xs text-teal-600 font-semibold">
                        ✅ {newTreatment.procedure_ids.length} procedure{newTreatment.procedure_ids.length > 1 ? "s" : ""} selected
                      </p>
                    )}
                    {/* Custom procedure for walk-ins or unlisted services */}
                    {newTreatment.is_walkin && (
                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Or type a custom procedure (e.g. &quot;Jawline Filler&quot;)</label>
                        <input
                          type="text"
                          value={walkinCustomProcedure}
                          onChange={e => setWalkinCustomProcedure(e.target.value)}
                          placeholder="e.g. Jawline Filler, Lip Flip, Under Eye Filler…"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                        />
                        {walkinCustomProcedure.trim() && (
                          <p className="mt-1 text-xs text-indigo-600">✨ AI will generate aftercare instructions for &quot;{walkinCustomProcedure.trim()}&quot; when you save.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Treatment date</label>
                    <input
                      type="date"
                      value={newTreatment.treatment_date}
                      onChange={e => setNewTreatment(p => ({ ...p, treatment_date: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Notes (optional)</label>
                    <textarea
                      value={newTreatment.notes}
                      onChange={e => setNewTreatment(p => ({ ...p, notes: e.target.value }))}
                      placeholder="e.g. 0.5ml lip filler, 1 syringe Juvederm Ultra"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                    />
                  </div>

                  {/* Options */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-xs text-amber-700">💡 Choose whether to send aftercare email to this client.</p>
                    <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={newTreatment.send_aftercare}
                        onChange={e => setNewTreatment(p => ({ ...p, send_aftercare: e.target.checked }))}
                        className="h-4 w-4 rounded"
                      />
                      <span className="text-sm font-semibold text-amber-800">Send aftercare email to client</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={newTreatment.came_via_bot}
                        onChange={e => setNewTreatment(p => ({ ...p, came_via_bot: e.target.checked }))}
                        className="h-4 w-4 rounded"
                      />
                      <span className="text-sm font-semibold text-amber-800">Client came via AdonisBlue bot 🤖</span>
                    </label>
                  </div>

                  {/* Rebook option */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={rebookChecked}
                        onChange={e => {
                          setRebookChecked(e.target.checked);
                          if (e.target.checked) {
                            // Default rebook date to 3 months out, same procedures
                            const d = new Date();
                            d.setMonth(d.getMonth() + 3);
                            setRebookDate(d.toISOString().slice(0, 10));
                            setRebookProcedureIds(newTreatment.procedure_ids);
                          }
                        }}
                        className="h-4 w-4 rounded"
                      />
                      <span className="text-sm font-semibold text-indigo-800">📅 Rebook next appointment</span>
                    </label>
                    {rebookChecked && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Next appointment date</label>
                          <input
                            type="date"
                            value={rebookDate}
                            onChange={e => setRebookDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Procedures for next appointment</label>
                          <div className="flex flex-wrap gap-2">
                            {procedures.filter((p, i, self) => i === self.findIndex(t => t.name === p.name)).map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setRebookProcedureIds(prev =>
                                  prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                )}
                                className={`min-h-[40px] rounded-full px-4 py-1.5 text-xs font-semibold transition ${rebookProcedureIds.includes(p.id) ? "bg-indigo-500 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                              >
                                {rebookProcedureIds.includes(p.id) ? "✓ " : ""}{p.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-indigo-600">A prep guide email will be sent to the client for their rebooked appointment.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={treatmentSaving || (!newTreatment.intake_id && !newTreatment.is_walkin) || (newTreatment.procedure_ids.length === 0 && !(newTreatment.is_walkin && walkinCustomProcedure.trim()))}
                      onClick={() => void handleLogTreatment()}
                      style={{ touchAction: "manipulation" }}
                      className="min-h-[48px] flex-1 rounded-full bg-[#0d9488] px-6 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
                    >
                      {treatmentSaving ? "Saving…" : newTreatment.send_aftercare ? "Log & send aftercare 💙" : "Log treatment"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingTreatment(false)}
                      style={{ touchAction: "manipulation" }}
                      className="min-h-[48px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 active:scale-[0.97]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {treatments.length === 0 && !addingTreatment && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-4xl mb-3">💉</p>
                <p className="font-bold text-[#1a2744]">No treatments logged yet</p>
                <p className="mt-1 text-sm text-slate-500">Log a treatment to automatically send the right aftercare to your client.</p>
              </div>
            )}

            {/* Treatment cards */}
            {treatments.map(treatment => (
              <div key={treatment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-[#1a2744]">{treatment.intakes?.first_name ?? "Client"}</p>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{treatment.procedure_name}</span>
                      {treatment.came_via_bot && (
                        <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-700">🤖 Via bot</span>
                      )}
                      {(treatment.aftercare_sent || aftercareSentIds.has(treatment.id)) ? (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">✅ Aftercare sent</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">⏳ No aftercare</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {treatment.intakes?.email} · {new Date(treatment.treatment_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                    {treatment.notes && <p className="mt-1 text-xs text-slate-600 italic">{treatment.notes}</p>}
                    {/* Send aftercare button — only if not already sent and has an intake */}
                    {!treatment.aftercare_sent && !aftercareSentIds.has(treatment.id) && treatment.intake_id && treatment.intakes?.email && (
                      <button
                        type="button"
                        disabled={aftercareSendingId === treatment.id}
                        onClick={async () => {
                          setAftercareSendingId(treatment.id);
                          try {
                            const res = await fetch("/api/send-aftercare", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ intake_id: treatment.intake_id }),
                            });
                            if (res.ok) {
                              setAftercareSentIds(prev => new Set([...prev, treatment.id]));
                              flash(`Aftercare sent to ${treatment.intakes?.first_name ?? "client"}! 💙`);
                            }
                          } finally {
                            setAftercareSendingId(null);
                          }
                        }}
                        className="mt-2 rounded-full bg-[#0d9488] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                      >
                        {aftercareSendingId === treatment.id ? "Sending…" : "Send aftercare 💌"}
                      </button>
                    )}
                  </div>
                  {/* Archive button — subtle trash icon at far right */}
                  <button
                    type="button"
                    onClick={() => setArchiveConfirmId(archiveConfirmId === treatment.id ? null : treatment.id)}
                    className="shrink-0 rounded-full p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-400"
                    title="Archive treatment"
                    aria-label="Archive treatment"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                {/* Inline archive confirmation */}
                {archiveConfirmId === treatment.id && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p className="font-medium mb-2">Archive this treatment? It won&apos;t appear in your list but the data is kept safely.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleArchive(treatment.id)}
                        disabled={archivingId === treatment.id}
                        className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
                      >
                        {archivingId === treatment.id ? "Archiving…" : "Yes, archive"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchiveConfirmId(null)}
                        className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Show archived toggle */}
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={async () => {
                  if (!showArchived) await loadArchivedTreatments();
                  setShowArchived(v => !v);
                }}
                className="text-xs font-semibold text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline"
              >
                {showArchived
                  ? "Hide archived"
                  : `Show archived${archivedTreatments.length > 0 ? ` (${archivedTreatments.length})` : ""}`}
              </button>
            </div>

            {/* Archived treatment cards */}
            {showArchived && (
              <div className="space-y-3 mt-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Archived treatments</p>
                {archivedTreatments.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No archived treatments.</p>
                ) : archivedTreatments.map(treatment => (
                  <div key={treatment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 opacity-70">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-slate-500 text-sm">{treatment.intakes?.first_name ?? "Client"}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{treatment.procedure_name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-400">📦 Archived</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {new Date(treatment.treatment_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Emergency Tab ───────────────────────────────────────────────── */}
        {tab === "emergency" && (
          <div className="space-y-4">

            {/* Explanatory banner */}
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
              <p className="font-semibold mb-1">🚨 How emergency monitoring works</p>
              <p className="leading-relaxed">Emergency keywords are monitored in your healing chat and AI bot. When a client types any of the keywords below, you will be immediately notified by email at your alert address. Make sure your alert email is set in the <button type="button" onClick={() => setTab("alerts")} className="underline font-semibold hover:text-red-900">Alerts tab</button>.</p>
            </div>

            {/* ── Incident Feed ─────────────────────────────────────────── */}
            <div className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between bg-red-50 px-5 py-4 border-b border-red-100">
                <div>
                  <h3 className="text-base font-bold text-red-700">🚨 Flagged Incidents</h3>
                  <p className="text-xs text-red-500 mt-0.5">Clients who used emergency keywords — review and follow up.</p>
                </div>
                {/* Active / Accidental toggle */}
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
                      // Optimistically update local state
                      if (incidentView === "active") {
                        setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, nurse_notes: noteVal } : i));
                      } else {
                        setIncidentsAccidental(prev => prev.map(i => i.id === inc.id ? { ...i, nurse_notes: noteVal } : i));
                      }
                      flash("Note saved ✅");
                    };

                    return (
                      <li key={inc.id} className="p-5 space-y-3">
                        {/* Header row */}
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-[#1a2744]">
                                {inc.client_name ?? <span className="font-normal italic text-slate-400">Name not provided</span>}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${inc.source === "healing" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                                {inc.source === "healing" ? "Recovery chat" : "AI chatbot"}
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

                        {/* Flagged message */}
                        {inc.flagged_message && (
                          <div className="rounded-lg bg-red-50 border-l-4 border-red-400 px-4 py-3">
                            <p className="text-xs font-semibold text-red-500 mb-1">What they said:</p>
                            <p className="text-sm text-red-700 italic">&ldquo;{inc.flagged_message}&rdquo;</p>
                          </div>
                        )}

                        {/* Existing note (if any) */}
                        {inc.nurse_notes && !isNoteOpen && (
                          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                            <p className="text-xs font-semibold text-slate-500 mb-1">Your note:</p>
                            <p className="text-sm text-slate-700">{inc.nurse_notes}</p>
                          </div>
                        )}

                        {/* Note editor */}
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

                        {/* Delete confirmation inline */}
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

                        {/* Action buttons */}
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

            {/* ── Emergency Keywords ────────────────────────────────────── */}
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

        {/* ── Alert Settings Tab ──────────────────────────────────────────── */}
        {tab === "alerts" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-sky-50 p-5">
              <h3 className="font-bold text-[#1a2744] mb-1">⚙️ Alert Settings</h3>
              <p className="text-sm text-slate-600 leading-relaxed">This is where we contact you when a client reports an emergency symptom in their healing chat or AI bot. Set your preferred email and phone number below so we can reach you immediately when it matters most.</p>
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
