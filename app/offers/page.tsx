"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscountType = "percentage" | "fixed" | "addon";

type Offer = {
  id: string;
  title: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number | null;
  service_name: string | null;
  ongoing: boolean;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

type FormState = {
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  service_name: string;
  ongoing: boolean;
  starts_at: string;
  expires_at: string;
};

// ─── Holiday templates ────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();

const TEMPLATES: {
  emoji: string;
  label: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  starts_at: string;
  expires_at: string;
}[] = [
  {
    emoji: "💕", label: "Valentine's Day",
    title: "Love Your Lips Special",
    description: "15% off all lip filler appointments",
    discount_type: "percentage", discount_value: "15",
    starts_at: `${currentYear}-02-01`, expires_at: `${currentYear}-02-14`,
  },
  {
    emoji: "🌸", label: "Spring Refresh",
    title: "Spring Glow Package",
    description: "$50 off your first visit this spring",
    discount_type: "fixed", discount_value: "50",
    starts_at: `${currentYear}-03-01`, expires_at: `${currentYear}-04-30`,
  },
  {
    emoji: "☀️", label: "Summer Ready",
    title: "Summer Prep Special",
    description: "Skin booster discount — get glowing before summer",
    discount_type: "percentage", discount_value: "10",
    starts_at: `${currentYear}-05-01`, expires_at: `${currentYear}-06-30`,
  },
  {
    emoji: "👰", label: "Wedding Season",
    title: "Bridal Beauty Deal",
    description: "Special discount for brides and bridal parties",
    discount_type: "percentage", discount_value: "15",
    starts_at: `${currentYear}-06-01`, expires_at: `${currentYear}-08-31`,
  },
  {
    emoji: "🎄", label: "Holiday Party",
    title: "Party Ready Package",
    description: "Look your best for the holidays — combo deal",
    discount_type: "percentage", discount_value: "20",
    starts_at: `${currentYear}-11-01`, expires_at: `${currentYear}-12-31`,
  },
  {
    emoji: "🎉", label: "New Year",
    title: "New Year Glow",
    description: "Start the new year feeling your best — 20% off",
    discount_type: "percentage", discount_value: "20",
    starts_at: `${currentYear + 1}-01-01`, expires_at: `${currentYear + 1}-01-31`,
  },
  {
    emoji: "🎂", label: "Birthday Month",
    title: "Birthday Treat",
    description: "20% off in your birthday month — because you deserve it!",
    discount_type: "percentage", discount_value: "20",
    starts_at: "", expires_at: "",
  },
  {
    emoji: "⚡", label: "Flash Sale",
    title: "Weekend Special",
    description: "15% off this weekend only — limited spots available!",
    discount_type: "percentage", discount_value: "15",
    starts_at: (() => {
      const d = new Date();
      const day = d.getDay();
      const toFri = day <= 5 ? 5 - day : 6;
      d.setDate(d.getDate() + toFri);
      return d.toISOString().slice(0, 10);
    })(),
    expires_at: (() => {
      const d = new Date();
      const day = d.getDay();
      const toSun = day === 0 ? 0 : 7 - day;
      d.setDate(d.getDate() + toSun);
      return d.toISOString().slice(0, 10);
    })(),
  },
  {
    emoji: "👋", label: "New Client",
    title: "Welcome Special",
    description: "$50 off your first visit — we can't wait to meet you!",
    discount_type: "fixed", discount_value: "50",
    starts_at: "", expires_at: "",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function discountLabel(offer: Offer): string {
  if (offer.discount_type === "addon") return "Free Add-on";
  if (!offer.discount_value) return "";
  if (offer.discount_type === "percentage") return `${offer.discount_value}% off`;
  return `$${offer.discount_value} off`;
}

function offerStatus(offer: Offer): { label: string; color: string } {
  const now = new Date();
  if (!offer.ongoing && offer.expires_at && new Date(offer.expires_at) < now) {
    return { label: "Expired", color: "bg-slate-100 text-slate-500" };
  }
  if (!offer.ongoing && offer.starts_at && new Date(offer.starts_at) > now) {
    return { label: `Starts ${formatDate(offer.starts_at)}`, color: "bg-blue-50 text-blue-600" };
  }
  if (offer.active) {
    return { label: offer.ongoing ? "Always active" : "Active now", color: "bg-green-50 text-green-700" };
  }
  return { label: "Paused", color: "bg-amber-50 text-amber-700" };
}

function emptyForm(): FormState {
  return {
    title: "", description: "", discount_type: "percentage",
    discount_value: "", service_name: "", ongoing: false, starts_at: "", expires_at: "",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OffersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [procedures, setProcedures] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Auth + load ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) { router.replace("/auth"); return; }
      const tok = data.session.access_token;
      setToken(tok);
      const h = { Authorization: `Bearer ${tok}` };

      const [offersRes, procsRes] = await Promise.all([
        fetch("/api/offers", { headers: h }),
        fetch("/api/procedures", { headers: h }),
      ]);
      if (cancelled) return;

      if (offersRes.ok) {
        const j = await offersRes.json() as { offers?: Offer[] };
        setOffers(j.offers ?? []);
      }
      if (procsRes.ok) {
        const j = await procsRes.json() as { procedures?: { name?: string }[] };
        setProcedures((j.procedures ?? []).map(p => p.name ?? "").filter(Boolean));
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  // ── Create offer ───────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!form.title.trim()) { setError("Please give your offer a name."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          discount_type: form.discount_type,
          discount_value: form.discount_value ? parseFloat(form.discount_value) : null,
          service_name: form.service_name || null,
          ongoing: form.ongoing,
          starts_at: form.ongoing ? null : (form.starts_at ? new Date(form.starts_at).toISOString() : null),
          expires_at: form.ongoing ? null : (form.expires_at ? new Date(form.expires_at).toISOString() : null),
          active: true,
        }),
      });
      const j = await res.json() as { offer?: Offer; error?: string };
      if (!res.ok) { setError(j.error ?? "Could not save offer."); return; }
      if (j.offer) setOffers(prev => [j.offer!, ...prev]);
      setForm(emptyForm());
      setShowForm(false);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }, [form, authHeaders]);

  // ── Toggle active ──────────────────────────────────────────────────────
  const handleToggle = useCallback(async (offer: Offer) => {
    setTogglingId(offer.id);
    try {
      await fetch("/api/offers", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ id: offer.id, active: !offer.active }),
      });
      setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, active: !o.active } : o));
    } finally {
      setTogglingId(null);
    }
  }, [authHeaders]);

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this offer? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch("/api/offers", {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      });
      setOffers(prev => prev.filter(o => o.id !== id));
    } finally {
      setDeletingId(null);
    }
  }, [authHeaders]);

  // ── Apply template ─────────────────────────────────────────────────────
  const applyTemplate = useCallback((t: typeof TEMPLATES[number]) => {
    setForm({
      title: t.title,
      description: t.description,
      discount_type: t.discount_type,
      discount_value: t.discount_value,
      service_name: "",
      ongoing: false,
      starts_at: t.starts_at,
      expires_at: t.expires_at,
    });
    setShowForm(true);
    setTimeout(() => document.getElementById("offer-form")?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const setF = useCallback((patch: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...patch }));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#0d9488]" />
      </div>
    );
  }

  const inputCls = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2";

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1a2744] sm:text-2xl">Your Offers &amp; Specials 🎉</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Set up a special offer and your AI bot will automatically tell clients about it.
              It turns on and off by itself based on the dates you set.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">

        {/* ── Tip card ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4">
          <p className="text-sm font-semibold text-[#1a2744] mb-2">💡 How to make a great offer</p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li>✓ Give it a fun name clients will remember</li>
            <li>✓ Set a real end date — limited time = more bookings</li>
            <li>✓ Be specific about the discount so clients know exactly what they get</li>
            <li>✓ Your AI bot handles the rest automatically!</li>
          </ul>
        </div>

        {/* ── Holiday quick-start ───────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[#1a2744]">⚡ Quick-start templates — tap to pre-fill</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => applyTemplate(t)}
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#0d9488] hover:bg-teal-50 hover:text-[#0d9488] min-h-[44px]"
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm());
                setShowForm(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-teal-300 bg-white px-4 py-2 text-xs font-semibold text-teal-600 hover:bg-teal-50 transition min-h-[44px]"
            >
              ✏️ Create your own
            </button>
          </div>
        </section>

        {/* ── Active offers ─────────────────────────────────────────────── */}
        {offers.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[#1a2744]">Your offers</h2>
            <ul className="space-y-3">
              {offers.map((offer) => {
                const status = offerStatus(offer);
                const disc = discountLabel(offer);
                return (
                  <li key={offer.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[#1a2744]">{offer.title}</p>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                          {disc && (
                            <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                              {disc}
                            </span>
                          )}
                        </div>
                        {offer.description && (
                          <p className="mt-1 text-sm text-slate-600">{offer.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                          {offer.service_name && <span>📍 {offer.service_name}</span>}
                          {(offer.starts_at || offer.expires_at) && (
                            <span>
                              🗓 {offer.starts_at ? formatDate(offer.starts_at) : "Now"}
                              {" → "}
                              {offer.expires_at ? formatDate(offer.expires_at) : "Ongoing"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {/* Toggle */}
                        <button
                          type="button"
                          disabled={togglingId === offer.id}
                          onClick={() => void handleToggle(offer)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${offer.active ? "bg-[#0d9488]" : "bg-slate-200"} disabled:opacity-50`}
                          aria-label={offer.active ? "Turn off" : "Turn on"}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${offer.active ? "left-5" : "left-0.5"}`}
                          />
                        </button>
                        {/* Delete */}
                        <button
                          type="button"
                          disabled={deletingId === offer.id}
                          onClick={() => void handleDelete(offer.id)}
                          className="rounded-full border border-red-100 px-3 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {deletingId === offer.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Create offer ──────────────────────────────────────────────── */}
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white py-5 text-sm font-semibold text-slate-500 transition hover:border-[#0d9488] hover:text-[#0d9488]"
          >
            + Create new offer
          </button>
        ) : (
          <section id="offer-form" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-[#1a2744]">Create an offer</h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a2744]">Offer name</label>
                <input
                  className={inputCls}
                  placeholder="Valentine's Lip Special 💕"
                  value={form.title}
                  onChange={e => setF({ title: e.target.value })}
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a2744]">What&apos;s the deal?</label>
                <textarea
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="15% off all lip filler appointments"
                  value={form.description}
                  onChange={e => setF({ description: e.target.value })}
                />
              </div>

              {/* Service */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a2744]">Which service?</label>
                <select
                  className={inputCls}
                  value={form.service_name}
                  onChange={e => setF({ service_name: e.target.value })}
                >
                  <option value="">All services</option>
                  {procedures.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Discount type */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a2744]">Discount type</label>
                <div className="flex gap-2">
                  {(["percentage", "fixed", "addon"] as DiscountType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setF({ discount_type: t })}
                      className={`flex-1 rounded-full border-2 py-2.5 text-sm font-semibold transition ${
                        form.discount_type === t
                          ? "border-[#0d9488] bg-teal-50 text-[#0d9488]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {t === "percentage" ? "% Off" : t === "fixed" ? "$ Off" : "Free Add-on"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount amount */}
              {form.discount_type !== "addon" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                    {form.discount_type === "percentage" ? "Percentage off" : "Dollar amount off"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    placeholder={form.discount_type === "percentage" ? "15" : "50"}
                    value={form.discount_value}
                    onChange={e => setF({ discount_value: e.target.value })}
                  />
                </div>
              )}

              {/* Dates / ongoing toggle */}
              <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                <p className="mb-3 text-sm font-semibold text-[#1a2744]">When is this offer available?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setF({ ongoing: true, starts_at: "", expires_at: "" })}
                    className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${form.ongoing ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                  >
                    🔄 Always active
                  </button>
                  <button
                    type="button"
                    onClick={() => setF({ ongoing: false })}
                    className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${!form.ongoing ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                  >
                    📅 Set dates
                  </button>
                </div>
                {!form.ongoing && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Start date</label>
                      <input
                        type="date"
                        value={form.starts_at}
                        onChange={e => setF({ starts_at: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0d9488]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">End date</label>
                      <input
                        type="date"
                        value={form.expires_at}
                        onChange={e => setF({ expires_at: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0d9488]"
                      />
                    </div>
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  {form.ongoing
                    ? "Your AI bot will mention this offer to every new client — no expiry date."
                    : "Your AI bot will only mention this offer between the dates you set."}
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(emptyForm()); setError(null); }}
                  className="flex-1 rounded-full border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleCreate()}
                  className="flex-1 rounded-full bg-[#0d9488] py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save offer ✓"}
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
