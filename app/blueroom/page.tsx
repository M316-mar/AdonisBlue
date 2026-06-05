"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Post = {
  id: string;
  title: string;
  content: string;
  category: string;
  emoji: string;
  created_at: string;
  blueroom_comments: { count: number }[];
};

type Comment = {
  id: string;
  nurse_name: string;
  message: string;
  created_at: string;
};

const CATEGORIES = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "trending", label: "Trending", emoji: "🔥" },
  { id: "techniques", label: "Techniques", emoji: "💉" },
  { id: "business", label: "Business Tips", emoji: "📈" },
  { id: "news", label: "Industry News", emoji: "📰" },
  { id: "general", label: "General", emoji: "💙" },
];

export default function BlueRoomPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [nurseName, setNurseName] = useState("there");
  const [nurseId, setNurseId] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      const user = data.session.user;
      setNurseId(user.id);
      const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Nurse";
      setNurseName(name);

      const res = await fetch("/api/blueroom/posts");
      if (!cancelled && res.ok) {
        const json = await res.json();
        setPosts(json.posts ?? []);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const loadComments = useCallback(async (postId: string) => {
    if (comments[postId]) return;
    const res = await fetch(`/api/blueroom/comments?post_id=${postId}`);
    if (res.ok) {
      const json = await res.json();
      setComments(prev => ({ ...prev, [postId]: json.comments ?? [] }));
    }
  }, [comments]);

  const handleExpandPost = useCallback(async (postId: string) => {
    if (expandedPost === postId) {
      setExpandedPost(null);
      return;
    }
    setExpandedPost(postId);
    await loadComments(postId);
  }, [expandedPost, loadComments]);

  const handleSubmitComment = useCallback(async (postId: string) => {
    const message = commentText[postId]?.trim();
    if (!message) return;
    setCommentLoading(postId);
    const res = await fetch("/api/blueroom/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, nurse_id: nurseId, nurse_name: nurseName, message }),
    });
    if (res.ok) {
      const json = await res.json();
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), json.comment] }));
      setCommentText(prev => ({ ...prev, [postId]: "" }));
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        blueroom_comments: [{ count: (p.blueroom_comments?.[0]?.count ?? 0) + 1 }]
      } : p));
    }
    setCommentLoading(null);
  }, [commentText, nurseId, nurseName]);

  const filteredPosts = activeCategory === "all"
    ? posts
    : posts.filter(p => p.category === activeCategory);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-[#1a2744]/80">Loading The Blue Room…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-[#1a2744]">The Blue Room 💙</h1>
              <p className="text-xs text-slate-500">Your nurse community</p>
            </div>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Welcome banner */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] via-[#0d4f6b] to-[#0d9488] px-6 py-6 sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_0%,rgba(56,189,248,0.2),transparent)]" aria-hidden />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Welcome, {nurseName.split(" ")[0]}!</p>
            <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">The Blue Room 💙</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-200">
              Stay ahead of the curve. Get the latest aesthetic trends, techniques, and business tips — curated just for nurse injectors like you.
            </p>
          </div>
        </div>

        {/* Category filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                activeCategory === cat.id
                  ? "bg-[#0d9488] text-white shadow-md"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:text-[#0d9488]"
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Posts */}
        {filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-4xl">💙</p>
            <p className="mt-3 text-base font-semibold text-[#1a2744]">Posts coming soon!</p>
            <p className="mt-1 text-sm text-slate-500">We're preparing amazing content just for you. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map(post => (
              <div key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                {/* Post header */}
                <div className="px-5 py-5 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-sky-50 text-xl border border-teal-100">
                        {post.emoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            post.category === "trending" ? "bg-orange-50 text-orange-600 border border-orange-100" :
                            post.category === "techniques" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                            post.category === "business" ? "bg-green-50 text-green-600 border border-green-100" :
                            post.category === "news" ? "bg-purple-50 text-purple-600 border border-purple-100" :
                            "bg-teal-50 text-teal-600 border border-teal-100"
                          }`}>
                            {CATEGORIES.find(c => c.id === post.category)?.label ?? post.category}
                          </span>
                          <span className="text-xs text-slate-400">{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="mt-1 text-base font-bold text-[#1a2744] sm:text-lg">{post.title}</h3>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Post footer */}
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 sm:px-6">
                  <button
                    type="button"
                    onClick={() => void handleExpandPost(post.id)}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-[#0d9488]"
                  >
                    <span>💬</span>
                    <span>{post.blueroom_comments?.[0]?.count ?? 0} comment{(post.blueroom_comments?.[0]?.count ?? 0) !== 1 ? "s" : ""}</span>
                    <span className="text-slate-300">{expandedPost === post.id ? "▲" : "▼"}</span>
                  </button>
                  <span className="text-xs text-slate-400">AdonisBlue Team</span>
                </div>

                {/* Comments section */}
                {expandedPost === post.id && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
                    {/* Existing comments */}
                    <div className="space-y-3 mb-4">
                      {(comments[post.id] ?? []).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">No comments yet — be the first! 💙</p>
                      ) : (
                        (comments[post.id] ?? []).map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                              {comment.nurse_name?.charAt(0)?.toUpperCase() ?? "N"}
                            </div>
                            <div className="flex-1 rounded-xl bg-white border border-slate-200 px-3 py-2">
                              <p className="text-xs font-semibold text-[#1a2744]">{comment.nurse_name ?? "Nurse"}</p>
                              <p className="text-xs leading-relaxed text-slate-600 mt-0.5">{comment.message}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add comment */}
                    <div className="flex gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white">
                        {nurseName?.charAt(0)?.toUpperCase() ?? "N"}
                      </div>
                      <div className="flex flex-1 gap-2">
                        <input
                          value={commentText[post.id] ?? ""}
                          onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") void handleSubmitComment(post.id); }}
                          placeholder="Share your thoughts…"
                          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20"
                        />
                        <button
                          type="button"
                          disabled={commentLoading === post.id || !commentText[post.id]?.trim()}
                          onClick={() => void handleSubmitComment(post.id)}
                          className="shrink-0 rounded-full bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                        >
                          {commentLoading === post.id ? "…" : "Post"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
