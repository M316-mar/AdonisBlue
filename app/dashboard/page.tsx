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
  { id: "photos", label: "Upload your work photos" },
  { id: "botStyle", label: "Set your bot colors and name" },
  { id: "policies", label: "Add your policies and agreements" },
  { id: "preview", label: "Preview your bot" },
  { id: "share", label: "Share your bot with your clients" },
];

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
  const [done, setDone] = useState<Record<ChecklistId, boolean>>({
    account: true,
    practice: false,
    services: false,
    booking: false,
    photos: false,
    botStyle: false,
    policies: false,
    preview: false,
    share: false,
  });

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
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const completedCount = useMemo(() => CHECKLIST.filter((item) => done[item.id]).length, [done]);
  const progressPct = Math.round((completedCount / CHECKLIST.length) * 100);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth");
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

              <ul className="mt-6 divide-y divide-slate-100">
                {CHECKLIST.map((item) => {
                  const isDone = done[item.id];
                  return (
                    <li key={item.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-lg leading-none" aria-hidden>
                          {isDone ? (
                            <span className="select-none">✅</span>
                          ) : (
                            <span className="block h-8 w-8 rounded-full border-2 border-slate-200 bg-white" />
                          )}
                        </span>
                        <span className={`text-sm font-medium leading-snug sm:text-base ${isDone ? "text-slate-500 line-through decoration-slate-300" : "text-[#1a2744]"}`}>
                          {item.label}
                        </span>
                      </div>
                      {item.alwaysDone ? (
                        <button
                          type="button"
                          disabled
                          className="w-full shrink-0 rounded-full border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-[#0d9488] opacity-80 sm:w-auto sm:min-w-[6.5rem]"
                        >
                          Done
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDone((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                          className="w-full shrink-0 rounded-full bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700 active:scale-[0.98] sm:w-auto sm:min-w-[6.5rem]"
                        >
                          {isDone ? "Edit" : "Start"}
                        </button>
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
      </main>
    </div>
  );
}
