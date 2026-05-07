"use client";

import { useState } from "react";
import Image from "next/image";
const SOFT_BLUE = "#e0f2fe";
const TEAL = "#0d9488";

const features = [
  { title: "Always-on front desk", description: "Cover nights and busy clinic windows without being glued to your phone." },
  { title: "Natural plain-English replies", description: "Your clients get clear, calm answers that feel human, not robotic." },
  { title: "English + Spanish", description: "Support more clients in the language they are most comfortable using." },
  { title: "Lead-safe handoffs", description: "Anything complex gets flagged and routed so real opportunities are not lost." },
  { title: "Guardrails you control", description: "You approve the answers, update services, and set clear boundaries any time." },
  { title: "Practical insights", description: "See what people ask most so you can improve your scripts and service pages." },
];

const faqItems: { q: string; a: string }[] = [
  { q: "Will my clients know it is a bot?", a: "Usually yes, and that is fine. Most clients care about getting a fast and clear answer. You can give it your tone so it feels like your practice." },
  { q: "What if the bot says something wrong?", a: "You stay in control. You can edit answers any time, and harder questions are sent to you so nothing critical is left to automation." },
  { q: "Do I need a website to use AdonisBlue?", a: "No. You can start with a direct link in Instagram, text, or email. If you have a site, you can embed later." },
  { q: "Can I change my services after setup?", a: "Yes. Update your services, wording, policies, and FAQs whenever your practice changes." },
  { q: "Is my client information safe?", a: "AdonisBlue is a front-end chatbot. It does not go into your booking platform, records system, or backend software." },
  { q: "What happens when the free trial ends?", a: "You get a reminder before trial ends. Then you can upgrade or stop. No hidden lock-ins." },
  { q: "Does it work in Spanish?", a: "Yes. It supports both English and Spanish so your clients can ask naturally." },
  { q: "How is this different from a generic chatbot?", a: "Generic bots sound generic. AdonisBlue is trained on your services and your voice, so answers match your brand and workflow." },
];

const trustLine =
  "We do not touch your booking system, your client records, or your backend software. AdonisBlue is your front-end welcome desk - nothing more, nothing less.";

function NavLinkLight({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-sm font-medium text-[#1a2744]/90 transition hover:text-[#0d9488] lg:text-[15px]">
      {children}
    </a>
  );
}

function FlowArrow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center text-[#0d9488] ${className}`} aria-hidden>
      <svg className="h-6 w-6 md:h-5 md:w-5 lg:h-6 lg:w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
      </svg>
    </div>
  );
}

