"use client";
import { useState } from "react";

type Props = {
  treatmentId: string;
  token: string;
  /** "Don't send" succeeded — caller should clear aftercare_send_at from its state */
  onCanceled: () => void;
  /** "Change it" succeeded — cancel confirmed, caller should navigate to the edit screen */
  onChangeIt: () => void;
  /** "Never mind" — caller should close the popup without changing anything */
  onDismiss: () => void;
};

export default function CancelAftercarePopup({ treatmentId, token, onCanceled, onChangeIt, onDismiss }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doCancel(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/treatments/${treatmentId}/aftercare-cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json() as { ok?: boolean; already_sent?: boolean; error?: string };
      if (j.ok) return true;
      if (j.already_sent) {
        setError("Already sent — it's on its way!");
        return false;
      }
      setError(j.error ?? "Couldn't cancel. Try again.");
      return false;
    } catch {
      setError("Network error. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleDontSend() {
    const ok = await doCancel();
    if (ok) onCanceled();
  }

  async function handleChangeIt() {
    const ok = await doCancel();
    // Only proceed on confirmed cancel — never navigate if cancel failed (would send two emails)
    if (ok) onChangeIt();
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-md px-4 py-3">
      <p className="text-sm font-semibold text-[#1a2744] mb-3">What would you like to do?</p>
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleChangeIt()}
          className="rounded-full bg-teal-600 px-3 py-1.5 text-left text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Canceling…" : "✏️ Change it"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDontSend()}
          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
        >
          Don&apos;t send
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Never mind
        </button>
      </div>
    </div>
  );
}
