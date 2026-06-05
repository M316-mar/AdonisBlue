"use client";

import Image from "next/image";
import Link from "next/link";

const steps = [
  {
    step: "01",
    emoji: "📱",
    title: "Create a free ManyChat account",
    body: "Go to manychat.com and sign up for free. Connect your Instagram business account when prompted. This takes about 2 minutes.",
    tip: "Make sure your Instagram is set to a Business or Creator account — ManyChat won't work with personal accounts.",
  },
  {
    step: "02",
    emoji: "⚡",
    title: "Create a new Instagram automation",
    body: "Inside ManyChat, click 'New Flow' then select 'Instagram'. Choose 'Comment Trigger' as your trigger type.",
    tip: "Comment triggers fire when someone comments a specific word on your post — like 'INFO' or 'BOOK'.",
  },
  {
    step: "03",
    emoji: "🔑",
    title: "Set your trigger keyword",
    body: "Choose a keyword your clients will comment to get your bot link. Popular choices are 'INFO', 'BOOK', 'LIPS', or 'DETAILS'. Keep it short and easy to remember.",
    tip: "Put the keyword in your caption — 'Comment INFO below and I'll send you everything!' works really well.",
  },
  {
    step: "04",
    emoji: "💬",
    title: "Set the DM reply message",
    body: "When someone comments your keyword, ManyChat automatically DMs them. Set the message to send your AdonisBlue bot link.",
    tip: null,
  },
  {
    step: "05",
    emoji: "🔗",
    title: "Add your AdonisBlue link",
    body: "In the DM message, type something like: 'Hey! Here's all the info you need 💙' then add a button linking to your bot.",
    tip: "Your bot link is: adonisblue.io/chat/YOUR-SLUG — find it on your dashboard.",
  },
  {
    step: "06",
    emoji: "✅",
    title: "Test and go live",
    body: "Test by commenting your keyword on one of your posts from a different account. You should receive a DM with your bot link within seconds.",
    tip: "Once it works, add the keyword to all your service posts and in your Instagram bio link section!",
  },
];

export default function ManyChatGuidePage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            <span className="text-base font-bold text-[#1a2744]">AdonisBlue</span>
          </Link>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <div className="mb-10">
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-bold text-amber-800">Before you start — read this first</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-700">
                  ManyChat is a <strong>separate free app</strong> — it is not part of AdonisBlue. You will need to create your own free account at <strong>manychat.com</strong>. It takes 2 minutes and it is completely free to use for this.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-4 py-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-pink-600">Instagram Integration</span>
            </div>
            <h1 className="text-3xl font-bold text-[#1a2744] sm:text-4xl">Get clients from Instagram — automatically</h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500">
              Here is exactly how it works in plain English:
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <div className="mb-3 text-4xl">1️⃣</div>
              <p className="text-sm font-bold text-[#1a2744]">You post on Instagram</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">You tell followers to comment a word like "INFO" or "BOOK" to get details</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <div className="mb-3 text-4xl">2️⃣</div>
              <p className="text-sm font-bold text-[#1a2744]">ManyChat sends them a DM</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Automatically — no touching your phone. ManyChat sends your bot link instantly</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <div className="mb-3 text-4xl">3️⃣</div>
              <p className="text-sm font-bold text-[#1a2744]">Your AdonisBlue bot closes them</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">They click the link, chat with your bot, get their questions answered and book</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-center text-sm font-semibold text-[#1a2744]">
              💙 You do not need to be online. You do not need to reply. It all happens automatically while you sleep, work, or treat clients.
            </p>
          </div>
        </div>

        {/* How it works banner */}
        <div className="mb-10 rounded-2xl bg-gradient-to-br from-[#1a2744] via-[#0d4f6b] to-[#0d9488] p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_0%,rgba(56,189,248,0.2),transparent)]" aria-hidden />
          <h2 className="text-lg font-bold text-white sm:text-xl">How it works in 3 seconds</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { icon:"💬", text:"Client comments 'INFO' on your post" },
              { icon:"⚡", text:"ManyChat instantly DMs them your bot link" },
              { icon:"🤖", text:"Your AdonisBlue bot answers all their questions" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-xs font-medium leading-relaxed text-slate-200">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[#1a2744]">Step by step setup</h2>
          {steps.map((step, i) => (
            <div key={step.step} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start gap-4 p-5 sm:p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-sky-50 border border-teal-100 text-2xl">
                  {step.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-teal-500">STEP {step.step}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#1a2744] sm:text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
                  {step.tip && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <span className="text-sm">💡</span>
                      <p className="text-xs leading-relaxed text-amber-800">{step.tip}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Caption templates */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-[#1a2744]">📝 Ready-to-use Instagram captions</h2>
          <p className="mt-1 text-sm text-slate-500">Copy these and customize with your details.</p>
          <div className="mt-4 space-y-4">
            {[
              {
                label: "For a lip filler post",
                caption: "Swipe to see my latest lip filler results ✨\n\nAll my clients start by chatting with my AI assistant — she answers all your questions about pricing, what to expect, and how to book.\n\nComment 'LIPS' below and I'll send you the link instantly 💋",
              },
              {
                label: "For a general services post",
                caption: "Want to know if you're a good candidate for filler? 💉\n\nComment 'INFO' below and I'll send you a link where you can ask all your questions, see my services, and book a spot — 24/7, no waiting.\n\nYour glow-up is one comment away ✨",
              },
              {
                label: "For a before/after post",
                caption: "Results like this don't happen by accident 🌸\n\nMy AI assistant can walk you through exactly what we did, answer your questions, and help you book.\n\nComment 'BOOK' and I'll send you the link 💙",
              },
            ].map(template => (
              <div key={template.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0d9488]">{template.label}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{template.caption}</p>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(template.caption)}
                  className="mt-3 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-teal-200 hover:text-[#0d9488]"
                >
                  📋 Copy caption
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center">
          <p className="text-base font-bold text-[#1a2744]">Ready to set this up? 💙</p>
          <p className="mt-1 text-sm text-slate-500">Get your bot link from your dashboard and paste it into ManyChat.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[#0d9488] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-teal-700"
          >
            Go to my dashboard →
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-100 bg-white px-4 py-8 text-center">
        <p className="text-sm text-slate-400">© {new Date().getFullYear()} AdonisBlue. Built for nurse injectors 💙</p>
      </footer>
    </div>
  );
}
