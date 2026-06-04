"use client";

import { useState } from "react";
import Image from "next/image";

const features = [
  { emoji: "🌙", title: "Always-on front desk", description: "Cover nights and busy clinic windows without being glued to your phone." },
  { emoji: "💬", title: "Natural plain-English replies", description: "Your clients get clear, calm answers that feel human, not robotic." },
  { emoji: "🌎", title: "English + Spanish", description: "Support more clients in the language they are most comfortable using." },
  { emoji: "🔀", title: "Lead-safe handoffs", description: "Anything complex gets flagged and routed so real opportunities are not lost." },
  { emoji: "🎛️", title: "Guardrails you control", description: "You approve the answers, update services, and set clear boundaries any time." },
  { emoji: "📊", title: "Practical insights", description: "See what people ask most so you can improve your scripts and service pages." },
];

const faqItems = [
  { q: "Will my clients know it is a bot?", a: "Usually yes, and that is fine. Most clients care about getting a fast and clear answer. You can give it your tone so it feels like your practice." },
  { q: "What if the bot says something wrong?", a: "You stay in control. You can edit answers any time, and harder questions are sent to you so nothing critical is left to automation." },
  { q: "Do I need a website to use AdonisBlue?", a: "No. You can start with a direct link in Instagram, text, or email. If you have a site, you can embed later." },
  { q: "Can I change my services after setup?", a: "Yes. Update your services, wording, policies, and FAQs whenever your practice changes." },
  { q: "Is my client information safe?", a: "AdonisBlue is a front-end chatbot. It does not go into your booking platform, records system, or backend software." },
  { q: "What happens when the free trial ends?", a: "You get a reminder before trial ends. Then you can upgrade or stop. No hidden lock-ins." },
  { q: "Does it work in Spanish?", a: "Yes. It supports both English and Spanish so your clients can ask naturally." },
  { q: "How is this different from a generic chatbot?", a: "Generic bots sound generic. AdonisBlue is trained on your services and your voice, so answers match your brand and workflow." },
];

