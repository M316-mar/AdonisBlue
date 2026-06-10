"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";

type Message = { role: "user" | "assistant"; content: string; id: string };

type Treatment = {
  id: string;
  procedure_name: string;
  treatment_date: string;
  intakes: { first_name: string; email: string } | null;
  procedures: { name: string; aftercare_instructions: string } | null;
  bots: { practice_name: string } | null;
};

export default function HealingChatPage({ params }: { params: Promise<{ treatment_id: string }> }) {
  const [treatmentId, setTreatmentId] = useState("");
  const [treatment, setTreatment] = useState<Treatment | null>(null);
  const [emergencyKeywords, setEmergencyKeywords] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then(p => setTreatmentId(p.treatment_id));
  }, [params]);

  useEffect(() => {
    if (!treatmentId) return;
    (async () => {
      const res = await fetch(`/api/healing?treatment_id=${treatmentId}`);
      if (!res.ok) { setError("This recovery chat link is invalid or expired."); setLoading(false); return; }
      const data = await res.json();
      setTreatment(data.treatment);
      setEmergencyKeywords(data.emergency_keywords ?? []);
      const clientName = data.treatment?.intakes?.first_name || "there";
      const procedureName = data.treatment?.procedures?.name || data.treatment?.procedure_name || "your procedure";
      setMessages([{
        role: "assistant",
        content: `Hi ${clientName}! 💙 I'm here to help you with your recovery after your ${procedureName}. How are you feeling? You can ask me anything about your healing process — I'm available 24/7!`,
        id: "welcome",
      }]);
      setLoading(false);
    })();
  }, [treatmentId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const checkForEmergency = useCallback((text: string): boolean => {
    const lower = text.toLowerCase();
    return emergencyKeywords.some(kw => lower.includes(kw.toLowerCase()));
  }, [emergencyKeywords]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;
    const userMessage: Message = { role: "user", content: text, id: Date.now().toString() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setSending(true);

    const isFlagged = checkForEmergency(text);

    try {
      const res = await fetch("/api/healing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatment_id: treatmentId,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          flagged: isFlagged,
          flagged_message: isFlagged ? text : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.message,
          id: Date.now().toString() + "-ai",
        }]);
      }
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  }, [messages, sending, treatmentId, checkForEmergency]);

  const practiceName = (treatment?.bots as any)?.practice_name || "Your Provider";
  const procedureName = treatment?.procedures?.name || treatment?.procedure_name || "your procedure";
  const clientName = treatment?.intakes?.first_name || "there";

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d1628]">
        <p className="text-sm text-slate-400">Loading your recovery chat…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d1628] px-4">
        <div className="text-center">
          <p className="text-4xl mb-4">💙</p>
          <p className="text-white font-semibold">{error}</p>
          <p className="mt-2 text-slate-400 text-sm">Please contact your provider directly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#0d1628]">
      {/* Header */}
      <header style={{ borderBottom: "3px solid #0d9488" }} className="shrink-0 bg-[#1a2744] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0d9488]/20 text-2xl">
            🩹
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white">{practiceName}</h1>
            <p className="text-xs text-teal-300">Recovery support for {procedureName} 💙</p>
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
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
        <p className="mx-auto max-w-2xl text-center text-xs text-amber-300">
          ⚠️ If you are experiencing a medical emergency, please call 911 immediately. This chat is for general recovery questions only.
        </p>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d9488]/20 text-base">
                  🩹
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-sm bg-[#0d9488]/20 border border-[#0d9488]/30 text-white"
                  : "rounded-bl-sm border border-white/10 bg-white/8 text-slate-100"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d9488]/20 text-base">🩹</div>
              <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/8 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick questions */}
      <div className="px-4 pb-2 sm:px-6">
        <div className="mx-auto max-w-2xl flex gap-2 overflow-x-auto pb-1">
          {["Is this swelling normal?", "When can I wear makeup?", "Can I exercise today?", "My area feels hard", "I have bruising"].map(q => (
            <button
              key={q}
              type="button"
              onClick={() => void sendMessage(q)}
              disabled={sending}
              className="shrink-0 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-300 transition hover:bg-teal-400/20 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 bg-[#1a2744]/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } }}
            placeholder="Ask about your recovery…"
            disabled={sending}
            className="max-h-28 min-h-[2.75rem] w-0 flex-1 resize-none rounded-full border border-sky-100/20 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-sky-100/40 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={sending || !input.trim()}
            onClick={() => void sendMessage(input)}
            className="shrink-0 rounded-full bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
