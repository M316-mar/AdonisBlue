"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    emoji: "💳",
    color: "border-teal-300 bg-teal-50 ring-2 ring-teal-400",
    badgeColor: "bg-teal-100 text-teal-700",
    btnColor: "bg-[#0d9488] hover:bg-teal-700",
    monthlyPrice: 85,
    annualPrice: 850,
    features: [
      "Unlimited client conversations",
      "24/7 AI front desk chatbot",
      "Aftercare + healing chat + emergency alerts",
      "Automated rebooking reminders",
      "Booking link built into bot",
      "Embed chat on your website",
      "Conversation insights dashboard",
      "Weekly summary of top questions",
      "Blue Room community access",
    ],
    badge: "Everything included",
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (plan: "starter") => {
    setLoading(plan);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError("Session expired — please refresh the page and try again."); return; }

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, billing }),
      });
      const j = await res.json() as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        setError(j.error ?? "Could not start checkout. Please try again.");
        return;
      }
      window.location.href = j.url;
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  // annualPrice is the full yearly charge; compare to 12 × monthly to get savings %
  const annualSavings = (plan: typeof PLANS[number]) =>
    Math.round(((plan.monthlyPrice * 12 - plan.annualPrice) / (plan.monthlyPrice * 12)) * 100);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans antialiased">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#1a2744]">
            ← Back to dashboard
          </Link>
          <span className="text-base font-bold text-[#1a2744]">AdonisBlue</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1a2744] sm:text-3xl">Choose your plan</h1>
          <p className="mt-2 text-sm text-slate-500">No contracts. Cancel anytime. Upgrade or downgrade at any time.</p>
        </div>

        {/* Billing toggle */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${billing === "monthly" ? "bg-[#1a2744] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("annual")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${billing === "annual" ? "bg-[#1a2744] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            Annual <span className="ml-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-700">Save 20%</span>
          </button>
        </div>

        {/* Plan cards */}
        <div className="mt-8 grid gap-5 sm:grid-cols-1 max-w-md mx-auto w-full">
          {PLANS.map((plan) => {
            const isLoading = loading === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 bg-white p-6 shadow-sm ${plan.color}`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0d9488] px-4 py-1 text-xs font-bold text-white shadow">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{plan.emoji}</span>
                  <h2 className="text-lg font-bold text-[#1a2744]">{plan.name}</h2>
                  <span className={`ml-auto rounded-full px-3 py-0.5 text-xs font-semibold ${plan.badgeColor}`}>{plan.name}</span>
                </div>

                <div className="mt-4">
                  {billing === "monthly" ? (
                    <>
                      <span className="text-4xl font-bold text-[#1a2744]">${plan.monthlyPrice}</span>
                      <span className="ml-1 text-sm text-slate-500">/month</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-[#1a2744]">${plan.annualPrice.toLocaleString()}</span>
                      <span className="ml-1 text-sm text-slate-500">/year</span>
                      <p className="mt-0.5 text-xs font-semibold text-teal-600">
                        Save {annualSavings(plan)}% vs monthly billing
                      </p>
                    </>
                  )}
                </div>

                <ul className="mt-5 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 shrink-0 text-teal-500">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void handleUpgrade(plan.id)}
                  className={`mt-6 w-full rounded-full py-3 text-sm font-bold text-white transition disabled:opacity-60 ${plan.btnColor}`}
                >
                  {isLoading ? "Redirecting to checkout…" : `Get ${plan.name} →`}
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Trust signals */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-xs text-slate-500 leading-relaxed">
            🔒 Payments are processed securely by Stripe. We never store your card details.
            <br />
            Questions? Email us at <a href="mailto:hello@adonisblue.io" className="font-semibold text-[#0d9488]">hello@adonisblue.io</a>
          </p>
        </div>
      </main>
    </div>
  );
}
