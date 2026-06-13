"use client";

import { useEffect, useState, useRef, useCallback } from "react";

type Message = { role: "user" | "assistant"; content: string; id: string };

type Treatment = {
  id: string;
  procedure_name: string;
  treatment_date: string;
  intakes: { first_name: string } | null;
  procedures: { name: string; aftercare_instructions: string } | null;
  bots: null;
};

const QUICK_QUESTIONS = [
  "Is this swelling normal?",
  "When can I wear makeup?",
  "Can I exercise today?",
  "My area feels hard",
  "I have bruising",
];

export default function HealingChatPage({
  params,
}: {
  params: Promise<{ treatment_id: string }>;
}) {
  const [treatmentId, setTreatmentId] = useState("");
  const [treatment, setTreatment] = useState<Treatment | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [phoneCollected, setPhoneCollected] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Resolve async params
  useEffect(() => {
    params.then((p) => setTreatmentId(p.treatment_id));
  }, [params]);

  // Load treatment data
  useEffect(() => {
    if (!treatmentId) return;
    (async () => {
      const res = await fetch(`/api/healing?treatment_id=${treatmentId}`);
      if (!res.ok) {
        setError("This recovery chat link is invalid or expired.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTreatment(data.treatment);
      const clientName = data.treatment?.intakes?.first_name || "there";
      const procedureName =
        data.treatment?.procedures?.name ||
        data.treatment?.procedure_name ||
        "your procedure";
      setMessages([
        {
          role: "assistant",
          content: `Hi ${clientName}! 💙 I'm your recovery assistant after your ${procedureName}. Are you reaching out because of an emergency or concern, or do you just have a general question about your healing? I'm here 24/7 for you! 🌸`,
          id: "welcome",
        },
      ]);
      setLoading(false);
    })();
  }, [treatmentId]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      const userMessage: Message = {
        role: "user",
        content: text,
        id: Date.now().toString(),
      };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setSending(true);

      try {
        const res = await fetch("/api/healing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            treatment_id: treatmentId,
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            flagged_message: text,
            client_phone: clientPhone || null,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.message,
              id: Date.now().toString() + "-ai",
            },
          ]);
        }
      } catch (e) {
        console.error(e);
      }
      setSending(false);
    },
    [messages, sending, treatmentId, clientPhone]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  const procedureName =
    treatment?.procedures?.name ||
    treatment?.procedure_name ||
    "your procedure";
  const clientName = treatment?.intakes?.first_name || "there";

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d1628]">
        <p className="text-sm text-slate-400">Loading your recovery chat…</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d1628] px-4">
        <div className="text-center">
          <p className="text-4xl mb-4">💙</p>
          <p className="text-white font-semibold">{error}</p>
          <p className="mt-2 text-slate-400 text-sm">
            Please contact your provider directly.
          </p>
        </div>
      </div>
    );
  }

  // ── Phone collection ───────────────────────────────────────────────────────
  if (!phoneCollected) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d1628] px-4 py-8"
           style={{ paddingTop: "max(2rem, env(safe-area-inset-top))", paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a2744] p-8 shadow-xl text-center">
          <p className="text-4xl mb-3">💙</p>
          <h2 className="text-lg font-bold text-white mb-1">Recovery Check-in</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Before we start, what&rsquo;s the best phone number to reach you
            in case of an emergency? This is only shared with your nurse if needed.
          </p>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#0d9488] mb-3 placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => setPhoneCollected(true)}
            style={{ touchAction: "manipulation" }}
            className="w-full min-h-[48px] rounded-full bg-[#0d9488] py-3 text-sm font-bold text-white transition hover:bg-teal-700 active:scale-[0.98] mb-3"
          >
            Continue to recovery chat →
          </button>
          <button
            type="button"
            onClick={() => {
              setClientPhone("Not provided");
              setPhoneCollected(true);
            }}
            style={{ touchAction: "manipulation" }}
            className="w-full min-h-[44px] rounded-full border border-white/10 py-2.5 text-xs text-slate-400 transition hover:bg-white/5 active:scale-[0.98]"
          >
            Skip — I don&rsquo;t want to share my number
          </button>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            🔒 Your number is never sold or shared with anyone except your nurse.
          </p>
        </div>
      </div>
    );
  }

  // ── Main chat ──────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col bg-[#0d1628] overflow-hidden"
      style={{
        minHeight: "100dvh",
        maxWidth: "100vw",
      }}
    >
      {/* Header — safe area top for notch / Dynamic Island */}
      <header
        className="shrink-0 bg-[#1a2744]"
        style={{
          borderBottom: "3px solid #0d9488",
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
          paddingBottom: "1rem",
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0d9488]/20 text-xl sm:h-12 sm:w-12 sm:text-2xl">
            🩹
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-white sm:text-base">
              {treatment?.bots
                ? String((treatment.bots as unknown as Record<string, unknown>).practice_name)
                : "Recovery Assistant"}
            </h1>
            <p className="text-xs text-teal-300 truncate">
              Recovery support for {procedureName} 💙
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-slate-400">Hi {clientName}!</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1 justify-end">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Available 24/7
            </p>
          </div>
        </div>
      </header>

      {/* Emergency banner */}
      <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
        <p className="mx-auto max-w-2xl text-center text-xs text-amber-300 leading-relaxed">
          ⚠️ If you are experiencing a medical emergency, please call{" "}
          <a
            href="tel:911"
            className="font-bold underline"
            style={{ touchAction: "manipulation" }}
          >
            911
          </a>{" "}
          immediately.
        </p>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6 sm:py-6"
        style={{
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d9488]/20 text-base">
                  🩹
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[78%] ${
                  m.role === "user"
                    ? "rounded-br-sm bg-[#0d9488]/20 border border-[#0d9488]/30 text-white"
                    : "rounded-bl-sm border border-white/10 bg-white/[0.08] text-slate-100"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d9488]/20 text-base">
                🩹
              </div>
              <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.08] px-4 py-3">
                <div className="flex gap-1 items-center">
                  <span
                    className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions + input bar */}
      <div
        className="shrink-0 border-t border-white/10 bg-[#1a2744]/95"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
          paddingTop: "0.75rem",
        }}
      >
        <div className="mx-auto max-w-2xl space-y-2">
          {/* Emergency & Concern — prominent row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void sendMessage("🚨 I think I am having an emergency")}
              disabled={sending}
              style={{ touchAction: "manipulation" }}
              className="min-h-[48px] rounded-full border border-red-400/50 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-400/20 active:scale-[0.97] disabled:opacity-50 sm:text-sm"
            >
              🚨 Emergency
            </button>
            <button
              type="button"
              onClick={() => void sendMessage("💬 I have a concern about my recovery")}
              disabled={sending}
              style={{ touchAction: "manipulation" }}
              className="min-h-[48px] rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-400/20 active:scale-[0.97] disabled:opacity-50 sm:text-sm"
            >
              💬 Concern
            </button>
          </div>

          {/* Quick questions — wrapping chips */}
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void sendMessage(q)}
                disabled={sending}
                style={{ touchAction: "manipulation" }}
                className="min-h-[36px] rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-300 transition hover:bg-teal-400/20 active:scale-[0.97] disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Text input */}
          <div className="flex items-end gap-2 pt-1">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your recovery…"
              disabled={sending}
              className="min-h-[44px] max-h-28 w-0 flex-1 resize-none rounded-2xl border border-sky-100/20 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-sky-100/40 disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            />
            <button
              type="button"
              disabled={sending || !input.trim()}
              onClick={() => void sendMessage(input)}
              style={{ touchAction: "manipulation" }}
              className="min-h-[44px] shrink-0 rounded-full bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 active:scale-[0.97] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
