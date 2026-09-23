"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const PROCEDURES = [
  {
    name: "Botox / Neuromodulator",
    text: "Thank you for coming in today. Here's everything you need for the next couple of days — nothing complicated, just the things that actually matter.\n\nFor the next 4 hours\nStay upright. Sitting, standing, walking, driving — all fine. Just no lying flat, no naps, and nothing that puts your head below your heart for long stretches (think downward dog or leaning way over a laptop).\nDon't rub, press, or massage the treated areas. If you're putting makeup back on, be gentle.\n\nFor the next 24 hours\nSkip the gym, running, and anything that gets your heart rate up\nSkip alcohol — it can make bruising worse\nAvoid ibuprofen, aspirin, fish oil, and vitamin E if you can, for the same reason\nKeep hats, headbands, and goggles off your forehead\n\nFor the next 48 hours\nNo saunas, steam rooms, hot tubs, or hot yoga. Keep showers lukewarm.\n\nFor the next 2 weeks\nHold off on facials, peels, microneedling, and facial massage.\n\nWhat's normal\nSmall bumps right after that settle within a few hours. Mild redness or a little bruising at the injection points. You'll start seeing results around day 3 to 5, and the full effect lands around day 10 to 14. If it looks uneven at day 5, that's usually just it settling — give it the full two weeks.\n\nCall me if\nYou have any change in your vision, or pain around your eyes\nYou have trouble breathing or swallowing\nYou notice drooping of an eyelid or eyebrow\nAnything feels wrong and you want a real answer\n\n[YOUR PHONE] — text or call, I'd genuinely rather hear from you than have you sitting at home wondering.\n\nYou can also reply right here in your healing chat any time, day or night, and you'll get an answer.\n\n— [YOUR NAME]",
  },
  {
    name: "Lip Filler",
    text: "You did great today. Lips swell more than anywhere else, so here's what's coming and what to do about it.\n\nToday and tomorrow\nUse a cold compress — 15 minutes on, then a break. Always wrap it in a clean cloth, never ice directly on your lips. Sleep with your head slightly elevated tonight if you can.\nHands off. Don't press or massage, and if you feel a small lump, don't try to work it out yourself — message me and I'll look at it.\n\nFor the next 24 hours\nNo hot showers, saunas, steam rooms, or hot tubs — lukewarm only\nNo hard workouts; a walk is fine\nSkip alcohol\nSkip makeup and lipstick for the first 12 hours\nDrink water and go easy on salty food, it helps the swelling\n\nFor the next 2 weeks\nNo facials, peels, laser, or facial massage. Reschedule routine dental work if you can.\n\nWhat's normal\nReal swelling. Your lips will look bigger than the final result — that's expected, and it peaks around 24 to 48 hours before it starts coming down. Bruising, tenderness, and small lumps you can feel are all normal early on. Give it two full weeks before you judge the result, and don't panic on day two. Everyone does, and everyone's fine.\n\nCall me right away if\nThe skin on or around your lips turns white, pale, or blotchy\nThe pain is severe and getting worse instead of better\nYou see any change in your vision\nYou notice increasing redness, warmth, or a fever\n\n[YOUR PHONE] — call me any time, including nights and weekends. These are rare, but I want to hear about them immediately, not tomorrow.\n\nYour healing chat below is open 24/7 too. If something feels off and you're not sure, ask. That's what it's for.\n\n— [YOUR NAME]",
  },
  {
    name: "Cheek Filler",
    text: "Thanks for trusting me with this today. Here's what to do over the next couple of days.\n\nToday and tomorrow\nCool compress if you're swollen — 15 minutes at a time, wrapped in a cloth, never ice directly on skin. Try to sleep on your back tonight so you're not pressing your cheeks into the pillow.\nDon't massage or press the treated areas. If you feel a firm spot, leave it alone and tell me about it.\n\nFor the next 24 hours\nKeep showers and baths lukewarm — no saunas, steam, or hot tubs\nNo strenuous exercise; light walking is fine\nSkip alcohol\nHold off on makeup for the first 12 hours\n\nFor the next 2 weeks\nNo facials, chemical peels, microdermabrasion, laser, or facial massage. If you have dental work scheduled, push it out if you can.\n\nWhat's normal\nSwelling that peaks around 24 to 48 hours, some bruising, and a firm or slightly uneven feel early on. Cheeks often look fuller than the final result for the first week. Two weeks is when you'll see what you actually paid for.\n\nCall me right away if\nThe skin looks white, pale, blotchy, or dusky\nThe pain is severe or getting worse\nYou have any vision changes or eye pain\nYou see spreading redness, warmth, pus, or you're running a fever\n\n[YOUR PHONE] — any hour. Don't wait until morning.\n\nOr just reply in your healing chat and I'll get back to you.\n\n— [YOUR NAME]",
  },
  {
    name: "Nose Filler",
    text: "Nose filler is beautiful work but it's the area I watch most closely, so please read this whole thing.\n\nToday and tomorrow\nNothing touches your nose. No pressing, no massaging, no picking at it. Sleep on your back with your head elevated.\nIf you wear glasses or sunglasses, keep them off your nose for at least 48 hours — ask me about taping them up if you need them for work.\nCool compress nearby, not directly on the bridge, 15 minutes at a time with a cloth barrier.\n\nFor the next 24 to 48 hours\nNo hot showers, saunas, steam, or hot tubs\nNo exercise\nSkip alcohol\nNo makeup on the area for the first 12 hours\n\nFor the next 2 weeks\nNo facials, peels, laser, or massage anywhere near the area. No other injectables in the same region until we've talked.\n\nWhat's normal\nMild swelling, tenderness, and small bruises. The shape settles over about two weeks.\n\nStop and call me immediately if\nThe skin on your nose or between your eyes turns white, pale, or grey\nYou have blurred vision, double vision, or any pain behind your eyes\nThe pain is severe or getting noticeably worse\nThe skin looks mottled or develops a dusky, bruise-like pattern that keeps spreading\n\n[YOUR PHONE] — call, don't text, and call at any hour. If you can't reach me and you have vision changes, go to the emergency room. I will never be annoyed that you called. I would be devastated if you waited.\n\nYour healing chat is also open 24/7 for anything that doesn't feel urgent.\n\n— [YOUR NAME]",
  },
  {
    name: "Skin Booster",
    text: "Easy one — skin boosters have the gentlest recovery of anything I do. Here's the short version.\n\nToday\nYou'll likely have small raised bumps where the product went in. They're normal and usually settle within 24 to 48 hours. Don't massage them unless I specifically told you to.\nKeep the area clean, skip makeup for the first 12 hours, and use a cool compress if you feel puffy.\n\nFor the next 24 hours\nNo strenuous exercise or heavy sweating\nNo saunas, steam rooms, or hot tubs\nSkip alcohol\nLukewarm water only when you wash your face\n\nFor the next 3 to 5 days\nPause retinol, exfoliating acids, and scrubs. Go gentle with your skincare and wear SPF 30 or higher — your skin's a little more sensitive right now.\n\nFor the next 2 weeks\nNo facials, peels, microneedling, or laser.\n\nWhat's normal\nSmall bumps, mild redness, occasional pinpoint bruising. Hydration and glow build gradually — most people see the real difference around week 2 to 4, and it keeps improving if we do the full series.\n\nCall me if\nRedness, warmth, or swelling gets worse after day 2 instead of better\nYou develop pus, or a fever\nAny bump is painful rather than just visible\nAnything at all feels wrong\n\n[YOUR PHONE], or reply in your healing chat below any time.\n\n— [YOUR NAME]",
  },
];

