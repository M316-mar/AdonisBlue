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

      const [loyaltyRes, refRes, botRes] = await Promise.all([
        fetch("/api/loyalty", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/referrals", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/mybot", { headers: { Authorization: `Bearer ${t}` } }),
      ]);

      if (!cancelled) {
        if (loyaltyRes.ok) { const j = await loyaltyRes.json(); setLoyalty(j.loyalty ?? []); }
        const intakesRes = await fetch("/api/intakes", { headers: { Authorization: `Bearer ${t}` } });
        if (intakesRes.ok) { const j = await intakesRes.json(); setIntakes(j.intakes ?? []); }
        if (refRes.ok) { const j = await refRes.json(); setReferralData(j); }
        if (botRes.ok) { const j = await botRes.json(); setPracticeName(j.bot?.practice_name || "Your Practice"); }
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
                      <option value="">Choose from existing clients…</option>
                      {intakes.filter(i => i.email).map(i => (
                        <option key={i.id} value={i.id}>{i.first_name} {i.last_name || ""} — {i.email}</option>
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
      </main>
    </div>
  );
}
