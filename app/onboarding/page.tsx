"use client";

import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

// ─── Confetti ─────────────────────────────────────────────────────────────────

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["#0d9488", "#1a2744", "#f0abfc", "#fbbf24", "#34d399", "#60a5fa", "#f87171"];
    const pieces = Array.from({ length: 110 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      r: Math.random() * 6 + 3,
      d: Math.random() * 2 + 1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      tilt: Math.random() * 10 - 5,
      tiltSpeed: Math.random() * 0.1 + 0.05,
      angle: Math.random() * Math.PI * 2,
    }));

    let frame: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.45, p.angle, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        p.y += p.d;
        p.angle += p.tiltSpeed;
        p.tilt += Math.sin(p.angle) * 0.5;
        p.x += Math.sin(p.angle) * 1.5;

        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      });
      frame = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const PROCEDURES = [
  "Lip Filler",
  "Botox / Neuromodulator",
  "Cheek Filler",
  "Tear Trough",
  "Jawline Filler",
  "Nose Filler",
  "PRP / Biostimulator",
  "Skin Booster",
  "Microneedling",
  "Other",
] as const;

type Procedure = (typeof PROCEDURES)[number];

const COLOR_PRESETS = [
  { label: "Teal",        value: "#0d9488", emoji: "🩵" },
  { label: "Navy",        value: "#1a2744", emoji: "💙" },
  { label: "Rose",        value: "#f43f5e", emoji: "🌸" },
  { label: "Purple",      value: "#8b5cf6", emoji: "💜" },
  { label: "Soft Pink",   value: "#fb7185", emoji: "🤍" },
  { label: "Warm Orange", value: "#f97316", emoji: "🧡" },
  { label: "Charcoal",    value: "#374151", emoji: "🖤" },
  { label: "Gold",        value: "#d97706", emoji: "✨" },
] as const;

const DRAFT_KEY = "adonisblue-onboarding-v2";

// ─── Types ────────────────────────────────────────────────────────────────────

const US_STATES = [
  { abbr: "AL", name: "Alabama" }, { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" }, { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" }, { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" }, { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" }, { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" }, { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" }, { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" }, { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" }, { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" }, { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" }, { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" }, { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" }, { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" }, { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" }, { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" }, { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" }, { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" }, { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" }, { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" }, { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" }, { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" }, { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" }, { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" }, { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" }, { abbr: "WY", name: "Wyoming" },
] as const;

type Draft = {
  userId: string;
  step: number;
  // Step 1
  practiceName: string;
  city: string;
  state: string;
  // Step 2
  procedures: string[];
  customProcedures: string;
  numbingMethod: string;
  cancellationPolicy: string;
  depositInfo: string;
  bookingLink: string;
  // Step 3
  instagram: string;
  tiktok: string;
  facebook: string;
  website: string;
  notificationEmail: string;
  // Step 4
  botName: string;
  greeting: string;
  brandColor: string;
  logoUrl: string;
  botTheme: string; // 'aurora' | 'crystal'
  // Nurse's full name from auth metadata — used for greeting generation, not persisted to bots table
  nurseName: string;
};

function emptyDraft(userId: string): Draft {
  return {
    userId,
    step: 1,
    practiceName: "",
    city: "",
    state: "",
    procedures: [],
    customProcedures: "",
    numbingMethod: "",
    cancellationPolicy: "",
    depositInfo: "",
    bookingLink: "",
    instagram: "",
    tiktok: "",
    facebook: "",
    website: "",
    notificationEmail: "",
    botName: "",
    greeting: "",
    brandColor: "#0d9488",
    logoUrl: "",
    botTheme: "aurora",
    nurseName: "",
  };
}

function loadDraft(userId: string): Draft {
  if (typeof window === "undefined") return emptyDraft(userId);
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft(userId);
    const parsed = JSON.parse(raw) as Partial<Draft>;
    if (parsed.userId !== userId) return emptyDraft(userId);
    return { ...emptyDraft(userId), ...parsed };
  } catch {
    return emptyDraft(userId);
  }
}

function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // quota or private mode — ignore
  }
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "my-bot"
  );
}