function renderWithPlaceholders(text: string) {
  const parts = text.split(/(\[YOUR PHONE\]|\[YOUR NAME\])/g);
  return parts.map((part, i) => {
    if (part === "[YOUR PHONE]") {
      return (
        <em key={i} className="not-italic rounded bg-teal-50 px-1.5 py-0.5 text-[0.85em] font-semibold text-teal-700 ring-1 ring-teal-200">
          (your phone number)
        </em>
      );
    }
    if (part === "[YOUR NAME]") {
      return (
        <em key={i} className="not-italic rounded bg-teal-50 px-1.5 py-0.5 text-[0.85em] font-semibold text-teal-700 ring-1 ring-teal-200">
          (your name)
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);

  const handleCopy = (index: number) => {
    void navigator.clipboard.writeText(PROCEDURES[index].text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 antialiased">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
          </Link>
          <Link href="/" className="text-sm font-semibold text-[#1a2744]">AdonisBlue</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a2744] sm:text-4xl">
            Free Aftercare Templates
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500">
            The exact messages AdonisBlue sends your clients after every treatment. Copy them, use them however you&apos;d like — no strings attached.
          </p>
        </div>

        {/* Tab bar */}
        <div className="mb-1 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {PROCEDURES.map((p, i) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition whitespace-nowrap ${
                activeTab === i
                  ? "bg-[#0d9488] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Template card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-[#1a2744]">{PROCEDURES[activeTab].name} — Aftercare</h2>
            <button
              type="button"
              onClick={() => handleCopy(activeTab)}
              className="rounded-full bg-[#0d9488] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              {copied === activeTab ? "Copied!" : "Copy template"}
            </button>
          </div>
          <div className="px-5 py-5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {renderWithPlaceholders(PROCEDURES[activeTab].text)}
            </p>
          </div>
        </div>

        {/* See it in action */}
        <div className="mt-14 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-[#1a2744]">See it in action</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
            This isn&apos;t just text on a page — it&apos;s what your AI assistant actually sends, automatically, the moment a treatment is logged. Try asking it something yourself.
          </p>
          <a
            href="https://www.adonisblue.io/chat/adonispracticespa"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0d9488] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
          >
            💬 Chat with a live demo assistant
          </a>
          <p className="mt-3 text-xs text-slate-400">
            Try asking: &ldquo;I accidentally laid down after my Botox&rdquo; or &ldquo;my skin feels numb and tingly&rdquo; to see how it responds.
          </p>
        </div>

        {/* Closing CTA */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-center text-xl font-bold text-[#1a2744]">Want this running for your own clients?</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed text-slate-500">
            AdonisBlue sends these automatically — no copy-pasting, no forgetting. Two ways to get started:
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <a
              href="https://adonisblue.io"
              className="flex flex-col items-center rounded-2xl border border-teal-200 bg-teal-50 px-6 py-5 text-center transition hover:bg-teal-100 sm:w-56"
            >
              <span className="text-2xl">🚀</span>
              <span className="mt-2 text-sm font-bold text-[#1a2744]">Start your 14-day free trial</span>
              <span className="mt-1 text-xs text-slate-500">Create your account and go live today — no approval needed.</span>
            </a>
            <a
              href="https://adonisblue.io/beta"
              className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center transition hover:bg-slate-100 sm:w-56"
            >
              <span className="text-2xl">🤝</span>
              <span className="mt-2 text-sm font-bold text-[#1a2744]">Apply for the guided beta</span>
              <span className="mt-1 text-xs text-slate-500">Valentina personally helps you set it up — free, in exchange for your honest feedback.</span>
            </a>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} AdonisBlue · <a href="mailto:hi@adonisblue.io" className="underline hover:text-slate-600">hi@adonisblue.io</a>
      </footer>
    </div>
  );
}
