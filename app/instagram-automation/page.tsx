"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const SITE_URL = "https://www.adonisblue.io";

export default function InstagramAutomationPage() {
  const router = useRouter();
  const [botLink, setBotLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) { router.push("/auth"); return; }
      const res = await fetch("/api/mybot", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { bot } = await res.json();
        if (bot?.slug) setBotLink(`${SITE_URL}/chat/${bot.slug}`);
      }
    });
  }, [router]);

  const handleCopy = () => {
    if (!botLink) return;
    void navigator.clipboard.writeText(botLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen" style={{ background: "#0d1628" }}>
      {/* Top nav */}
      <div className="border-b border-white/10 px-4 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="text-5xl">📱</div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Instagram Automation</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            When a client comments a keyword, Instagram automatically sends them your bot link — hands free.
          </p>
        </div>

        {/* How it works */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold text-white">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                emoji: "🗣️",
                title: "Client comments a keyword",
                desc: 'e.g. "LIPS", "BOOK", or "INFO" on your Instagram post',
              },
              {
                emoji: "📲",
                title: "Instagram sends them a DM",
                desc: "Automatically — with your AdonisBlue bot link",
              },
              {
                emoji: "🤖",
                title: "They start chatting with your AI",
                desc: "Booking questions answered instantly, 24/7",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-center space-y-2"
              >
                <div className="text-3xl">{step.emoji}</div>
                <p className="text-sm font-semibold text-white">{step.title}</p>
                <p className="text-xs text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bot link */}
        <section className="rounded-2xl border border-teal-500/30 bg-teal-900/20 p-6 sm:p-8 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Your bot link</h2>
            <p className="text-sm text-slate-400 mt-1">Use this link in your automation setup below.</p>
          </div>
          {botLink ? (
            <div className="flex items-center gap-3 flex-wrap">
              <code className="flex-1 rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-teal-300 break-all">
                {botLink}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-xl px-5 py-3 text-sm font-semibold transition-colors"
                style={{ background: copied ? "#0d4f6b" : "#0d9488", color: "#fff" }}
              >
                {copied ? "Copied! ✓" : "Copy link"}
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-500 animate-pulse">
              Loading your bot link…
            </div>
          )}
          <p className="text-xs text-teal-400">
            💡 Tip: Paste this exact link into the auto-reply message in your automation setup.
          </p>
        </section>

        {/* Setup guide */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Setup guide</h2>

          {/* Option 1 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-teal-500/20 border border-teal-500/30 px-3 py-1 text-xs font-semibold text-teal-400">
                Option 1
              </span>
              <h3 className="text-lg font-semibold text-white">Instagram Native Automation</h3>
              <span className="ml-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                Free
              </span>
            </div>
            <p className="text-sm text-slate-400">Built right into Instagram — no third-party tools needed.</p>
            <ol className="space-y-4">
              {[
                <>Go to <strong className="text-white">Instagram</strong> → <strong className="text-white">Professional Dashboard</strong> → <strong className="text-white">Automated Messages</strong> → <strong className="text-white">Keyword Replies</strong></>,
                <>Set your trigger keyword — e.g. <code className="rounded bg-white/10 px-1.5 py-0.5 text-teal-300 text-xs">LIPS</code>, <code className="rounded bg-white/10 px-1.5 py-0.5 text-teal-300 text-xs">BOOK</code>, or <code className="rounded bg-white/10 px-1.5 py-0.5 text-teal-300 text-xs">INFO</code></>,
                <>Set the auto-reply message:{" "}
                  <span className="block mt-2 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-slate-300 italic">
                    &ldquo;Hey! Here&apos;s my booking link — chat with my AI assistant for instant answers:{" "}
                    <span className="text-teal-300">{botLink ?? "https://adonisblue.io/chat/your-slug"}</span>&rdquo;
                  </span>
                </>,
                <>Hit <strong className="text-white">Save</strong> and test it by commenting the keyword yourself on one of your posts</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-xs font-bold text-teal-400">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-300 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Option 2 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="rounded-full bg-violet-500/20 border border-violet-500/30 px-3 py-1 text-xs font-semibold text-violet-400">
                Option 2
              </span>
              <h3 className="text-lg font-semibold text-white">ManyChat</h3>
              <span className="ml-auto rounded-full bg-violet-500/20 border border-violet-500/30 px-2.5 py-0.5 text-xs font-medium text-violet-400">
                More powerful · free plan available
              </span>
            </div>
            <p className="text-sm text-slate-400">
              More automation options — trigger on comments, story replies, DMs, and more.
            </p>
            <ol className="space-y-4">
              {[
                <>Go to <a href="https://manychat.com" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline hover:text-teal-300">manychat.com</a> and connect your Instagram account</>,
                <>Create a <strong className="text-white">new Flow</strong> and choose <strong className="text-white">Instagram Comments</strong> as the trigger</>,
                <>Set your keyword — e.g. <code className="rounded bg-white/10 px-1.5 py-0.5 text-teal-300 text-xs">LIPS</code></>,
                <>Add an action: <strong className="text-white">Send DM</strong> — paste your bot link as the message</>,
                <>Hit <strong className="text-white">Publish</strong> and test by commenting the keyword on your post</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-400">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-300 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
            <a
              href="https://manychat.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-300 hover:bg-violet-500/20 transition-colors"
            >
              Open ManyChat →
            </a>
          </div>
        </div>

        {/* Pro tip */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex gap-4">
          <span className="text-2xl shrink-0">💡</span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-300">Pro tip</p>
            <p className="text-sm text-slate-400">
              Post a Reel or Story and caption it:{" "}
              <em className="text-slate-300">&ldquo;Comment LIPS and I&apos;ll send you my booking link!&rdquo;</em>{" "}
              This dramatically increases DM automation triggers and grows your client pipeline hands-free.
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center pt-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
