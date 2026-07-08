"use client";

import { signOutCompletely, supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ChecklistId =
  | "account"
  | "practice"
  | "services"
  | "booking"
  | "photos"
  | "botStyle"
  | "policies"
  | "preview"
  | "share";

const CHECKLIST: { id: ChecklistId; label: string; alwaysDone?: boolean }[] = [
  { id: "account", label: "Create your account", alwaysDone: true },
  { id: "practice", label: "Tell us about your practice" },
  { id: "services", label: "Choose your services" },
  { id: "booking", label: "Add your booking link" },
  { id: "botStyle", label: "Set your bot colors and name" },
  { id: "policies", label: "Add your policies and agreements" },
  { id: "preview", label: "Preview your bot" },
  { id: "share", label: "Share your bot with your clients" },
];

type BotRow = {
  slug?: string | null;
  practice_name?: string | null;
  bot_name?: string | null;
  services?: string[] | null;
  booking_link?: string | null;
  photos?: string[] | null;
  cancellation_policy?: string | null;
  aftercare?: string | null;
  launched?: boolean | null;
  frozen?: boolean | null;
  plan?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
};

type IntakeRow = {
  id: string;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  service_interested: string | null;
  referred_by: string | null;
  created_at: string;
  survey_sent?: boolean | null;
  aftercare_sent_at?: string | null;
  reminder_6m_sent?: boolean | null;
  reminder_9m_sent?: boolean | null;
};

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "my-practice";
}

function onboardingHrefForChecklist(id: ChecklistId): string {
  switch (id) {
    case "practice":   return "/onboarding?step=1";
    case "services":   return "/onboarding?step=2";
    case "booking":    return "/onboarding?step=2";
    case "photos":     return "/onboarding?step=4";
    case "botStyle":   return "/onboarding?step=4";
    case "policies":   return "/onboarding?step=2";
    case "preview":    return "/onboarding?step=4";
    case "share":      return "/dashboard#embed";
    default:           return "/onboarding";
  }
}

function computeChecklistDone(bot: BotRow | null): Record<ChecklistId, boolean> {
  return {
    account: true,
    practice: Boolean(bot?.practice_name?.trim()),
    services: Array.isArray(bot?.services) && bot.services.length > 0,
    booking: Boolean(bot?.booking_link?.trim()),
    photos: Array.isArray(bot?.photos) && bot.photos.length > 0,
    botStyle: Boolean(bot?.bot_name?.trim()),
    policies: Boolean(bot?.cancellation_policy?.trim()) || Boolean(bot?.aftercare?.trim()),
    preview: bot?.launched === true,
    share: bot?.launched === true,
  };
}

function displayNameFromUser(user: { user_metadata?: { full_name?: string }; email?: string } | null): string {
  if (!user) return "there";
  const fromMeta = user.user_metadata?.full_name;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  const email = user.email;
  if (email) return email.split("@")[0] ?? "there";
  return "there";
}

