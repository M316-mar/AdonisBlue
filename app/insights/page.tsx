"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type InsightsData = {
  totalConversations: number;
  totalIntakes: number;
  topQuestions: { keyword: string; count: number }[];
  topServices: { service: string; count: number }[];
  topReferrals: { source: string; count: number }[];
};

const questionLabels: Record<string, string> = {
  price: "💰 Pricing questions",
  cost: "💰 Cost questions",
  hurt: "😟 Does it hurt?",
  pain: "😟 Pain concerns",
  safe: "🛡️ Safety questions",
  booking: "📅 Booking questions",
  book: "📅 How to book",
  filler: "💉 Filler questions",
  botox: "✨ Botox questions",
  lip: "👄 Lip questions",
  cheek: "✨ Cheek questions",
  prp: "🩸 PRP questions",
  appointment: "📅 Appointment questions",
  long: "⏳ How long does it last?",
  last: "⏳ Results longevity",
  result: "📸 Results questions",
  before: "📸 Before/after questions",
  after: "📸 Aftercare questions",
  bruise: "🩹 Bruising concerns",
  swelling: "🩹 Swelling concerns",
  recovery: "🩹 Recovery questions",
};

export default function InsightsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<InsightsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sessionData.session) {
        router.replace("/auth");
        return;
      }
      const token = sessionData.session.access_token;
      const res = await fetch("/api/myinsights", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!cancelled && res.ok) {
        const json = await res.json();
        setData(json);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-[#1a2744]/80">Loading your insights…</p>
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
              <h1 className="text-base font-bold text-[#1a2744]">Conversation Insights 📊</h1>
              <p className="text-xs text-slate-500">What your clients are asking</p>
            </div>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Hero banner */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] via-[#0d4f6b] to-[#0d9488] px-6 py-6 sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_0%,rgba(56,189,248,0.2),transparent)]" aria-hidden />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Your data</p>
            <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">What are your clients really asking? 💙</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-200">
              Use these insights to improve your bot, update your services, and create better content for your practice.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Conversations", value: data?.totalConversations ?? 0, emoji: "💬", color: "from-teal-50 to-sky-50 border-teal-100" },
            { label: "Client Intakes", value: data?.totalIntakes ?? 0, emoji: "💌", color: "from-sky-50 to-blue-50 border-sky-100" },
            { label: "Top Questions Tracked", value: data?.topQuestions.length ?? 0, emoji: "❓", color: "from-purple-50 to-indigo-50 border-purple-100" },
            { label: "Referral Sources", value: data?.topReferrals.length ?? 0, emoji: "📍", color: "from-pink-50 to-rose-50 border-pink-100" },
          ].map(stat => (
            <div key={stat.label} className={`rounded-2xl border bg-gradient-to-br ${stat.color} p-5`}>
              <p className="text-2xl font-bold text-[#1a2744]">{stat.value}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{stat.emoji} {stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top questions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-[#1a2744]">❓ What clients ask most</h3>
            {(data?.topQuestions ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No conversation data yet — start sharing your bot link!</p>
            ) : (
              <div className="space-y-3">
                {(data?.topQuestions ?? []).map((q, i) => (
                  <div key={q.keyword} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-slate-400">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1a2744]">{questionLabels[q.keyword] ?? q.keyword}</span>
                        <span className="text-xs font-bold text-[#0d9488]">{q.count}x</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-400 to-sky-400"
                          style={{ width: `${Math.min(100, (q.count / ((data?.topQuestions[0]?.count ?? 1))) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top services */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-[#1a2744]">💉 Most requested services</h3>
            {(data?.topServices ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No intake data yet.</p>
            ) : (
              <div className="space-y-3">
                {(data?.topServices ?? []).map((s, i) => (
                  <div key={s.service} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-slate-400">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1a2744]">{s.service}</span>
                        <span className="text-xs font-bold text-[#0d9488]">{s.count} clients</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400"
                          style={{ width: `${Math.min(100, (s.count / ((data?.topServices[0]?.count ?? 1))) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Referral sources */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-[#1a2744]">📍 Where clients find you</h3>
            {(data?.topReferrals ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No referral data yet.</p>
            ) : (
              <div className="space-y-3">
                {(data?.topReferrals ?? []).map((r, i) => (
                  <div key={r.source} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-slate-400">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1a2744]">{r.source}</span>
                        <span className="text-xs font-bold text-[#0d9488]">{r.count} clients</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
                          style={{ width: `${Math.min(100, (r.count / ((data?.topReferrals[0]?.count ?? 1))) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips based on data */}
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 p-6">
            <h3 className="mb-4 text-base font-bold text-[#1a2744]">💡 Tips based on your data</h3>
            <div className="space-y-3">
              {[
                { tip: "Add pricing FAQs to your bot — pricing is always the #1 question clients ask.", emoji: "💰" },
                { tip: "Post before/after photos on Instagram — clients who see results convert faster.", emoji: "📸" },
                { tip: "Add a 'Does it hurt?' answer to your bot greeting — it removes the biggest fear.", emoji: "😊" },
                { tip: "Send aftercare emails the same day as the appointment for best results.", emoji: "💌" },
              ].map(item => (
                <div key={item.tip} className="flex items-start gap-3 rounded-xl border border-teal-100 bg-white p-3">
                  <span className="text-lg">{item.emoji}</span>
                  <p className="text-xs leading-relaxed text-slate-600">{item.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
