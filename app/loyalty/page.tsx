"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type LoyaltyClient = {
  id: string;
  client_email: string;
  client_name: string;
  points: number;
  total_visits: number;
};

type ReferralData = {
  referral_link: string;
  referrals: { id: string; referred_email: string; status: string; created_at: string }[];
  confirmed_count: number;
  free_months_earned: number;
  slug?: string;
};

export default function ReferralsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<"loyalty" | "referrals" | "program">("program");
  const [loyalty, setLoyalty] = useState<LoyaltyClient[]>([]);
  const [intakes, setIntakes] = useState<{ id: string; first_name: string; last_name: string; email: string; phone: string }[]>([]);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [practiceName, setPracticeName] = useState("");
  const [addingPoints, setAddingPoints] = useState(false);
  const [newPoints, setNewPoints] = useState({ client_email: "", client_name: "", points: 10, send_email: true });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [program, setProgram] = useState({
    points_per_visit: 10,
    points_value: 100,
    discount_value: 10,
    expiry_days: 365,
    enabled: false,
    welcome_message: "",
  });
  const [programSaved, setProgramSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) { router.replace("/auth"); return; }
      const t = data.session.access_token;
      setToken(t);

      try {
        const [loyaltyRes, intakesRes, programRes] = await Promise.all([
          fetch("/api/loyalty", { headers: { Authorization: `Bearer ${t}` } }),
          fetch("/api/intakes", { headers: { Authorization: `Bearer ${t}` } }),
          fetch("/api/loyalty-program", { headers: { Authorization: `Bearer ${t}` } }),
        ]);

        if (!cancelled) {
          if (loyaltyRes.ok) { const j = await loyaltyRes.json(); setLoyalty(j.loyalty ?? []); }
          if (intakesRes.ok) { const j = await intakesRes.json(); setIntakes(j.intakes ?? []); }
          if (programRes.ok) { const j = await programRes.json(); if (j.program) setProgram(prev => ({ ...prev, ...j.program })); }
        }

        try {
          const refRes = await fetch("/api/referrals", { headers: { Authorization: `Bearer ${t}` } });
          if (!cancelled && refRes.ok) { const j = await refRes.json(); setReferralData(j); }
        } catch (e) { console.error("Referrals fetch error:", e); }

      } catch (e) {
        console.error("Fetch error:", e);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleAddPoints = useCallback(async () => {
    if (!newPoints.client_email.trim()) return;
    setSaving(true);
    const res = await fetch("/api/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        client_email: newPoints.client_email,
        client_name: newPoints.client_name,
        points_to_add: newPoints.points,
        send_email: newPoints.send_email,
        practice_name: practiceName,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setLoyalty(prev => {
        const exists = prev.find(l => l.client_email === newPoints.client_email);
        return exists ? prev.map(l => l.client_email === newPoints.client_email ? j.loyalty : l) : [j.loyalty, ...prev];
      });
      setNewPoints({ client_email: "", client_name: "", points: 10, send_email: true });
      setAddingPoints(false);
      setSuccessMsg(newPoints.send_email ? "Points added and email sent! 🌟" : "Points added!");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
    setSaving(false);
  }, [newPoints, token, practiceName]);

  const handleCopyLink = useCallback(() => {
    if (referralData?.referral_link) {
      void navigator.clipboard.writeText(referralData.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralData]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
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
              <h1 className="text-base font-bold text-[#1a2744]">Referrals & Loyalty 🌟</h1>
              <p className="text-xs text-slate-500">Grow your practice and reward your clients</p>
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
          <button type="button" onClick={() => setTab("loyalty")} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "loyalty" ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            🌟 Client Loyalty ({loyalty.length})
          </button>
          <button type="button" onClick={() => setTab("referrals")} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "referrals" ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            🔗 Nurse Referrals ({referralData?.confirmed_count ?? 0})
          </button>
          <button type="button" onClick={() => setTab("program")} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "program" ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            ⚙️ Program Setup
          </button>
        </div>

        {/* Loyalty Tab */}
        {tab === "loyalty" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 p-5">
              <h3 className="font-bold text-[#1a2744] mb-2">💡 Why loyalty points work</h3>
              <p className="text-sm text-slate-600 leading-relaxed">Clients with loyalty points visit nearly <strong>3x more per year</strong> and spend <strong>35% more</strong>. Every time you log a treatment, you can award points and send the client an email — it costs you nothing and builds deep loyalty.</p>
              <p className="mt-2 text-xs text-slate-500">You decide what points are worth — e.g. 100 points = $10 off their next visit.</p>
            </div>

            {(program as any).points_per_visit > 0 && (
              <div className="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚙️</span>
                    <div>
                      <p className="text-sm font-bold text-[#1a2744]">Your loyalty program is active</p>
                      <p className="text-xs text-slate-500">{(program as any).points_per_visit} pts per visit · {(program as any).points_value} pts = ${(program as any).discount_value} off · {(program as any).reward_style === "procedure" ? "by procedure" : (program as any).reward_style === "frequency" ? "by frequency" : "by visit"}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setTab("program")} className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100">
                    Edit program
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button type="button" onClick={() => setAddingPoints(true)} className="rounded-full bg-[#0d9488] px-5 py-2 text-sm font-bold text-white transition hover:bg-teal-700">
                + Award points to client
              </button>
            </div>

            {addingPoints && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
                <h3 className="mb-4 text-base font-bold text-[#1a2744]">Award loyalty points 🌟</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Select client</label>
                    <select
                      onChange={e => {
                        const selected = intakes.find(i => i.id === e.target.value);
                        if (selected) {
                          setNewPoints(p => ({ ...p, client_email: selected.email || "", client_name: selected.first_name + (selected.last_name ? " " + selected.last_name : "") }));
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]"
                    >
                      <option value="">Choose from existing clients… ({intakes.length} total)</option>
                      {intakes.map(i => (
                        <option key={i.id} value={i.id}>{i.first_name} {i.last_name || ""} — {i.email || "no email"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Or enter manually</label>
                    <input value={newPoints.client_email} onChange={e => setNewPoints(p => ({ ...p, client_email: e.target.value }))} placeholder="Client email address" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                    <input value={newPoints.client_name} onChange={e => setNewPoints(p => ({ ...p, client_name: e.target.value }))} placeholder="Client name" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-slate-600">Points to award:</label>
                    <input type="number" value={newPoints.points} onChange={e => setNewPoints(p => ({ ...p, points: parseInt(e.target.value) }))} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newPoints.send_email} onChange={e => setNewPoints(p => ({ ...p, send_email: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-slate-600">Send &quot;You earned points!&quot; email to client</span>
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={saving || !newPoints.client_email.trim()} onClick={() => void handleAddPoints()} className="rounded-full bg-[#0d9488] px-6 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50">
                      {saving ? "Saving…" : "Award points 🌟"}
                    </button>
                    <button type="button" onClick={() => setAddingPoints(false)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {loyalty.length === 0 && !addingPoints && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-4xl mb-3">🌟</p>
                <p className="font-bold text-[#1a2744]">No loyalty clients yet</p>
                <p className="mt-1 text-sm text-slate-500">Start awarding points after each visit to build client loyalty.</p>
              </div>
            )}

            {loyalty.map(client => (
              <div key={client.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-lg font-bold text-teal-600">
                      {client.client_name?.charAt(0)?.toUpperCase() ?? "C"}
                    </div>
                    <div>
                      <p className="font-bold text-[#1a2744]">{client.client_name || "Client"}</p>
                      <p className="text-xs text-slate-500">{client.client_email} · {client.total_visits} visit{client.total_visits !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#0d9488]">{client.points}</p>
                    <p className="text-xs text-slate-400">points</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Referrals Tab */}
        {tab === "referrals" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-5">
              <h3 className="font-bold text-[#1a2744] mb-2">🔗 How nurse referrals work</h3>
              <p className="text-sm text-slate-600 leading-relaxed">Share your unique referral link with other nurse injectors. When they sign up and subscribe to AdonisBlue, you earn <strong>1 free month</strong> for every nurse you refer. There is no limit!</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Your referral link</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 font-mono truncate">
                  {referralData?.referral_link || "Loading…"}
                </div>
                <button type="button" onClick={handleCopyLink} className="shrink-0 rounded-full bg-[#0d9488] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700">
                  {copied ? "Copied! ✅" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Share this link on Instagram, in DMs, or with nurse friends. When they sign up using your link, you get credit!</p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: "Nurses referred", value: referralData?.referrals.length ?? 0, emoji: "👩‍⚕️" },
                { label: "Confirmed signups", value: referralData?.confirmed_count ?? 0, emoji: "✅" },
                { label: "Free months earned", value: referralData?.free_months_earned ?? 0, emoji: "🎁" },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                  <p className="text-3xl font-bold text-[#1a2744]">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{stat.emoji} {stat.label}</p>
                </div>
              ))}
            </div>

            {(referralData?.referrals ?? []).length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-4xl mb-3">🔗</p>
                <p className="font-bold text-[#1a2744]">No referrals yet</p>
                <p className="mt-1 text-sm text-slate-500">Share your link with nurse friends and earn free months!</p>
              </div>
            ) : (
              (referralData?.referrals ?? []).map(referral => (
                <div key={referral.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#1a2744]">{referral.referred_email || "Pending"}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${referral.status === "confirmed" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
                      {referral.status === "confirmed" ? "✅ Confirmed" : "⏳ Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{new Date(referral.created_at).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "program" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 p-5">
              <h3 className="font-bold text-[#1a2744] mb-1">⚙️ Set up your loyalty program</h3>
              <p className="text-sm text-slate-600">This is completely optional. Set it up once and clients will automatically know how to earn and redeem their points.</p>
            </div>

            {(program as any).enabled !== undefined && (program as any).points_per_visit > 0 && (
              <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-600 mb-2">✅ Your active program</p>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-700">🎯 Style: <strong>{(program as any).reward_style === "procedure" ? "By procedure" : (program as any).reward_style === "frequency" ? "By frequency" : "By visit"}</strong></p>
                      <p className="text-sm text-slate-700">⭐ Points per visit: <strong>{(program as any).points_per_visit}</strong></p>
                      <p className="text-sm text-slate-700">💰 Redemption: <strong>{(program as any).points_value} points = ${(program as any).discount_value} off</strong></p>
                      <p className="text-sm text-slate-700">⏰ Expiry: <strong>{(program as any).expiry_days >= 9999 ? "Never" : `${(program as any).expiry_days} days`}</strong></p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void (async () => {
                      const res = await fetch("/api/loyalty-program", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      });
                      if (res.ok) {
                        setProgram({ points_per_visit: 10, points_value: 100, discount_value: 10, expiry_days: 365, enabled: false, welcome_message: "" });
                        setSuccessMsg("Program deleted.");
                        setTimeout(() => setSuccessMsg(""), 3000);
                      }
                    })()}
                    className="shrink-0 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#1a2744] mb-1">How do you want to reward clients?</label>
                <p className="text-xs text-slate-500 mb-3">Choose your reward style — you can always change it later.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { id: "visit", emoji: "📅", title: "By visit", desc: "Same points every time they come in, no matter what procedure" },
                    { id: "procedure", emoji: "💉", title: "By procedure", desc: "Set different points per procedure — reward bigger treatments more" },
                    { id: "frequency", emoji: "🏆", title: "By frequency", desc: "Bonus points at milestones — 5th visit, 10th visit, birthdays" },
                  ].map(style => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setProgram(p => ({ ...p, reward_style: style.id }))}
                      className={`rounded-2xl border p-4 text-left transition ${(program as any).reward_style === style.id ? "border-[#0d9488] bg-teal-50 ring-1 ring-[#0d9488]/30" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <span className="text-2xl">{style.emoji}</span>
                      <p className="mt-2 text-sm font-bold text-[#1a2744]">{style.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {(!(program as any).reward_style || (program as any).reward_style === "visit") && (
              <div>
                <label className="block text-sm font-bold text-[#1a2744] mb-1">Points per visit</label>
                <p className="text-xs text-slate-500 mb-2">How many points does a client earn each time they visit?</p>
                <div className="flex items-center gap-3">
                  <input type="number" value={program.points_per_visit} onChange={e => setProgram(p => ({ ...p, points_per_visit: parseInt(e.target.value) || 0 }))} className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                  <span className="text-sm text-slate-500">points per visit</span>
                </div>
              </div>
              )}

              {(program as any).reward_style === "procedure" && (
                <div>
                  <label className="block text-sm font-bold text-[#1a2744] mb-1">Points per procedure</label>
                  <p className="text-xs text-slate-500 mb-3">Set how many points each procedure earns. Bigger treatments can earn more!</p>
                  <div className="space-y-2">
                    {["Lip Filler", "Botox / Neuromodulator", "Cheek Filler", "PRP / Biostimulator", "Skin Booster"].map(proc => (
                      <div key={proc} className="flex items-center gap-3">
                        <span className="w-44 text-sm text-slate-700 shrink-0">{proc}</span>
                        <input
                          type="number"
                          defaultValue={proc.includes("Filler") ? 20 : proc.includes("Botox") ? 15 : 10}
                          className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]"
                        />
                        <span className="text-xs text-slate-400">points</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(program as any).reward_style === "frequency" && (
                <div>
                  <label className="block text-sm font-bold text-[#1a2744] mb-1">Frequency milestones</label>
                  <p className="text-xs text-slate-500 mb-3">Clients earn bonus points when they hit these visit milestones.</p>
                  <div className="space-y-2">
                    {[
                      { visit: "5th visit", points: 50 },
                      { visit: "10th visit", points: 100 },
                      { visit: "Birthday month", points: 75 },
                      { visit: "Every visit", points: 10 },
                    ].map(milestone => (
                      <div key={milestone.visit} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                        <span className="flex-1 text-sm font-semibold text-[#1a2744]">🏆 {milestone.visit}</span>
                        <input
                          type="number"
                          defaultValue={milestone.points}
                          className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]"
                        />
                        <span className="text-xs text-slate-400">bonus points</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-[#1a2744] mb-1">What are points worth?</label>
                <p className="text-xs text-slate-500 mb-2">How many points does a client need to earn a discount?</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="number" value={program.points_value} onChange={e => setProgram(p => ({ ...p, points_value: parseInt(e.target.value) || 0 }))} className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                  <span className="text-sm text-slate-500">points =</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-slate-500">$</span>
                    <input type="number" value={program.discount_value} onChange={e => setProgram(p => ({ ...p, discount_value: parseInt(e.target.value) || 0 }))} className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]" />
                  </div>
                  <span className="text-sm text-slate-500">off their next visit</span>
                </div>
                <p className="mt-2 text-xs text-teal-600 font-semibold">💡 Example: Client visits 10 times → earns {program.points_per_visit * 10} points → gets ${Math.floor((program.points_per_visit * 10) / program.points_value) * program.discount_value} off</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1a2744] mb-1">Points expiry</label>
                <p className="text-xs text-slate-500 mb-2">How long before unused points expire?</p>
                <div className="flex items-center gap-3">
                  <select value={program.expiry_days} onChange={e => setProgram(p => ({ ...p, expiry_days: parseInt(e.target.value) }))} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488]">
                    <option value={180}>6 months</option>
                    <option value={365}>1 year</option>
                    <option value={730}>2 years</option>
                    <option value={9999}>Never expire</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-3">
                <p className="text-xs font-bold text-amber-800">💡 Ideas for rewards (pick what works for you):</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    "100 points = $10 off next visit",
                    "200 points = free lip touch-up",
                    "500 points = 50% off one treatment",
                    "Birthday month = double points",
                    "Refer a friend = 50 bonus points",
                    "First visit = 20 welcome points",
                  ].map(idea => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setProgram(p => ({ ...p, welcome_message: p.welcome_message + (p.welcome_message ? "\n" : "") + "✨ " + idea }))}
                      className="text-left rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-800 transition hover:bg-amber-50"
                    >
                      + {idea}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1a2744] mb-1">Welcome message to clients</label>
                <p className="text-xs text-slate-500 mb-2">This appears in every points email so clients know how to redeem. Keep it short and exciting!</p>
                <textarea
                  value={program.welcome_message}
                  onChange={e => setProgram(p => ({ ...p, welcome_message: e.target.value }))}
                  placeholder={`🌟 Welcome to our loyalty program!\n\nEvery visit earns you ${program.points_per_visit} points. Once you reach ${program.points_value} points, you get $${program.discount_value} off your next appointment!\n\nTo redeem your points, just mention it when you book. We'll apply your discount automatically 💙`}
                  rows={6}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488] placeholder:text-slate-400"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!token) {
                    setSuccessMsg("Session expired — please refresh the page.");
                    setTimeout(() => setSuccessMsg(""), 3000);
                    return;
                  }
                  void (async () => {
                    const res = await fetch("/api/loyalty-program", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify(program),
                    });
                    if (res.ok) {
                      setProgramSaved(true);
                      setSuccessMsg("Loyalty program saved! 🌟");
                      setTimeout(() => {
                        setProgramSaved(false);
                        setSuccessMsg("");
                        setTab("loyalty");
                      }, 1500);
                    } else {
                      const err = await res.text();
                      setSuccessMsg(`Error: ${err}`);
                      setTimeout(() => setSuccessMsg(""), 5000);
                    }
                  })();
                }}
                className="w-full rounded-full bg-[#0d9488] px-6 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                {programSaved ? "✅ Program saved!" : "Save loyalty program ⚙️"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