export default function NurseDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [nurseName, setNurseName] = useState("there");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [bot, setBot] = useState<BotRow | null>(null);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [surveyLoading, setSurveyLoading] = useState<string | null>(null);
  const [aftercareLoading, setAftercareLoading] = useState<string | null>(null);
  const [intakesOpen, setIntakesOpen] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showLaunchCelebration, setShowLaunchCelebration] = useState(false);
  const [justLaunched, setJustLaunched] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [showEmailNotice, setShowEmailNotice] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    setShowEmailNotice(!localStorage.getItem("emailNoticesDismissed"));
    if (!localStorage.getItem("adonisblue-welcome-seen")) {
      setShowWelcome(true);
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    localStorage.setItem("adonisblue-welcome-seen", "true");
    setShowWelcome(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      setNurseName(displayNameFromUser(data.session.user));

      const token = data.session.access_token;
      if (token) {
        const res = await fetch("/api/mybot", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const json = await res.json();
          const row = json?.bot ?? json;
          setBot(row && typeof row === "object" && !Array.isArray(row) ? row as BotRow : null);
          const alreadyCelebrated = localStorage.getItem("ab-celebrated-" + (row?.slug || ""));
          if (row?.launched && !alreadyCelebrated) {
            setShowLaunchCelebration(true);
            setJustLaunched(true);
          }

          // Fetch recent intakes
          const intakesRes = await fetch("/api/myintakes", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && intakesRes.ok) {
            const intakesJson = await intakesRes.json();
            setIntakes(intakesJson.intakes ?? []);
          }
        }
      }

      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const done = useMemo(() => computeChecklistDone(bot), [bot]);
  const launched = bot?.launched === true;
  const botChatSlug = useMemo(() => {
    if (bot?.slug) return bot.slug;
    const raw = (bot?.bot_name || "").trim() || (bot?.practice_name || "").trim() || "my-bot";
    return slugify(raw);
  }, [bot?.slug, bot?.bot_name, bot?.practice_name]);

  const completedCount = useMemo(() => CHECKLIST.filter((item) => done[item.id]).length, [done]);
  const progressPct = Math.round((completedCount / CHECKLIST.length) * 100);

  const totalClients = useMemo(() => intakes.length, [intakes]);
  const aftercareSent = useMemo(() => intakes.filter((i) => i.aftercare_sent_at).length, [intakes]);
  const reviewsRequested = useMemo(() => intakes.filter((i) => i.survey_sent).length, [intakes]);
  const remindersScheduled = useMemo(
    () => intakes.filter((i) => i.aftercare_sent_at && !i.reminder_6m_sent).length,
    [intakes]
  );

  const handleLogout = useCallback(async () => {
    await signOutCompletely();
    router.push("/auth");
  }, [router]);

  const handleManagePlan = useCallback(async () => {
    setPortalBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json() as { url?: string; error?: string };
      if (res.ok && j.url) {
        window.location.href = j.url;
      } else {
        alert(j.error ?? "Could not open billing portal. Please try again.");
      }
    } finally {
      setPortalBusy(false);
    }
  }, []);

  const handleCancelMembership = useCallback(async () => {
    if (!window.confirm("Are you sure you want to cancel your membership? You'll keep access until the end of your billing period.")) return;
    setCancelBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCancelDone(true);
      } else {
        alert("Something went wrong. Please try again or contact support.");
      }
    } finally {
      setCancelBusy(false);
    }
  }, []);

  const handleConfirmDeleteDialog = useCallback(async () => {
    setDeleteBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch("/api/delete-account", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await signOutCompletely();
      router.push("/");
    } finally {
      setDeleteBusy(false);
    }
  }, [router]);

  const handleSendSurvey = useCallback(async (intake: IntakeRow) => {
    setSurveyLoading(intake.id);
    await fetch("/api/send-survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intake_id: intake.id }),
    });
    setIntakes((prev) => prev.map((i) => i.id === intake.id ? { ...i, survey_sent: true } : i));
    setSurveyLoading(null);
  }, []);

  const handleSendAftercare = useCallback(async (intake: IntakeRow) => {
    setAftercareLoading(intake.id);
    await fetch("/api/send-aftercare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intake_id: intake.id }),
    });
    setIntakes((prev) => prev.map((i) => i.id === intake.id ? { ...i, aftercare_sent_at: new Date().toISOString() } : i));
    setAftercareLoading(null);
  }, []);

  const handleFreezeToggle = useCallback(async () => {
    if (!bot) return;
    const nextFrozen = !bot.frozen;
    setFreezeLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch("/api/my-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ frozen: nextFrozen }),
        });
        setBot(prev => prev ? { ...prev, frozen: nextFrozen } : prev);
      }
    } finally {
      setFreezeLoading(false);
    }
  }, [bot]);

  const handleDeleteIntake = useCallback(async (id: string) => {
    await fetch("/api/delete-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setIntakes((prev) => prev.filter((i) => i.id !== id));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-[#1a2744]/80">Loading your dashboard…</p>
      </div>
    );
  }

  const nurseFirstName = (() => {
    const trimmed = nurseName.trim();
    if (!trimmed || trimmed === "there") return "there";
    return trimmed.split(/\s+/)[0] ?? trimmed;
  })();

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <Image src="/Alona.png" alt="AdonisBlue" width={48} height={48} className="h-10 w-10 sm:h-12 sm:w-12" />
            <span className="truncate text-base font-semibold tracking-tight text-[#1a2744] sm:text-lg">AdonisBlue</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
            <span className="hidden max-w-[12rem] truncate text-sm font-medium text-[#1a2744] sm:inline sm:max-w-xs md:text-base">
              {nurseName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50 sm:px-4 sm:text-sm"
            >
              Log out
            </button>
          </div>
        </div>
        <p className="mx-auto max-w-6xl truncate px-4 pb-2 text-xs font-medium text-teal-100/90 sm:hidden">{nurseName}</p>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {showEmailNotice && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start justify-between gap-3">
            <p className="text-xs text-amber-800">📬 <strong>Heads up:</strong> The first email from AdonisBlue may land in your client&apos;s spam folder. Ask them to mark it as &quot;Not Spam&quot; so future emails go straight to their inbox!</p>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem("emailNoticesDismissed", "true");
                setShowEmailNotice(false);
              }}
              className="shrink-0 text-amber-400 hover:text-amber-600 text-xs"
            >
              ✕
            </button>
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8 lg:items-start">
          <div className="space-y-6 lg:col-span-8">
            <section className="relative overflow-hidden rounded-2xl border border-teal-900/20 bg-gradient-to-br from-[#1a2744] to-[#0d3d38] px-4 py-6 shadow-lg sm:px-6 sm:py-8">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_85%_0%,rgba(13,148,136,0.22),transparent),radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(56,189,248,0.12),transparent)] opacity-90"
                aria-hidden
              />
              <div className="relative">
                <p className="text-sm font-semibold uppercase tracking-wider text-teal-300/90">Your dashboard</p>
                <h1 className="mt-2 text-balance text-xl font-semibold leading-snug text-white sm:text-2xl lg:text-[1.65rem]">
                  Welcome back, {nurseFirstName} <span aria-hidden>✨</span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
                  As someone who truly cares about your clients&apos; experience, you&apos;re exactly the kind of injector AdonisBlue was built for. Let&apos;s make today count. 🦋
                </p>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {[
                { label: "Total Clients", value: totalClients, emoji: "💌", color: "#0d9488" },
                { label: "Aftercare Sent", value: aftercareSent, emoji: "✅", color: "#0d9488" },
                { label: "Reviews Requested", value: reviewsRequested, emoji: "⭐", color: "#0d9488" },
                { label: "Auto Reminders", value: remindersScheduled, emoji: "🔔", color: "#0d9488" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-md sm:px-5 sm:py-5"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{
                      background: "radial-gradient(ellipse 80% 60% at 80% 0%, rgba(13,148,136,0.25), transparent)",
                    }}
                    aria-hidden
                  />
                  <div className="relative">
                    <p className="text-2xl font-bold tabular-nums text-[#1a2744] sm:text-3xl">{stat.value}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">{stat.emoji} {stat.label}</p>
                  </div>
                </div>
              ))}
            </section>

            {/* ── SETUP CHECKLIST — below stats, above clients ── */}
            {progressPct < 100 ? (
              <section className="overflow-hidden rounded-2xl border-2 border-[#0d9488] bg-white shadow-lg">
                {/* Header */}
                <div className="relative overflow-hidden bg-gradient-to-r from-[#1a2744] to-[#0d4f6b] px-5 py-4 sm:px-6">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_100%_0%,rgba(13,148,136,0.3),transparent)]" aria-hidden />
                  <div className="relative flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-teal-300">Get your bot live</p>
                      <h2 className="mt-0.5 text-lg font-bold text-white sm:text-xl">
                        Setup checklist — {progressPct}% complete
                      </h2>
                      <p className="mt-1 text-sm text-slate-300">
                        {CHECKLIST.length - completedCount} step{CHECKLIST.length - completedCount !== 1 ? "s" : ""} remaining before your AI front desk is live
                      </p>
                    </div>
                    <div className="hidden shrink-0 flex-col items-center sm:flex">
                      <div className="relative flex h-16 w-16 items-center justify-center">
                        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff18" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0d9488" strokeWidth="3"
                            strokeDasharray={`${progressPct} ${100 - progressPct}`} strokeLinecap="round" />
                        </svg>
                        <span className="text-sm font-bold text-white">{progressPct}%</span>
                      </div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-teal-400 transition-[width] duration-500 ease-out"
                      style={{ width: `${progressPct}%` }}
                      role="progressbar"
                      aria-valuenow={progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Setup progress"
                    />
                  </div>
                </div>
                {/* Steps */}
                <ul className="divide-y divide-slate-100">
                  {CHECKLIST.map((item) => {
                    const isDone = done[item.id];
                    const isActiveBotStep = item.id === "share" && launched;
                    const label = isActiveBotStep ? "Bot is active ✅" : item.label;
                    const onboardingHref = onboardingHrefForChecklist(item.id);
                    return (
                      <li
                        key={item.id}
                        className={`relative flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6 transition-colors ${
                          isDone ? "bg-slate-50/60" : "bg-white hover:bg-slate-50 cursor-pointer"
                        }`}
                      >
                        {!isActiveBotStep && !item.alwaysDone ? (
                          <Link
                            href={onboardingHref}
                            className="absolute inset-0 z-[1] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0d9488]"
                            aria-label={`Continue setup: ${item.label}`}
                          />
                        ) : null}
                        <div className="relative z-[2] flex min-w-0 flex-1 items-center gap-3 pointer-events-none">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-base" aria-hidden>
                            {isDone
                              ? <span className="select-none text-lg">✅</span>
                              : <span className="block h-6 w-6 rounded-full border-2 border-slate-300 bg-white" />}
                          </span>
                          <span className={`text-sm font-medium leading-snug ${isDone && !isActiveBotStep ? "text-slate-400 line-through decoration-slate-300" : "text-[#1a2744]"}`}>
                            {label}
                          </span>
                        </div>
                        <div className="relative z-[2] shrink-0">
                          {isActiveBotStep ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Active</span>
                              <Link href={`/chat/${botChatSlug}`} className="inline-flex items-center rounded-full bg-[#0d9488] px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-700">View bot</Link>
                            </div>
                          ) : item.alwaysDone ? (
                            <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0d9488]">Done</span>
                          ) : (
                            <Link href={onboardingHref} tabIndex={-1} className="inline-flex items-center rounded-full bg-[#0d9488] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-teal-700">
                              {isDone ? "Edit →" : "Start →"}
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : (
              <div className="flex items-center gap-4 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-sky-50 px-5 py-4 shadow-sm">
                <span className="text-3xl">🎉</span>
                <div>
                  <p className="text-base font-bold text-[#1a2744]">You&apos;re all set!</p>
                  <p className="text-sm text-slate-600">Your bot is live and your practice is fully set up. Share your link and start getting clients.</p>
                </div>
                <div className="ml-auto flex shrink-0 gap-2">
                  <Link href="/onboarding?step=1" className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#1a2744] transition hover:bg-slate-50">
                    Edit my bot
                  </Link>
                  <Link href={`/chat/${botChatSlug}`} className="shrink-0 rounded-full bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700">
                    View my bot →
                  </Link>
                </div>
              </div>
            )}

            {launched ? (
              <>
                {/* ── The Blue Room (main content) ── */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] via-[#0d4f6b] to-[#0d9488] px-5 py-6 shadow-lg">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_0%,rgba(56,189,248,0.15),transparent)]" aria-hidden />
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" />
                        <span className="text-xs font-semibold uppercase tracking-widest text-teal-300">Coming Soon</span>
                      </div>
                      <h2 className="text-lg font-bold text-white">The Blue Room 💙</h2>
                      <p className="mt-1 text-sm leading-relaxed text-slate-200">
                        Your private community of nurse injectors. Share tips, get support, stay on top of the latest aesthetic trends, and grow together.
                      </p>
                      <ul className="mt-3 grid grid-cols-2 gap-1.5">
                        {["Trending procedures","New techniques","Holiday offer templates","Peer support","Industry news","Members only content"].map(item => (
                          <li key={item} className="flex items-center gap-1.5 text-xs font-medium text-teal-100">
                            <span className="text-teal-300">✓</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2 sm:shrink-0 sm:items-end">
                      <Link
                        href="/blueroom"
                        className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#1a2744] shadow-lg transition hover:bg-teal-50 sm:w-auto"
                      >
                        Enter The Blue Room 💙
                      </Link>
                      <p className="text-xs text-teal-200/70 text-center">Be first in when we launch</p>
                    </div>
                  </div>
                </div>

                {/* ── Add to your website (collapsible, main content) ── */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setEmbedOpen(o => !o)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-sm">💻</span>
                      <p className="text-sm font-semibold text-[#1a2744]">Add to your website</p>
                    </div>
                    <span className="text-slate-400 text-sm">{embedOpen ? "▲" : "▾"}</span>
                  </button>
                  {embedOpen && (
                    <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                      <p className="text-xs leading-relaxed text-slate-500">Copy this code and paste it anywhere in your website&apos;s HTML. Your bot will appear automatically — updates apply instantly, no changes needed on your site.</p>
                      <div className="mt-3 rounded-xl bg-[#1a2744] px-3 py-3">
                        <code className="block break-all text-xs leading-relaxed text-teal-200">
                          {`<script async src="https://adonisblue.io/embed.js" data-bot-slug="${botChatSlug}"></script>`}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(`<script async src="https://adonisblue.io/embed.js" data-bot-slug="${botChatSlug}"></script>`)}
                        className="mt-3 w-full rounded-full bg-[#0d9488] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
                      >
                        Copy embed code
                      </button>
                    </div>
                  )}
                </section>
              </>
            ) : null}

            {intakes.length > 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white shadow-md">
                <button
                  type="button"
                  onClick={() => setIntakesOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-4 py-4 sm:px-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm">💌</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">Client Intakes & Follow-ups</p>
                      <p className="text-xs text-slate-400">{intakes.length} client{intakes.length !== 1 ? "s" : ""} — {intakes.filter(i => !i.aftercare_sent_at).length} aftercare pending</p>
                    </div>
                  </div>
                  <span className="text-slate-400 text-sm">{intakesOpen ? "▲" : "▼"}</span>
                </button>
                {intakesOpen ? (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-6">
                    <p className="mb-3 text-xs leading-relaxed text-slate-600">Know how you did, collect real reviews, and use them on your Google Business, website, or social media. Every review builds your reputation 💙</p>
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 mb-4">
                      <span className="text-base">💡</span>
                      <p className="text-xs leading-relaxed text-amber-800">
                        <strong>Heads up:</strong> The first email from AdonisBlue may land in your client's spam folder. Ask them to mark it as "Not Spam" so future emails go straight to their inbox!
                      </p>
                    </div>
                    <ul className="space-y-3">
                      {intakes.map((intake) => (
                        <li key={intake.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[#1a2744]">{intake.first_name || "Client"}</p>
                            <p className="text-xs text-slate-500">{intake.service_interested || "Service not specified"} • {new Date(intake.created_at).toLocaleDateString()}</p>
                            {intake.referred_by ? <p className="text-xs text-teal-600">Found you via {intake.referred_by}</p> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={aftercareLoading === intake.id}
                              onClick={() => intake.aftercare_sent_at ? router.push("/aftercare") : void handleSendAftercare(intake)}
                              className="shrink-0 rounded-full bg-[#1a2744] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#243552] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {intake.aftercare_sent_at ? "Aftercare sent ✅" : aftercareLoading === intake.id ? "Sending..." : "Send aftercare 💌"}
                            </button>
                            <button
                              type="button"
                              disabled={!!intake.survey_sent || surveyLoading === intake.id}
                              onClick={() => void handleSendSurvey(intake)}
                              className="shrink-0 rounded-full bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {intake.survey_sent ? "Review requested ✅" : surveyLoading === intake.id ? "Sending..." : "Request review ⭐"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteIntake(intake.id)}
                              className="shrink-0 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5">
                <h3 className="text-base font-semibold text-[#1a2744] sm:text-lg">Your bot</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-medium text-slate-500">Practice name</dt>
                    <dd className="mt-0.5 font-medium text-[#1a2744]">{bot?.practice_name?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Booking link</dt>
                    <dd className="mt-0.5 truncate font-medium text-[#0d9488]" title={bot?.booking_link?.trim() || undefined}>
                      {(() => {
                        const link = bot?.booking_link?.trim() || "";
                        if (!link) return "—";
                        return link.length > 40 ? `${link.slice(0, 37)}...` : link;
                      })()}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href="/onboarding?step=1"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
                  >
                    Edit my bot
                  </Link>
                  {launched ? (
                    <Link
                      href={`/chat/${botChatSlug}`}
                      className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#1a2744] transition hover:bg-slate-50"
                    >
                      View my bot
                    </Link>
                  ) : null}
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <Link
                    href="/insights"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2.5 text-center text-sm font-semibold text-[#0d9488] transition hover:bg-teal-100"
                  >
                    📊 View my insights
                  </Link>
                  <Link
                    href="/aftercare"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    🩹 Aftercare Dashboard
                  </Link>
                  <Link
                    href="/offers"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2.5 text-center text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                  >
                    🎉 Offers &amp; Specials
                  </Link>
                  <Link
                    href="/booking-connect"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    🔗 Connect Booking Software
                  </Link>
                  {process.env.NEXT_PUBLIC_SHOW_LOYALTY === "true" && (
                    <Link
                      href="/loyalty"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2.5 text-center text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
                    >
                      🌟 Referrals & Loyalty
                    </Link>
                  )}
                </div>
              </div>
              {/* ── Instagram Automation ── */}
              <div className="mt-4 rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50 to-rose-50 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📱</span>
                  <h3 className="text-sm font-bold text-[#1a2744]">Instagram Automation</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-500 mb-3">
                  Let clients comment a keyword on your posts and automatically receive your bot link in a DM — hands free.
                </p>
                <Link
                  href="/instagram-automation"
                  className="inline-flex w-full items-center justify-center rounded-full border border-pink-200 bg-white px-4 py-2 text-xs font-bold text-pink-600 transition hover:bg-pink-50"
                >
                  Set up Instagram automation →
                </Link>
              </div>

              {/* ── My Plan ── */}
              {(() => {
                const plan = (bot?.plan ?? "trial").toLowerCase();
                const trialEndsAt = bot?.trial_ends_at
                  ? new Date(bot.trial_ends_at)
                  : null;
                const daysLeft = trialEndsAt
                  ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : null;
                const expired = plan === "trial" && trialEndsAt !== null && trialEndsAt.getTime() < Date.now();
                const planLabel = plan === "starter" || plan === "pro" ? "💳 Starter" : "🆓 Trial";
                const planColor = plan === "starter" || plan === "pro"
                  ? "text-teal-600 bg-teal-50 border-teal-200"
                  : expired
                  ? "text-red-600 bg-red-50 border-red-200"
                  : "text-amber-600 bg-amber-50 border-amber-200";
                return (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
                    <h3 className="text-sm font-semibold text-[#1a2744]">My Plan</h3>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${planColor}`}>{planLabel}</span>
                      {expired && <span className="text-xs font-semibold text-red-500">Trial expired</span>}
                    </div>
                    {plan === "trial" && !expired && daysLeft !== null && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        <span className="font-semibold text-amber-600">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span> left in your free trial
                      </p>
                    )}
                    {expired && (
                      <p className="mt-1.5 text-xs text-red-500">Your trial has ended. Upgrade to keep your bot running.</p>
                    )}
                    {plan === "trial" || plan === "free" ? (
                      <Link
                        href="/upgrade"
                        className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2 text-center text-xs font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
                      >
                        Upgrade to Starter →
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={portalBusy}
                        onClick={() => void handleManagePlan()}
                        className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2 text-center text-xs font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700 disabled:opacity-60"
                      >
                        {portalBusy ? "Opening portal…" : "Manage plan →"}
                      </button>
                    )}
                    <div className="mt-2 border-t border-slate-100 pt-2 space-y-1.5">
                      <button
                        type="button"
                        disabled={freezeLoading}
                        onClick={() => void handleFreezeToggle()}
                        className={`inline-flex w-full items-center justify-center rounded-full border px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                          bot?.frozen
                            ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {freezeLoading ? "Saving…" : bot?.frozen ? "❄️ Unfreeze my account" : "❄️ Freeze my account"}
                      </button>
                      <p className={`text-xs px-1 ${bot?.frozen ? "text-amber-600 font-medium" : "text-slate-500"}`}>
                        {bot?.frozen
                          ? "Your bot is paused. Clients cannot chat until you unfreeze."
                          : "Temporarily pauses your bot — clients will see an 'unavailable' message instead of the chat."}
                      </p>
                      {cancelDone ? (
                        <p className="text-center text-xs font-semibold text-teal-700 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5">
                          ✓ Membership canceled — you keep access until the end of your billing period.
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCancelMembership()}
                          disabled={cancelBusy}
                          className="inline-flex w-full items-center justify-center rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {cancelBusy ? "Canceling…" : "Cancel membership"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>
          </aside>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 lg:mt-10 lg:pt-8">
          <p className="text-xs text-slate-500">
            Want to delete your account?{" "}
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-xs font-medium text-red-600 underline decoration-red-600/40 underline-offset-2 transition hover:text-red-700"
            >
              Delete account
            </button>
          </p>
        </div>

        {showWelcome ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title">
            <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={dismissWelcome} />
            <div className="relative z-[101] w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <h2 id="welcome-modal-title" className="text-lg font-bold text-[#1a2744]">Welcome to AdonisBlue! 🦋</h2>
              <p className="mt-1 text-sm text-slate-500">Here&apos;s all you need to know:</p>
              <ul className="mt-4 space-y-3">
                {[
                  { icon: "🤖", text: "Your bot link — Share it on Instagram or your website. Clients can chat 24/7." },
                  { icon: "🩹", text: "Aftercare — Log a treatment after each appointment. The right email goes out automatically." },
                  { icon: "🚨", text: "Emergency alerts — If a client types a concerning symptom, you get an immediate email." },
                  { icon: "📊", text: "Insights — See how many clients your bot captured." },
                  { icon: "❄️", text: "Freeze — Going on vacation? Freeze your bot so clients see a pause message." },
                ].map(({ icon, text }) => (
                  <li key={icon} className="flex gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 shrink-0">{icon}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={dismissWelcome}
                className="mt-6 w-full rounded-full bg-[#0d9488] py-3 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                Got it! Let&apos;s go 🦋
              </button>
            </div>
          </div>
        ) : null}

        {deleteDialogOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close dialog"
              onClick={() => !deleteBusy && setDeleteDialogOpen(false)}
            />
            <div className="relative z-[101] w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
              <h2 id="delete-account-title" className="sr-only">
                Delete account
              </h2>
              <p className="text-sm leading-relaxed text-slate-700">
                Are you sure? Deleting your account removes everything permanently — your bot, settings, and photos. This cannot be undone.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => setDeleteDialogOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={handleConfirmDeleteDialog}
                  className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteBusy ? "Signing out…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {showLaunchCelebration ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowLaunchCelebration(false);
              localStorage.setItem("ab-celebrated-" + botChatSlug, "true");
            }}
          />
          <div className="relative z-[201] w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-[#1a2744] via-[#0d4f6b] to-[#0d9488] p-6 shadow-2xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(56,189,248,0.2),transparent)]" aria-hidden />
            <div className="relative text-center">
              <div className="mb-4 text-6xl">🎉</div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Your bot is live!</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                Congratulations! Your AI front desk is ready to answer clients 24/7. Share it everywhere!
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-teal-300">Your bot link</p>
                  <p className="break-all text-sm font-medium text-white">https://adonisblue.io/chat/{botChatSlug}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(`https://adonisblue.io/chat/${botChatSlug}`);
                  }}
                  className="w-full rounded-full bg-white px-6 py-3 text-sm font-bold text-[#1a2744] shadow-lg transition hover:bg-teal-50"
                >
                  📋 Copy my bot link
                </button>

                <a
                  href={`https://www.instagram.com/?url=https://adonisblue.io/chat/${botChatSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-full border-2 border-white/30 bg-white/10 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-white/20"
                >
                  📱 Share on Instagram
                </a>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(`<script async src="https://adonisblue.io/embed.js" data-bot-slug="${botChatSlug}"></script>`);
                  }}
                  className="block w-full rounded-full border-2 border-white/30 bg-white/10 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-white/20"
                >
                  💻 Copy embed code
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowLaunchCelebration(false);
                  localStorage.setItem("ab-celebrated-" + botChatSlug, "true");
                }}
                className="mt-4 text-xs text-slate-400 underline underline-offset-2 transition hover:text-white"
              >
                Close and go to dashboard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {feedbackOpen ? (
          <div className="w-[min(100vw-3rem,20rem)] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-lg shadow-slate-900/10">
            <p className="text-sm font-semibold text-[#1a2744]">We grow because of you 💙</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Tell us what&apos;s working, what&apos;s not, or what you wish existed. We read every single message.
            </p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0d9488]/40 focus:bg-white focus:ring-2 focus:ring-[#0d9488]/20"
              placeholder="Your thoughts help us build something truly special for nurses like you..."
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const res = await fetch("/api/send-feedback", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        feedback: feedbackText.trim(),
                        nurse_name: nurseName,
                      }),
                    });
                    if (res.ok) {
                      setFeedbackText("");
                      setFeedbackOpen(false);
                    }
                  })();
                }}
                className="flex-1 rounded-full bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="rounded-full bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-700"
        >
          💬 How are we doing?
        </button>
      </div>
    </div>
  );
}
