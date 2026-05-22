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
  practice_name?: string | null;
  bot_name?: string | null;
  services?: string[] | null;
  booking_link?: string | null;
  photos?: string[] | null;
  cancellation_policy?: string | null;
  aftercare?: string | null;
  launched?: boolean | null;
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
    const raw = (bot?.bot_name || "").trim() || (bot?.practice_name || "").trim() || "my-bot";
    return slugify(raw);
  }, [bot?.bot_name, bot?.practice_name]);

  const completedCount = useMemo(() => CHECKLIST.filter((item) => done[item.id]).length, [done]);
  const progressPct = Math.round((completedCount / CHECKLIST.length) * 100);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  }, [router]);

  const handleConfirmDeleteDialog = useCallback(async () => {
    setDeleteBusy(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
    } finally {
      setDeleteBusy(false);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-[#1a2744]/80">Loading your dashboard…</p>
      </div>
    );
  }

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
                  Welcome back, {nurseName} <span aria-hidden>✨</span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
                  We appreciate your hard work and dedication. We are here to make sure your clients always feel taken care of — even when you are busy taking care of them.
                </p>
              </div>
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
          </div>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/5">
                <div className="aspect-video bg-gradient-to-br from-[#1a2744] via-[#1e3350] to-[#0d9488]/40 p-4 sm:p-5">
                  <div className="flex h-full flex-col justify-between">
                    <p className="text-sm font-semibold leading-snug text-white sm:text-base">Watch how it works — 3 min video</p>
                    <div className="flex justify-center py-2">
                      <button
                        type="button"
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-[#0d9488] shadow-lg ring-4 ring-white/30 transition hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
                        aria-label="Play how it works video"
                      >
                        <svg className="ml-0.5 h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path d="M8 5v14l11-7L8 5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
                  <p className="text-xs text-slate-500">A quick tour of your client-facing bot and dashboard.</p>
                </div>
              </div>
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
    </div>
  );
}
