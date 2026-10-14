"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

// Starter price sourced from app/page.tsx pricing section ($200/mo)
const MONTHLY_PRICE = 200;
const YEARLY_PRICE = MONTHLY_PRICE * 12; // 2400

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

const PRESETS = [
  { label: "Botox", sub: "$435 · every 4 months", price: 435, interval: 4 },
  { label: "Filler", sub: "$715 · every 9 months", price: 715, interval: 9 },
];

const INTERVALS = [
  { label: "Every 3 months", value: 3 },
  { label: "Every 4 months", value: 4 },
  { label: "Every 6 months", value: 6 },
  { label: "Every 9 months", value: 9 },
  { label: "Once a year", value: 12 },
];

// Simple line icons as inline SVG — no emoji
function IconHeart() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function ClientValueCalculatorPage() {
  const [price, setPrice] = useState(435);
  const [interval, setInterval] = useState(4);
  const [kept, setKept] = useState(2);
  const [activePreset, setActivePreset] = useState<number>(0); // index into PRESETS

  const results = useMemo(() => {
    const perYear = (price * 12) / interval;
    const over3Years = perYear * 3;
    const keptYear = kept * 12;
    const keptValue = keptYear * perYear;
    const clientsToBreakEven = Math.ceil(YEARLY_PRICE / perYear);
    return { perYear, over3Years, keptYear, keptValue, clientsToBreakEven };
  }, [price, interval, kept]);

  function handlePreset(idx: number) {
    const p = PRESETS[idx]!;
    setPrice(p.price);
    setInterval(p.interval);
    setActivePreset(idx);
  }

  function handlePriceSlider(v: number) {
    setPrice(v);
    setActivePreset(-1);
  }

  function handleInterval(v: number) {
    setInterval(v);
    setActivePreset(-1);
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            <span className="text-base font-bold text-[#1B2240]">AdonisBlue</span>
          </Link>
          <Link href="/auth" className="rounded-full bg-[#2F7F70] px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700">
            Start free trial
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

        {/* 1. Hero */}
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2F7F70]">Client Value Calculator</p>
          <h1 className="text-3xl font-bold text-[#1B2240] sm:text-4xl lg:text-5xl">
            One client who keeps coming back<br className="hidden sm:block" /> is worth more than you think.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Most practices pour their energy into finding new clients. The real growth is in the ones who already trust you, and keep coming back.
          </p>
        </div>

        {/* 2. Calculator */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">

          {/* LEFT — inputs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md sm:p-8">
            <h2 className="mb-5 text-base font-bold text-[#1B2240]">Your practice</h2>

            {/* Preset buttons */}
            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold text-slate-700">Start with a typical treatment</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p, i) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePreset(i)}
                    className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      activePreset === i
                        ? "border-[#2F7F70] bg-teal-50 text-[#2F7F70]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-bold">{p.label}</span>
                    <span className="ml-1 font-normal text-slate-500">· {p.sub}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Then adjust the numbers to match your own prices.</p>
            </div>

            {/* Price slider */}
            <div className="mb-6">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Average price per visit</label>
                <span className="text-lg font-bold text-[#2F7F70]">{fmt(price)}</span>
              </div>
              <input
                type="range"
                min={150}
                max={1500}
                step={5}
                value={price}
                onChange={e => handlePriceSlider(Number(e.target.value))}
                className="w-full accent-[#2F7F70]"
                style={{ minHeight: "44px" }}
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400"><span>$150</span><span>$1,500</span></div>
              <p className="mt-1 text-[11px] text-slate-400">US average fee: about $435 for Botox and $715 for hyaluronic acid filler.</p>
            </div>

            {/* Interval pill buttons */}
            <div className="mb-6">
              <p className="mb-2 text-sm font-semibold text-slate-700">How often a client comes back</p>
              <div className="flex flex-wrap gap-2">
                {INTERVALS.map(iv => (
                  <button
                    key={iv.value}
                    type="button"
                    onClick={() => handleInterval(iv.value)}
                    className={`min-h-[44px] rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      interval === iv.value
                        ? "border-[#2F7F70] bg-teal-50 text-[#2F7F70]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-slate-50"
                    }`}
                  >
                    {iv.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Botox usually lasts 3–6 months. Filler usually lasts 6–12 months.</p>
            </div>

            {/* Kept clients slider */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">What if this many more clients came back each month?</label>
                <span className="text-lg font-bold text-[#2F7F70]">{kept}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={kept}
                onChange={e => setKept(Number(e.target.value))}
                className="w-full accent-[#2F7F70]"
                style={{ minHeight: "44px" }}
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400"><span>1</span><span>10</span></div>
              <p className="mt-1 text-[11px] text-slate-400">Clients who would have drifted away, but rebooked instead.</p>
            </div>
          </div>

          {/* RIGHT — results */}
          <div className="flex flex-col gap-4">
            <div className="flex-1 rounded-2xl bg-[#1B2240] p-6 text-white shadow-xl sm:p-8">

              {/* One client */}
              <div className="mb-6 border-b border-white/10 pb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-teal-300">One client who keeps coming back</p>
                <p className="mt-2 text-4xl font-bold sm:text-5xl">{fmt(results.perYear)}</p>
                <p className="mt-1 text-sm text-slate-300">a year in visits</p>
                <p className="mt-3 text-lg font-semibold text-white/80">{fmt(results.over3Years)} <span className="text-sm font-normal text-slate-400">over 3 years</span></p>
              </div>

              {/* Kept clients */}
              <div className="mb-6 border-b border-white/10 pb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-teal-300">
                  If {kept} more client{kept === 1 ? "" : "s"} a month keep rebooking
                </p>
                <p className="mt-2 text-4xl font-bold sm:text-5xl">{fmt(results.keptValue)}</p>
                <p className="mt-1 text-sm text-slate-300">a year in visits</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  That&apos;s {results.keptYear} more returning client{results.keptYear === 1 ? "" : "s"} by the end of the year, bringing in this much each year they stay.
                </p>
              </div>

              {/* Cost comparison */}
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-sm font-semibold text-white">AdonisBlue Starter: {fmt(YEARLY_PRICE)} a year</p>
                <p className="mt-1 text-sm text-slate-300">
                  Keeping {results.clientsToBreakEven} client{results.clientsToBreakEven === 1 ? "" : "s"} coming back covers the cost.
                </p>
              </div>
            </div>

            {/* Disclaimer under card */}
            <p className="text-center text-[11px] text-slate-400">Revenue before your costs, like product and supplies.</p>
          </div>
        </div>

        {/* 3. How AdonisBlue helps */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold text-[#1B2240] sm:text-3xl">How AdonisBlue helps them come back</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed text-slate-500">
            Clients return to the injector who made them feel cared for. AdonisBlue helps make that happen for every client, even on your busiest weeks.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                Icon: IconHeart,
                title: "They feel cared for",
                body: "Aftercare emails and check-ins after treatment, so clients aren't left wondering if what they feel is normal.",
              },
              {
                Icon: IconClock,
                title: "A reminder at the right time",
                body: "Rebooking reminders go out when their treatment usually starts wearing off.",
              },
              {
                Icon: IconMoon,
                title: "Answers at 11pm",
                body: "Your assistant answers common questions any time, and alerts you when a message includes urgent warning signs.",
              },
              {
                Icon: IconStar,
                title: "Happy clients bring friends",
                body: "Review requests and your own reviews page help turn happy clients into word-of-mouth.",
              },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 text-[#2F7F70]"><Icon /></div>
                <p className="mb-2 text-sm font-bold text-[#1B2240]">{title}</p>
                <p className="text-sm leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Honest note */}
        <div className="mt-12 rounded-2xl bg-slate-100 px-5 py-4">
          <p className="text-xs leading-relaxed text-slate-500">
            These numbers are an example based on what you enter, not a promise of results. Starting prices are national average fees reported by the American Society of Plastic Surgeons (2023); your prices may differ by city. AdonisBlue helps you stay in touch with every client after their visit, so they feel looked after and remember to come back.
          </p>
        </div>

        {/* 5. Closing CTA */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-[#1B2240] sm:text-3xl">Start caring for the clients you already have.</h2>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#2F7F70] px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-teal-700 sm:w-auto"
            >
              Start free — no card needed
            </Link>
            <Link
              href="/#how-it-works"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-[#1B2240] transition hover:border-teal-300 hover:bg-slate-50 sm:w-auto"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">14 days free · Cancel anytime · Setup in under an hour</p>
        </div>

      </main>
    </div>
  );
}
