"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type NurseRow = {
  practice_name: string | null;
  bot_name: string | null;
  email: string | null;
  slug: string | null;
  launched: boolean | null;
  frozen: boolean | null;
  created_at: string;
  nurse_id: string;
  total_intakes: number;
  total_conversations: number;
  reviews_sent: number;
  aftercare_sent: number;
  last_active: string;
  plan: string;
  trial_ends_at: string | null;
  subscription_status: string;
};

type FeedbackRow = {
  id: string;
  nurse_name: string | null;
  message: string | null;
  created_at: string;
};

type TabId = "nurses" | "subscriptions" | "feedback" | "blueroom" | "newsletter" | "refunds";

type RefundRow = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  amount: number | null;
  reason: string | null;
  created_at: string;
};

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-practice";
}

function botSlug(row: NurseRow): string {
  if (row.slug?.trim()) return row.slug.trim();
  return slugify((row.bot_name || row.practice_name || "my-bot").trim());
}

function isTrialExpired(nurse: NurseRow): boolean {
  const plan = nurse.plan ?? "trial";
  const status = nurse.subscription_status ?? "trial";
  if (plan !== "trial" && status !== "trial") return false;
  const endsAt = nurse.trial_ends_at
    ? new Date(nurse.trial_ends_at)
    : new Date(new Date(nurse.created_at).getTime() + 14 * 24 * 60 * 60 * 1000);
  return endsAt.getTime() < Date.now();
}