function FlowArrowDown({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center text-[#0d9488] md:hidden ${className}`} aria-hidden>
      <svg className="h-6 w-6 rotate-90" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
      </svg>
    </div>
  );
}

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {faqItems.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="overflow-hidden rounded-xl border border-sky-200/30 bg-white/[0.06] transition hover:border-[#38bdf8]/50">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-white sm:text-base">{item.q}</span>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200/40 text-[#38bdf8] transition ${isOpen ? "rotate-180 bg-white/10" : ""}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {isOpen ? (
              <div className="border-t border-sky-200/20 px-4 pb-4 sm:px-5">
                <p className="pt-3 text-sm leading-relaxed text-slate-200 sm:text-base">{item.a}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-full bg-white font-sans text-slate-800 antialiased">
      <header className="sticky top-0 z-50 border-b border-sky-100 bg-white/95 shadow-sm shadow-sky-100/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
          <a href="#" className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2">
            <Image src="/Alona.png" alt="AdonisBlue Logo" width={52} height={52} />
            <span className="truncate text-lg font-semibold tracking-tight text-[#1a2744] sm:text-xl">AdonisBlue</span>
          </a>
          <details className="group relative lg:hidden">
            <summary className="list-none [&::-webkit-details-marker]:hidden">
              <span className="flex cursor-pointer items-center justify-center rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-[#1a2744]">Menu</span>
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-sky-100 bg-white p-4 shadow-xl shadow-sky-100/80">
              <nav className="flex flex-col gap-3">
                <NavLinkLight href="#daily-flow">How it Works</NavLinkLight>
                <NavLinkLight href="#features">Features</NavLinkLight>
                <NavLinkLight href="#pricing">Pricing</NavLinkLight>
                <NavLinkLight href="#faq">FAQ</NavLinkLight>
                <a href="#pricing" className="mt-1 rounded-full bg-[#0d9488] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-teal-700">Get Started Free</a>
              </nav>
            </div>
          </details>
          <nav className="hidden items-center gap-7 xl:gap-9 lg:flex">
            <NavLinkLight href="#daily-flow">How it Works</NavLinkLight>
            <NavLinkLight href="#features">Features</NavLinkLight>
            <NavLinkLight href="#pricing">Pricing</NavLinkLight>
            <NavLinkLight href="#faq">FAQ</NavLinkLight>
          </nav>
          <a href="#pricing" className="hidden rounded-full bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-200/80 transition hover:bg-teal-700 lg:inline-flex">Get Started Free</a>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#1a2744] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_70%_-10%,rgba(56,189,248,0.12),transparent),radial-gradient(ellipse_70%_50%_at_10%_100%,rgba(13,148,136,0.16),transparent)]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-14 xl:gap-20">
            <div className="order-2 lg:order-1">
              <p className="mb-4 inline-flex rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#38bdf8] sm:text-xs">Built for nurse injectors</p>
              <h1 className="text-balance text-[1.65rem] font-semibold leading-snug tracking-tight text-white sm:text-3xl sm:leading-tight md:text-4xl lg:text-[2.35rem] xl:text-[2.65rem]">
                Your clients are texting you at 11pm. You&apos;re exhausted. And you&apos;re still losing them to whoever answered first.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                AdonisBlue handles repetitive client questions in your voice, routes complex ones to you, and keeps your front desk feeling responsive even when you are in treatment.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <a href="#pricing" className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#0d9488] px-7 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-700 sm:text-base">Start my free trial</a>
                <a href="#daily-flow" className="inline-flex min-h-[48px] items-center justify-center rounded-full border-2 border-sky-200/30 bg-transparent px-7 py-3.5 text-center text-sm font-semibold text-white transition hover:border-[#38bdf8] hover:text-[#38bdf8] sm:text-base">See how it works</a>
              </div>
            </div>
            <div className="relative order-1 w-full max-w-md justify-self-center sm:max-w-lg lg:order-2 lg:max-w-none lg:justify-self-end">
              <div className="absolute -inset-1 rounded-[1.35rem] bg-gradient-to-br from-[#38bdf8]/30 via-[#0d9488]/20 to-transparent opacity-90 blur-xl sm:-inset-2" aria-hidden />
              <div className="relative overflow-hidden rounded-2xl border border-sky-200/25 bg-[#14213b] shadow-2xl shadow-black/40 ring-1 ring-sky-200/10">
                <div className="flex items-center justify-between border-b border-sky-100/15 bg-[#1a2744] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Image src="/Alona.png" alt="AdonisBlue Logo" width={52} height={52} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">AdonisBlue</p>
                      <p className="flex items-center gap-1.5 text-xs text-teal-300">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300 opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300" />
                        </span>
                        Online - replies instantly
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Live preview</span>
                </div>
                <div className="space-y-4 px-4 py-5">
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-br-md bg-[#38bdf8]/18 px-3.5 py-2.5 text-sm leading-relaxed text-white ring-1 ring-[#38bdf8]/35">Can I get lip filler if I am on a blood thinner?</div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-sky-100/20 bg-white/[0.06] px-3.5 py-2.5 text-sm leading-relaxed text-slate-200">
                      Great question. I cannot give personal medical advice in chat, but many practices review blood thinners before treatment due to bruising risk. I can send our booking link so your injector can guide you safely.
                    </div>
                  </div>
                </div>
                <div className="border-t border-sky-100/15 bg-[#1a2744]/90 px-3 pb-4 pt-3">
                  <div className="flex items-center gap-2 rounded-xl border border-sky-100/20 bg-white/[0.04] px-3 py-2.5">
                    <span className="text-xs text-slate-500">Write a message...</span>
                    <span className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d9488] text-sm font-bold text-white shadow-md shadow-teal-900/30">↑</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="daily-flow" className="border-b border-sky-100 bg-[#ffffff] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0d9488]">Daily operations</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#1a2744] sm:text-3xl md:text-4xl">How AdonisBlue runs your front desk, every day</h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">A clean workflow that keeps response times fast and handoffs clear.</p>
            </div>
            <div className="mt-12 flex flex-col gap-2 md:flex-row md:flex-nowrap md:items-stretch md:gap-0">
              {[{title:"Client asks a question",body:"DM, text, or website chat.",step:"1"},{title:"AdonisBlue answers instantly",body:"Plain-language reply in English or Spanish.",step:"2"},{title:"Complex questions forwarded",body:"Anything sensitive or nuanced routes to you.",step:"3"},{title:"Nurse gets notified",body:"You follow up with context, not chaos.",step:"4"}].map((card, i) => (
                <div key={card.title} className="contents md:contents">
                  <div className="flex flex-1 flex-col md:min-w-0">
                    {i > 0 ? <FlowArrowDown className="py-1 md:hidden" /> : null}
                    <article className="flex h-full flex-col rounded-2xl border border-sky-100 bg-[#e0f2fe]/45 p-5 shadow-sm shadow-sky-100/70 sm:p-6">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#0d9488]/15 text-sm font-bold text-[#0d9488] ring-2 ring-[#0d9488]/30">{card.step}</span>
                      <h3 className="mt-4 text-lg font-semibold text-[#1a2744]">{card.title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{card.body}</p>
                    </article>
                  </div>
                  {i < 3 ? <FlowArrow className="hidden min-w-[2rem] shrink-0 px-1 md:flex md:items-center md:self-center md:px-2" /> : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-b border-sky-100/20 bg-[#1a2744] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#38bdf8]">Features</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">Calm, premium client communication at scale</h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">Designed to feel elegant on the surface and practical in real clinic life.</p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {features.map((feature) => (
                <li key={feature.title} className="rounded-2xl border border-sky-200/20 bg-white/[0.05] p-5 shadow-lg shadow-black/15 sm:p-6">
                  <span className="inline-block h-1 w-11 rounded-full bg-[#0d9488]" aria-hidden />
                  <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{feature.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className="border-b border-sky-100 bg-[#ffffff] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0d9488]">Pricing</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#1a2744] sm:text-3xl md:text-4xl">Choose the pace that matches your practice</h2>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-start lg:gap-8">
              <article className="flex h-full flex-col rounded-2xl border border-sky-100 bg-[#ffffff] p-6 shadow-md shadow-sky-100/70 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#0d9488]">14 Days Free</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#1a2744]">Try it completely free - no credit card needed</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">See for yourself how many client questions your bot answers before you pay a single dollar.</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                  {["Your own custom chatbot","Answers up to 50 client questions","Works in English and Spanish","Share a direct link on Instagram or text","Plain simple English - no robotic answers","Set up in under 5 minutes"].map((line) => (
                    <li key={line} className="flex gap-2"><span className="mt-0.5 text-[#0d9488]">✓</span><span>{line}</span></li>
                  ))}
                </ul>
                <a href="#final-cta" className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#0d9488] px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 sm:text-base">Start Free - No Card Needed</a>
                <p className="mt-3 text-center text-xs text-slate-500">Cancel or upgrade any time</p>
                <p className="mt-4 text-center text-xs italic text-[#0d9488]">{trustLine}</p>
              </article>

              <article className="flex h-full flex-col rounded-2xl border border-sky-100 bg-[#ffffff] p-6 shadow-md shadow-sky-100/70 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#0d9488]">$85/month - Starter</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#1a2744]">Stop missing clients while you work</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">One extra booking a month pays for this. Everything else is pure profit.</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                  {["Everything in the free trial","Unlimited client conversations - no cap","Embed the chat bubble right on your website","Booking link built right into the bot","Unanswered questions get flagged and sent to you","Simple weekly summary of top client questions"].map((line) => (
                    <li key={line} className="flex gap-2"><span className="mt-0.5 text-[#0d9488]">✓</span><span>{line}</span></li>
                  ))}
                </ul>
                <a href="#final-cta" className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#1a2744] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#243556] sm:text-base">Get Starter</a>
                <p className="mt-3 text-center text-xs text-slate-500">Less than $3 a day</p>
                <p className="mt-4 text-center text-xs italic text-[#0d9488]">{trustLine}</p>
              </article>

              <article className="flex h-full flex-col rounded-2xl border-2 border-[#38bdf8] bg-[#ffffff] p-6 shadow-xl shadow-sky-100 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#0d9488]">$150/month - Pro</p>
                  <span className="rounded-full bg-[#38bdf8] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1a2744]">Most Popular</span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#1a2744]">Your own AI-powered front desk - for less than one treatment</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">This is what it feels like to run your practice like a real business.</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                  {["Everything in Starter","Custom bot name and colors","Guided brainstorm to map every likely client question","Monthly check-in to improve answers from real conversations","Conversation insights dashboard","Multiple locations or specialties","VIP response within 4 hours for fixes"].map((line) => (
                    <li key={line} className="flex gap-2"><span className="mt-0.5 text-[#0d9488]">✓</span><span>{line}</span></li>
                  ))}
                </ul>
                <a href="#final-cta" className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#0d9488] px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 sm:text-base">Get Pro</a>
                <p className="mt-3 text-center text-xs text-slate-500">Most popular among full-time injectors</p>
                <p className="mt-4 text-center text-xs italic text-[#0d9488]">{trustLine}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="border-b border-sky-100 bg-[#e0f2fe]/45 px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-sky-100/90 bg-white p-6 sm:p-10 lg:p-12">
              <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-8 sm:text-left">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#1a2744] text-[#38bdf8] shadow-lg shadow-sky-200/70">
                  <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div className="mt-6 sm:mt-0">
                  <h2 className="text-xl font-semibold text-[#1a2744] sm:text-2xl">Privacy and trust, in plain English</h2>
                  <p className="mt-4 text-base font-medium leading-relaxed text-[#1a2744] sm:text-lg">{trustLine}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-b border-sky-100/20 bg-[#1a2744] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#38bdf8]">FAQ</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">Questions you probably have</h2>
            </div>
            <div className="mt-12"><FaqAccordion /></div>
          </div>
        </section>

        <section id="final-cta" className="bg-[#1a2744] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">Ready to create your assistant?</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">Watch how a nurse sets up her chatbot in under 5 minutes - and never misses a client question again.</p>
            <div className="mt-10 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-5">
              <a href="#pricing" className="inline-flex min-h-[52px] w-full min-w-[200px] items-center justify-center rounded-full bg-[#0d9488] px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-teal-900/25 transition hover:bg-teal-700 sm:w-auto sm:text-base">Build my free chatbot</a>
              <div className="flex w-full flex-col items-center sm:w-auto">
                <button type="button" disabled className="inline-flex min-h-[52px] w-full cursor-not-allowed items-center justify-center rounded-full border-2 border-sky-200/30 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-sky-200/60 opacity-70 sm:w-auto sm:min-w-[200px] sm:text-base">Watch it in action</button>
                <p className="mt-2 text-xs text-sky-200/60">Coming soon</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-sky-100 bg-white px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
          <a href="#" className="flex items-center gap-1.5 sm:gap-2">
            <Image src="/Alona.png" alt="AdonisBlue Logo" width={52} height={52} />
            <span className="text-lg font-semibold text-[#1a2744]">AdonisBlue</span>
          </a>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-[#1a2744]/85">
            <NavLinkLight href="#daily-flow">How it Works</NavLinkLight>
            <NavLinkLight href="#features">Features</NavLinkLight>
            <NavLinkLight href="#pricing">Pricing</NavLinkLight>
            <NavLinkLight href="#faq">FAQ</NavLinkLight>
          </nav>
          <p className="text-center text-sm text-slate-500 lg:text-right">© {new Date().getFullYear()} AdonisBlue. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
