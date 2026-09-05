"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Reminder = {
  id: string;
  client_name: string;
  phone: string | null;
  procedure_name: string;
  days_since: number;
  due_date: string;
  status: "pending" | "done" | "no_answer_snoozed";
  note: string | null;
  script: string;
};

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function duePill(dueDate: string): string {
  const today = todayUTC();
  const tomorrow = tomorrowUTC();
  if (dueDate === today) return "Due today";
  if (dueDate === tomorrow) return "Due tomorrow";
  const d = new Date(dueDate + "T00:00:00Z");
  return "Due " + d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function ReminderCard({
  reminder,
  onPatch,
}: {
  reminder: Reminder;
  onPatch: (id: string, action: "complete" | "no_answer" | "note", note?: string) => Promise<void>;
}) {
  const [callClicked, setCallClicked] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(reminder.note ?? "");
  const [saving, setSaving] = useState(false);
  const today = todayUTC();
  const isToday = reminder.due_date === today;
  const firstName = reminder.client_name.split(" ")[0];

  const handleComplete = async () => {
    setSaving(true);
    await onPatch(reminder.id, "complete");
    setSaving(false);
  };

  const handleNoAnswer = async () => {
    setSaving(true);
    await onPatch(reminder.id, "no_answer");
    setSaving(false);
    setCallClicked(false);
  };

  const handleSaveNote = async () => {
    setSaving(true);
    await onPatch(reminder.id, "note", noteText);
    setSaving(false);
    setNoteOpen(false);
  };

  if (reminder.status === "done") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 opacity-50">
        <div className="flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <span className="text-sm font-semibold text-slate-500">Completed — {reminder.client_name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border bg-white px-5 py-5 shadow-sm ${isToday ? "border-2 border-teal-400" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#1a2744]">{reminder.client_name}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {reminder.days_since} day{reminder.days_since !== 1 ? "s" : ""} after {reminder.procedure_name}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
          isToday ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
        }`}>
          {duePill(reminder.due_date)}
        </span>
      </div>

      <blockquote className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 border-l-4 border-teal-300">
        {reminder.script}
      </blockquote>

      <div className="mt-4 flex flex-col gap-2">
        {!callClicked ? (
          reminder.phone ? (
            <a
              href={`tel:${reminder.phone}`}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
              onClick={() => setCallClicked(true)}
            >
              📞 Call {firstName}
            </a>
          ) : (
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
              onClick={() => setCallClicked(true)}
            >
              📞 Call {firstName}
            </button>
          )
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-medium text-[#1a2744]">Did you reach {firstName}?</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleComplete}
                className="flex-1 rounded-full bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                Yes, complete
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleNoAnswer}
                className="flex-1 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                No answer
              </button>
            </div>
          </div>
        )}

        {!noteOpen ? (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="text-xs text-slate-400 hover:text-teal-600 text-left transition"
          >
            + Add note
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <textarea
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note about this call…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#1a2744] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveNote}
                className="rounded-full bg-slate-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50"
              >
                Save note
              </button>
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckinPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sessionData.session) { router.replace("/auth"); return; }
      const t = sessionData.session.access_token;
      setToken(t);
      const res = await fetch("/api/checkin-reminders", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!cancelled && res.ok) {
        const json = await res.json();
        setReminders(json.reminders ?? []);
        setTotal(json.total ?? 0);
        setDone(json.done ?? 0);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handlePatch = useCallback(async (
    id: string,
    action: "complete" | "no_answer" | "note",
    note?: string
  ) => {
    if (!token) return;
    const res = await fetch("/api/checkin-reminders", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, note }),
    });
    if (!res.ok) return;
    const json = await res.json();
    const updated = json.reminder;
    if (!updated) return;

    setReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: updated.status,
              due_date: updated.due_date,
              note: updated.note ?? r.note,
            }
          : r
      )
    );
    if (action === "complete") {
      setDone((d) => d + 1);
    }
  }, [token]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-[#1a2744]/80">Loading check-ins…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-[#1a2744]">Client Check-Ins 📞</h1>
              <p className="text-xs text-slate-500">Personal follow-up, made simple.</p>
            </div>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* ── Week header ── */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-[#1a2744]">This week&apos;s follow-ups</p>
            <p className="mt-0.5 text-sm text-slate-500">You&apos;re the kind of injector who checks in.</p>
          </div>
          <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-700">
            {done} of {total} completed
          </span>
        </div>

        {total === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-2xl mb-2">🌿</p>
            <p className="text-sm text-slate-500">Nothing due this week. Your clients already know you&apos;ve got them.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reminders.map((r) => (
              <ReminderCard key={r.id} reminder={r} onPatch={handlePatch} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
