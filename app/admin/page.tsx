"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type NurseRow = {
  practice_name: string | null;
  bot_name: string | null;
  slug: string | null;
  launched: boolean | null;
  frozen: boolean | null;
  created_at: string;
  nurse_id: string;
  total_intakes: number;
  reviews_sent: number;
  aftercare_sent: number;
  last_active: string;
};

type FeedbackRow = {
  id: string;
  nurse_name: string | null;
  message: string | null;
  created_at: string;
};

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-practice";
}

function botSlug(row: NurseRow): string {
  if (row.slug?.trim()) return row.slug.trim();
  return slugify((row.bot_name || row.practice_name || "my-bot").trim());
}

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [nurses, setNurses] = useState<NurseRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [freezeLoading, setFreezeLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"nurses" | "feedback">("nurses");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("adminAuth") !== "true") {
      router.replace("/admin-login");
      return;
    }
    fetch("/api/admin/nurses-public")
      .then(r => r.json())
      .then(json => {
        setNurses(Array.isArray(json.nurses) ? json.nurses : []);
        setFeedback(Array.isArray(json.feedback) ? json.feedback : []);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [router]);

  const handleFreezeToggle = useCallback(async (nurse: NurseRow) => {
    const nextFrozen = !nurse.frozen;
    setFreezeLoading(nurse.nurse_id);
    try {
      const res = await fetch("/api/admin/freeze-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurse_id: nurse.nurse_id, frozen: nextFrozen }),
      });
      if (res.ok) {
        setNurses(prev => prev.map(n => n.nurse_id === nurse.nurse_id ? { ...n, frozen: nextFrozen } : n));
      }
    } finally {
      setFreezeLoading(null);
    }
  }, []);

  const totalActive = nurses.filter(n => n.launched && !n.frozen).length;
  const totalFrozen = nurses.filter(n => n.frozen).length;
  const totalIntakes = nurses.reduce((sum, n) => sum + (n.total_intakes || 0), 0);
  const totalReviews = nurses.reduce((sum, n) => sum + (n.reviews_sent || 0), 0);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1628]">
        <p className="text-sm text-white/60">Loading admin dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1628] font-sans text-slate-200 antialiased">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d1628]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            <span className="text-base font-semibold text-white">AdonisBlue <span className="text-teal-400">Admin</span></span>
          </div>
          <button
            type="button"
            onClick={() => { sessionStorage.removeItem("adminAuth"); router.push("/"); }}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
          {[
            { label: "Total Nurses", value: nurses.length, emoji: "👩‍⚕️" },
            { label: "Active Bots", value: totalActive, emoji: "🟢" },
            { label: "Frozen", value: totalFrozen, emoji: "🔒" },
            { label: "Total Intakes", value: totalIntakes, emoji: "💌" },
            { label: "Reviews Sent", value: totalReviews, emoji: "⭐" },
            { label: "Feedback", value: feedback.length, emoji: "💬" },
          ].map(stat => (
            <div key={stat.label} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-400/8 to-transparent" aria-hidden />
              <div className="relative">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-400">{stat.emoji} {stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("nurses")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "nurses" ? "bg-teal-400 text-[#0d1628]" : "border border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
          >
            👩‍⚕️ Nurses ({nurses.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("feedback")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "feedback" ? "bg-teal-400 text-[#0d1628]" : "border border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
          >
            💬 Feedback ({feedback.length})
          </button>
        </div>

        {/* Nurses tab */}
        {tab === "nurses" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Practice</th>
                    <th className="px-4 py-3">Bot URL</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Clients</th>
                    <th className="px-4 py-3">Reviews</th>
                    <th className="px-4 py-3">Last Active</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {nurses.map(nurse => (
                    <tr key={nurse.nurse_id} className="align-middle transition hover:bg-white/3">
                      <td className="px-4 py-3 font-medium text-white">{nurse.practice_name?.trim() || "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/chat/${botSlug(nurse)}`} target="_blank" className="text-teal-400 hover:underline">
                          /chat/{botSlug(nurse)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          nurse.frozen
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                            : nurse.launched
                            ? "border-green-400/30 bg-green-400/10 text-green-300"
                            : "border-slate-400/30 bg-slate-400/10 text-slate-400"
                        }`}>
                          {nurse.frozen ? "🔒 Frozen" : nurse.launched ? "🟢 Active" : "⚪ Not launched"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{nurse.total_intakes || 0}</td>
                      <td className="px-4 py-3 text-slate-300">{nurse.reviews_sent || 0}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(nurse.last_active).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(nurse.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={freezeLoading === nurse.nurse_id}
                          onClick={() => void handleFreezeToggle(nurse)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            nurse.frozen
                              ? "border border-teal-400/30 bg-teal-400/10 text-teal-300 hover:bg-teal-400/20"
                              : "border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                          }`}
                        >
                          {freezeLoading === nurse.nurse_id ? "Saving…" : nurse.frozen ? "Unfreeze" : "Freeze"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {nurses.length === 0 && (
                <p className="py-12 text-center text-sm text-slate-500">No nurses yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Feedback tab */}
        {tab === "feedback" && (
          <div className="space-y-3">
            {feedback.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-slate-500">No feedback yet.</p>
              </div>
            )}
            {feedback.map(f => (
              <div key={f.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-sm">💬</div>
                    <div>
                      <p className="text-sm font-semibold text-white">{f.nurse_name || "Unknown nurse"}</p>
                      <p className="text-xs text-slate-500">{new Date(f.created_at).toLocaleDateString()} at {new Date(f.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 border-l-2 border-teal-400/30 pl-4">{f.message || "(no message)"}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
