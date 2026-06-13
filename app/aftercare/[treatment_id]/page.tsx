"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AftercareData = {
  clientName: string;
  procedureName: string;
  practiceName: string;
  treatmentDate: string;
  aftercareInstructions: string;
  treatmentId: string;
};

export default function AftercarePage({
  params,
}: {
  params: Promise<{ treatment_id: string }>;
}) {
  const [treatmentId, setTreatmentId] = useState("");
  const [data, setData] = useState<AftercareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Resolve async params
  useEffect(() => {
    params.then((p) => setTreatmentId(p.treatment_id));
  }, [params]);

  // Fetch treatment data via the existing healing GET endpoint
  useEffect(() => {
    if (!treatmentId) return;
    (async () => {
      try {
        const res = await fetch(`/api/healing?treatment_id=${treatmentId}`);
        if (!res.ok) {
          setError("This aftercare link is invalid or has expired.");
          setLoading(false);
          return;
        }
        const json = await res.json();
        const treatment = json.treatment;

        setData({
          clientName: treatment?.intakes?.first_name || "there",
          procedureName:
            treatment?.procedures?.name ||
            treatment?.procedure_name ||
            "your procedure",
          practiceName: "Your Provider",
          treatmentDate: treatment?.treatment_date || "",
          aftercareInstructions:
            treatment?.procedures?.aftercare_instructions || "",
          treatmentId,
        });
      } catch {
        setError("Something went wrong. Please contact your provider directly.");
      }
      setLoading(false);
    })();
  }, [treatmentId]);

  const formattedDate = data?.treatmentDate
    ? new Date(data.treatmentDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d1628]">
        <p className="text-sm text-slate-400 animate-pulse">
          Loading your aftercare instructions…
        </p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d1628] px-4">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🩹</p>
          <p className="text-white font-semibold mb-2">
            {error || "Something went wrong."}
          </p>
          <p className="text-slate-400 text-sm">
            Please contact your provider directly for your aftercare
            instructions.
          </p>
        </div>
      </div>
    );
  }

  // ── Aftercare view ─────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-dvh bg-[#0d1628] text-white"
      style={{ overflowX: "hidden" }}
    >
      {/* Header */}
      <header
        className="bg-[#1a2744]"
        style={{
          borderBottom: "3px solid #0d9488",
          paddingTop: "max(1.25rem, env(safe-area-inset-top))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
          paddingBottom: "1.25rem",
        }}
      >
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 rounded-full bg-[#0d9488]/20 flex items-center justify-center text-xl">
            🌸
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-white truncate">
              Aftercare Instructions
            </h1>
            <p className="text-xs text-teal-300 truncate">
              {data.procedureName}
              {formattedDate ? ` · ${formattedDate}` : ""}
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main
        className="mx-auto max-w-2xl px-4 py-8 space-y-6"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Greeting card */}
        <div className="rounded-2xl border border-white/10 bg-[#1a2744] p-6 text-center">
          <p className="text-3xl mb-3">💙</p>
          <h2 className="text-xl font-bold text-white mb-2">
            You&rsquo;re glowing, {data.clientName}! 🌸
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Thank you for your visit. Below are your personal aftercare
            instructions to keep your results looking their absolute best.
          </p>
        </div>

        {/* Aftercare instructions */}
        {data.aftercareInstructions ? (
          <div className="rounded-2xl border border-[#0d9488]/30 bg-[#0d9488]/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📋</span>
              <h3 className="text-sm font-bold text-teal-300 uppercase tracking-wide">
                {data.procedureName} Aftercare
              </h3>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {data.aftercareInstructions}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-slate-400 text-sm">
              Your nurse will share specific aftercare instructions with you
              directly.
            </p>
          </div>
        )}

        {/* Emergency reminder */}
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-5 py-4">
          <p className="text-xs text-amber-300 leading-relaxed text-center">
            ⚠️ If you experience severe swelling, trouble breathing, or any
            medical emergency, call{" "}
            <a
              href="tel:911"
              className="font-bold underline"
              style={{ touchAction: "manipulation" }}
            >
              911
            </a>{" "}
            immediately.
          </p>
        </div>

        {/* Recovery chat CTA */}
        <div className="rounded-2xl border border-white/10 bg-[#1a2744] p-6 text-center space-y-3">
          <p className="text-base font-bold text-white">
            Have a recovery question? 💬
          </p>
          <p className="text-sm text-slate-400">
            Your 24/7 recovery assistant is here for you — ask anything about
            your healing.
          </p>
          <Link
            href={`/healing/${data.treatmentId}`}
            style={{ touchAction: "manipulation" }}
            className="inline-block min-h-[48px] w-full rounded-full bg-[#0d9488] px-6 py-3 text-sm font-bold text-white transition hover:bg-teal-700 active:scale-[0.98] text-center leading-tight flex items-center justify-center"
          >
            💬 Open recovery chat
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-600 pb-4">
          Sent with care via AdonisBlue · If you have concerns please contact
          your provider directly.
        </p>
      </main>
    </div>
  );
}
