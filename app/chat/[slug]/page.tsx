"use client";

import { useParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BotNameFontId = "dm-sans" | "playfair" | "inter-bold" | "nunito" | "georgia";

type BotRow = {
  id: string;
  nurse_id: string;
  nurse_email?: string | null;
  practice_name: string | null;
  city?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  website?: string | null;
  other_social?: string | null;
  numbing_method?: string | null;
  previous_work_policy?: string | null;
  touch_up_policy?: string | null;
  same_day_consultation?: string | null;
  deposit_info?: string | null;
  bot_name: string | null;
  logo_url?: string | null;
  logo_image?: string | null;
  logo_data_url?: string | null;
  brand_name_image?: string | null;
  greeting: string | null;
  tone: string | null;
  brand_color: string | null;
  services: string[] | null;
  booking_link: string | null;
  forward_questions: string | null;
  cancellation_policy: string | null;
  aftercare: string | null;
  photos: string[] | null;
  launched: boolean | null;
  bot_name_font?: BotNameFontId | null;
  bubble_attention_message?: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  photos?: string[];
};

const QUICK_REPLIES = [
  "What services do you offer?",
  "How do I book?",
  "Does it hurt?",
  "What are your prices?",
  "I'm a returning client 💕",
];

const DEFAULT_ATTENTION = "Need help? Tap to chat with us 💬";

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "my-practice";
}

function botShareSlug(bot: Pick<BotRow, "bot_name" | "practice_name">): string {
  const raw = (bot.bot_name || "").trim() || (bot.practice_name || "").trim() || "my-bot";
  return slugify(raw);
}

// Suppress unused warning — kept for potential external use
void botShareSlug;

function safeHex(color: string | null | undefined, fallback: string): string {
  if (!color) return fallback;
  const c = color.trim();
  if (/^#[0-9A-Fa-f]{3,8}$/.test(c)) return c;
  return fallback;
}

function getBotNameFontStyle(id: BotNameFontId | null | undefined): CSSProperties {
  switch (id) {
    case "playfair":
      return { fontFamily: "var(--font-bot-playfair), Georgia, serif" };
    case "inter-bold":
      return { fontFamily: "var(--font-bot-inter), system-ui, sans-serif", fontWeight: 700 };
    case "nunito":
      return { fontFamily: "var(--font-bot-nunito), system-ui, sans-serif" };
    case "georgia":
      return { fontFamily: "Georgia, Palatino, serif" };
    case "dm-sans":
    default:
      return { fontFamily: "var(--font-bot-dm-sans), system-ui, sans-serif" };
  }
}

function wantsToSeePhotos(text: string): boolean {
  return /\b(results?|photos?|pictures?|gallery|before\s+and\s+after|your\s+work|examples?)\b/i.test(text);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const URL_IN_TEXT_REGEX = /(https?:\/\/[^\s]+)/gi;

function renderMessageContent(content: string) {
  const parts = content.split(URL_IN_TEXT_REGEX);
  const urls: string[] = [];
  const textChunks: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (/^https?:\/\//i.test(part)) {
      urls.push(part);
    } else {
      textChunks.push(part);
    }
  }
  const text = textChunks.join("");

  const renderBold = (str: string) => {
    const segments = str.split(/\*\*(.*?)\*\*/g);
    return segments.map((seg, i) => (i % 2 === 1 ? <strong key={i}>{seg}</strong> : seg));
  };

  return (
    <>
      {text ? <p className="whitespace-pre-wrap">{renderBold(text)}</p> : null}
      {urls.map((url, i) => {
        const label = url.includes("instagram")
          ? "📸 View our Instagram"
          : url.includes("tiktok")
            ? "🎵 Follow us on TikTok"
            : url.includes("facebook")
              ? "👍 Find us on Facebook"
              : /\.(com|io|co|net|org)/.test(url) &&
                  !url.includes("zenoti") &&
                  !url.includes("booking") &&
                  !url.includes("calendly") &&
                  !url.includes("acuity")
                ? "🌐 Visit our website"
                : "👉 Click here to book your appointment";
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block w-fit rounded-full border-2 px-4 py-2 text-sm font-semibold transition hover:opacity-80"
            style={{ borderColor: "currentColor" }}
          >
            {label}
          </a>
        );
      })}
    </>
  );
}

