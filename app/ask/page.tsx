"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };

const OPENING_MESSAGE: Message = {
  role: "assistant",
  content: "Hey! I'm the AdonisBlue AI — the same technology your future clients would use on your page. Ask me anything about what AdonisBlue does, how it works, or whether it's a fit for your practice. I'm a real demo, not a brochure. 💙",
};

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const updated: Message[] = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/product-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const json = await res.json();
      const reply: string = json.reply ?? "I'm not sure — want me to have Valentina follow up with you directly?";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong on my end — try again or email hi@adonisblue.io directly 💙" }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#0d1628] font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0d1628]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            <span className="text-sm font-bold text-white">AdonisBlue</span>
          </Link>
          <Link
            href="/beta"
            className="rounded-full bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-teal-600"
          >
            Apply for beta →
          </Link>
        </div>
      </header>

      {/* Intro */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-2 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">Live demo</p>
        <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">Ask me anything about AdonisBlue</h1>
        <p className="mt-1 text-sm text-slate-400">I&apos;m the same AI your clients would use — try me.</p>
      </div>

      {/* Message list */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="mr-2 mt-1 shrink-0">
                <Image src="/Alona.png" alt="AdonisBlue" width={28} height={28} className="rounded-lg" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "rounded-br-sm bg-[#0d9488] text-white"
                  : "rounded-bl-sm bg-white/10 text-slate-100"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="mr-2 mt-1 shrink-0">
              <Image src="/Alona.png" alt="AdonisBlue" width={28} height={28} className="rounded-lg" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t border-white/10 bg-[#0d1628]/95 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about AdonisBlue…"
            disabled={loading}
            className="flex-1 resize-none rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none transition focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20 disabled:opacity-50"
            style={{ minHeight: "2.75rem", maxHeight: "8rem" }}
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!input.trim() || loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white shadow-md transition hover:bg-teal-600 disabled:opacity-40"
            aria-label="Send"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">Beta spots open · <a href="mailto:hi@adonisblue.io" className="text-teal-400 hover:underline">hi@adonisblue.io</a></p>
      </div>
    </div>
  );
}
