"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ClientContactCard } from "@/components/ClientContactCard";
import { SideNavRail } from "@/components/SideNavRail";
import { formatTreatmentDate, parseTreatmentDate } from "@/lib/formatTreatmentDate";
import { DEFAULT_RETURN_DAYS } from "@/lib/reminderDate";
import CancelAftercarePopup from "@/components/CancelAftercarePopup";

// ─── Types ────────────────────────────────────────────────────────────────────

type Procedure = {
  id: string;
  name: string;
  aftercare_instructions: string;
  reminder_days: number | null;
  created_at: string;
  approved_at: string | null;
};

type Treatment = {
  id: string;
  intake_id: string | null;
  procedure_name: string;
  procedure_id: string | null;
  treatment_date: string;
  aftercare_sent_at: string | null;
  aftercare_send_at: string | null;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`flex-1 min-w-0 rounded-2xl border p-4 text-center ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs font-semibold leading-tight">{label}</p>
    </div>
  );
}

function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


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
  return "Come with a clean face — no makeup.\nAvoid alcohol 24 hours before your appointment.\nAvoid blood thinners and ibuprofen for 24 hours.\nStay hydrated — drink plenty of water.\nArrive 10 minutes early.";
}

function formatScheduledTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday = d.toLocaleDateString() === now.toLocaleDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isToday) return time;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " at " + time;
}

function isAftercareDelivered(t: Treatment, aftercareSentIds: Set<string>): boolean {
  if (aftercareSentIds.has(t.id)) return true;
  if (t.aftercare_sent_at != null) return true;
  // Scheduled time has passed — Resend has delivered (promotion hasn't run yet)
  if (t.aftercare_send_at != null && new Date(t.aftercare_send_at) <= new Date()) return true;
  return false;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AftercarePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");

  // Procedures (read-only here — editing lives in Send Emails & Alerts)
  const [procedures, setProcedures] = useState<Procedure[]>([]);

  // Inline client edit state (used in treatment cards)
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editClientForm, setEditClientForm] = useState({ first_name: "", email: "", phone: "" });
  const [editClientSaving, setEditClientSaving] = useState(false);
  const [editClientError, setEditClientError] = useState<string | null>(null);

  // Treatment state
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [newTreatment, setNewTreatment] = useState({
    intake_id: "",
    procedure_ids: [] as string[],
    procedure_name: "",
    treatment_date: toLocalDateString(),
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
  const [treatmentSubmitted, setTreatmentSubmitted] = useState(false);
  const [treatmentError, setTreatmentError] = useState<string | null>(null);
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(new Set());
  const [customProcedure, setCustomProcedure] = useState("");
  const [customProcedureAftercare, setCustomProcedureAftercare] = useState("");
  const [customProcedureReminderDays, setCustomProcedureReminderDays] = useState<number | null>(null);
  const [extraAftercareNotes, setExtraAftercareNotes] = useState("");
  const [rebookChecked, setRebookChecked] = useState(false);
  const [rebookDate, setRebookDate] = useState("");
  const [rebookProcedureIds, setRebookProcedureIds] = useState<string[]>([]);
  const [rebookCustomProcedure, setRebookCustomProcedure] = useState("");
  // Inline approval for unapproved procedures (E)
  const [inlineApproveId, setInlineApproveId] = useState<string | null>(null);
  const [inlineApproveText, setInlineApproveText] = useState("");
  const [inlineApproveReminderDays, setInlineApproveReminderDays] = useState<number | null>(null);
  const [inlineApproveSaving, setInlineApproveSaving] = useState(false);
  const [inlineApproveError, setInlineApproveError] = useState<string | null>(null);
  // phone_public (or alert_phone fallback) shown in the approval card
  const [nurseClientPhone, setNurseClientPhone] = useState<string>("");

  // Archive state
  const [archivedTreatments, setArchivedTreatments] = useState<Treatment[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const [aftercareSendingId, setAftercareSendingId] = useState<string | null>(null);
  const [aftercareSentIds, setAftercareSentIds] = useState<Set<string>>(new Set());
  const [aftercareSendNowId, setAftercareSendNowId] = useState<string | null>(null);
  const [aftercareSchedulingId, setAftercareSchedulingId] = useState<string | null>(null);
  const [cancelPopupId, setCancelPopupId] = useState<string | null>(null);

  const [prepPrompt, setPrepPrompt] = useState<{
    intakeId: string;
    clientName: string;
    procedureName: string;
    instructions: string;
    appointmentDate?: string;
  } | null>(null);
  const [prepTab, setPrepTab] = useState<"auto" | "custom">("auto");
  const [prepCustomText, setPrepCustomText] = useState("");
  const [prepSending, setPrepSending] = useState(false);
  const [prepSentDone, setPrepSentDone] = useState(false);

  const [nurseId, setNurseId] = useState("");
  // Draft banner shown when the form opens and a saved draft exists
  const [draftBanner, setDraftBanner] = useState<{ savedAt: string; clientLabel: string } | null>(null);

  const [successMsg, setSuccessMsg] = useState("");

  function flash(msg: string, ms = 4000) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), ms);
  }

  // ── Draft helpers ─────────────────────────────────────────────────────────
  function draftKey(id: string) { return `adonisblue_treatment_draft_${id}`; }

  function saveDraft(id: string) {
    if (!id) return;
    try {
      const draft = {
        newTreatment, customProcedure, customProcedureAftercare,
        customProcedureReminderDays, extraAftercareNotes,
        rebookChecked, rebookDate, rebookProcedureIds, rebookCustomProcedure,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftKey(id), JSON.stringify(draft));
    } catch { /* storage unavailable */ }
  }

  function clearDraft(id: string) {
    if (!id) return;
    try { localStorage.removeItem(draftKey(id)); } catch { /* ignore */ }
  }

  function readDraft(id: string) {
    if (!id) return null;
    try {
      const raw = localStorage.getItem(draftKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // Auto-save whenever any form field changes (form must be open)
  useEffect(() => {
    if (!addingTreatment || !nurseId) return;
    const t = setTimeout(() => saveDraft(nurseId), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    addingTreatment, nurseId,
    newTreatment, customProcedure, customProcedureAftercare,
    customProcedureReminderDays, extraAftercareNotes,
    rebookChecked, rebookDate, rebookProcedureIds, rebookCustomProcedure,
  ]);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) { router.replace("/auth"); return; }
      const t = data.session.access_token;
      setToken(t);
      setNurseId(data.session.user.id);

      const [procRes, treatRes, intakeRes, botRes] = await Promise.all([
        fetch("/api/procedures", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/treatments", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/intakes", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/mybot", { headers: { Authorization: `Bearer ${t}` } }),
      ]);

      if (!cancelled) {
        if (procRes.ok) { const j = await procRes.json(); setProcedures(j.procedures ?? []); }
        if (treatRes.ok) { const j = await treatRes.json(); setTreatments(j.treatments ?? []); }
        if (intakeRes.ok) { const j = await intakeRes.json(); setIntakes(j.intakes ?? []); }
        if (botRes.ok) {
          const j = await botRes.json();
          const bot = j.bot ?? j;
          setNurseClientPhone((bot.phone_public || bot.alert_phone || "").trim());
        }
      }
      setReady(true);
    })();

    return () => { cancelled = true; };
  }, [router]);

  // ── Update client ──────────────────────────────────────────────────────────
  const handleUpdateClient = useCallback(async () => {
    if (!editingClientId || !editClientForm.first_name.trim()) return;
    setEditClientSaving(true);
    setEditClientError(null);
    const res = await fetch("/api/intakes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: editingClientId,
        first_name: editClientForm.first_name,
        email: editClientForm.email,
        phone: editClientForm.phone,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setIntakes(prev => prev.map(i => (i.id === j.intake.id ? j.intake : i)));
      setTreatments(prev => prev.map(t =>
        t.intake_id === j.intake.id
          ? { ...t, intakes: { ...t.intakes, first_name: j.intake.first_name, email: j.intake.email, phone: j.intake.phone, service_interested: t.intakes?.service_interested ?? "" } }
          : t
      ));
      setEditingClientId(null);
      flash("Client info updated!");
    } else {
      const j = await res.json().catch(() => ({}));
      setEditClientError(j.error ?? "Failed to update client");
    }
    setEditClientSaving(false);
  }, [editingClientId, editClientForm, token]);

  // ── Treatment handler ──────────────────────────────────────────────────────
  const handleLogTreatment = useCallback(async () => {
    const capturedIntakeId = newTreatment.intake_id;
    const capturedIsWalkin = newTreatment.is_walkin;
    const capturedWalkinName = newTreatment.walkin_name;
    const capturedRebookChecked = rebookChecked;
    const capturedRebookDate = rebookDate;
    const capturedRebookProcedureIds = rebookProcedureIds;
    const capturedRebookCustomProcedure = rebookCustomProcedure.trim();
    const capturedCustomProcedure = customProcedure.trim();
    const capturedCustomProcedureAftercare = customProcedureAftercare.trim();
    const capturedCustomProcedureReminderDays = customProcedureReminderDays;
    const capturedClientName = intakes.find(i => i.id === capturedIntakeId)?.first_name
      || capturedWalkinName
      || "Client";

    const hasCustom = !!capturedCustomProcedure;
    if ((!capturedIntakeId && !capturedIsWalkin) || (newTreatment.procedure_ids.length === 0 && !hasCustom)) return;
    setTreatmentSaving(true);
    setTreatmentError(null);

    const selectedProcedures = procedures.filter(p => newTreatment.procedure_ids.includes(p.id));
    const procedureNames = selectedProcedures.length > 0
      ? selectedProcedures.map(p => p.name).join(", ")
      : capturedCustomProcedure;

    let aiPrepInstructions: string | null = null;
    let customAftercareInstructions: string | null = null;
    // ID of a newly saved custom procedure (used below when building procedure_id for the insert)
    let savedCustomProcedureId: string | null = null;

    if (hasCustom) {
      // Save the custom procedure first — inline aftercare takes priority over AI generation.
      // This makes it a real approved procedure so it appears next time.
      const hasInlineAftercare = !!capturedCustomProcedureAftercare;
      const procBody: Record<string, unknown> = {
        name: capturedCustomProcedure,
        description: "",
        approved: hasInlineAftercare,
      };
      if (hasInlineAftercare) procBody.aftercare_instructions = capturedCustomProcedureAftercare;
      if (capturedCustomProcedureReminderDays !== null) procBody.reminder_days = capturedCustomProcedureReminderDays;
      try {
        const procRes = await fetch("/api/procedures", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(procBody),
        });
        if (procRes.ok) {
          const pd = await procRes.json();
          savedCustomProcedureId = pd.procedure?.id ?? null;
          if (hasInlineAftercare) customAftercareInstructions = capturedCustomProcedureAftercare;
          // Refresh procedure list so it shows up next time
          setProcedures(prev => {
            if (!pd.procedure) return prev;
            const exists = prev.some(p => p.id === pd.procedure.id);
            return exists ? prev.map(p => p.id === pd.procedure.id ? pd.procedure : p) : [pd.procedure, ...prev];
          });
        }
      } catch { /* fall through — treatment still logs */ }

      // Generate prep guide for custom procedure
      try {
        const prepRes = await fetch("/api/generate-prep-instructions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ procedure_name: capturedCustomProcedure }),
        });
        if (prepRes.ok) { const d = await prepRes.json(); aiPrepInstructions = d.instructions ?? null; }
      } catch { /* fall through */ }

      // AI-generate aftercare only if nurse didn't provide inline instructions
      if (!hasInlineAftercare && selectedProcedures.length === 0) {
        try {
          const aftercareRes = await fetch("/api/generate-aftercare", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ procedure_name: capturedCustomProcedure }),
          });
          if (aftercareRes.ok) { const d = await aftercareRes.json(); customAftercareInstructions = d.instructions ?? null; }
        } catch { /* fall through */ }
      }
    }

    // Use saved custom procedure id when available so the treatment links to a real procedure
    const effectiveProcedureId = newTreatment.procedure_ids[0] ?? savedCustomProcedureId ?? null;
    const effectiveProcedureIds = newTreatment.procedure_ids.length > 0
      ? newTreatment.procedure_ids
      : (savedCustomProcedureId ? [savedCustomProcedureId] : []);

    const res = await fetch("/api/treatments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intake_id: capturedIntakeId || null,
        procedure_id: effectiveProcedureId,
        procedure_ids: effectiveProcedureIds,
        procedure_name: procedureNames,
        custom_aftercare_instructions: customAftercareInstructions,
        treatment_date: newTreatment.treatment_date,
        notes: newTreatment.notes,
        extra_aftercare_notes: extraAftercareNotes.trim() || null,
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
      if (capturedIsWalkin) {
        fetch("/api/intakes", { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => { if (d.intakes) setIntakes(d.intakes); })
          .catch(() => {});
      }
      setTreatmentSubmitted(true);
      setNewTreatment({ intake_id: "", procedure_ids: [], procedure_name: "", treatment_date: toLocalDateString(), notes: "", is_walkin: false, walkin_name: "", walkin_email: "", walkin_phone: "", send_aftercare: true, came_via_bot: false });
      setExtraAftercareNotes("");
      setCustomProcedure("");
      setCustomProcedureAftercare("");
      setCustomProcedureReminderDays(null);
      setAddingTreatment(false);
      clearDraft(nurseId);
      setDraftBanner(null);
      const loggedTreatment = j.treatment;
      flash(
        loggedTreatment?.aftercare_sent_at
          ? `Treatment logged and aftercare sent for ${procedureNames}! 💙`
          : loggedTreatment?.aftercare_send_at
          ? `Treatment logged! 💙 Aftercare will send to ${capturedClientName} in about 60 minutes.`
          : "Treatment logged!"
      );

      // Rebook: PATCH the newly created treatment to set next_appointment_at — no second treatment row.
      if (capturedRebookChecked && capturedRebookDate && j.treatment?.id) {
        const rebookProcNames = procedures
          .filter(p => capturedRebookProcedureIds.includes(p.id))
          .map(p => p.name).join(", ");
        const rebookEffectiveProcName = rebookProcNames || capturedRebookCustomProcedure || procedureNames;

        await fetch("/api/treatments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: "set_next_appointment",
            id: j.treatment.id,
            next_appointment_at: capturedRebookDate,
            next_appointment_procedures: rebookEffectiveProcName,
          }),
        });

        setRebookChecked(false);
        setRebookDate("");
        setRebookProcedureIds([]);
        setRebookCustomProcedure("");

        // Offer prep guide for the upcoming appointment
        if (j.treatment.intake_id && !capturedIsWalkin) {
          const instructions = defaultPrepInstructions(rebookEffectiveProcName);
          const formattedDate = new Date(capturedRebookDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          setPrepPrompt({
            intakeId: j.treatment.intake_id,
            clientName: capturedClientName,
            procedureName: rebookEffectiveProcName,
            instructions,
            appointmentDate: formattedDate,
          });
          setPrepTab("auto");
          setPrepCustomText(instructions);
        }
      }
    } else {
      const j = await res.json().catch(() => ({})) as { error?: string; procedures?: string[] };
      if (j.error === "unapproved_procedures" && j.procedures?.length) {
        setTreatmentError(`Aftercare hasn't been set up for ${j.procedures.join(", ")} yet. Tap the procedure name above to add aftercare instructions first.`);
      } else {
        setTreatmentError(j.error ?? "Couldn't save the treatment. Try again.");
      }
    }
    setTreatmentSaving(false);
  }, [newTreatment, customProcedure, customProcedureAftercare, customProcedureReminderDays, rebookChecked, rebookDate, rebookProcedureIds, rebookCustomProcedure, procedures, token, intakes]);

  // ── Scheduled aftercare: Send now / Cancel ────────────────────────────────

  // "Send now" — cancels any pending Resend job and delivers immediately.
  // Only shown when aftercare_send_at is set (the scheduled banner).
  const handleAftercareSendNow = useCallback(async (treatmentId: string) => {
    setAftercareSendNowId(treatmentId);
    try {
      const res = await fetch(`/api/treatments/${treatmentId}/aftercare-now`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (res.ok) {
        const sentAt = j.sent_at as string;
        setTreatments(prev => prev.map(t =>
          t.id === treatmentId
            ? { ...t, aftercare_sent_at: sentAt, aftercare_send_at: null }
            : t
        ));
        if (j.already_sent) {
          const d = new Date(sentAt);
          const formatted = isNaN(d.getTime()) ? "" : ` on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          flash(`Already sent${formatted} ✅`);
        } else {
          flash("Aftercare sent now! 💙");
        }
      } else {
        flash(j.error ?? "Couldn't send aftercare right now");
      }
    } catch {
      flash("Couldn't send aftercare right now");
    }
    setAftercareSendNowId(null);
  }, [token]);

  // "Send aftercare" — schedules the email 1 hour out, same as the normal logging flow.
  // Shown on Not-sent visits (no aftercare_send_at and not yet delivered).
  const handleAftercareSchedule = useCallback(async (treatmentId: string) => {
    setAftercareSchedulingId(treatmentId);
    try {
      const res = await fetch("/api/send-aftercare", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ treatment_id: treatmentId }),
      });
      const j = await res.json();
      if (res.status === 409 && j.already_sent) {
        const sentAt = j.sent_at as string;
        setTreatments(prev => prev.map(t =>
          t.id === treatmentId ? { ...t, aftercare_sent_at: sentAt, aftercare_send_at: null } : t
        ));
        const d = new Date(sentAt);
        const formatted = isNaN(d.getTime()) ? "" : ` on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        flash(`Already sent${formatted} ✅`);
      } else if (res.status === 409 && j.already_scheduled) {
        setTreatments(prev => prev.map(t =>
          t.id === treatmentId ? { ...t, aftercare_send_at: j.scheduled_at ?? t.aftercare_send_at } : t
        ));
        flash("Aftercare is already scheduled 💙");
      } else if (res.ok && j.success) {
        setTreatments(prev => prev.map(t =>
          t.id === treatmentId ? { ...t, aftercare_send_at: j.aftercare_send_at ?? null } : t
        ));
        flash("Aftercare scheduled! 💙");
      } else {
        flash(j.error ?? "Couldn't schedule aftercare right now");
      }
    } catch {
      flash("Couldn't schedule aftercare right now");
    }
    setAftercareSchedulingId(null);
  }, [token]);


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
      if (showArchived) await loadArchivedTreatments();
    }
    setArchiveConfirmId(null);
    setArchivingId(null);
  }, [token, showArchived, loadArchivedTreatments]);

  const handleIntakeSelect = useCallback((intakeId: string) => {
    const intake = intakes.find(i => i.id === intakeId);
    setNewTreatment(p => ({
      ...p,
      intake_id: intakeId,
      came_via_bot: intake?.came_via_bot === true ? true : p.came_via_bot,
    }));
  }, [intakes]);

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
    <div className="flex min-h-screen">
      <SideNavRail />
      <div className="flex-1 min-w-0 sm:pl-20">
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
              <h1 className="text-sm font-bold text-[#1a2744] sm:text-base truncate">Treatment Records 🩹</h1>
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

        {/* ── Treatments ─────────────────────────────────────────────── */}
        <div className="space-y-4">
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
              onClick={() => {
                const draft = readDraft(nurseId);
                const hasMeaningfulDraft = draft && (
                  draft.newTreatment?.intake_id ||
                  draft.newTreatment?.is_walkin ||
                  draft.newTreatment?.procedure_ids?.length > 0 ||
                  draft.customProcedure ||
                  draft.newTreatment?.notes
                );
                if (hasMeaningfulDraft) {
                  // Resolve a display label for the client in the banner
                  let clientLabel = "unknown client";
                  if (draft.newTreatment?.is_walkin && draft.newTreatment?.walkin_name?.trim()) {
                    clientLabel = draft.newTreatment.walkin_name.trim().split(" ")[0];
                  } else if (draft.newTreatment?.intake_id) {
                    const match = intakes.find(i => i.id === draft.newTreatment.intake_id);
                    if (match) clientLabel = match.first_name.split(" ")[0];
                  }
                  setDraftBanner({ savedAt: draft.savedAt, clientLabel });
                  setAddingTreatment(true);
                  setTreatmentSubmitted(false);
                } else {
                  clearDraft(nurseId);
                  setAddingTreatment(true);
                  setCustomProcedure("");
                  setTreatmentSubmitted(false);
                }
              }}
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
                {procedures.filter(p => p.approved_at).length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {procedures.filter(p => p.approved_at).map(p => (
                      <span key={p.id} className="rounded-full bg-white border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-700">
                        {p.name} → {p.reminder_days ? `${p.reminder_days} days` : `${DEFAULT_RETURN_DAYS} days (default) — tap to change`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400 italic">No approved treatments yet — add one above to see its reminder schedule.</p>
                )}
                {procedures.filter(p => p.approved_at && !p.reminder_days).length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
                    <p className="text-xs font-bold text-amber-900">⚠️ Set when clients come back</p>
                    {procedures.filter(p => p.approved_at && !p.reminder_days).map(p => (
                      <p key={p.id} className="text-xs text-amber-800">
                        Set when clients come back for <strong>{p.name}</strong> — currently using the {DEFAULT_RETURN_DAYS}-day default.
                      </p>
                    ))}
                    <p className="text-xs text-amber-700 mt-1">Edit each procedure in the Templates tab to set the right interval.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Log treatment form */}
          {addingTreatment && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-[#1a2744]">Log a treatment 💉</h3>

              {/* Draft banner */}
              {draftBanner && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-amber-900">
                    📝 You have an unfinished treatment for{" "}
                    <strong>{draftBanner.clientLabel}</strong>
                    {" "}(started{" "}
                    {new Date(draftBanner.savedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const draft = readDraft(nurseId);
                        if (!draft) { setDraftBanner(null); return; }
                        setNewTreatment(draft.newTreatment ?? newTreatment);
                        setCustomProcedure(draft.customProcedure ?? "");
                        setCustomProcedureAftercare(draft.customProcedureAftercare ?? "");
                        setCustomProcedureReminderDays(draft.customProcedureReminderDays ?? null);
                        setExtraAftercareNotes(draft.extraAftercareNotes ?? "");
                        setRebookChecked(draft.rebookChecked ?? false);
                        setRebookDate(draft.rebookDate ?? "");
                        setRebookProcedureIds(draft.rebookProcedureIds ?? []);
                        setRebookCustomProcedure(draft.rebookCustomProcedure ?? "");
                        setDraftBanner(null);
                      }}
                      className="rounded-full bg-amber-700 px-4 py-1.5 text-sm font-bold text-white"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearDraft(nurseId);
                        setDraftBanner(null);
                        setNewTreatment({ intake_id: "", procedure_ids: [], procedure_name: "", treatment_date: toLocalDateString(), notes: "", is_walkin: false, walkin_name: "", walkin_email: "", walkin_phone: "", send_aftercare: true, came_via_bot: false });
                        setCustomProcedure(""); setCustomProcedureAftercare(""); setCustomProcedureReminderDays(null);
                        setExtraAftercareNotes(""); setRebookChecked(false); setRebookDate(""); setRebookProcedureIds([]); setRebookCustomProcedure("");
                      }}
                      className="rounded-full border border-amber-300 px-4 py-1.5 text-sm font-semibold text-amber-900"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}

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
                      {newTreatment.intake_id && (() => {
                        const selected = intakes.find(i => i.id === newTreatment.intake_id);
                        if (!selected) return null;
                        return (
                          <div className="mt-2">
                            <ClientContactCard
                              name={`${selected.first_name} ${selected.last_name || ""}`.trim()}
                              phone={selected.phone ?? null}
                              email={selected.email ?? null}
                              badge={selected.came_via_bot ? <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-600">🤖 Via bot</span> : undefined}
                            />
                          </div>
                        );
                      })()}
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
                  {/* Custom procedure */}
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Or add a custom procedure</label>
                      <input
                        type="text"
                        value={customProcedure}
                        onChange={e => { setCustomProcedure(e.target.value); setCustomProcedureAftercare(""); setCustomProcedureReminderDays(null); }}
                        placeholder="e.g. Jawline Filler, Lip Flip, Morpheus8…"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                      />
                    </div>
                    {customProcedure.trim() && (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-indigo-800">
                            Aftercare for &quot;{customProcedure.trim()}&quot; <span className="font-normal text-indigo-600">(leave blank to skip sending aftercare)</span>
                          </label>
                          <textarea
                            value={customProcedureAftercare}
                            onChange={e => setCustomProcedureAftercare(e.target.value)}
                            placeholder={"e.g. Keep the area clean and avoid sun exposure for 48 hours…"}
                            rows={4}
                            className="w-full resize-none rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-indigo-800">When should she come back?</label>
                          <select
                            value={customProcedureReminderDays ?? ""}
                            onChange={e => setCustomProcedureReminderDays(e.target.value ? Number(e.target.value) : null)}
                            className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488]"
                          >
                            <option value="">Not needed</option>
                            <option value="28">4 weeks</option>
                            <option value="90">3 months</option>
                            <option value="180">6 months</option>
                            <option value="270">9 months</option>
                            <option value="365">12 months</option>
                          </select>
                        </div>
                        <p className="text-xs text-indigo-600">✨ Saved as a new procedure so it&apos;s ready next time.</p>
                      </div>
                    )}
                  </div>
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

                {/* Extra aftercare notes */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Extra notes for this client&apos;s aftercare (optional)</label>
                  <textarea
                    value={extraAftercareNotes}
                    onChange={e => setExtraAftercareNotes(e.target.value)}
                    placeholder="e.g. More swelling than usual today — keep an eye on it and message us if it doesn't improve in 48 hours"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-[#0d9488]"
                  />
                  <p className="mt-1 text-xs text-slate-400">Added to this client&apos;s aftercare email in addition to the normal instructions — for anything unusual about today&apos;s visit.</p>
                </div>

                {(() => {
                  const unapproved = procedures.filter(p => newTreatment.procedure_ids.includes(p.id) && !p.approved_at);
                  if (unapproved.length === 0 || !newTreatment.send_aftercare) return null;
                  const approving = unapproved.find(p => p.id === inlineApproveId);
                  return (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
                      <p className="font-semibold text-amber-900">
                        {unapproved.map(p => p.name).join(", ")} {unapproved.length === 1 ? "has" : "have"} no approved aftercare yet
                      </p>
                      {!approving ? (
                        <>
                          <p className="text-sm text-amber-900/90">Your client wouldn&apos;t receive anything. Approve the instructions right here — takes about a minute.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setInlineApproveId(unapproved[0].id);
                              setInlineApproveText(unapproved[0].aftercare_instructions ?? "");
                              setInlineApproveReminderDays(unapproved[0].reminder_days ?? DEFAULT_RETURN_DAYS);
                              setInlineApproveError(null);
                            }}
                            className="text-amber-900 font-semibold underline text-sm"
                          >
                            Set up aftercare for {unapproved[0].name} →
                          </button>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-amber-900">Aftercare instructions for {approving.name}</p>
                          <textarea
                            value={inlineApproveText}
                            onChange={e => setInlineApproveText(e.target.value)}
                            rows={5}
                            className="w-full resize-none rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488]"
                            placeholder="e.g. Keep the area clean, avoid sun exposure for 48 hours…"
                          />
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-amber-900">When should she come back? <span className="font-normal">(required)</span></label>
                            <select
                              value={inlineApproveReminderDays ?? DEFAULT_RETURN_DAYS}
                              onChange={e => setInlineApproveReminderDays(Number(e.target.value))}
                              className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488]"
                            >
                              <option value="30">1 month</option>
                              <option value="90">3 months</option>
                              <option value="120">4 months</option>
                              <option value="180">6 months</option>
                              <option value="270">9 months</option>
                              <option value="365">12 months</option>
                            </select>
                          </div>
                          {/\[YOUR PHONE\]/i.test(inlineApproveText) && (
                            <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
                              {nurseClientPhone
                                ? <>Clients will see this number: <strong>{nurseClientPhone}</strong></>
                                : <>Your instructions contain <strong>[YOUR PHONE]</strong> but you haven{"'"}t saved a client phone number yet. Add it in <Link href="/account#practice" className="underline font-semibold">My Account → My Practice</Link>, or remove the placeholder above.</>
                              }
                            </p>
                          )}
                          {inlineApproveError && (
                            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{inlineApproveError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={inlineApproveSaving || !inlineApproveText.trim()}
                              onClick={async () => {
                                setInlineApproveSaving(true);
                                setInlineApproveError(null);
                                const r = await fetch("/api/procedures", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({
                                    id: approving.id,
                                    name: approving.name,
                                    approved: true,
                                    aftercare_instructions: inlineApproveText.trim(),
                                    reminder_days: inlineApproveReminderDays ?? DEFAULT_RETURN_DAYS,
                                  }),
                                });
                                if (r.ok) {
                                  const rd = await r.json();
                                  setProcedures(prev => prev.map(p => p.id === approving.id ? rd.procedure : p));
                                  setInlineApproveId(null);
                                } else {
                                  const rd = await r.json().catch(() => ({}));
                                  setInlineApproveError(rd.error ?? "Could not approve. Please try again.");
                                }
                                setInlineApproveSaving(false);
                              }}
                              className="flex-1 rounded-full bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                            >
                              {inlineApproveSaving ? "Saving…" : "Approve & continue"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineApproveId(null)}
                              className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setNewTreatment(p => ({ ...p, send_aftercare: false }))}
                        className="block text-sm text-amber-900/70 underline"
                      >
                        Log this treatment without sending aftercare
                      </button>
                    </div>
                  );
                })()}

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
                          // Default date = procedure.reminder_days from the first selected procedure
                          const firstProc = procedures.find(p => newTreatment.procedure_ids.includes(p.id));
                          const reminderDays = firstProc?.reminder_days ?? DEFAULT_RETURN_DAYS;
                          const d = new Date();
                          d.setUTCDate(d.getUTCDate() + reminderDays);
                          setRebookDate(toLocalDateString(d));
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
                        <div className="mt-2">
                          <label className="mb-1 block text-xs font-semibold text-slate-500">Or add a custom procedure</label>
                          <input
                            type="text"
                            value={rebookCustomProcedure}
                            onChange={e => setRebookCustomProcedure(e.target.value)}
                            placeholder="e.g. Jawline Filler, Lip Flip, Morpheus8…"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]"
                          />
                          {rebookCustomProcedure.trim() && !rebookProcedureIds.length && (
                            <p className="mt-1 text-xs text-indigo-500">✨ AI will generate a prep guide for &quot;{rebookCustomProcedure.trim()}&quot;</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {treatmentError && (
                  <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{treatmentError}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={treatmentSaving || treatmentSubmitted || (!newTreatment.intake_id && !newTreatment.is_walkin) || (newTreatment.procedure_ids.length === 0 && !customProcedure.trim()) || (newTreatment.send_aftercare && procedures.some(p => newTreatment.procedure_ids.includes(p.id) && !p.approved_at))}
                    onClick={() => void handleLogTreatment()}
                    style={{ touchAction: "manipulation" }}
                    className="min-h-[48px] flex-1 rounded-full bg-[#0d9488] px-6 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
                  >
                    {treatmentSaving ? "Saving…" : newTreatment.send_aftercare ? "Log & send aftercare 💙" : "Log treatment"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingTreatment(false); clearDraft(nurseId); setDraftBanner(null); setCustomProcedure(""); setCustomProcedureAftercare(""); setCustomProcedureReminderDays(null); setInlineApproveId(null); setTreatmentSubmitted(false); setTreatmentError(null); }}
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

          {/* Prep guide prompt — appears after rebook is logged */}
          {prepPrompt && (
            <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-5 shadow-sm">
              {prepSentDone ? (
                <div className="text-center py-2">
                  <p className="text-2xl mb-1">✅</p>
                  <p className="font-semibold text-teal-800">Sent to {prepPrompt.clientName}!</p>
                  <button type="button" onClick={() => { setPrepPrompt(null); setPrepSentDone(false); }}
                    className="mt-2 text-xs text-slate-500 underline">Dismiss</button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <p className="text-sm font-semibold text-[#1a2744]">
                      {prepPrompt.appointmentDate
                        ? `💌 Send a prep guide to ${prepPrompt.clientName} for their ${prepPrompt.procedureName} on ${prepPrompt.appointmentDate}?`
                        : `💌 Send a pre-appointment prep guide to ${prepPrompt.clientName}?`}
                    </p>
                    <button type="button" onClick={() => setPrepPrompt(null)}
                      className="shrink-0 text-xs text-slate-400 hover:text-slate-600 underline">Skip</button>
                  </div>
                  <div className="flex gap-2 mb-3">
                    {(["auto", "custom"] as const).map((id) => (
                      <button key={id} type="button" onClick={() => setPrepTab(id)}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                          prepTab === id ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                        {id === "auto" ? "✨ Auto" : "✏️ Customize"}
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
                      <button type="button" disabled={prepSending}
                        onClick={async () => {
                          setPrepSending(true);
                          try {
                            const res = await fetch("/api/send-prep-guide", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ intake_id: prepPrompt.intakeId, custom_instructions: prepPrompt.instructions }),
                            });
                            if (res.ok) setPrepSentDone(true);
                          } finally { setPrepSending(false); }
                        }}
                        className="w-full rounded-full bg-[#0d9488] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {prepSending ? "Sending…" : "Send prep guide 💌"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea value={prepCustomText} onChange={e => setPrepCustomText(e.target.value)}
                        rows={6} className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-teal-400" />
                      <button type="button" disabled={prepSending}
                        onClick={async () => {
                          setPrepSending(true);
                          try {
                            const res = await fetch("/api/send-prep-guide", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ intake_id: prepPrompt.intakeId, custom_instructions: prepCustomText }),
                            });
                            if (res.ok) setPrepSentDone(true);
                          } finally { setPrepSending(false); }
                        }}
                        className="w-full rounded-full bg-[#0d9488] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {prepSending ? "Sending…" : "Send customized guide 💌"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Client-grouped treatment cards */}
          {(() => {
            const groups: Map<string, Treatment[]> = new Map();
            for (const t of treatments) {
              const key = t.intake_id ?? (t.intakes?.email ?? `walk-in-${t.id}`);
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(t);
            }
            for (const [, g] of groups) g.sort((a, b) => (parseTreatmentDate(b.treatment_date)?.getTime() ?? 0) - (parseTreatmentDate(a.treatment_date)?.getTime() ?? 0));
            return Array.from(groups.entries()).map(([groupKey, groupTreatments]) => {
              const rep = groupTreatments[0];
              const clientName = rep.intakes?.first_name ?? "Walk-in Client";
              const clientEmail = rep.intakes?.email ?? "";
              const hasUnsent = groupTreatments.some(t =>
                !isAftercareDelivered(t, aftercareSentIds) && !t.aftercare_send_at
              );
              const isExpanded = expandedClientIds.has(groupKey) || (!expandedClientIds.has(`collapsed:${groupKey}`) && hasUnsent);
              const toggle = () => setExpandedClientIds(prev => {
                const next = new Set(prev);
                if (isExpanded) {
                  next.delete(groupKey);
                  next.add(`collapsed:${groupKey}`);
                } else {
                  next.add(groupKey);
                  next.delete(`collapsed:${groupKey}`);
                }
                return next;
              });
              return (
                <div key={groupKey} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div
                    onClick={toggle}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(); }}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition cursor-pointer"
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
                      {(() => {
                        // Find the most-urgent aftercare state across all visits in this group
                        const hasNotSent = groupTreatments.some(t => !isAftercareDelivered(t, aftercareSentIds) && !t.aftercare_send_at);
                        const scheduledT = groupTreatments.find(t => t.aftercare_send_at && !isAftercareDelivered(t, aftercareSentIds) && new Date(t.aftercare_send_at) > new Date());
                        if (hasNotSent) return <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">Not sent</span>;
                        if (scheduledT) return <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">💙 Sending at {formatScheduledTime(scheduledT.aftercare_send_at!)}</span>;
                        return null;
                      })()}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                        {groupTreatments.length} visit{groupTreatments.length !== 1 ? "s" : ""}
                      </span>
                      {rep.intake_id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClientId(rep.intake_id);
                            setEditClientForm({ first_name: clientName, email: clientEmail, phone: rep.intakes?.phone ?? "" });
                            setEditClientError(null);
                          }}
                          className="rounded-full p-1.5 text-slate-300 transition hover:bg-teal-50 hover:text-teal-500"
                          title="Edit client info"
                          aria-label="Edit client info"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                      )}
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {editingClientId === rep.intake_id && (
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input
                          value={editClientForm.first_name}
                          onChange={e => setEditClientForm(f => ({ ...f, first_name: e.target.value }))}
                          placeholder="Name"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400"
                        />
                        <input
                          value={editClientForm.email}
                          onChange={e => setEditClientForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="Email"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400"
                        />
                        <input
                          value={editClientForm.phone}
                          onChange={e => setEditClientForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="Phone"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400"
                        />
                      </div>
                      {editClientError && <p className="text-xs font-semibold text-red-600">{editClientError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={editClientSaving}
                          onClick={() => void handleUpdateClient()}
                          className="rounded-full bg-[#0d9488] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                        >
                          {editClientSaving ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingClientId(null); setEditClientError(null); }}
                          className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Treatment timeline */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {groupTreatments.map((treatment, idx) => (
                        <div key={treatment.id} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{treatment.procedure_name}</span>
                                {treatment.came_via_bot && (
                                  <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-700">🤖 Via bot</span>
                                )}
                                {treatment.notes === "Rebooked appointment" && (
                                  <span className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-semibold text-purple-700">📅 Rebooked</span>
                                )}
                                {isAftercareDelivered(treatment, aftercareSentIds) ? (
                                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">✅ Aftercare sent</span>
                                ) : treatment.aftercare_send_at && new Date(treatment.aftercare_send_at) > new Date() ? (
                                  <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">💙 Sending at {formatScheduledTime(treatment.aftercare_send_at)}</span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Not sent</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                {formatTreatmentDate(treatment.treatment_date, { month: "long", day: "numeric", year: "numeric" })}
                                {idx === 0 && <span className="ml-1 text-teal-600 font-semibold">· Latest</span>}
                              </p>
                              {treatment.notes && treatment.notes !== "Rebooked appointment" && (
                                <p className="mt-1 text-xs text-slate-600 italic">{treatment.notes}</p>
                              )}
                            </div>
                            {/* Archive button */}
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
                          {/* Not-sent: inline Send aftercare button */}
                          {!isAftercareDelivered(treatment, aftercareSentIds) && !treatment.aftercare_send_at && (
                            <div className="mt-2">
                              <button
                                type="button"
                                disabled={aftercareSchedulingId === treatment.id}
                                onClick={(e) => { e.stopPropagation(); void handleAftercareSchedule(treatment.id); }}
                                className="rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                              >
                                {aftercareSchedulingId === treatment.id ? "Scheduling…" : "Send aftercare"}
                              </button>
                            </div>
                          )}
                          {/* Scheduled aftercare banner */}
                          {treatment.aftercare_send_at && !isAftercareDelivered(treatment, aftercareSentIds) && new Date(treatment.aftercare_send_at) > new Date() && (
                            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-xs text-blue-800 font-medium">
                                  💙 Aftercare will send to <strong>{clientName}</strong> at {formatScheduledTime(treatment.aftercare_send_at)}
                                </p>
                                <div className="flex gap-2 shrink-0">
                                  <button
                                    type="button"
                                    disabled={aftercareSendNowId === treatment.id}
                                    onClick={(e) => { e.stopPropagation(); void handleAftercareSendNow(treatment.id); }}
                                    className="rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                                  >
                                    {aftercareSendNowId === treatment.id ? "Sending…" : "Send now"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setCancelPopupId(treatment.id); }}
                                    className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                              {/* Cancel-choice popup */}
                              {cancelPopupId === treatment.id && (
                                <CancelAftercarePopup
                                  treatmentId={treatment.id}
                                  token={token}
                                  onCanceled={() => {
                                    setTreatments(prev => prev.map(t =>
                                      t.id === treatment.id ? { ...t, aftercare_send_at: null } : t
                                    ));
                                    setCancelPopupId(null);
                                    flash("Scheduled aftercare canceled. You can send it manually later.");
                                  }}
                                  onChangeIt={() => {
                                    setTreatments(prev => prev.map(t =>
                                      t.id === treatment.id ? { ...t, aftercare_send_at: null } : t
                                    ));
                                    setCancelPopupId(null);
                                    router.push(
                                      `/client-journey?aftercare=${treatment.intake_id ?? ""}&treatment_id=${treatment.id}&treatment_date=${treatment.treatment_date}${treatment.procedure_id ? `&procedure_id=${treatment.procedure_id}` : ""}`
                                    );
                                  }}
                                  onDismiss={() => setCancelPopupId(null)}
                                />
                              )}
                            </div>
                          )}

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
                    </div>
                  )}
                </div>
              );
            });
          })()}

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
                    {formatTreatmentDate(treatment.treatment_date, { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
      </div>
    </div>
  );
}
