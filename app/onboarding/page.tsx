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

type Draft = {
  userId: string;
  step: number;
  // Step 1
  firstName: string;
  practiceName: string;
  city: string;
  state: string;
  // Step 2
  procedures: string[];
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
};

function emptyDraft(userId: string): Draft {
  return {
    userId,
    step: 1,
    firstName: "",
    practiceName: "",
    city: "",
    state: "",
    procedures: [],
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

function ChatPreview({
  botName,
  greeting,
  brandColor,
  logoUrl,
}: {
  botName: string;
  greeting: string;
  brandColor: string;
  logoUrl?: string;
}) {
  const title = botName.trim() || "Your Bot";
  const greetingText =
    greeting.trim() || "Hi there! 👋 How can I help you today?";
  const brand = brandColor || "#0d9488";

  const DEMO_MSGS: PreviewMsg[] = [
    { id: "1", role: "assistant", content: greetingText },
    { id: "2", role: "user", content: "What services do you offer?" },
    {
      id: "3",
      role: "assistant",
      content:
        "We offer Lip Filler, Botox, Cheek Filler, and more! ✨ Would you like to book a consultation?",
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-slate-100 bg-white shadow-xl">
      {/* brand top stripe */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: brand }} />

      {/* header */}
      <div
        className="flex shrink-0 items-center gap-2.5 border-b-4 bg-white px-3 py-2.5"
        style={{ borderBottomColor: brand }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white overflow-hidden"
          style={!logoUrl ? { backgroundColor: brand, boxShadow: "0 1px 3px rgba(0,0,0,.12)" } : { boxShadow: "0 1px 3px rgba(0,0,0,.12)" }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-full w-full object-cover" />
          ) : (
            title.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs font-semibold leading-tight"
            style={{ color: brand }}
          >
            {title}
          </p>
          <p className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Online
          </p>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50 px-2.5 py-3">
        {DEMO_MSGS.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] text-[11px] leading-relaxed ${
                m.role === "user"
                  ? "rounded-full border-2 bg-white px-3 py-2 text-slate-800"
                  : "py-0.5 text-slate-800"
              }`}
              style={m.role === "user" ? { borderColor: brand } : undefined}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {/* input bar */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-2.5 pb-2.5 pt-2">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-400">
          <span className="flex-1">Type a message…</span>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
            style={{ backgroundColor: brand }}
          >
            Send
          </span>
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
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]";

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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">
            Your first name
          </label>
          <input
            className={field}
            placeholder="e.g. Maria"
            value={draft.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
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
            value={draft.city}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">State</label>
          <input
            className={field}
            placeholder="e.g. FL"
            value={draft.state}
            onChange={(e) => onChange({ state: e.target.value })}
          />
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

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1a2744]">
          Booking link{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]"
          placeholder="https://your-booking-link.com"
          value={draft.bookingLink}
          onChange={(e) => onChange({ bookingLink: e.target.value })}
        />
        <p className="text-xs text-slate-400">
          Calendly, Acuity, Jane, Vagaro — any link works
        </p>
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
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]";

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
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 min-h-[48px]";

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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">Bot name <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            className={field}
            placeholder="Bella, Luna, Glamour AI…"
            value={draft.botName}
            onChange={(e) => onChange({ botName: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2744]">
            Brand color
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={`${c.emoji} ${c.label}`}
                onClick={() => onChange({ brandColor: c.value })}
                className={`h-9 w-9 rounded-full border-2 transition ${
                  draft.brandColor === c.value
                    ? "scale-110 border-[#1a2744] shadow-sm"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
            <input
              type="color"
              value={draft.brandColor}
              onChange={(e) => onChange({ brandColor: e.target.value })}
              className="h-9 w-9 cursor-pointer rounded-full border border-slate-200 p-0.5"
              title="Custom color"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1a2744]">
          Welcome message
        </label>
        <textarea
          rows={2}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
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
              const res = await fetch("/api/generate-greeting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  practice_name: draft.practiceName,
                  procedures: draft.procedures,
                  bot_name: draft.botName,
                }),
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
          Welcome to AdonisBlue,{" "}
          {draft.firstName.trim() || "friend"}. Your bot is live right now.
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

      // Derive first name from auth metadata as best-effort fallback
      const metaFullName =
        (data.session.user.user_metadata?.full_name as string | undefined) ?? "";
      const metaFirstName = metaFullName.trim().split(" ")[0] ?? "";

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
              // Step 1 — first_name has no DB column; use auth metadata or local draft
              firstName: metaFirstName,
              practiceName: (bot.practice_name as string | null) ?? "",
              city: (bot.city as string | null) ?? "",
              state: (bot.state as string | null) ?? "",
              // Step 2 — procedures come from services[] on bots table
              procedures: Array.isArray(bot.services) && bot.services.length > 0
                ? (bot.services as string[])
                : [],
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

        // Restore firstName from local draft if auth metadata didn't have it
        if (!serverDraft.firstName) {
          const localPeek = loadDraft(userId);
          if (localPeek.firstName) serverDraft.firstName = localPeek.firstName;
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
      return Boolean(draft.firstName.trim() && draft.practiceName.trim());
    if (draft.step === 2) return draft.procedures.length > 0;
    return true;
  }, [draft]);

  const goNext = useCallback(async () => {
    if (!canAdvance()) return;
    setError(null);

    if (draft.step < TOTAL_STEPS - 1) {
      setDraft({ step: draft.step + 1 });
      return;
    }

    // Step 4 → save & launch
    setSaving(true);
    try {
      const token = tokenRef.current;
      const slug = slugify(draft.botName.trim() || draft.practiceName.trim());

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
        brand_color: draft.brandColor,
        booking_link: draft.bookingLink.trim() || null,
        services: draft.procedures,
        logo_url: draft.logoUrl || null,
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

      // Seed procedures
      if (draft.procedures.length > 0) {
        await Promise.allSettled(
          draft.procedures.map((name) =>
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
            <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
              <div>
                <StepCustomize draft={draft} onChange={setDraft} />
              </div>
              <div className="hidden lg:block">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Live preview
                </p>
                <div className="h-[480px]">
                  <ChatPreview
                    botName={draft.botName || draft.practiceName}
                    greeting={draft.greeting}
                    brandColor={draft.brandColor}
                    logoUrl={draft.logoUrl}
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

          {/* Mobile preview for step 4 */}
          {showPreview && (
            <div className="mt-6 lg:hidden">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Live preview
              </p>
              <div className="h-[380px]">
                <ChatPreview
                  botName={draft.botName || draft.practiceName}
                  greeting={draft.greeting}
                  brandColor={draft.brandColor}
                  logoUrl={draft.logoUrl}
                />
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