function trialDaysLeft(nurse: NurseRow): number {
  const endsAt = nurse.trial_ends_at
    ? new Date(nurse.trial_ends_at)
    : new Date(new Date(nurse.created_at).getTime() + 14 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function PlanBadge({ plan, expired }: { plan: string; expired: boolean }) {
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-xs font-semibold text-red-300">
        ⚠️ Trial expired
      </span>
    );
  }
  const map: Record<string, string> = {
    trial: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    starter: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    pro: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  };
  const label: Record<string, string> = {
    trial: "🆓 Trial",
    starter: "💳 Starter",
    pro: "⭐ Pro",
  };
  const key = (plan ?? "trial").toLowerCase();
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${map[key] ?? map["trial"]}`}>
      {label[key] ?? plan}
    </span>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [nurses, setNurses] = useState<NurseRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [freezeLoading, setFreezeLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabId>("nurses");
  const [blueroomPosts, setBlueroomPosts] = useState<{id:string;title:string;content:string;category:string;emoji:string;created_at:string;}[]>([]);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general", emoji: "💙" });
  const [postLoading, setPostLoading] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [newsletter, setNewsletter] = useState({ subject: "", content: "", preview_text: "" });
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSent, setNewsletterSent] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [refundForm, setRefundForm] = useState({ customer_name: "", customer_email: "", amount: "", reason: "" });
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("adminAuth") !== "true") {
      router.replace("/admin-login");
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/admin/nurses-public");
        const json = await r.json();
        setNurses(Array.isArray(json.nurses) ? json.nurses : []);
        setFeedback(Array.isArray(json.feedback) ? json.feedback : []);
        const blueroomRes = await fetch("/api/blueroom/posts");
        if (blueroomRes.ok) {
          const blueroomJson = await blueroomRes.json();
          setBlueroomPosts(blueroomJson.posts ?? []);
        }
        const refundRes = await fetch("/api/admin/refund-log");
        if (refundRes.ok) {
          const refundJson = await refundRes.json();
          setRefunds(refundJson.refunds ?? []);
        }
        setReady(true);
      } catch {
        setReady(true);
      }
    })();
  }, [router]);

  const fetchRefunds = useCallback(async () => {
    const res = await fetch("/api/admin/refund-log");
    if (res.ok) {
      const json = await res.json();
      setRefunds(json.refunds ?? []);
    }
  }, []);

  const handleLogRefund = useCallback(async () => {
    setRefundError(null);
    const amount = parseFloat(refundForm.amount);
    if (!refundForm.amount.trim() || !Number.isFinite(amount)) {
      setRefundError("Amount is required.");
      return;
    }
    setRefundLoading(true);
    try {
      const res = await fetch("/api/admin/refund-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...refundForm, amount }),
      });
      if (res.ok) {
        setRefundForm({ customer_name: "", customer_email: "", amount: "", reason: "" });
        setRefundSuccess(true);
        setTimeout(() => setRefundSuccess(false), 3000);
        await fetchRefunds();
      } else {
        setRefundError("Failed to save refund.");
      }
    } finally {
      setRefundLoading(false);
    }
  }, [refundForm, fetchRefunds]);

  const handleDelete = useCallback(async (nurse: NurseRow) => {
    if (!window.confirm(`Delete ${nurse.practice_name?.trim() || nurse.email || "this nurse"}? This cannot be undone.`)) return;
    setDeleteLoading(nurse.nurse_id);
    try {
      const res = await fetch("/api/admin/freeze-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurse_id: nurse.nurse_id }),
      });
      if (res.ok) {
        setNurses(prev => prev.filter(n => n.nurse_id !== nurse.nurse_id));
      } else {
        alert("Delete failed — check the API.");
      }
    } finally {
      setDeleteLoading(null);
    }
  }, []);

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

  const handleCreatePost = useCallback(async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return;
    setPostLoading(true);
    const res = await fetch("/api/blueroom/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPost),
    });
    if (res.ok) {
      const json = await res.json();
      setBlueroomPosts(prev => [json.post, ...prev]);
      setNewPost({ title: "", content: "", category: "general", emoji: "💙" });
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 3000);
    }
    setPostLoading(false);
  }, [newPost]);

  const handleSendNewsletter = useCallback(async () => {
    if (!newsletter.subject.trim() || !newsletter.content.trim()) return;
    setNewsletterLoading(true);
    setNewsletterSent(null);
    try {
      const res = await fetch("/api/admin/send-newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newsletter),
      });
      if (res.ok) {
        const json = await res.json();
        setNewsletterSent(json.sent_count ?? 0);
        setNewsletter({ subject: "", content: "", preview_text: "" });
      }
    } finally {
      setNewsletterLoading(false);
    }
  }, [newsletter]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalActive = nurses.filter(n => n.launched && !n.frozen).length;
  const totalFrozen = nurses.filter(n => n.frozen).length;
  const totalIntakes = nurses.reduce((sum, n) => sum + (n.total_intakes || 0), 0);
  const totalReviews = nurses.reduce((sum, n) => sum + (n.reviews_sent || 0), 0);

  const filteredNurses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return nurses;
    return nurses.filter(n =>
      (n.practice_name ?? "").toLowerCase().includes(q) ||
      (n.email ?? "").toLowerCase().includes(q) ||
      botSlug(n).toLowerCase().includes(q)
    );
  }, [nurses, search]);

  const trialNurses = useMemo(() => nurses.filter(n => (n.plan ?? "trial") === "trial" && !isTrialExpired(n)), [nurses]);
  const starterNurses = useMemo(() => nurses.filter(n => (n.plan ?? "trial") === "starter"), [nurses]);
  const proNurses = useMemo(() => nurses.filter(n => (n.plan ?? "trial") === "pro"), [nurses]);
  const expiredNurses = useMemo(() => nurses.filter(n => isTrialExpired(n)), [nurses]);
  const monthlyRevenue = starterNurses.length * 85 + proNurses.length * 150;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1628]">
        <p className="text-sm text-white/60">Loading admin dashboard…</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "nurses", label: `👩‍⚕️ Nurses (${nurses.length})` },
    { id: "subscriptions", label: `💳 Subscriptions` },
    { id: "feedback", label: `💬 Feedback (${feedback.length})` },
    { id: "blueroom", label: "💙 Blue Room" },
    { id: "newsletter", label: "📧 Newsletter" },
    { id: "refunds", label: "💸 Refunds" },
  ];

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

        {/* Preview test bot shortcut */}
        <div className="mb-5">
          <button
            disabled={previewLoading}
            onClick={async () => {
              setPreviewLoading(true);
              try {
                const res = await fetch("/api/admin/preview-link", {
                  method: "POST",
                  headers: { "x-admin-secret": "AdonisBlue2026!" },
                });
                const json = await res.json();
                if (json.url) {
                  window.location.href = json.url;
                } else {
                  alert("Could not generate preview link: " + (json.error ?? "unknown error"));
                }
              } catch (e) {
                alert("Error: " + String(e));
              } finally {
                setPreviewLoading(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#0d9488] px-5 py-2.5 text-sm font-semibold text-[#0d9488] transition hover:bg-teal-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {previewLoading ? "Opening preview…" : "👩‍⚕️ Preview Nurse Dashboard →"}
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
          {[
            { label: "Total Nurses", value: nurses.length, emoji: "👩‍⚕️" },
            { label: "Active Bots", value: totalActive, emoji: "🟢" },
            { label: "Frozen", value: totalFrozen, emoji: "🔒" },
            { label: "Total Clients", value: totalIntakes, emoji: "💌" },
            { label: "Reviews Sent", value: totalReviews, emoji: "⭐" },
            { label: "Expired Trials", value: expiredNurses.length, emoji: "⚠️" },
            { label: "Paid Nurses", value: starterNurses.length + proNurses.length, emoji: "💳" },
            { label: "MRR", value: `$${monthlyRevenue}`, emoji: "💰" },
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
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition ${tab === t.id ? "bg-teal-400 text-[#0d1628]" : "border border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Nurses tab ── */}
        {tab === "nurses" && (
          <div className="space-y-3">
            {/* Search + Export row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by practice name, email, or bot URL…"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400/50 sm:max-w-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const rows = [
                    ["Practice", "Email", "Bot URL", "Plan", "Trial Ends", "Convos", "Clients", "Joined"].join(","),
                    ...filteredNurses.map(n => [
                      `"${(n.practice_name?.trim() || n.email || "").replace(/"/g, '""')}"`,
                      `"${(n.email || "").replace(/"/g, '""')}"`,
                      `/chat/${botSlug(n)}`,
                      n.plan ?? "trial",
                      n.trial_ends_at ? new Date(n.trial_ends_at).toLocaleDateString() : "",
                      n.total_conversations || 0,
                      n.total_intakes || 0,
                      new Date(n.created_at).toLocaleDateString(),
                    ].join(",")),
                  ].join("\n");
                  const blob = new Blob([rows], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `nurses-${new Date().toISOString().split("T")[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="shrink-0 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-2 text-sm font-semibold text-teal-300 transition hover:bg-teal-400/20"
              >
                ↓ Export CSV
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Practice</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Bot URL</th>
                      <th className="px-4 py-3">Bot Status</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Trial Ends</th>
                      <th className="px-4 py-3">Convos</th>
                      <th className="px-4 py-3">Clients</th>
                      <th className="px-4 py-3">Last Active</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredNurses.map(nurse => {
                      const expired = isTrialExpired(nurse);
                      const daysLeft = trialDaysLeft(nurse);
                      const trialAlmostDone = !expired && (nurse.plan ?? "trial") === "trial" && daysLeft <= 3;
                      const displayName = nurse.practice_name?.trim() || nurse.email || "—";
                      return (
                        <tr
                          key={nurse.nurse_id}
                          className={`align-middle transition hover:bg-white/[0.03] ${
                            expired ? "bg-red-900/10" : trialAlmostDone ? "bg-yellow-400/[0.07]" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-white">
                            <div className="flex items-center gap-2">
                              {expired && <span title="Trial expired">⚠️</span>}
                              {trialAlmostDone && <span title="Trial ending soon">🟡</span>}
                              {displayName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-300 text-xs">{nurse.email || "—"}</td>
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
                          <td className="px-4 py-3">
                            <PlanBadge plan={nurse.plan ?? "trial"} expired={expired} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {(nurse.plan ?? "trial") === "trial" && !expired && (
                              <span className={`font-semibold ${trialAlmostDone ? "text-yellow-300" : "text-amber-300"}`}>{daysLeft}d left</span>
                            )}
                            {expired && <span className="text-red-400">Expired</span>}
                            {(nurse.plan ?? "trial") !== "trial" && <span className="text-teal-400">Paid</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{nurse.total_conversations || 0}</td>
                          <td className="px-4 py-3 text-slate-300">{nurse.total_intakes || 0}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{new Date(nurse.last_active).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{new Date(nurse.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/onboarding?nurse_id=${nurse.nurse_id}`}
                                className="rounded-full border border-slate-400/30 bg-slate-400/10 px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-400/20"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                disabled={freezeLoading === nurse.nurse_id}
                                onClick={() => void handleFreezeToggle(nurse)}
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                                  nurse.frozen
                                    ? "border border-teal-400/30 bg-teal-400/10 text-teal-300 hover:bg-teal-400/20"
                                    : "border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                                }`}
                              >
                                {freezeLoading === nurse.nurse_id ? "…" : nurse.frozen ? "Unfreeze" : "Freeze"}
                              </button>
                              <button
                                type="button"
                                disabled={deleteLoading === nurse.nurse_id}
                                onClick={() => void handleDelete(nurse)}
                                className="rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-400/20 disabled:opacity-50"
                              >
                                {deleteLoading === nurse.nurse_id ? "…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredNurses.length === 0 && (
                  <p className="py-12 text-center text-sm text-slate-500">
                    {search ? "No nurses match your search." : "No nurses yet."}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Subscriptions tab ── */}
        {tab === "subscriptions" && (
          <div className="space-y-6">
            {/* Revenue summary */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "On Trial", value: trialNurses.length, color: "border-amber-400/20 bg-amber-400/10 text-amber-300", note: "Active trials" },
                { label: "On Starter ($85)", value: starterNurses.length, color: "border-sky-400/20 bg-sky-400/10 text-sky-300", note: `$${starterNurses.length * 85}/mo` },
                { label: "On Pro ($150)", value: proNurses.length, color: "border-teal-400/20 bg-teal-400/10 text-teal-300", note: `$${proNurses.length * 150}/mo` },
                { label: "Expired Trials", value: expiredNurses.length, color: "border-red-400/20 bg-red-400/10 text-red-300", note: "Needs follow up" },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl border ${s.color} p-5`}>
                  <p className={`text-3xl font-bold ${s.color.split(" ")[2]}`}>{s.value}</p>
                  <p className="mt-1 text-xs font-semibold text-white/80">{s.label}</p>
                  <p className="text-xs text-white/40">{s.note}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-teal-400/20 bg-teal-400/10 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Total monthly revenue</p>
              <p className="mt-1 text-4xl font-bold text-white">${monthlyRevenue}<span className="text-lg text-teal-300">/mo</span></p>
              <p className="mt-0.5 text-xs text-slate-400">{starterNurses.length} × $85 Starter + {proNurses.length} × $150 Pro</p>
            </div>

            {/* Expired trials — needs follow up */}
            {expiredNurses.length > 0 && (
              <div className="rounded-2xl border border-red-400/20 bg-white/5 overflow-hidden">
                <div className="border-b border-white/10 px-5 py-3">
                  <p className="text-sm font-bold text-red-300">⚠️ Expired Trials — Needs Follow Up ({expiredNurses.length})</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2">Practice</th>
                        <th className="px-4 py-2">Conversations</th>
                        <th className="px-4 py-2">Clients</th>
                        <th className="px-4 py-2">Trial ended</th>
                        <th className="px-4 py-2">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {expiredNurses.map(n => (
                        <tr key={n.nurse_id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3 font-medium text-white">{n.practice_name?.trim() || "—"}</td>
                          <td className="px-4 py-3 text-slate-300">{n.total_conversations}</td>
                          <td className="px-4 py-3 text-slate-300">{n.total_intakes}</td>
                          <td className="px-4 py-3 text-xs text-red-400">
                            {n.trial_ends_at ? new Date(n.trial_ends_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{new Date(n.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All plans sections */}
            {[
              { label: "🆓 Active Trials", nurses: trialNurses, color: "border-amber-400/20" },
              { label: "💳 Starter Plan", nurses: starterNurses, color: "border-sky-400/20" },
              { label: "⭐ Pro Plan", nurses: proNurses, color: "border-teal-400/20" },
            ].map(group => (
              <div key={group.label} className={`rounded-2xl border ${group.color} bg-white/5 overflow-hidden`}>
                <div className="border-b border-white/10 px-5 py-3">
                  <p className="text-sm font-bold text-white">{group.label} ({group.nurses.length})</p>
                </div>
                {group.nurses.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">None yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <th className="px-4 py-2">Practice</th>
                          <th className="px-4 py-2">Conversations</th>
                          <th className="px-4 py-2">Clients</th>
                          <th className="px-4 py-2">Bot</th>
                          <th className="px-4 py-2">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {group.nurses.map(n => (
                          <tr key={n.nurse_id} className="hover:bg-white/[0.03]">
                            <td className="px-4 py-3 font-medium text-white">{n.practice_name?.trim() || "—"}</td>
                            <td className="px-4 py-3 text-slate-300">{n.total_conversations}</td>
                            <td className="px-4 py-3 text-slate-300">{n.total_intakes}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${n.launched ? "border-green-400/30 bg-green-400/10 text-green-300" : "border-slate-400/30 bg-slate-400/10 text-slate-400"}`}>
                                {n.launched ? "🟢 Live" : "⚪ Draft"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{new Date(n.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Feedback tab ── */}
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
                  <button
                    type="button"
                    onClick={() => {
                      void fetch(`/api/admin/feedback?id=${f.id}`, {
                        method: "DELETE",
                        headers: { "x-admin-secret": "AdonisBlue2026!" },
                      }).then(() => setFeedback(prev => prev.filter(x => x.id !== f.id)));
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/20 hover:text-red-400"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 border-l-2 border-teal-400/30 pl-4">{f.message || "(no message)"}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Blue Room tab ── */}
        {tab === "blueroom" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <h2 className="mb-4 text-lg font-bold text-white">Create a new post 💙</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {["💙","🔥","💉","📈","📰","✨","💡","⚠️"].map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setNewPost(p => ({ ...p, emoji: e }))}
                      className={`rounded-xl border py-2 text-xl transition ${newPost.emoji === e ? "border-teal-400 bg-teal-400/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <select
                  value={newPost.category}
                  onChange={e => setNewPost(p => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none"
                >
                  <option value="general" className="text-black">💙 General</option>
                  <option value="trending" className="text-black">🔥 Trending</option>
                  <option value="techniques" className="text-black">💉 Techniques</option>
                  <option value="business" className="text-black">📈 Business Tips</option>
                  <option value="news" className="text-black">📰 Industry News</option>
                </select>
                <input
                  value={newPost.title}
                  onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                  placeholder="Post title…"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400/50"
                />
                <textarea
                  value={newPost.content}
                  onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                  placeholder="Write your post content… Share trends, tips, news, techniques."
                  rows={5}
                  className="w-full resize-none rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400/50"
                />
                <button
                  type="button"
                  disabled={postLoading || !newPost.title.trim() || !newPost.content.trim()}
                  onClick={() => void handleCreatePost()}
                  className="w-full rounded-full bg-teal-400 px-6 py-3 text-sm font-bold text-[#0d1628] transition hover:bg-teal-300 disabled:opacity-50"
                >
                  {postLoading ? "Publishing…" : postSuccess ? "Published! ✅" : "Publish to Blue Room 💙"}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Published posts ({blueroomPosts.length})</h3>
              {blueroomPosts.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                  <p className="text-slate-500">No posts yet — create your first one above!</p>
                </div>
              )}
              {blueroomPosts.map(post => (
                <div key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{post.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-teal-400/20 px-2 py-0.5 text-xs font-bold text-teal-300">{post.category}</span>
                        <span className="text-xs text-slate-500">{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 font-semibold text-white">{post.title}</p>
                      <p className="mt-1 text-sm text-slate-400 line-clamp-2">{post.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Newsletter tab ── */}
        {tab === "newsletter" && (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] to-[#0d4f6b] p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_0%,rgba(56,189,248,0.2),transparent)]" aria-hidden />
              <div className="relative">
                <h2 className="text-lg font-bold text-white">📧 Send Newsletter to All Nurses</h2>
                <p className="mt-1 text-sm text-slate-300">Write a newsletter and send it to every active nurse on AdonisBlue.</p>
              </div>
            </div>
            {newsletterSent !== null && (
              <div className="rounded-2xl border border-teal-400/30 bg-teal-400/10 p-4 text-center">
                <p className="text-lg font-bold text-teal-300">✅ Sent to {newsletterSent} nurse{newsletterSent !== 1 ? "s" : ""}!</p>
              </div>
            )}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Subject line</label>
                  <input value={newsletter.subject} onChange={e => setNewsletter(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. 🔥 Top 3 trending procedures this month" className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Preview text</label>
                  <input value={newsletter.preview_text} onChange={e => setNewsletter(p => ({ ...p, preview_text: e.target.value }))} placeholder="e.g. What clients are asking for most right now..." className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Content</label>
                  <textarea value={newsletter.content} onChange={e => setNewsletter(p => ({ ...p, content: e.target.value }))} placeholder={"Hi nurse family! 💙\n\nHere is what we have been seeing this week...\n\nWrite your newsletter here."} rows={10} className="w-full resize-none rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500" />
                </div>
                <button type="button" disabled={newsletterLoading || !newsletter.subject.trim() || !newsletter.content.trim()} onClick={() => void handleSendNewsletter()} className="w-full rounded-full bg-teal-400 px-6 py-3 text-sm font-bold text-[#0d1628] transition hover:bg-teal-300 disabled:opacity-50">
                  {newsletterLoading ? "Sending…" : "📧 Send newsletter to all nurses"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── Refunds tab ── */}
        {tab === "refunds" && (
          <div className="space-y-6">
            {/* Checklist */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <h2 className="mb-4 text-lg font-bold text-white">💸 Refund Process</h2>
              <ol className="space-y-3">
                {[
                  "Calculate the prorated amount — days remaining in their billing period ÷ total days in the period × amount paid",
                  "Go to the Stripe Dashboard → Customers → find the customer → Payments → Refund",
                  "Cancel or downgrade their subscription (if not already done)",
                  "Log it below so you have a record",
                  "Send them a quick confirmation email letting them know it's done",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-teal-400/20 text-xs font-bold text-teal-300">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Log refund form */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <h3 className="mb-4 text-sm font-bold text-white">Log a refund</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Customer name</label>
                  <input
                    value={refundForm.customer_name}
                    onChange={e => setRefundForm(p => ({ ...p, customer_name: e.target.value }))}
                    placeholder="Jane Doe"
                    className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Customer email</label>
                  <input
                    value={refundForm.customer_email}
                    onChange={e => setRefundForm(p => ({ ...p, customer_email: e.target.value }))}
                    placeholder="jane@example.com"
                    type="email"
                    className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Amount ($) <span className="text-red-400">*</span></label>
                  <input
                    value={refundForm.amount}
                    onChange={e => setRefundForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="85.00"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Reason</label>
                  <input
                    value={refundForm.reason}
                    onChange={e => setRefundForm(p => ({ ...p, reason: e.target.value }))}
                    placeholder="e.g. Cancelled within 24h"
                    className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400/50"
                  />
                </div>
              </div>
              {refundError && <p className="mt-3 text-xs text-red-400">{refundError}</p>}
              <button
                type="button"
                disabled={refundLoading}
                onClick={() => void handleLogRefund()}
                className="mt-4 rounded-full bg-teal-400 px-6 py-2.5 text-sm font-bold text-[#0d1628] transition hover:bg-teal-300 disabled:opacity-50"
              >
                {refundLoading ? "Saving…" : refundSuccess ? "Logged! ✅" : "Log refund"}
              </button>
            </div>

            {/* Past refunds table */}
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="border-b border-white/10 px-5 py-3">
                <p className="text-sm font-bold text-white">Past refunds ({refunds.length})</p>
              </div>
              {refunds.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No refunds logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Customer</th>
                        <th className="px-4 py-2 text-left">Email</th>
                        <th className="px-4 py-2 text-left">Amount</th>
                        <th className="px-4 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {refunds.map(r => (
                        <tr key={r.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-slate-200">{r.customer_name || "—"}</td>
                          <td className="px-4 py-3 text-slate-400">{r.customer_email || "—"}</td>
                          <td className="px-4 py-3 font-semibold text-teal-300">{r.amount != null ? `$${r.amount.toFixed(2)}` : "—"}</td>
                          <td className="px-4 py-3 text-slate-400">{r.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