export default function PublicChatPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [loadState, setLoadState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [bot, setBot] = useState<BotRow | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [showAttn, setShowAttn] = useState(false);

  const brand = useMemo(() => safeHex(bot?.brand_color, "#0d9488"), [bot?.brand_color]);

  const nurseDisplayName = useMemo(() => {
    if (!bot) return "your provider";
    return (bot.practice_name || "").trim() || (bot.bot_name || "").trim() || "your provider";
  }, [bot]);

  const attentionMessage = useMemo(() => {
    const raw = bot?.bubble_attention_message;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    return DEFAULT_ATTENTION;
  }, [bot?.bubble_attention_message]);

  const PSYCH_MESSAGES = [
    "✨ Curious about lip filler?",
    "💉 What would you change first?",
    "💕 Ready to look refreshed?",
    "👄 What's holding you back?",
    "✨ Ask me anything — I'm here!",
  ];

  // Show rotating attention messages when chat is closed
  useEffect(() => {
    if (chatOpen) {
      setShowAttn(false);
      return;
    }
    const showTimer = setTimeout(() => setShowAttn(true), 3000);
    const rotateInterval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % PSYCH_MESSAGES.length);
    }, 5000);
    return () => {
      clearTimeout(showTimer);
      clearInterval(rotateInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  useEffect(() => {
    if (!slug) {
      setLoadState("notfound");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadState("loading");
      const res = await fetch(`/api/bot/${slug}`);
      if (cancelled) return;
      if (!res.ok) {
        setLoadState(res.status === 404 ? "notfound" : "error");
        setBot(null);
        return;
      }
      const botData = await res.json();
      const found = botData as BotRow;
      setBot(found);
      const greeting = (found.greeting || "").trim() || "Hello! How can we help you today?";
      setMessages([{ id: newId(), role: "assistant", content: greeting }]);
      setLoadState("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, chatOpen, sending]);

  const sendUserText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !bot || sending) return;

      const userMessage: ChatMessage = { id: newId(), role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setSending(true);

      const historyForApi = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const botContext = {
        nurse_email: (bot as BotRow & { nurse_email?: string }).nurse_email,
        bot_id: bot.id,
        nurse_id: bot.nurse_id,
        practice_name: bot.practice_name,
        city: bot.city,
        instagram: bot.instagram,
        facebook: bot.facebook,
        tiktok: bot.tiktok,
        website: bot.website,
        other_social: bot.other_social,
        numbing_method: bot.numbing_method,
        previous_work_policy: bot.previous_work_policy,
        touch_up_policy: bot.touch_up_policy,
        same_day_consultation: bot.same_day_consultation,
        deposit_info: bot.deposit_info,
        bot_name: bot.bot_name,
        services: bot.services ?? [],
        tone: bot.tone,
        greeting: bot.greeting,
        booking_link: bot.booking_link,
        cancellation_policy: bot.cancellation_policy,
        aftercare: bot.aftercare,
        forward_questions: bot.forward_questions,
        photos: bot.photos ?? [],
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            messages: historyForApi,
            botContext,
            nurseDisplayName,
            styleHints: {
              plainEnglish: true,
              noMedicalJargon: true,
              warmAndHuman: true,
              bookingLinkWhenBooking: true,
              unknownAnswerFallback: `That is a great question! Let me have ${nurseDisplayName} get back to you on that one personally 💙`,
              showPhotosWhenResultsRequested: true,
            },
          }),
        });

        const raw = await res.text();
        let reply = "";
        try {
          const parsed = JSON.parse(raw) as { reply?: string; message?: string; error?: string };
          reply = (typeof parsed.reply === "string" && parsed.reply) || (typeof parsed.message === "string" && parsed.message) || "";
          if (!res.ok && !reply && typeof parsed.error === "string") reply = parsed.error;
        } catch {
          reply = res.ok ? raw.trim() : "";
        }

        if (!reply) {
          reply = res.ok
            ? "Thanks for your message — we are here to help. Try again in a moment, or reach out through our booking link when it is available."
            : "We could not reach the assistant right now. Please try again in a moment.";
        }

        console.log("BOT REPLY:", reply.slice(0, 100));
        const assistantMsg: ChatMessage = { id: newId(), role: "assistant", content: reply };

        const photoFollowUp: ChatMessage[] =
          wantsToSeePhotos(trimmed) && (bot.photos?.length ?? 0) > 0
            ? [
                {
                  id: newId(),
                  role: "assistant",
                  content:
                    "Here are some photos from our practice. Results vary by person — we would love to discuss what is right for you.",
                  photos: bot.photos ?? [],
                },
              ]
            : [];
        setMessages((prev) => [...prev, assistantMsg, ...photoFollowUp]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: "Something went wrong while sending your message. Please check your connection and try again.",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [bot, messages, nurseDisplayName, sending, slug]
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void sendUserText(input);
    },
    [input, sendUserText]
  );

  if (loadState === "loading") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#0d9488]" aria-hidden />
        <p className="mt-4 text-sm font-medium text-slate-600">Loading chat…</p>
      </div>
    );
  }

  if (loadState === "error" || loadState === "notfound" || !bot) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {loadState === "notfound" ? "We could not find this chat" : "Something went wrong"}
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-600">
          {loadState === "notfound"
            ? "This link may be incorrect or the bot is not live yet. Ask your provider for an updated link."
            : "Please refresh the page or try again later."}
        </p>
      </div>
    );
  }

  const fontId = (bot.bot_name_font as BotNameFontId | undefined) ?? "dm-sans";
  const botTitle = (bot.practice_name || "").trim() || "Chat";
  const botLogoImage = bot.logo_url || bot.logo_image || bot.logo_data_url;

  const ChatPanel = (
    <div
      className={`fixed z-50 flex flex-col bg-white shadow-2xl transition-[transform,opacity] duration-300 ease-out md:rounded-2xl md:border-2 md:border-slate-100 ${
        chatOpen
          ? "inset-0 translate-y-0 opacity-100 md:inset-auto md:bottom-6 md:right-6 md:h-[min(36rem,calc(100dvh-4rem))] md:max-h-[calc(100dvh-4rem)] md:w-[min(100%,24rem)]"
          : "pointer-events-none inset-0 translate-y-full opacity-0 md:inset-auto md:bottom-6 md:right-6 md:h-[min(36rem,calc(100dvh-4rem))] md:max-h-[calc(100dvh-4rem)] md:w-[min(100%,24rem)] md:translate-y-8 md:opacity-0"
      }`}
      style={{ visibility: chatOpen ? "visible" : "hidden" }}
      aria-hidden={!chatOpen}
    >
      {/* Top brand stripe */}
      <div className="h-1 w-full shrink-0 md:rounded-t-2xl" style={{ backgroundColor: brand }} />

      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b-4 bg-white px-4 py-3 md:rounded-t-2xl"
        style={{ borderBottomColor: brand }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {botLogoImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={botLogoImage}
              alt=""
              style={{ width: 56, height: 56, minWidth: 56, borderRadius: "50%", objectFit: "contain", backgroundColor: "white", padding: "2px", boxShadow: "0 1px 3px rgba(0,0,0,.12)", display: "block" }}
            />
          ) : (
            <div
              style={{ width: 56, height: 56, minWidth: 56, borderRadius: "50%", backgroundColor: brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "white", boxShadow: "0 1px 3px rgba(0,0,0,.12)" }}
            >
              {(bot.practice_name || "").trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold leading-tight"
              style={{ ...getBotNameFontStyle(fontId), color: brand }}
            >
              {botTitle}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              Online
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setChatOpen(false)}
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-4"
      >
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-full border-2 bg-white px-3.5 py-2 text-slate-800"
                  : "py-1 text-slate-800"
              }`}
              style={m.role === "user" ? { borderColor: brand } : undefined}
            >
              {renderMessageContent(m.content)}
              {m.photos && m.photos.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {m.photos.slice(0, 6).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${m.id}-p-${i}`}
                      src={src}
                      alt=""
                      className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {sending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce [animation-delay:120ms]">●</span>
                <span className="animate-bounce [animation-delay:240ms]">●</span>
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 md:rounded-b-2xl">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void sendUserText(q)}
              disabled={sending}
              className="rounded-full border-2 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              style={{ borderColor: brand }}
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendUserText(input);
              }
            }}
            placeholder="Type a message…"
            disabled={sending}
            className="max-h-28 min-h-[2.75rem] w-0 flex-1 resize-none rounded-full border-2 border-slate-200 bg-white px-4 py-2.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: brand }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header
        className="shrink-0 border-b-4 bg-white px-4 py-5 sm:px-6 sm:py-6"
        style={{ borderBottomColor: brand }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-4 sm:gap-5">
          {botLogoImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={botLogoImage}
              alt=""
              style={{ width: 56, height: 56, minWidth: 56, borderRadius: "50%", objectFit: "cover", backgroundColor: "white", boxShadow: "0 1px 3px rgba(0,0,0,.12)", display: "block" }}
            />
          ) : (
            <div
              style={{ width: 56, height: 56, minWidth: 56, borderRadius: "50%", backgroundColor: brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "white", boxShadow: "0 1px 3px rgba(0,0,0,.12)" }}
            >
              {botTitle.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-xl font-bold tracking-tight sm:text-2xl"
              style={{ ...getBotNameFontStyle(fontId), color: brand }}
            >
              {botTitle}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500 sm:text-sm">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              Online — we typically reply right away
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col bg-white px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-center text-sm font-medium text-slate-600 sm:text-base">
          {attentionMessage}
        </p>
        <p className="mx-auto mt-6 max-w-md text-center text-xs leading-relaxed text-slate-500 sm:text-sm">
          Tap the chat button to ask about services, booking, and more. We keep things simple and friendly — no jargon.
        </p>
      </main>

      {!chatOpen ? (
        <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-8 sm:right-8">
          {showAttn && (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="animate-bounce-in max-w-[min(calc(100vw-5rem),16rem)] rounded-2xl px-4 py-2.5 text-left text-sm font-semibold text-white shadow-xl shadow-slate-900/20 ring-2 ring-white/25 transition hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: brand }}
            >
              <span className="line-clamp-2 leading-snug">{PSYCH_MESSAGES[msgIdx]}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="relative flex h-16 w-16 items-center justify-center rounded-full shadow-xl shadow-slate-900/20 ring-2 ring-white/25 transition hover:opacity-90 active:scale-[0.98] md:h-14 md:w-14"
            style={{ backgroundColor: brand }}
            aria-label="Open chat"
          >
            <span className="text-2xl" aria-hidden>💬</span>
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
            {showAttn && (
              <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: brand }} />
            )}
          </button>
        </div>
      ) : null}

      {chatOpen ? <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-0" aria-hidden onClick={() => setChatOpen(false)} /> : null}

      {ChatPanel}
    </div>
  );
}
