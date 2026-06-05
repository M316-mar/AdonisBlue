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
  { id: "all", label: "All Posts", emoji: "🏠" },
  { id: "trending", label: "Trending", emoji: "🔥" },
  { id: "techniques", label: "Techniques", emoji: "💉" },
  { id: "business", label: "Business", emoji: "📈" },
  { id: "news", label: "News", emoji: "📰" },
  { id: "general", label: "General", emoji: "💙" },
];

const CATEGORY_COLORS: Record<string, string> = {
  trending: "bg-orange-100 text-orange-700",
  techniques: "bg-blue-100 text-blue-700",
  business: "bg-green-100 text-green-700",
  news: "bg-purple-100 text-purple-700",
  general: "bg-teal-100 text-teal-700",
};

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
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) { router.replace("/auth"); return; }
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
    if (expandedPost === postId) { setExpandedPost(null); return; }
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
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, blueroom_comments: [{ count: (p.blueroom_comments?.[0]?.count ?? 0) + 1 }] } : p));
    }
    setCommentLoading(null);
  }, [commentText, nurseId, nurseName]);

  const filteredPosts = activeCategory === "all" ? posts : posts.filter(p => p.category === activeCategory);
  const firstName = nurseName.split(" ")[0] ?? nurseName;
  const initials = nurseName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5]">
        <p className="text-sm text-slate-500">Loading The Blue Room…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans antialiased">

      {/* Facebook-style top nav */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-[#1a2744]">The Blue Room</h1>
              <p className="text-xs text-slate-400">Nurse injector community 💙</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0d9488] text-xs font-bold text-white">
              {initials}
            </div>
            <span className="hidden text-sm font-semibold text-[#1a2744] sm:block">{firstName}</span>
            <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-6">

        {/* Left sidebar — like Facebook */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-20 space-y-2">
            <p className="px-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Categories</p>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  activeCategory === cat.id
                    ? "bg-teal-50 text-[#0d9488]"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${
                  activeCategory === cat.id ? "bg-teal-100" : "bg-slate-100"
                }`}>{cat.emoji}</span>
                {cat.label}
              </button>
            ))}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-[#1a2744] mb-2">About The Blue Room</p>
              <p className="text-xs leading-relaxed text-slate-500">Your private community for nurse injectors. Share, learn, and grow together — all inside AdonisBlue 💙</p>
            </div>
          </div>
        </aside>

        {/* Main feed — like Facebook */}
        <main className="lg:col-span-9 space-y-4">

          {/* Mobile category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  activeCategory === cat.id
                    ? "bg-[#0d9488] text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Posts feed */}
          {filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <p className="text-4xl mb-3">💙</p>
              <p className="font-semibold text-[#1a2744]">No posts yet in this category</p>
              <p className="mt-1 text-sm text-slate-500">Check back soon — we post regularly!</p>
            </div>
          ) : (
            filteredPosts.map(post => (
              <div key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                {/* Post header — like Facebook post header */}
                <div className="flex items-start gap-3 px-4 pt-4 pb-3 sm:px-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a2744] to-[#0d9488] text-sm font-bold text-white">
                    AB
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#1a2744]">AdonisBlue</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CATEGORY_COLORS[post.category] ?? "bg-teal-100 text-teal-700"}`}>
                        {CATEGORIES.find(c => c.id === post.category)?.label ?? post.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{new Date(post.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <span className="text-2xl">{post.emoji}</span>
                </div>

                {/* Post content */}
                <div className="px-4 pb-3 sm:px-5">
                  <h3 className="text-base font-bold text-[#1a2744] mb-2">{post.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Like + Comment count bar — like Facebook */}
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 sm:px-5">
                  <div className="flex items-center gap-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0d9488] text-[10px] text-white">💙</span>
                    <span className="text-xs text-slate-500">{liked[post.id] ? "You and others" : "Be the first to like this"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleExpandPost(post.id)}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    {post.blueroom_comments?.[0]?.count ?? 0} comment{(post.blueroom_comments?.[0]?.count ?? 0) !== 1 ? "s" : ""}
                  </button>
                </div>

                {/* Like + Comment buttons — exactly like Facebook */}
                <div className="flex border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setLiked(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                    className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold transition hover:bg-slate-50 ${liked[post.id] ? "text-[#0d9488]" : "text-slate-500"}`}
                  >
                    <span>{liked[post.id] ? "💙" : "🤍"}</span> Like
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExpandPost(post.id)}
                    className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                  >
                    <span>💬</span> Comment
                  </button>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(`https://adonisblue.io/blueroom`)}
                    className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                  >
                    <span>↗️</span> Share
                  </button>
                </div>

                {/* Comments section */}
                {expandedPost === post.id && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
                    <div className="space-y-3 mb-4">
                      {(comments[post.id] ?? []).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">No comments yet — be the first! 💙</p>
                      ) : (
                        (comments[post.id] ?? []).map(comment => (
                          <div key={comment.id} className="flex gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-xs font-bold text-white">
                              {comment.nurse_name?.charAt(0)?.toUpperCase() ?? "N"}
                            </div>
                            <div className="flex-1">
                              <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2">
                                <p className="text-xs font-bold text-[#1a2744]">{comment.nurse_name ?? "Nurse"}</p>
                                <p className="text-xs leading-relaxed text-slate-700 mt-0.5">{comment.message}</p>
                              </div>
                              <p className="mt-1 px-2 text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add comment — like Facebook */}
                    <div className="flex gap-2 items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-xs font-bold text-white">
                        {initials}
                      </div>
                      <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
                        <input
                          value={commentText[post.id] ?? ""}
                          onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") void handleSubmitComment(post.id); }}
                          placeholder="Write a comment…"
                          className="min-w-0 flex-1 bg-transparent text-xs outline-none text-slate-800 placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          disabled={commentLoading === post.id || !commentText[post.id]?.trim()}
                          onClick={() => void handleSubmitComment(post.id)}
                          className="shrink-0 text-[#0d9488] font-bold text-xs disabled:opacity-40 transition hover:text-teal-700"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  );
}
