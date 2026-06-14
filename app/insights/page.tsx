"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type InsightsData = {
  totalConversations: number;
  totalIntakes: number;
  conversionRate: number;
  clientsFromBot: number;
  clientsFromBooking: number;
  treatmentsLogged: number;
  aftercareSent: number;
  remindersSent: number;
  reviewsRequested: number;
  emergencyAlerts: number;
  intakesThisMonth: number;
  intakesLastMonth: number;
  topProcedure: string | null;
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

function StatCard({
  emoji,
  value,
  label,
  gradient,
  border,
  sub,
}: {
  emoji: string;
  value: string | number;
  label: string;
  gradient: string;
  border: string;
  sub?: string;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-5`}>
      <span className="text-2xl">{emoji}</span>
      <p className="mt-3 text-3xl font-bold text-[#1a2744]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function BarList({
  items,
  colorClass,
  emptyMsg,
  labelKey,
  countLabel,
}: {
  items: { label: string; count: number }[];
  colorClass: string;
  emptyMsg: string;
  labelKey?: never;
  countLabel: string;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{emptyMsg}</p>;
  }
  const max = items[0]?.count ?? 1;
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-5 shrink-0 text-xs font-bold text-slate-400">#{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-[#1a2744]">{item.label}</span>
              <span className="shrink-0 text-xs font-bold text-[#0d9488]">{item.count} {countLabel}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${colorClass}`}
                style={{ width: `${Math.min(100, (item.count / max) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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

  // Month-over-month change
  const thisMonth = data?.intakesThisMonth ?? 0;
  const lastMonth = data?.intakesLastMonth ?? 0;
  const momChange =
    lastMonth === 0
      ? thisMonth > 0 ? 100 : 0
      : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  const momUp = momChange >= 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-[#1a2744]">Insights 📊</h1>
              <p className="text-xs text-slate-500">Your practice at a glance</p>
            </div>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">

        {/* ── Hero banner ── */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] via-[#0d4f6b] to-[#0d9488] px-6 py-6 sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_0%,rgba(56,189,248,0.2),transparent)]" aria-hidden />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Your data</p>
            <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
              {data?.topProcedure
                ? `Top procedure: ${data.topProcedure} 💙`
                : "Know your numbers 💙"}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-200">
              Use these insights to grow your practice, improve your bot, and make sure your automations are actually working.
            </p>
          </div>
        </div>

        {/* ── Section 1: AdonisBlue Impact ── */}
        <div className="mb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0d9488]">Your AdonisBlue Impact</p>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard emoji="🤖" value={data?.clientsFromBot ?? 0} label="Clients from bot" gradient="from-teal-50 to-sky-50" border="border-teal-100" sub="via AI chatbot" />
          <StatCard emoji="🔗" value={data?.clientsFromBooking ?? 0} label="Clients from booking" gradient="from-sky-50 to-blue-50" border="border-sky-100" sub="via booking software" />
          <StatCard emoji="📈" value={`${data?.conversionRate ?? 0}%`} label="Conversion rate" gradient="from-blue-50 to-indigo-50" border="border-blue-100" sub="conversations → intakes" />
          <StatCard emoji="💉" value={data?.treatmentsLogged ?? 0} label="Treatments logged" gradient="from-indigo-50 to-purple-50" border="border-indigo-100" sub="total procedures" />
        </div>

        {/* ── Section 2: Automation Working for You ── */}
        <div className="mb-2 mt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0d9488]">Automation Working for You</p>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard emoji="💌" value={data?.aftercareSent ?? 0} label="Aftercare emails sent" gradient="from-purple-50 to-pink-50" border="border-purple-100" />
          <StatCard emoji="🔁" value={data?.remindersSent ?? 0} label="Rebooking reminders" gradient="from-pink-50 to-rose-50" border="border-pink-100" />
          <StatCard emoji="⭐" value={data?.reviewsRequested ?? 0} label="Review requests sent" gradient="from-amber-50 to-yellow-50" border="border-amber-100" />
          <StatCard emoji="🚨" value={data?.emergencyAlerts ?? 0} label="Emergency alerts" gradient="from-red-50 to-orange-50" border="border-red-100" sub="healing chat flags" />
        </div>

        {/* ── Section 3: This Month vs Last Month ── */}
        <div className="mb-6 mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#0d9488]">This Month vs Last Month</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:items-center">
            <div className="text-center">
              <p className="text-4xl font-bold text-[#1a2744]">{thisMonth}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">New clients this month</p>
            </div>
            <div className="flex flex-col items-center">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${momUp ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-600"}`}>
                {momUp ? "▲" : "▼"} {Math.abs(momChange)}%
              </span>
              <p className="mt-1 text-xs text-slate-400">vs last month</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-slate-400">{lastMonth}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">New clients last month</p>
            </div>
          </div>
        </div>

        {/* ── Section 4: Detail lists ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top questions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-[#1a2744]">❓ What clients ask most</h3>
            <BarList
              items={(data?.topQuestions ?? []).map(q => ({ label: questionLabels[q.keyword] ?? q.keyword, count: q.count }))}
              colorClass="bg-gradient-to-r from-teal-400 to-sky-400"
              emptyMsg="No conversation data yet — start sharing your bot link!"
              countLabel="x"
            />
          </div>

          {/* Top services */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-[#1a2744]">💉 Most requested services</h3>
            <BarList
              items={(data?.topServices ?? []).map(s => ({ label: s.service, count: s.count }))}
              colorClass="bg-gradient-to-r from-purple-400 to-pink-400"
              emptyMsg="No intake data yet."
              countLabel="clients"
            />
          </div>

          {/* Referral sources */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-[#1a2744]">📍 Where clients find you</h3>
            <BarList
              items={(data?.topReferrals ?? []).map(r => ({ label: r.source, count: r.count }))}
              colorClass="bg-gradient-to-r from-amber-400 to-orange-400"
              emptyMsg="No referral data yet."
              countLabel="clients"
            />
          </div>

          {/* Tips */}
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
