"use client";

import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClientContactCard } from "@/components/ClientContactCard";
import { SideNavRail } from "@/components/SideNavRail";

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  ok_to_share: boolean;
  display_name: string | null;
  featured: boolean;
  reached_out_at: string | null;
  removed_at: string | null;
  removed_reason: string | null;
  reported_at: string | null;
  flagged: boolean;
  flagged_message: string | null;
  created_at: string;
  intakes: {
    first_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type BotInfo = {
  slug: string | null;
  google_review_link: string | null;
  facebook_review_link: string | null;
  instagram: string | null;
  practice_name: string | null;
};

type Filter = "all" | "needs_attention" | "ok_to_share" | "on_website";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-400">
      {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length >= 2
    ? (parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")
    : (parts[0]?.[0] ?? "?");
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-[#1a2744] text-sm font-bold text-white">
      {letters.toUpperCase()}
    </div>
  );
}

export default function ReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [linkCopied, setLinkCopied] = useState(false);

  // Review link editing (bottom card)
  const [editingLinks, setEditingLinks] = useState(false);
  const [googleLinkDraft, setGoogleLinkDraft] = useState("");
  const [facebookLinkDraft, setFacebookLinkDraft] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  // Per-review action state
  const [removeOpen, setRemoveOpen] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchReviews = useCallback(async (token: string) => {
    const res = await fetch("/api/reviews", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const j = await res.json() as { reviews?: Review[] };
      setReviews(j.reviews ?? []);
    }
  }, []);

  const doAction = useCallback(async (id: string, action: string, extra?: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    setBusy(id + ":" + action);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) await fetchReviews(token);
    } finally {
      setBusy(null);
    }
  }, [fetchReviews]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/auth"); return; }
      const token = data.session.access_token;
      const [reviewsRes, botRes] = await Promise.all([
        fetch("/api/reviews", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/mybot", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!cancelled) {
        if (reviewsRes.ok) {
          const j = await reviewsRes.json() as { reviews?: Review[] };
          setReviews(j.reviews ?? []);
        }
        if (botRes.ok) {
          const j = await botRes.json() as { bot?: BotInfo };
          if (j.bot) setBot(j.bot);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleSaveLinks = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    setLinkSaving(true);
    try {
      await fetch("/api/savebot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          google_review_link: googleLinkDraft.trim() || null,
          facebook_review_link: facebookLinkDraft.trim() || null,
        }),
      });
      setBot((b) => b ? { ...b, google_review_link: googleLinkDraft.trim() || null, facebook_review_link: facebookLinkDraft.trim() || null } : b);
      setEditingLinks(false);
    } finally {
      setLinkSaving(false);
    }
  }, [googleLinkDraft, facebookLinkDraft]);

  const handleDownloadImage = useCallback(async (review: Review) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    setDownloading(review.id);
    try {
      const res = await fetch(`/api/reviews/image?id=${review.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `review-${review.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }, []);

  const visible = reviews.filter((r) => {
    if (r.removed_at) return false;
    if (filter === "needs_attention") return r.rating <= 3 && !r.reached_out_at;
    if (filter === "ok_to_share") return r.ok_to_share;
    if (filter === "on_website") return r.featured;
    return true;
  });

  const active = reviews.filter((r) => !r.removed_at);
  const avgRating = active.length ? active.reduce((s, r) => s + r.rating, 0) / active.length : null;
  const okToShareCount = active.filter((r) => r.ok_to_share).length;
  const featuredCount = active.filter((r) => r.featured).length;

  const publicPageUrl = bot?.slug ? `https://adonisblue.io/reviews/${bot.slug}` : null;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: `All (${active.length})` },
    { key: "needs_attention", label: `Needs attention (${active.filter((r) => r.rating <= 3 && !r.reached_out_at).length})` },
    { key: "ok_to_share", label: `OK to share (${okToShareCount})` },
    { key: "on_website", label: `Shown publicly (${featuredCount})` },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-[#1a2744]/80">Loading reviews…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <SideNavRail />
      <div className="flex-1 min-w-0 sm:pl-20">
        <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased">
          <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm backdrop-blur-md">
            <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <Link href="/dashboard">
                <Image src="/Alona.png" alt="AdonisBlue" width={40} height={40} className="h-10 w-10" />
              </Link>
              <h1 className="text-base font-semibold text-[#1a2744] sm:text-lg">Your Reviews</h1>
            </div>
          </header>

          <main className="mx-auto max-w-4xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">

            {/* How your reviews get seen — 3-step row */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">How your reviews get seen</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                {/* Step 1 */}
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#1a2744]">① Choose</p>
                  <p className="mt-1 text-xs text-slate-600">Turn on &ldquo;Show publicly&rdquo; on the reviews you love.</p>
                </div>
                {/* Arrow */}
                <div className="hidden md:flex items-center justify-center text-slate-300 text-lg">→</div>
                {/* Step 2 */}
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#1a2744]">② Your page</p>
                  {publicPageUrl ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 truncate max-w-[140px]">{publicPageUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(publicPageUrl);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 transition"
                      >
                        {linkCopied ? "Copied!" : "Copy link"}
                      </button>
                      <a
                        href={publicPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#0d9488] hover:bg-slate-50 transition"
                      >
                        Open ↗
                      </a>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">Set up your practice in settings to get a link.</p>
                  )}
                </div>
                {/* Arrow */}
                <div className="hidden md:flex items-center justify-center text-slate-300 text-lg">→</div>
                {/* Step 3 */}
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#1a2744]">③ Share</p>
                  <p className="mt-1 text-xs text-slate-600">Put your link in your Instagram bio, Linktree, Google profile, or texts. It updates by itself.</p>
                </div>
              </div>
            </div>

            {/* Summary tiles */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-2xl font-bold text-[#1a2744]">{avgRating != null ? avgRating.toFixed(1) : "—"}</p>
                <p className="mt-0.5 text-xs text-slate-500">Average rating</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-2xl font-bold text-[#1a2744]">{active.length}</p>
                <p className="mt-0.5 text-xs text-slate-500">Total reviews</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-2xl font-bold text-[#0d9488]">{okToShareCount}</p>
                <p className="mt-0.5 text-xs text-slate-500">OK to share</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-2xl font-bold text-[#1a2744]">{featuredCount}</p>
                <p className="mt-0.5 text-xs text-slate-500">Shown publicly</p>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === f.key
                      ? "bg-[#1a2744] text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Review cards */}
            {visible.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                {active.length === 0 ? "Reviews from your clients will show up here." : "No reviews match this filter."}
              </div>
            ) : (
              <div className="space-y-4">
                {visible.map((review) => {
                  const clientName = review.intakes?.first_name || "Client";
                  const isRemoving = removeOpen === review.id;
                  const isBusy = (action: string) => busy === review.id + ":" + action;

                  return (
                    <div key={review.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="p-4 sm:p-5">
                        {/* Header */}
                        <div className="flex items-start gap-3">
                          <Initials name={review.display_name || clientName} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-sm text-[#1a2744]">
                                {review.display_name || clientName}
                              </span>
                              {review.flagged && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                  Sent to Emergency alerts
                                </span>
                              )}
                              {review.featured && (
                                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                                  Shown publicly
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Stars n={review.rating} />
                              <span className="text-xs text-slate-400">
                                {new Date(review.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Review text */}
                        {review.ok_to_share ? (
                          review.review_text ? (
                            <p className="mt-3 text-sm leading-relaxed text-slate-700">{review.review_text}</p>
                          ) : null
                        ) : (
                          <p className="mt-3 text-xs text-slate-400">🔒 Private — client didn&apos;t give permission to share</p>
                        )}

                        {/* Actions */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {review.ok_to_share && (
                            <>
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  disabled={isBusy("feature")}
                                  onClick={() => void doAction(review.id, "feature", { featured: !review.featured })}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    review.featured
                                      ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {isBusy("feature") ? "…" : review.featured ? "✓ Shown publicly" : "Show publicly"}
                                </button>
                                <span className="text-[10px] text-slate-400 px-1">Shows this review on your public reviews page.</span>
                              </div>
                              {review.review_text && (
                                <button
                                  type="button"
                                  disabled={downloading === review.id}
                                  onClick={() => void handleDownloadImage(review)}
                                  className="self-start rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {downloading === review.id ? "Downloading…" : "Download image"}
                                </button>
                              )}
                            </>
                          )}

                          {review.rating <= 3 && !review.reached_out_at && (
                            <div className="w-full mt-1">
                              <p className="mb-1 text-xs font-semibold text-amber-700">This client may need follow-up</p>
                              <ClientContactCard
                                name={clientName}
                                phone={review.intakes?.phone ?? null}
                                email={review.intakes?.email ?? null}
                              />
                              <button
                                type="button"
                                disabled={isBusy("reach_out")}
                                onClick={() => void doAction(review.id, "reach_out")}
                                className="mt-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100"
                              >
                                {isBusy("reach_out") ? "…" : "Mark as reached out ✓"}
                              </button>
                            </div>
                          )}
                          {review.rating <= 3 && review.reached_out_at && (
                            <span className="text-xs text-slate-400">
                              Reached out {new Date(review.reached_out_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>

                        {/* Footer actions */}
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          {!isRemoving ? (
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => { setRemoveOpen(review.id); setRemoveReason(""); }}
                                className="text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-600 transition"
                              >
                                Remove at client&apos;s request
                              </button>
                              {!review.reported_at && (
                                <button
                                  type="button"
                                  disabled={isBusy("report")}
                                  onClick={() => void doAction(review.id, "report")}
                                  className="text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-600 transition"
                                >
                                  {isBusy("report") ? "Reporting…" : "Report to AdonisBlue"}
                                </button>
                              )}
                              {review.reported_at && (
                                <span className="text-[11px] text-slate-400">Reported ✓</span>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[#1a2744]">Reason for removal</p>
                              <textarea
                                rows={2}
                                value={removeReason}
                                onChange={(e) => setRemoveReason(e.target.value)}
                                placeholder="e.g. Client requested removal"
                                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-[#1a2744] outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={!removeReason.trim() || isBusy("remove")}
                                  onClick={async () => {
                                    await doAction(review.id, "remove", { remove_reason: removeReason });
                                    setRemoveOpen(null);
                                    setRemoveReason("");
                                  }}
                                  className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                                >
                                  {isBusy("remove") ? "Removing…" : "Confirm removal"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setRemoveOpen(null); setRemoveReason(""); }}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom notice */}
            <p className="mt-8 text-center text-[11px] text-slate-400">
              Reviews can&apos;t be deleted. They stay here as long as your account is active.
            </p>

            {/* Where clients write reviews — bottom card */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-[#1a2744]">Where clients write reviews</p>
              {!editingLinks ? (
                <>
                  {bot?.google_review_link || bot?.facebook_review_link ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        {bot.google_review_link && (
                          <p className="text-xs text-slate-700 truncate">
                            <span className="font-semibold text-slate-500">Google: </span>
                            <a href={bot.google_review_link} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline decoration-dotted">{bot.google_review_link}</a>
                          </p>
                        )}
                        {bot.facebook_review_link && (
                          <p className="text-xs text-slate-700 truncate">
                            <span className="font-semibold text-slate-500">Facebook: </span>
                            <a href={bot.facebook_review_link} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline decoration-dotted">{bot.facebook_review_link}</a>
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setGoogleLinkDraft(bot?.google_review_link ?? "");
                          setFacebookLinkDraft(bot?.facebook_review_link ?? "");
                          setEditingLinks(true);
                        }}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">Add your Google review link so happy clients can review you on Google.</p>
                      <div>
                        <input
                          type="url"
                          placeholder="https://g.page/r/..."
                          value={googleLinkDraft}
                          onChange={(e) => setGoogleLinkDraft(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">In your Google Business Profile, tap &ldquo;Ask for reviews&rdquo; and copy that link.</p>
                      </div>
                      <input
                        type="url"
                        placeholder="Facebook review link (optional)"
                        value={facebookLinkDraft}
                        onChange={(e) => setFacebookLinkDraft(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20"
                      />
                      <button
                        type="button"
                        disabled={linkSaving || (!googleLinkDraft.trim() && !facebookLinkDraft.trim())}
                        onClick={() => void handleSaveLinks()}
                        className="rounded-full bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                      >
                        {linkSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <input
                      type="url"
                      placeholder="https://g.page/r/..."
                      value={googleLinkDraft}
                      onChange={(e) => setGoogleLinkDraft(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">In your Google Business Profile, tap &ldquo;Ask for reviews&rdquo; and copy that link.</p>
                  </div>
                  <input
                    type="url"
                    placeholder="Facebook review link (optional)"
                    value={facebookLinkDraft}
                    onChange={(e) => setFacebookLinkDraft(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={linkSaving}
                      onClick={() => void handleSaveLinks()}
                      className="rounded-full bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      {linkSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingLinks(false)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