// ─── Mini chat preview (mirrors /chat/[slug] exactly) ────────────────────────

type PreviewMsg = { id: string; role: "user" | "assistant"; content: string };

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Shared iridescent gradient string used across the glass design system
const IRIDESCENT =
  "linear-gradient(135deg, rgba(255,100,175,0.78) 0%, rgba(120,165,255,0.78) 35%, rgba(255,225,70,0.72) 68%, rgba(80,215,255,0.76) 100%)";
const IRIDESCENT_PILL =
  "linear-gradient(135deg, rgba(255,100,175,0.75) 0%, rgba(120,165,255,0.75) 50%, rgba(255,225,70,0.65) 100%)";

function ChatPreview({
  practiceName,
  greeting,
  logoUrl,
}: {
  practiceName: string;
  greeting: string;
  brandColor: string; // kept in signature for call-site compat, not used
  logoUrl?: string;
  botTheme?: string; // kept for call-site compat, not used
}) {
  const outerStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", height: "100%",
    overflow: "hidden", borderRadius: "1rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    background: "linear-gradient(180deg, #cdc8e8 0%, #c6d9ce 100%)",
    padding: "3px",
  };

  const panelStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", flex: 1, minHeight: 0,
    overflow: "hidden", borderRadius: "0.875rem",
    background: [
      "linear-gradient(145deg, rgba(210,220,245,0.92) 0%, rgba(195,212,235,0.88) 100%) padding-box",
      `${IRIDESCENT} border-box`,
    ].join(", "),
    border: "3px solid transparent",
    boxShadow: [
      "inset 2px 2px 0 rgba(255,255,255,0.90)",
      "inset -1px -1px 0 rgba(0,0,0,0.06)",
      "inset 0 4px 20px rgba(255,255,255,0.50)",
    ].join(", "),
  };

  const headerStyle: React.CSSProperties = {
    display: "flex", flexShrink: 0, alignItems: "center", gap: 8,
    padding: "10px 12px",
    background: [
      "linear-gradient(180deg, rgba(220,230,248,0.72) 0%, rgba(210,220,240,0.55) 100%) padding-box",
      `${IRIDESCENT_PILL} border-box`,
    ].join(", "),
    borderBottom: "1.5px solid transparent",
    boxShadow: "0 1px 0 rgba(120,165,255,0.35)",
  };

  const closeBtnStyle: React.CSSProperties = {
    flexShrink: 0, borderRadius: 999, padding: "4px 8px",
    fontSize: 9, fontWeight: 600, color: "#475569",
    background: [
      "rgba(215,225,245,0.60) padding-box",
      `${IRIDESCENT_PILL} border-box`,
    ].join(", "),
    border: "1px solid transparent",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  };

  const botBubbleStyle: React.CSSProperties = {
    maxWidth: "85%", fontSize: 10, lineHeight: 1.6,
    borderRadius: 10, padding: "5px 8px", color: "#1e293b",
    background: "rgba(230,236,250,0.80)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), 0 1px 3px rgba(0,0,0,0.06)",
  };

  const userBubbleStyle: React.CSSProperties = {
    maxWidth: "85%", fontSize: 10, lineHeight: 1.6,
    borderRadius: 999, padding: "5px 10px", color: "#1e293b",
    background: "rgba(15,23,42,0.10)",
  };

  const pillStyle: React.CSSProperties = {
    borderRadius: 999, padding: "4px 8px",
    fontSize: 9, fontWeight: 500, color: "#1a2744",
    background: [
      "rgba(215,225,245,0.55) padding-box",
      `${IRIDESCENT_PILL} border-box`,
    ].join(", "),
    border: "1px solid transparent",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  };

  const inputStyle: React.CSSProperties = {
    flex: 1, borderRadius: 999, padding: "6px 12px",
    fontSize: 10, color: "#94a3b8",
    background: [
      "rgba(255,255,255,0.82) padding-box",
      `${IRIDESCENT_PILL} border-box`,
    ].join(", "),
    border: "1.5px solid transparent",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95)",
  };

  const sendStyle: React.CSSProperties = {
    flexShrink: 0, borderRadius: 999, padding: "6px 10px",
    fontSize: 9, fontWeight: 600, color: "#ffffff",
    background: [
      "#1a2744 padding-box",
      `${IRIDESCENT} border-box`,
    ].join(", "),
    border: "1.5px solid transparent",
    boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.18)",
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const title = practiceName.trim() || "Your Practice";
  const greetingText = greeting.trim() || "Hi there! 👋 How can I help you today?";

  const DEMO_MSGS: PreviewMsg[] = [
    { id: "1", role: "assistant", content: greetingText },
    { id: "2", role: "user", content: "What services do you offer?" },
    { id: "3", role: "assistant", content: "We offer Lip Filler, Botox, Cheek Filler, and more! ✨ Would you like to book a consultation?" },
  ];

  const PREVIEW_PILLS = ["Services", "Pricing", "Book now"];

  return (
    <div style={outerStyle}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          {logoUrl ? (
            <div style={{ width: 64, height: 64, minWidth: 64, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
            </div>
          ) : (
            <div style={{ width: 36, height: 36, minWidth: 36, borderRadius: "50%", backgroundColor: "#1a2744", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "white", flexShrink: 0 }}>
              {title.charAt(0).toUpperCase()}
            </div>
          )}
          <p style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 500, color: "#64748b", margin: 0, flex: 1 }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", backgroundColor: "#34d399", flexShrink: 0 }} />
            Online
          </p>
          <span style={closeBtnStyle}>Close</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "12px 10px" }}>
          {DEMO_MSGS.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={m.role === "user" ? userBubbleStyle : botBubbleStyle}>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div style={{ flexShrink: 0, padding: "8px 10px 10px", borderTop: "1px solid rgba(0,0,0,0.07)" }}>
          {/* Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {PREVIEW_PILLS.map((p) => (
              <span key={p} style={pillStyle}>{p}</span>
            ))}
          </div>
          {/* Input + Send */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={inputStyle}>Type a message…</div>
            <span style={sendStyle}>Send</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepWelcome({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const field =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a2744] sm:text-3xl">
          Let&apos;s set up your AI front desk 🦋
        </h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          Takes less than 5 minutes. We&apos;ll guide you through everything.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm font-medium text-[#1a2744]">
            Your full name
          </label>
          <input
            className={field}
            placeholder="e.g. Jane Smith"
            autoComplete="name"
            value={draft.nurseName}
            onChange={(e) => onChange({ nurseName: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm font-medium text-[#1a2744]">
            Practice name
          </label>
          <input
            className={field}
            placeholder="e.g. Glow Aesthetics"
            value={draft.practiceName}
            onChange={(e) => onChange({ practiceName: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">City</label>
          <input
            className={field}
            placeholder="e.g. Miami"
            autoComplete="address-level2"
            value={draft.city}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">State</label>
          <select
            className={`${field} text-base`}
            value={draft.state}
            onChange={(e) => onChange({ state: e.target.value })}
          >
            <option value="">Select state...</option>
            {US_STATES.map((s) => (
              <option key={s.abbr} value={s.abbr}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function StepProcedures({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const toggle = useCallback(
    (p: string) => {
      onChange({
        procedures: draft.procedures.includes(p)
          ? draft.procedures.filter((x) => x !== p)
          : [...draft.procedures, p],
      });
    },
    [draft.procedures, onChange]
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a2744] sm:text-3xl">
          What procedures do you offer? 💉
        </h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          Tap everything that applies — you can always add more later.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {PROCEDURES.map((p) => {
          const selected = draft.procedures.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              className={`flex min-h-[48px] items-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-semibold transition ${
                selected
                  ? "border-[#0d9488] bg-[#0d9488] text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-[#0d9488]/40 hover:bg-slate-50"
              }`}
            >
              {selected && (
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3 8l3.5 3.5L13 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {p}
            </button>
          );
        })}
      </div>

      {draft.procedures.includes("Other") && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">Custom services</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]"
            placeholder="e.g. Microdermabrasion, Chemical Peel, Laser..."
            value={draft.customProcedures}
            onChange={(e) => onChange({ customProcedures: e.target.value })}
          />
          <p className="text-xs text-slate-400">Separate multiple services with commas</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#1a2744]">
          What numbing method do you use? <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "Topical numbing cream", label: "💊 Topical cream" },
            { value: "Numbing in the needle", label: "💉 In the needle" },
            { value: "Both topical and needle numbing", label: "🔢 Both methods" },
            { value: "I don't use numbing", label: "❌ No numbing" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ numbingMethod: draft.numbingMethod === opt.value ? "" : opt.value })}
              className={`rounded-xl border-2 px-3 py-3 text-sm font-medium transition min-h-[44px] ${
                draft.numbingMethod === opt.value
                  ? "border-[#0d9488] bg-teal-50 text-[#0d9488]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1a2744]">
          Booking link{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]"
          placeholder="https://your-booking-link.com"
          value={draft.bookingLink}
          onChange={(e) => onChange({ bookingLink: e.target.value })}
        />
        <p className="text-xs text-slate-400">
          Calendly, Acuity, Jane, Vagaro — any link works
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1a2744]">
          Cancellation policy <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px] min-h-[80px] resize-none"
          placeholder="e.g. Cancellations must be made 24 hours in advance. Late cancellations may be subject to a fee."
          value={draft.cancellationPolicy}
          onChange={(e) => onChange({ cancellationPolicy: e.target.value })}
          rows={3}
        />
        <p className="text-xs text-slate-400">Your AI bot will share this with clients before they book.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1a2744]">
          Deposit requirement <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]"
          placeholder="e.g. $100 deposit required at booking — non-refundable"
          value={draft.depositInfo}
          onChange={(e) => onChange({ depositInfo: e.target.value })}
        />
        <p className="text-xs text-slate-400">Your bot will share this when clients ask about deposits or booking requirements.</p>
      </div>
    </div>
  );
}

function StepGetFound({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const field =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a2744] sm:text-3xl">
          Where do your clients find you? 📱
        </h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          Paste your full profile URLs — these help clients connect with you.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">
            Instagram URL{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            className={field}
            placeholder="https://www.instagram.com/yourhandle"
            value={draft.instagram}
            onChange={(e) => onChange({ instagram: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">
            TikTok URL{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            className={field}
            placeholder="https://www.tiktok.com/@yourhandle"
            value={draft.tiktok}
            onChange={(e) => onChange({ tiktok: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">
            Facebook URL{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            className={field}
            placeholder="https://www.facebook.com/yourpage"
            value={draft.facebook}
            onChange={(e) => onChange({ facebook: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">
            Website{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            className={field}
            placeholder="https://yourwebsite.com"
            value={draft.website}
            onChange={(e) => onChange({ website: e.target.value })}
          />
          {draft.website && (
            <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 mt-2">
              <p className="text-xs font-semibold text-teal-700 mb-1">💡 Website tip</p>
              <p className="text-xs text-slate-600">
                When you add your bot to your website, visitors will see a chat bubble that says:{" "}
                <strong>&ldquo;Have questions? I&apos;m here to help! 💙&rdquo;</strong>{" "}
                — this captures attention and turns website visitors into clients automatically.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1a2744]">
          Notification email{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="email"
          className={field}
          placeholder="Where should we send client alerts?"
          value={draft.notificationEmail}
          onChange={(e) => onChange({ notificationEmail: e.target.value })}
        />
        <p className="text-xs text-slate-400">
          We&apos;ll notify you when a new client fills out your intake form.
        </p>
      </div>
    </div>
  );
}

function StepCustomize({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const [generating, setGenerating] = useState(false);

  const field =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a2744] sm:text-3xl">
          Customize your AI assistant 🤖
        </h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          This is what your clients will see.
        </p>
      </div>

      {/* ── Give your assistant an identity ─────────────────────────────── */}
      <div>
        <p className="text-sm font-semibold text-[#1a2744] mb-1">Give your assistant an identity</p>
        <p className="text-xs text-slate-500 mb-3">
          Don&apos;t have a logo? No worries — we&apos;ll use your practice initial in a colored circle.
        </p>
        <div className="flex items-center gap-4">
          {draft.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.logoUrl}
              alt="Logo"
              className="h-16 w-16 rounded-full object-cover border-2 border-slate-200 shadow-sm shrink-0"
            />
          ) : (
            <div
              className="h-16 w-16 shrink-0 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-lg font-bold text-white select-none shadow-sm"
              style={{ backgroundColor: draft.brandColor || "#0d9488" }}
            >
              {(draft.practiceName || draft.botName || "A").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">
              {draft.logoUrl ? "Option A: Your logo ✓" : "Option A: Upload your logo"}
            </p>
            <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition inline-block">
              Upload logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    alert("File is too large. Please choose an image under 2 MB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    onChange({ logoUrl: reader.result as string });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {draft.logoUrl && (
              <button
                type="button"
                onClick={() => onChange({ logoUrl: "" })}
                className="ml-2 text-xs text-red-400 hover:text-red-600 transition"
              >
                Remove
              </button>
            )}
            <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 2 MB</p>
            {!draft.logoUrl && (
              <p className="text-xs text-slate-400 mt-1">
                Option B: Practice initial (shown above) — no upload needed.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1a2744]">
          Welcome message
        </label>
        <textarea
          rows={2}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
          placeholder="Hi there! 👋 I'm here to help with bookings, answer questions, and more."
          value={draft.greeting}
          onChange={(e) => onChange({ greeting: e.target.value })}
        />
        <button
          type="button"
          disabled={generating}
          onClick={async () => {
            setGenerating(true);
            try {
              const greetingPayload = {
                practice_name: draft.practiceName,
                procedures: draft.procedures,
                bot_name: draft.botName,
                nurse_name: draft.nurseName,
              };
              console.log("[generate-greeting] sending nurse_name:", JSON.stringify(greetingPayload.nurse_name));
              const res = await fetch("/api/generate-greeting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(greetingPayload),
              });
              const j = (await res.json()) as { greeting?: string };
              if (j.greeting) onChange({ greeting: j.greeting });
            } catch {
              // silently fail — nurse can type manually
            } finally {
              setGenerating(false);
            }
          }}
          className="mt-2 self-start rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? "Generating…" : "✨ Generate AI welcome message"}
        </button>
      </div>
    </div>
  );
}

function StepLive({
  draft,
  botSlug,
}: {
  draft: Draft;
  botSlug: string;
}) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/chat/${botSlug}`
      : `/chat/${botSlug}`;

  const embedCode = `<script src="https://adonisblue.com/widget.js" data-bot="${botSlug}" defer></script>`;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const copy = useCallback((text: string, which: "link" | "embed") => {
    void navigator.clipboard.writeText(text).then(() => {
      if (which === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
      }
    });
  }, []);

  const NEXT_STEPS = [
    "✅ Clients can now message your bot 24/7",
    "✅ New intake forms land in your dashboard automatically",
    "✅ Your bot answers FAQs, books appointments, and sends clients to your booking link",
    "✅ You get notified by email when a new lead comes in",
    "✅ Review & upgrade your plan any time from the dashboard",
  ];

  return (
    <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl text-center">
      <Confetti />
      <div className="relative z-10 flex flex-col items-center gap-6 pt-4">
      <div className="text-6xl animate-bounce">🎉</div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a2744] sm:text-3xl">
          Your AI front desk is ready!
        </h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          Welcome to AdonisBlue! Your bot is live right now.
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Your bot link
        </p>
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0d9488]">
            {shareUrl}
          </p>
          <button
            type="button"
            onClick={() => copy(shareUrl, "link")}
            className="shrink-0 rounded-xl bg-[#0d9488] px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
          >
            {copiedLink ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Embed on your website
        </p>
        <div className="flex items-start gap-2">
          <code className="flex-1 overflow-x-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 whitespace-pre">
            {embedCode}
          </code>
          <button
            type="button"
            onClick={() => copy(embedCode, "embed")}
            className="mt-0.5 shrink-0 rounded-xl bg-[#1a2744] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#243552]"
          >
            {copiedEmbed ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-teal-100 bg-teal-50 p-4 text-left">
        <p className="mb-3 text-sm font-semibold text-[#1a2744]">
          What happens next:
        </p>
        <ul className="flex flex-col gap-2">
          {NEXT_STEPS.map((s) => (
            <li key={s} className="text-sm text-slate-700">
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap justify-center gap-3 pb-4">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] items-center rounded-full border-2 border-[#0d9488] px-6 text-sm font-semibold text-[#0d9488] transition hover:bg-teal-50"
        >
          View my bot →
        </a>
      </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [draft, setDraftState] = useState<Draft>(emptyDraft(""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botSlug, setBotSlug] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const tokenRef = useRef<string>("");

  // ── Auth + hydrate draft ─────────────────────────────────────────────────
  useEffect(() => {
    // Read ?step= from URL — highest priority source for initial step
    const stepParam = searchParams ? Number(searchParams.get("step")) : NaN;
    const urlStep =
      !isNaN(stepParam) && stepParam >= 1 && stepParam <= TOTAL_STEPS
        ? stepParam
        : null;

    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      const userId = data.session.user.id;
      tokenRef.current = data.session.access_token;
      // Capture nurse's full name from auth metadata for use in greeting generation
      const nurseName = (data.session.user.user_metadata?.full_name as string | undefined)?.trim() ?? "";

      // Always fetch server state first — mybot and procedures in parallel
      let serverDraft: Partial<Draft> = {};
      try {
        const authHeader = { Authorization: `Bearer ${data.session.access_token}` };
        const [botRes, procRes] = await Promise.all([
          fetch("/api/mybot", { headers: authHeader }),
          fetch("/api/procedures", { headers: authHeader }),
        ]);
        if (cancelled) return;

        // ── Bot row — all fields ──────────────────────────────────────────
        let botLaunched = false;
        if (botRes.ok) {
          const { bot } = (await botRes.json()) as { bot?: Record<string, unknown> | null };
          if (bot && bot.nurse_id === userId) {
            botLaunched = bot.launched === true;

            // ── Pre-fill ALL fields — never overwrite server data with empty ──
            serverDraft = {
              // Step 1
              practiceName: (bot.practice_name as string | null) ?? "",
              city: (bot.city as string | null) ?? "",
              state: (bot.state as string | null) ?? "",
              // Step 2 — procedures come from services[] on bots table
              procedures: Array.isArray(bot.services) && bot.services.length > 0
                ? (bot.services as string[])
                : [],
              customProcedures: "",
              numbingMethod: (bot.numbing_method as string | null) ?? "",
              cancellationPolicy: (bot.cancellation_policy as string | null) ?? "",
              depositInfo: (bot.deposit_info as string | null) ?? "",
              bookingLink: (bot.booking_link as string | null) ?? "",
              // Step 3
              instagram: (bot.instagram as string | null) ?? "",
              tiktok: (bot.tiktok as string | null) ?? "",
              facebook: (bot.facebook as string | null) ?? "",
              website: (bot.website as string | null) ?? "",
              notificationEmail: (bot.notification_email as string | null) ?? "",
              // Step 4
              botName: (bot.bot_name as string | null) ?? "",
              greeting: (bot.greeting as string | null) ?? "",
              brandColor: (bot.brand_color as string | null) ?? "#0d9488",
              logoUrl: (bot.logo_url as string | null) ?? "",
              botTheme: (bot.bot_theme as string | null) ?? "aurora",
            };

            // Fallback: if services[] is empty, pull names from procedures table
            if (serverDraft.procedures!.length === 0 && procRes.ok) {
              const { procedures } = (await procRes.json()) as {
                procedures?: Array<{ name?: string }> | null;
              };
              if (Array.isArray(procedures) && procedures.length > 0) {
                serverDraft.procedures = procedures.map((p) => p.name ?? "").filter(Boolean);
              }
            }

            // Track slug for step-5 share link
            if (botLaunched) {
              setBotSlug(
                slugify((bot.bot_name as string | null) ?? (bot.practice_name as string | null) ?? "")
              );
            }
          }
        }

        // If procedures table was fetched independently (no bot row yet), still use it
        if ((serverDraft.procedures ?? []).length === 0 && procRes.ok) {
          try {
            const { procedures } = (await procRes.json()) as {
              procedures?: Array<{ name?: string }> | null;
            };
            if (Array.isArray(procedures) && procedures.length > 0) {
              serverDraft.procedures = procedures.map((p) => p.name ?? "").filter(Boolean);
            }
          } catch { /* ignore */ }
        }

      } catch {
        // Network error — fall back to localStorage draft
      }
      if (cancelled) return;

      const localDraft = loadDraft(userId);

      // ── Determine initial step ────────────────────────────────────────
      // Priority: ?step= URL param > localStorage > 1
      // Exception: if ?step= is present, NEVER auto-jump to step 5 (success),
      // even if the bot is already launched — the nurse is editing.
      let initialStep: number;
      if (urlStep !== null) {
        initialStep = urlStep;
      } else if (localDraft.step > 1) {
        initialStep = localDraft.step;
      } else {
        initialStep = 1;
      }

      const merged: Draft = {
        ...emptyDraft(userId),
        ...serverDraft,
        userId,
        step: initialStep,
        nurseName, // from auth.users.user_metadata.full_name — never written to bots table
        // botTheme: prefer DB value, then local draft, then default
        botTheme: (serverDraft.botTheme && serverDraft.botTheme !== "aurora" ? serverDraft.botTheme : null)
          ?? (localDraft.botTheme && localDraft.botTheme !== "aurora" ? localDraft.botTheme : null)
          ?? serverDraft.botTheme
          ?? localDraft.botTheme
          ?? "aurora",
      };
      setDraftState(merged);
      saveDraft(merged);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  const setDraft = useCallback((patch: Partial<Draft>) => {
    setDraftState((prev) => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const canAdvance = useCallback((): boolean => {
    if (draft.step === 1)
      return Boolean(draft.nurseName.trim() && draft.practiceName.trim() && draft.city.trim());
    if (draft.step === 2) return draft.procedures.length > 0;
    return true;
  }, [draft]);

  const goNext = useCallback(async () => {
    if (!canAdvance()) return;
    setError(null);

    // Save nurse's full name to auth user metadata when leaving step 1
    if (draft.step === 1 && draft.nurseName.trim()) {
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        data: { full_name: draft.nurseName.trim() },
      });
      console.log("[onboarding] updateUser full_name:", draft.nurseName.trim(), "| result:", updateData?.user?.user_metadata?.full_name, "| error:", updateError?.message ?? null);
    }

    if (draft.step < TOTAL_STEPS - 1) {
      setDraft({ step: draft.step + 1 });
      return;
    }

    // Step 4 → save & launch
    setSaving(true);
    try {
      const token = tokenRef.current;
      const slug = slugify(draft.botName.trim() || draft.practiceName.trim());

      const baseServices = draft.procedures.filter((p) => p !== "Other");
      const customList = draft.customProcedures.split(",").map((s) => s.trim()).filter(Boolean);
      const services = [...baseServices, ...customList];

      const botPayload = {
        practice_name: draft.practiceName.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        notification_email: draft.notificationEmail.trim() || null,
        facebook: draft.facebook.trim() || null,
        tiktok: draft.tiktok.trim() || null,
        instagram: draft.instagram.trim() || null,
        website: draft.website.trim() || null,
        bot_name: draft.botName.trim() || draft.practiceName.trim(),
        slug,
        greeting:
          draft.greeting.trim() ||
          `Hi there! 👋 I'm here to help with bookings, answer questions, and more.`,
        booking_link: draft.bookingLink.trim() || null,
        services,
        logo_url: draft.logoUrl || null,
        numbing_method: draft.numbingMethod || null,
        cancellation_policy: draft.cancellationPolicy || null,
        deposit_info: draft.depositInfo || null,
        bot_theme: draft.botTheme || "aurora",
        launched: true,
      };

      console.log("[savebot] sending payload:", botPayload);
      console.log("[savebot] token present:", Boolean(token));

      const res = await fetch("/api/savebot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(botPayload),
      });

      const result = (await res.json()) as { error?: string };
      console.log("[savebot] response status:", res.status, "body:", result);

      if (!res.ok) {
        setError(result.error ?? "Could not save. Please try again.");
        setSaving(false);
        return;
      }

      // Seed procedures — delete all existing first to prevent duplicates, then re-insert
      await fetch("/api/procedures", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (services.length > 0) {
        await Promise.allSettled(
          services.map((name) =>
            fetch("/api/procedures", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ name, description: "" }),
            })
          )
        );
      }

      console.log("[savebot] success — bot saved, redirecting to dashboard");
      setBotSlug(slug);
      setDraft({ step: TOTAL_STEPS });
    } catch (e) {
      console.error("[savebot] unexpected error:", e);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [canAdvance, draft, setDraft]);

  const goBack = useCallback(() => {
    if (draft.step > 1) setDraft({ step: draft.step - 1 });
  }, [draft.step, setDraft]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#0d9488]" />
      </div>
    );
  }

  const pct = Math.round(((draft.step - 1) / (TOTAL_STEPS - 1)) * 100);
  const isLastContentStep = draft.step === TOTAL_STEPS - 1;
  const isDone = draft.step === TOTAL_STEPS;
  const showPreview = draft.step === 4;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-white border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[#1a2744]">
              AdonisBlue
            </span>
            <span className="text-xs font-medium text-slate-400">
              Step {draft.step} of {TOTAL_STEPS}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#0d9488] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i < draft.step ? "bg-[#0d9488]" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {showPreview ? (
            // Step 4: two-column layout with live preview
            <div className="grid gap-8 md:grid-cols-[1fr_320px]">
              <div>
                <StepCustomize draft={draft} onChange={setDraft} />
              </div>
              <div className="hidden md:block">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Live preview
                </p>
                <div className="h-[480px]">
                  <ChatPreview
                    key={draft.botTheme}
                    practiceName={draft.practiceName}
                    greeting={draft.greeting}
                    brandColor={draft.brandColor}
                    logoUrl={draft.logoUrl}
                    botTheme={draft.botTheme}
                  />
                </div>
              </div>
            </div>
          ) : draft.step === 1 ? (
            <StepWelcome draft={draft} onChange={setDraft} />
          ) : draft.step === 2 ? (
            <StepProcedures draft={draft} onChange={setDraft} />
          ) : draft.step === 3 ? (
            <StepGetFound draft={draft} onChange={setDraft} />
          ) : (
            <StepLive draft={draft} botSlug={botSlug} />
          )}

          {/* Mobile preview button for step 4 */}
          {showPreview && (
            <div className="mt-4 md:hidden">
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="w-full min-h-[44px] rounded-full border-2 border-[#0d9488] px-6 py-2.5 text-sm font-semibold text-[#0d9488] transition hover:bg-teal-50"
              >
                👁 Preview my bot
              </button>
            </div>
          )}

          {/* Preview modal (mobile only) */}
          {showPreviewModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:hidden" role="dialog" aria-modal="true">
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => setShowPreviewModal(false)}
              />
              <div className="relative z-[201] w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                  aria-label="Close preview"
                >
                  ✕
                </button>
                <p className="px-5 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Live preview
                </p>
                <div className="h-[420px] px-4 pb-4">
                  <ChatPreview
                    key={draft.botTheme}
                    practiceName={draft.practiceName}
                    greeting={draft.greeting}
                    brandColor={draft.brandColor}
                    logoUrl={draft.logoUrl}
                    botTheme={draft.botTheme}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* ── Bottom nav ───────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            {!isDone && draft.step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="min-h-[48px] rounded-full border-2 border-slate-200 px-6 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {isDone ? (
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="min-h-[48px] rounded-full bg-[#1a2744] px-8 text-sm font-semibold text-white shadow-sm transition hover:bg-[#243552]"
              >
                Go to dashboard →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={!canAdvance() || saving}
                className="min-h-[48px] rounded-full bg-[#0d9488] px-8 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : isLastContentStep
                    ? "Launch my bot 🚀"
                    : "Next →"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-slate-50">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#0d9488]" />
        </div>
      }
    >
      <OnboardingInner />
    </Suspense>
  );
}