const testimonials = [
  { quote: "I used to spend 2 hours a day answering the same questions on Instagram. Now my bot handles it and I focus on my clients.", name: "Sarah M.", role: "Nurse Injector, Miami" },
  { quote: "My clients love how fast they get answers. I've had three people book just because the bot replied at midnight when I couldn't.", name: "Jessica R.", role: "Aesthetic Nurse, Dallas" },
  { quote: "Setup took me 4 minutes. I was shocked. Now it's like having a receptionist that never sleeps.", name: "Tina F.", role: "Nurse Practitioner, Houston" },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {faqItems.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-teal-300/50 hover:shadow-md">
            <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" aria-expanded={isOpen}>
              <span className="text-sm font-semibold text-[#1a2744] sm:text-base">{item.q}</span>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-teal-500 transition ${isOpen ? "rotate-180 bg-teal-50" : ""}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100 px-5 pb-4">
                <p className="pt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0);
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 via-sky-50 to-white p-8 shadow-lg sm:p-10">
        <p className="text-lg font-medium leading-relaxed text-[#1a2744] sm:text-xl italic">"{testimonials[current].quote}"</p>
        <div className="mt-6">
          <p className="font-bold text-[#1a2744]">{testimonials[current].name}</p>
          <p className="text-sm text-slate-500">{testimonials[current].role}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setCurrent(c => (c - 1 + testimonials.length) % testimonials.length)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-600"
        >←</button>
        <div className="flex gap-2">
          {testimonials.map((_, i) => (
            <button key={i} type="button" onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${i === current ? "w-8 bg-teal-500" : "w-2 bg-slate-300"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCurrent(c => (c + 1) % testimonials.length)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-600"
        >→</button>
      </div>
    </div>
  );
}

export default function Home() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-full bg-white font-sans text-slate-800 antialiased">

      {/* ── ANNOUNCEMENT BAR ── */}
      <div className="bg-gradient-to-r from-[#1a2744] via-[#0d9488] to-[#1a2744] px-4 py-2.5 text-center">
        <p className="text-xs font-semibold text-white sm:text-sm">🎉 Now live — 6 & 9 month automatic client reminder emails. <a href="#pricing" className="underline underline-offset-2 hover:text-teal-200">Start free →</a></p>
      </div>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
          <a href="#" className="flex min-w-0 shrink items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={44} height={44} className="rounded-xl" />
            <span className="text-lg font-bold tracking-tight text-[#1a2744]">AdonisBlue</span>
          </a>
          <nav className="hidden items-center gap-7 lg:flex">
            {[["#daily-flow","How it Works"],["#features","Features"],["#pricing","Pricing"],["#faq","FAQ"]].map(([href,label]) => (
              <a key={label} href={href} className="text-sm font-medium text-slate-600 transition hover:text-[#0d9488]">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href="/auth" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-[#1a2744] transition hover:border-teal-300 hover:text-[#0d9488]">Log in</a>
            <a href="#pricing" className="rounded-full bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-200 transition hover:bg-teal-700">Get Started</a>
          </div>
        </div>
      </header>

      <main>

        {/* ── HERO — dark navy like Firefly ── */}
        <section className="relative overflow-hidden bg-[#0d1628] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-teal-500/15 blur-[120px]" />
            <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-sky-500/10 blur-[100px]" />
            <div className="absolute right-0 top-1/3 h-[300px] w-[300px] rounded-full bg-purple-500/10 blur-[80px]" />
          </div>
          <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-teal-300">Built for nurse injectors</span>
              </div>
              <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
                Stop losing clients to whoever{" "}
                <span className="bg-gradient-to-r from-teal-300 to-sky-300 bg-clip-text text-transparent">answered first.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
                AdonisBlue is your AI front desk — built for nurse injectors. It answers client questions in your voice, 24/7, while you focus on what you do best.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#pricing" className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#0d9488] px-8 py-3 text-base font-semibold text-white shadow-xl shadow-teal-900/30 transition hover:bg-teal-600">
                  Start free — no card needed
                </a>
                <a href="#daily-flow" className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/20 px-8 py-3 text-base font-semibold text-white transition hover:border-teal-300 hover:text-teal-300">
                  See how it works
                </a>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["🧑‍⚕️","👩‍⚕️","💉","🩺"].map((e,i) => (
                    <div key={i} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0d1628] bg-[#1a2744] text-sm">{e}</div>
                  ))}
                </div>
                <p className="text-sm text-slate-400"><span className="font-semibold text-white">200+ nurses</span> already using AdonisBlue</p>
              </div>
            </div>
            {/* Chat mockup */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-teal-500/20 via-sky-500/10 to-purple-500/10 blur-2xl" aria-hidden />
              <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-400/20">
                    <Image src="/Alona.png" alt="" width={32} height={32} className="rounded-full" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">AdonisBlue Assistant</p>
                    <p className="flex items-center gap-1.5 text-xs text-teal-300">
                      <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-teal-300" /></span>
                      Online · replies instantly
                    </p>
                  </div>
                  <span className="ml-auto rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-slate-400">Live preview</span>
                </div>
                <div className="space-y-4 px-4 py-5">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm border border-teal-400/30 bg-teal-400/10 px-4 py-2.5 text-sm text-white">
                      Can I get lip filler if I'm on a blood thinner?
                    </div>
                  </div>
                  <div className="flex justify-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">🤍</div>
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/8 px-4 py-2.5 text-sm leading-relaxed text-slate-200">
                      Great question! Many practices review blood thinners before treatment. I can send our booking link so your injector can guide you safely 💙
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm border border-teal-400/30 bg-teal-400/10 px-4 py-2.5 text-sm text-white">
                      How much is lip filler?
                    </div>
                  </div>
                  <div className="flex justify-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">🤍</div>
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/8 px-4 py-2.5 text-sm leading-relaxed text-slate-200">
                      Pricing is personalized to exactly what you need — your nurse will go over everything at your appointment. Ready to grab a spot? 💕
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 px-4 pb-4 pt-3">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {["What services do you offer?","How do I book?","Does it hurt?"].map(q => (
                      <span key={q} className="rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-300">{q}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
                    <span className="text-xs text-slate-500">Type a message…</span>
                    <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-sm text-white">↑</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── BIG STATS — Firefly style grid ── */}
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-xl">
              <h2 className="text-3xl font-bold text-[#1a2744] sm:text-4xl">The new standard for aesthetic practice communication</h2>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border border-slate-100 lg:grid-cols-4">
              {[
                { stat: "24/7", sub: "Client coverage", desc: "Never miss an inquiry again, day or night" },
                { stat: "5 min", sub: "Setup time", desc: "From signup to live bot in under 5 minutes" },
                { stat: "2×", sub: "More bookings", desc: "Clients who get instant answers book faster" },
                { stat: "0", sub: "Missed questions", desc: "Every client question gets a clear answer" },
              ].map((item) => (
                <div key={item.sub} className="group p-6 transition hover:bg-teal-50 sm:p-8">
                  <p className="text-4xl font-bold text-[#0d9488] sm:text-5xl">{item.stat}</p>
                  <p className="mt-2 text-base font-semibold text-[#1a2744]">{item.sub}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── GRADIENT CTA BANNER — like Firefly's purple strip ── */}
        <section className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#1a2744] via-[#0d4f6b] to-[#0d9488] px-6 py-5 sm:flex-row sm:px-8 sm:py-6">
              <p className="text-base font-semibold text-white sm:text-lg">See how nurses are saving 2+ hours a day with AdonisBlue</p>
              <a href="#pricing" className="shrink-0 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[#1a2744] shadow-md transition hover:bg-teal-50">
                Start free trial →
              </a>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS — white bg, teal accents ── */}
        <section id="daily-flow" className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0d9488]">Daily operations</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1a2744] sm:text-4xl">How AdonisBlue runs your front desk</h2>
              <p className="mt-4 text-base leading-relaxed text-slate-500">A clean workflow that keeps response times fast and handoffs clear.</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step:"01", title:"Client asks a question", body:"DM, text, or website chat.", icon:"💬", color:"from-teal-50 to-sky-50", border:"border-teal-100" },
                { step:"02", title:"AdonisBlue answers instantly", body:"Plain-language reply in English or Spanish.", icon:"⚡", color:"from-sky-50 to-blue-50", border:"border-sky-100" },
                { step:"03", title:"Complex questions forwarded", body:"Anything sensitive routes to you.", icon:"🔀", color:"from-blue-50 to-indigo-50", border:"border-blue-100" },
                { step:"04", title:"Nurse gets notified", body:"You follow up with context, not chaos.", icon:"🔔", color:"from-indigo-50 to-purple-50", border:"border-indigo-100" },
              ].map((card) => (
                <div key={card.step} className={`group relative overflow-hidden rounded-2xl border ${card.border} bg-gradient-to-br ${card.color} p-6 transition hover:shadow-lg`}>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-2xl">{card.icon}</span>
                    <span className="text-xs font-bold text-[#0d9488]/60">{card.step}</span>
                  </div>
                  <h3 className="text-base font-semibold text-[#1a2744]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES — light with colorful gradient cards like Firefly ── */}
        <section id="features" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0d9488]">Features</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1a2744] sm:text-4xl">Calm, premium client communication at scale</h2>
              <p className="mt-4 text-base leading-relaxed text-slate-500">Designed to feel elegant on the surface and practical in real clinic life.</p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => {
                const gradients = [
                  "from-teal-50 to-sky-50 border-teal-100",
                  "from-sky-50 to-blue-50 border-sky-100",
                  "from-blue-50 to-indigo-50 border-blue-100",
                  "from-indigo-50 to-purple-50 border-indigo-100",
                  "from-purple-50 to-pink-50 border-purple-100",
                  "from-pink-50 to-rose-50 border-pink-100",
                ];
                return (
                  <li key={feature.title} className={`group rounded-2xl border bg-gradient-to-br ${gradients[i]} p-6 transition hover:shadow-lg`}>
                    <span className="text-3xl">{feature.emoji}</span>
                    <h3 className="mt-4 text-base font-semibold text-[#1a2744]">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{feature.description}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── TESTIMONIALS — like Firefly's "Hear from customers" ── */}
        <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-4xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0d9488]">From our nurses</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1a2744] sm:text-4xl">Hear from our community</h2>
            </div>
            <div className="mt-12">
              <TestimonialsCarousel />
            </div>
          </div>
        </section>

        {/* ── HOW NURSES USE IT ── */}
        <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0d9488]">How nurses use it</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1a2744] sm:text-4xl">Meet clients where they already are</h2>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon:"📱", title:"Share in your Instagram bio", body:"One link handles story replies and DMs while you are in treatment — no more typing the same answers all day.", color:"from-pink-50 to-rose-50 border-pink-100" },
                { icon:"🌐", title:"Embed on your website", body:"Visitors get instant answers on your site without waiting for email — so fewer people bounce to a competitor.", color:"from-teal-50 to-sky-50 border-teal-100" },
                { icon:"💌", title:"Send directly in a DM or text", body:"Drop your bot link in a message so curious clients get clear answers before they book with someone else.", color:"from-sky-50 to-blue-50 border-sky-100" },
              ].map((item) => (
                <div key={item.title} className={`rounded-2xl border bg-gradient-to-br ${item.color} p-7 transition hover:shadow-lg`}>
                  <span className="text-4xl">{item.icon}</span>
                  <h3 className="mt-5 text-lg font-bold text-[#1a2744]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0d9488]">Pricing</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1a2744] sm:text-4xl">Choose the pace that matches your practice</h2>
              <div className="mt-6 flex items-center justify-center gap-3">
                <span className={`text-sm font-medium ${!annual ? "text-[#1a2744]" : "text-slate-400"}`}>Monthly</span>
                <button type="button" onClick={() => setAnnual(a => !a)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${annual ? "bg-[#0d9488]" : "bg-slate-200"}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${annual ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className={`text-sm font-medium ${annual ? "text-[#1a2744]" : "text-slate-400"}`}>
                  Annual <span className="ml-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-700">2 months free</span>
                </span>
              </div>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-start">
              {/* Free */}
              <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-[#0d9488]">14 Days Free</p>
                <h3 className="mt-3 text-xl font-bold text-[#1a2744]">Try it completely free</h3>
                <p className="mt-2 text-sm text-slate-500">No credit card needed.</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {["Your own custom chatbot","Up to 50 client questions","English and Spanish","Share via link or Instagram","Set up in under 5 minutes"].map(l => (
                    <li key={l} className="flex gap-2 text-sm text-slate-600"><span className="text-[#0d9488]">✓</span>{l}</li>
                  ))}
                </ul>
                <a href="/auth" className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-full border-2 border-[#0d9488] px-5 py-3 text-sm font-semibold text-[#0d9488] transition hover:bg-teal-50">
                  Start Free — No Card Needed
                </a>
              </div>
              {/* Starter */}
              <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-[#0d9488]">{annual ? "$71 / month" : "$85 / month"}</p>
                {annual && <p className="text-xs text-teal-600 mt-0.5">billed $850/yr — save $170</p>}
                <h3 className="mt-3 text-xl font-bold text-[#1a2744]">Starter</h3>
                <p className="mt-2 text-sm text-slate-500">One extra booking a month pays for this.</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {["Everything in free trial","Unlimited conversations","Embed chat on your website","Booking link built into bot","Questions flagged and sent to you","Weekly summary of top questions"].map(l => (
                    <li key={l} className="flex gap-2 text-sm text-slate-600"><span className="text-[#0d9488]">✓</span>{l}</li>
                  ))}
                </ul>
                <a href="/auth" className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#1a2744] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#243556]">
                  Get Starter
                </a>
              </div>
              {/* Pro */}
              <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-[#0d9488] bg-gradient-to-b from-teal-50 to-white p-7 shadow-xl shadow-teal-100">
                <div className="absolute right-4 top-4 rounded-full bg-[#0d9488] px-3 py-1 text-xs font-bold text-white">Most Popular</div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0d9488]">{annual ? "$125 / month" : "$150 / month"}</p>
                {annual && <p className="text-xs text-teal-600 mt-0.5">billed $1,500/yr — save $300</p>}
                <h3 className="mt-3 text-xl font-bold text-[#1a2744]">Pro</h3>
                <p className="mt-2 text-sm text-slate-500">Your AI-powered front desk — for less than one treatment.</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {["Everything in Starter","Custom bot name and colors","Guided setup for every client question","Monthly check-in to improve answers","Conversation insights dashboard","Multiple locations or specialties","VIP 4-hour response for fixes"].map(l => (
                    <li key={l} className="flex gap-2 text-sm text-slate-600"><span className="text-[#0d9488]">✓</span>{l}</li>
                  ))}
                </ul>
                <a href="/auth" className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#0d9488] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-200 transition hover:bg-teal-700">
                  Get Pro
                </a>
              </div>
            </div>
            {/* Guarantee row */}
            <div className="mt-10 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
              {[
                { icon:"🛡️", title:"30-day money back guarantee", sub:"See results or we refund you. No questions asked." },
                { icon:"💰", title:"A front desk costs $2,000/mo", sub:"AdonisBlue starts at $85. One booking pays for it." },
                { icon:"⚡", title:"Set up in 5 minutes", sub:"No tech skills. No credit card to start." },
              ].map(item => (
                <div key={item.title} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-xl">{item.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-[#1a2744]">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0d9488]">FAQ</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1a2744] sm:text-4xl">Questions you probably have</h2>
            </div>
            <div className="mt-12"><FaqAccordion /></div>
          </div>
        </section>

        {/* ── FINAL CTA — dark like Firefly ── */}
        <section id="final-cta" className="relative overflow-hidden bg-[#0d1628] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/15 via-transparent to-sky-500/10" />
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-400/10 blur-[80px]" />
          </div>
          <div className="relative mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Ready to never miss a client again?</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-300">Set up your AI chatbot in 5 minutes. No credit card. No tech skills needed.</p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a href="/auth" className="inline-flex min-h-[52px] w-full min-w-[200px] items-center justify-center rounded-full bg-[#0d9488] px-8 py-3.5 text-base font-bold text-white shadow-xl shadow-teal-900/30 transition hover:bg-teal-600 sm:w-auto">
                Build my free chatbot
              </a>
              <a href="/auth" className="inline-flex min-h-[52px] w-full min-w-[200px] items-center justify-center rounded-full border border-white/25 bg-white/8 px-8 py-3.5 text-base font-semibold text-white transition hover:border-white/50 hover:bg-white/15 sm:w-auto">
                Log in
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-100 bg-white px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <a href="#" className="flex items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            <span className="text-base font-semibold text-[#1a2744]">AdonisBlue</span>
          </a>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[["#daily-flow","How it Works"],["#features","Features"],["#pricing","Pricing"],["#faq","FAQ"]].map(([href,label]) => (
              <a key={label} href={href} className="text-sm font-medium text-slate-500 transition hover:text-[#0d9488]">{label}</a>
            ))}
          </nav>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} AdonisBlue. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
