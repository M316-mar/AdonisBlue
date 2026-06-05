"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type NurseRow = {
  practice_name: string | null;
  bot_name: string | null;
  slug: string | null;
  launched: boolean | null;
  frozen: boolean | null;
  created_at: string;
  nurse_id: string;
  total_intakes: number;
  reviews_sent: number;
  aftercare_sent: number;
  last_active: string;
};

type FeedbackRow = {
  id: string;
  nurse_name: string | null;
  message: string | null;
  created_at: string;
};

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-practice";
}

function botSlug(row: NurseRow): string {
  if (row.slug?.trim()) return row.slug.trim();
  return slugify((row.bot_name || row.practice_name || "my-bot").trim());
}

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [nurses, setNurses] = useState<NurseRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [freezeLoading, setFreezeLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"nurses" | "feedback" | "blueroom" | "news">("nurses");
  const [blueroomPosts, setBlueroomPosts] = useState<{id:string;title:string;content:string;category:string;emoji:string;created_at:string;}[]>([]);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general", emoji: "💙" });
  const [postLoading, setPostLoading] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [news, setNews] = useState<{title:string;category:string;summary:string;emoji:string;action:string;}[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsGeneratedAt, setNewsGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("adminAuth") !== "true") {
      router.replace("/admin-login");
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/admin/nurses-public");
        const json = await r.json();
        setNurses(Array.isArray(json.nurses) ? json.nurses : []);
        setFeedback(Array.isArray(json.feedback) ? json.feedback : []);
        const blueroomRes = await fetch("/api/blueroom/posts");
        if (blueroomRes.ok) {
          const blueroomJson = await blueroomRes.json();
          setBlueroomPosts(blueroomJson.posts ?? []);
        }
        setReady(true);
      } catch {
        setReady(true);
      }
    })();
  }, [router]);

  const handleFreezeToggle = useCallback(async (nurse: NurseRow) => {
    const nextFrozen = !nurse.frozen;
    setFreezeLoading(nurse.nurse_id);
    try {
      const res = await fetch("/api/admin/freeze-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurse_id: nurse.nurse_id, frozen: nextFrozen }),
      });
      if (res.ok) {
        setNurses(prev => prev.map(n => n.nurse_id === nurse.nurse_id ? { ...n, frozen: nextFrozen } : n));
      }
    } finally {
      setFreezeLoading(null);
    }
  }, []);

  const handleCreatePost = useCallback(async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return;
    setPostLoading(true);
    const res = await fetch("/api/blueroom/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPost),
    });
    if (res.ok) {
      const json = await res.json();
      setBlueroomPosts(prev => [json.post, ...prev]);
      setNewPost({ title: "", content: "", category: "general", emoji: "💙" });
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 3000);
    }
    setPostLoading(false);
  }, [newPost]);

  const handleFetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetch("/api/admin/news");
      if (res.ok) {
        const json = await res.json();
        setNews(json.news ?? []);
        setNewsGeneratedAt(json.generated_at ?? null);
      }
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const totalActive = nurses.filter(n => n.launched && !n.frozen).length;
  const totalFrozen = nurses.filter(n => n.frozen).length;
  const totalIntakes = nurses.reduce((sum, n) => sum + (n.total_intakes || 0), 0);
  const totalReviews = nurses.reduce((sum, n) => sum + (n.reviews_sent || 0), 0);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1628]">
        <p className="text-sm text-white/60">Loading admin dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1628] font-sans text-slate-200 antialiased">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d1628]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            <span className="text-base font-semibold text-white">AdonisBlue <span className="text-teal-400">Admin</span></span>
          </div>
          <button
            type="button"
            onClick={() => { sessionStorage.removeItem("adminAuth"); router.push("/"); }}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
          {[
            { label: "Total Nurses", value: nurses.length, emoji: "👩‍⚕️" },
            { label: "Active Bots", value: totalActive, emoji: "🟢" },
            { label: "Frozen", value: totalFrozen, emoji: "🔒" },
            { label: "Total Intakes", value: totalIntakes, emoji: "💌" },
            { label: "Reviews Sent", value: totalReviews, emoji: "⭐" },
            { label: "Feedback", value: feedback.length, emoji: "💬" },
          ].map(stat => (
            <div key={stat.label} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-400/8 to-transparent" aria-hidden />
              <div className="relative">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-400">{stat.emoji} {stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("nurses")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "nurses" ? "bg-teal-400 text-[#0d1628]" : "border border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
          >
            👩‍⚕️ Nurses ({nurses.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("feedback")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "feedback" ? "bg-teal-400 text-[#0d1628]" : "border border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
          >
            💬 Feedback ({feedback.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("blueroom")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "blueroom" ? "bg-teal-400 text-[#0d1628]" : "border border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
          >
            💙 Blue Room
          </button>
          <button
            type="button"
            onClick={() => setTab("news")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "news" ? "bg-teal-400 text-[#0d1628]" : "border border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
          >
            🔬 Industry News
          </button>
        </div>

        {/* Nurses tab */}
        {tab === "nurses" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Practice</th>
                    <th className="px-4 py-3">Bot URL</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Clients</th>
                    <th className="px-4 py-3">Reviews</th>
                    <th className="px-4 py-3">Last Active</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {nurses.map(nurse => (
                    <tr key={nurse.nurse_id} className="align-middle transition hover:bg-white/3">
                      <td className="px-4 py-3 font-medium text-white">{nurse.practice_name?.trim() || "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/chat/${botSlug(nurse)}`} target="_blank" className="text-teal-400 hover:underline">
                          /chat/{botSlug(nurse)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          nurse.frozen
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                            : nurse.launched
                            ? "border-green-400/30 bg-green-400/10 text-green-300"
                            : "border-slate-400/30 bg-slate-400/10 text-slate-400"
                        }`}>
                          {nurse.frozen ? "🔒 Frozen" : nurse.launched ? "🟢 Active" : "⚪ Not launched"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{nurse.total_intakes || 0}</td>
                      <td className="px-4 py-3 text-slate-300">{nurse.reviews_sent || 0}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(nurse.last_active).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(nurse.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={freezeLoading === nurse.nurse_id}
                          onClick={() => void handleFreezeToggle(nurse)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            nurse.frozen
                              ? "border border-teal-400/30 bg-teal-400/10 text-teal-300 hover:bg-teal-400/20"
                              : "border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                          }`}
                        >
                          {freezeLoading === nurse.nurse_id ? "Saving…" : nurse.frozen ? "Unfreeze" : "Freeze"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {nurses.length === 0 && (
                <p className="py-12 text-center text-sm text-slate-500">No nurses yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Feedback tab */}
        {tab === "feedback" && (
          <div className="space-y-3">
            {feedback.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-slate-500">No feedback yet.</p>
              </div>
            )}
            {feedback.map(f => (
              <div key={f.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-sm">💬</div>
                    <div>
                      <p className="text-sm font-semibold text-white">{f.nurse_name || "Unknown nurse"}</p>
                      <p className="text-xs text-slate-500">{new Date(f.created_at).toLocaleDateString()} at {new Date(f.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 border-l-2 border-teal-400/30 pl-4">{f.message || "(no message)"}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "blueroom" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <h2 className="mb-4 text-lg font-bold text-white">Create a new post 💙</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {["💙","🔥","💉","📈","📰","✨","💡","⚠️"].map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setNewPost(p => ({ ...p, emoji: e }))}
                      className={`rounded-xl border py-2 text-xl transition ${newPost.emoji === e ? "border-teal-400 bg-teal-400/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <select
                  value={newPost.category}
                  onChange={e => setNewPost(p => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none"
                >
                  <option value="general" className="text-black">💙 General</option>
                  <option value="trending" className="text-black">🔥 Trending</option>
                  <option value="techniques" className="text-black">💉 Techniques</option>
                  <option value="business" className="text-black">📈 Business Tips</option>
                  <option value="news" className="text-black">📰 Industry News</option>
                </select>
                <input
                  value={newPost.title}
                  onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                  placeholder="Post title…"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400/50"
                />
                <textarea
                  value={newPost.content}
                  onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                  placeholder="Write your post content… Share trends, tips, news, techniques."
                  rows={5}
                  className="w-full resize-none rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400/50"
                />
                <button
                  type="button"
                  disabled={postLoading || !newPost.title.trim() || !newPost.content.trim()}
                  onClick={() => void handleCreatePost()}
                  className="w-full rounded-full bg-teal-400 px-6 py-3 text-sm font-bold text-[#0d1628] transition hover:bg-teal-300 disabled:opacity-50"
                >
                  {postLoading ? "Publishing…" : postSuccess ? "Published! ✅" : "Publish to Blue Room 💙"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Published posts ({blueroomPosts.length})</h3>
              {blueroomPosts.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                  <p className="text-slate-500">No posts yet — create your first one above!</p>
                </div>
              )}
              {blueroomPosts.map(post => (
                <div key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{post.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-teal-400/20 px-2 py-0.5 text-xs font-bold text-teal-300">{post.category}</span>
                        <span className="text-xs text-slate-500">{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 font-semibold text-white">{post.title}</p>
                      <p className="mt-1 text-sm text-slate-400 line-clamp-2">{post.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "news" && (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] to-[#0d4f6b] p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_0%,rgba(56,189,248,0.2),transparent)]" aria-hidden />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">🔬 Aesthetic Industry Intelligence</h2>
                  <p className="mt-1 text-sm text-slate-300">AI-powered briefing on what&apos;s happening in aesthetics right now. Use this to inform your Blue Room posts and nurse newsletters.</p>
                  {newsGeneratedAt && (
                    <p className="mt-1 text-xs text-teal-300">Last generated: {new Date(newsGeneratedAt).toLocaleString()}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={newsLoading}
                  onClick={() => void handleFetchNews()}
                  className="shrink-0 rounded-full bg-teal-400 px-6 py-3 text-sm font-bold text-[#0d1628] transition hover:bg-teal-300 disabled:opacity-50"
                >
                  {newsLoading ? "Generating…" : "🔄 Generate briefing"}
                </button>
              </div>
            </div>

            {news.length === 0 && !newsLoading && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-4xl mb-3">🔬</p>
                <p className="text-white font-semibold">Click &quot;Generate briefing&quot; to get the latest aesthetic industry news</p>
                <p className="mt-1 text-sm text-slate-400">Powered by Claude AI — updated every time you generate</p>
              </div>
            )}

            {newsLoading && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-4xl mb-3 animate-pulse">🔬</p>
                <p className="text-white font-semibold">Analyzing aesthetic industry trends…</p>
                <p className="mt-1 text-sm text-slate-400">This takes about 10 seconds</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {news.map((item, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          item.category === "trending" ? "bg-orange-400/20 text-orange-300 border border-orange-400/30" :
                          item.category === "new_product" ? "bg-blue-400/20 text-blue-300 border border-blue-400/30" :
                          item.category === "safety" ? "bg-red-400/20 text-red-300 border border-red-400/30" :
                          item.category === "business" ? "bg-green-400/20 text-green-300 border border-green-400/30" :
                          item.category === "technique" ? "bg-purple-400/20 text-purple-300 border border-purple-400/30" :
                          "bg-pink-400/20 text-pink-300 border border-pink-400/30"
                        }`}>
                          {item.category.replace("_", " ")}
                        </span>
                      </div>
                      <h3 className="font-bold text-white text-sm">{item.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.summary}</p>
                      <div className="mt-3 rounded-xl border border-teal-400/20 bg-teal-400/10 px-3 py-2">
                        <p className="text-xs font-semibold text-teal-300">💡 Action: {item.action}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("blueroom");
                      setNewPost({
                        title: item.title,
                        content: item.summary + "\n\n💡 Action for your practice: " + item.action,
                        category: item.category === "trending" ? "trending" :
                                  item.category === "technique" ? "techniques" :
                                  item.category === "business" ? "business" : "news",
                        emoji: item.emoji,
                      });
                    }}
                    className="mt-3 w-full rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                  >
                    📝 Draft as Blue Room post
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
