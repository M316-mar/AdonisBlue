"use client";

import { supabase } from "@/lib/supabase";
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
    case "practice":
      return "/onboarding?step=1";
    case "services":
      return "/onboarding?step=2";
    case "booking":
      return "/onboarding?step=3";
    case "photos":
      return "/onboarding?step=4";
    case "botStyle":
      return "/onboarding?step=3";
    case "policies":
      return "/onboarding?step=3";
    case "preview":
      return "/onboarding?step=5";
    default:
      return "/onboarding";
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
  const [bot, setBot] = useState<BotRow | null>(null);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [surveyLoading, setSurveyLoading] = useState<string | null>(null);
  const [aftercareLoading, setAftercareLoading] = useState<string | null>(null);
  const [intakesOpen, setIntakesOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

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
    await supabase.auth.signOut();
    router.push("/auth");
  }, [router]);

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
      // Clear all local storage data
      localStorage.clear();
      sessionStorage.clear();
      await supabase.auth.signOut();
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1a2744]/95 shadow-sm shadow-slate-900/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <Image src="/Alona.png" alt="AdonisBlue" width={48} height={48} className="h-10 w-10 sm:h-12 sm:w-12" />
            <span className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">AdonisBlue</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
            <span className="hidden max-w-[12rem] truncate text-sm font-medium text-white/90 sm:inline sm:max-w-xs md:text-base">
              {nurseName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 sm:px-4 sm:text-sm"
            >
              Log out
            </button>
          </div>
        </div>
        <p className="mx-auto max-w-6xl truncate px-4 pb-2 text-xs font-medium text-teal-100/90 sm:hidden">{nurseName}</p>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8 lg:items-start">
          <div className="space-y-6 lg:col-span-8">
            <section className="relative overflow-hidden rounded-2xl border border-teal-900/10 bg-[#1a2744] px-4 py-6 shadow-lg shadow-slate-900/5 sm:px-6 sm:py-8">
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
                { label: "Reminders Queued", value: remindersScheduled, emoji: "🔔", color: "#0d9488" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="relative overflow-hidden rounded-2xl border border-teal-900/10 bg-[#1a2744] px-4 py-4 shadow-lg shadow-slate-900/10 sm:px-5 sm:py-5"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{
                      background: "radial-gradient(ellipse 80% 60% at 80% 0%, rgba(13,148,136,0.25), transparent)",
                    }}
                    aria-hidden
                  />
                  <div className="relative">
                    <p className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{stat.value}</p>
                    <p className="mt-1 text-xs font-medium text-teal-300/90 sm:text-sm">{stat.emoji} {stat.label}</p>
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-md shadow-slate-900/5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#1a2744] sm:text-xl">Your setup checklist</h2>
                  <p className="mt-1 text-sm text-slate-600">Complete each step when you are ready — you can revisit any time.</p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-[#0d9488]">{progressPct}%</p>
              </div>
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0d9488] transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Setup progress"
                />
              </div>

              <ul className="mt-6">
                {CHECKLIST.map((item) => {
                  const isDone = done[item.id];
                  const isActiveBotStep = item.id === "share" && launched;
                  const label = isActiveBotStep ? "Bot is active ✅" : item.label;
                  const onboardingHref = onboardingHrefForChecklist(item.id);
                  return (
                    <li
                      key={item.id}
                      className="relative flex flex-col gap-3 border-b border-slate-100 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      {!isActiveBotStep ? (
                        <Link
                          href={onboardingHref}
                          className="absolute inset-0 z-[1] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] focus-visible:ring-offset-2"
                          aria-label={`Continue setup: ${item.label}`}
                        />
                      ) : null}
                      <div className="relative z-[2] flex min-w-0 flex-1 items-start gap-3 pointer-events-none">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-lg leading-none" aria-hidden>
                          {isDone ? (
                            <span className="select-none">✅</span>
                          ) : (
                            <span className="block h-8 w-8 rounded-full border-2 border-slate-200 bg-white" />
                          )}
                        </span>
                        <span
                          className={`text-sm font-medium leading-snug sm:text-base ${
                            isDone && !isActiveBotStep ? "text-slate-500 line-through decoration-slate-300" : "text-[#1a2744]"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      {isActiveBotStep ? (
                        <div className="relative z-[2] flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                          <span className="inline-flex w-full items-center justify-center rounded-full border border-green-200 bg-green-50 px-4 py-2.5 text-center text-sm font-semibold text-green-700 sm:w-auto sm:min-w-[6.5rem]">
                            Active
                          </span>
                          <Link
                            href={`/chat/${botChatSlug}`}
                            className="inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700 sm:w-auto sm:min-w-[6.5rem]"
                          >
                            View my bot
                          </Link>
                        </div>
                      ) : item.alwaysDone ? (
                        <span className="relative z-[2] inline-flex w-full shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50 px-4 py-2.5 text-center text-sm font-semibold text-[#0d9488] opacity-80 pointer-events-none sm:w-auto sm:min-w-[6.5rem]">
                          Done
                        </span>
                      ) : (
                        <Link
                          href={onboardingHref}
                          tabIndex={-1}
                          className="relative z-[2] inline-flex w-full shrink-0 items-center justify-center rounded-full bg-[#0d9488] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700 sm:w-auto sm:min-w-[6.5rem]"
                        >
                          {isDone ? "Edit" : "Start"}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {intakes.length > 0 ? (
              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-900/5">
                <button
                  type="button"
                  onClick={() => setIntakesOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-4 py-4 sm:px-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm">💌</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[#1a2744]">Client Intakes & Follow-ups</p>
                      <p className="text-xs text-slate-500">{intakes.length} client{intakes.length !== 1 ? "s" : ""} — {intakes.filter(i => !i.aftercare_sent_at).length} aftercare pending</p>
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
                              disabled={!!intake.aftercare_sent_at || aftercareLoading === intake.id}
                              onClick={() => void handleSendAftercare(intake)}
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
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-lg shadow-slate-900/5 sm:p-5">
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
              </div>
              {launched ? (
                <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-lg shadow-slate-900/5 sm:p-5">
                  <h3 className="text-base font-semibold text-[#1a2744]">Add to your website</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">Copy this code and paste it anywhere in your website&apos;s HTML. Your bot will appear automatically — and any updates you make here apply instantly, no changes needed on your site.</p>
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
              ) : null}
            </div>
          </aside>
        </div>

        <section className="mt-8 lg:mt-10">
          <div className="flex flex-col gap-5 overflow-hidden rounded-2xl border border-teal-800/20 bg-gradient-to-br from-[#1a2744] via-[#243552] to-[#1a3d45] px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-7">
            <div className="max-w-xl">
              <h2 className="text-lg font-semibold text-white sm:text-xl">The Blue Room</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-200 sm:text-base">
                Join The Blue Room — connect with other nurses, share tips, and help us improve
              </p>
            </div>
            <button
              type="button"
              className="inline-flex w-full shrink-0 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-[#1a2744] shadow-md transition hover:bg-teal-50 sm:w-auto sm:self-center"
              style={{ backgroundColor: "#fff" }}
            >
              Join
            </button>
          </div>
        </section>

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
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0d9488]/40 focus:bg-white focus:ring-2 focus:ring-[#0d9488]/20"
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
