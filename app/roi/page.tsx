"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

export default function ROICalculatorPage() {
  const [treatmentPrice, setTreatmentPrice] = useState(500);
  const [newClientsWanted, setNewClientsWanted] = useState(3);
  const [hoursOnDMs, setHoursOnDMs] = useState(7);
  const [plan, setPlan] = useState<"starter" | "pro">("starter");

  const planCost = plan === "starter" ? 85 : 150;

  const results = useMemo(() => {
    const revenueFromNewClients = newClientsWanted * treatmentPrice;
    const profitAfterPlan = revenueFromNewClients - planCost;
    const breakEvenClients = Math.ceil(planCost / treatmentPrice * 10) / 10;
    const hourlyRate = treatmentPrice / 1.5; // assume 1.5hr per treatment
    const dmCostPerMonth = hoursOnDMs * 4 * (hourlyRate / 60); // 4 weeks
    const totalOpportunityCost = dmCostPerMonth + (newClientsWanted * treatmentPrice);
    return {
      revenueFromNewClients,
      profitAfterPlan,
      breakEvenClients,
      dmCostPerMonth: Math.round(dmCostPerMonth),
      totalOpportunityCost: Math.round(totalOpportunityCost),
    };
  }, [treatmentPrice, newClientsWanted, hoursOnDMs, planCost]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            <span className="text-base font-bold text-[#1a2744]">AdonisBlue</span>
          </Link>
          <Link href="/auth" className="rounded-full bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700">
            Start free trial
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-700">ROI Calculator</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1a2744] sm:text-4xl">How much is not having a bot costing you?</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500">
            Fill in your numbers and see exactly what AdonisBlue is worth to your practice.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Inputs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md sm:p-8">
            <h2 className="mb-6 text-lg font-bold text-[#1a2744]">Tell us about your practice</h2>

            {/* Plan selector */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Which plan are you considering?</label>
              <div className="grid grid-cols-2 gap-3">
                {(["starter", "pro"] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${plan === p ? "border-[#0d9488] bg-teal-50 text-[#0d9488]" : "border-slate-200 bg-white text-slate-600 hover:border-teal-200"}`}
                  >
                    {p === "starter" ? "Starter — $85/mo" : "Pro — $150/mo"}
                  </button>
                ))}
              </div>
            </div>

            {/* Treatment price */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Average treatment price</label>
                <span className="text-lg font-bold text-[#0d9488]">${treatmentPrice}</span>
              </div>
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                value={treatmentPrice}
                onChange={e => setTreatmentPrice(Number(e.target.value))}
                className="w-full accent-[#0d9488]"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>$100</span><span>$2,000</span>
              </div>
            </div>

            {/* New clients wanted */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">New clients you want per month</label>
                <span className="text-lg font-bold text-[#0d9488]">{newClientsWanted}</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={newClientsWanted}
                onChange={e => setNewClientsWanted(Number(e.target.value))}
                className="w-full accent-[#0d9488]"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>1</span><span>30</span>
              </div>
            </div>

            {/* Hours on DMs */}
            <div className="mb-2">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Hours per week answering DMs & questions</label>
                <span className="text-lg font-bold text-[#0d9488]">{hoursOnDMs}h</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={hoursOnDMs}
                onChange={e => setHoursOnDMs(Number(e.target.value))}
                className="w-full accent-[#0d9488]"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>1h</span><span>20h</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {/* Main result */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] to-[#0d4f6b] p-6 shadow-xl sm:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_0%,rgba(13,148,136,0.3),transparent)]" aria-hidden />
              <div className="relative">
                <p className="text-sm font-semibold uppercase tracking-widest text-teal-300">Your ROI</p>
                <p className="mt-2 text-4xl font-bold text-white sm:text-5xl">
                  ${results.profitAfterPlan.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-slate-300">extra revenue per month after your plan cost</p>
                <div className="mt-4 h-px bg-white/10" />
                <p className="mt-4 text-sm leading-relaxed text-slate-200">
                  AdonisBlue pays for itself with just <span className="font-bold text-teal-300">{results.breakEvenClients} booking{results.breakEvenClients !== 1 ? "s" : ""}</span>. Everything after that is pure profit.
                </p>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 p-5">
                <p className="text-2xl font-bold text-[#0d9488]">${results.revenueFromNewClients.toLocaleString()}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">💰 Revenue from {newClientsWanted} new clients</p>
              </div>
              <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50 p-5">
                <p className="text-2xl font-bold text-red-500">${results.dmCostPerMonth.toLocaleString()}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">⏰ Value of time lost on DMs/month</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-yellow-50 p-5">
                <p className="text-2xl font-bold text-amber-600">{hoursOnDMs * 4}h</p>
                <p className="mt-1 text-xs font-medium text-slate-500">📅 Hours/month answering questions</p>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-5">
                <p className="text-2xl font-bold text-purple-600">${planCost}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">✅ Your monthly plan cost</p>
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 text-center">
              <p className="text-sm font-semibold text-[#1a2744]">Ready to start making this money? 💙</p>
              <p className="mt-1 text-xs text-slate-500">14-day free trial. Full access. No credit card needed.</p>
              <Link
                href="/auth"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-teal-700"
              >
                Start my free trial →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom trust line */}
        <div className="mt-10 text-center">
          <p className="text-sm text-slate-400">A part-time receptionist costs $1,500–$2,500/month. AdonisBlue starts at $85. One booking pays for it.</p>
        </div>
      </main>
    </div>
  );
}
