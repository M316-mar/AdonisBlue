"use client";

import { useState, useMemo } from "react";

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

export function ClientValueCalculator() {
  const [price, setPrice] = useState(435);
  const [interval, setInterval] = useState(4);
  const [kept, setKept] = useState(2);
  const [activePreset, setActivePreset] = useState<number>(0);

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
  );
}
