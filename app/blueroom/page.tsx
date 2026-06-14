"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const REACTIONS = ["👍", "❤️", "🔥", "💉"] as const;
type Reaction = (typeof REACTIONS)[number];
type PostReactions = Record<string, number>; // emoji -> count

type Notification = {
  id: string;
  type: string;
  post_id: string | null;
  post_title: string | null;
  actor_name: string | null;
  is_read: boolean;
  created_at: string;
};

type Post = {
  id: string;
  title: string;
  content: string;
  category: string;
  emoji: string;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
  media_url?: string | null;
  media_type?: string | null;
  blueroom_comments: { count: number }[];
  is_pinned?: boolean;
  view_count?: number;
};

type Comment = {
  id: string;
  nurse_id: string;
  nurse_name: string;
  message: string;
  created_at: string;
  media_url?: string | null;
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

interface ReactionResult {
  postId: string;
  reactions: PostReactions;
  myReaction: Reaction | null;
}

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
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState<string | null>(null);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<{id:string;url:string;preview:string}[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);
  const [commentReactions, setCommentReactions] = useState<Record<string, {likes: number, dislikes: number, myReaction: string | null}>>({});
  const [commentMedia, setCommentMedia] = useState<Record<string, File | null>>({});
  const [commentMediaPreview, setCommentMediaPreview] = useState<Record<string, string | null>>({});
  const [newPostText, setNewPostText] = useState("");
  const [newPostCategory, setNewPostCategory] = useState("general");
  const [postBoxOpen, setPostBoxOpen] = useState(false);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // New state
  const [postReactions, setPostReactions] = useState<Record<string, PostReactions>>({});
  const [myPostReaction, setMyPostReaction] = useState<Record<string, Reaction | null>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState<string | null>(null);

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
        const json = await res.json() as { posts?: Post[] };
        setPosts(json.posts ?? []);

        // Fetch reactions for all posts
        const reactionFetches = (json.posts ?? []).map(async (p: Post): Promise<ReactionResult | null> => {
          const r = await fetch(`/api/blueroom/post-reactions?post_id=${p.id}&nurse_id=${user.id}`);
          if (r.ok) {
            const rj = await r.json() as { reactions: PostReactions; my_reaction: Reaction | null };
            return { postId: p.id, reactions: rj.reactions, myReaction: rj.my_reaction };
          }
          return null;
        });
        const reactionResults = await Promise.all(reactionFetches);
        const reactionsMap: Record<string, PostReactions> = {};
        const myReactionsMap: Record<string, Reaction | null> = {};
        reactionResults.forEach(r => {
          if (r) {
            reactionsMap[r.postId] = r.reactions;
            myReactionsMap[r.postId] = r.myReaction;
          }
        });
        setPostReactions(reactionsMap);
        setMyPostReaction(myReactionsMap);
      }

      // Fetch notifications
      const notifRes = await fetch(`/api/blueroom/notifications?nurse_id=${user.id}`);
      if (notifRes.ok) {
        const notifJson = await notifRes.json() as { notifications?: Notification[]; unread_count?: number };
        setNotifications(notifJson.notifications ?? []);
        setUnreadCount(notifJson.unread_count ?? 0);
      }

      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!showNotifications) return;
    function handleClick() { setShowNotifications(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNotifications]);

  const loadComments = useCallback(async (postId: string) => {
    if (comments[postId]) return;
    const res = await fetch(`/api/blueroom/comments?post_id=${postId}`);
    if (res.ok) {
      const json = await res.json() as { comments?: Comment[] };
      setComments(prev => ({ ...prev, [postId]: json.comments ?? [] }));
    }
  }, [comments]);

  const handleExpandPost = useCallback(async (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    await loadComments(postId);
    void fetch("/api/blueroom/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, nurse_id: nurseId }),
    });
  }, [expandedPost, loadComments, nurseId]);

  const handlePostReaction = useCallback(async (postId: string, reaction: Reaction) => {
    const res = await fetch("/api/blueroom/post-reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, nurse_id: nurseId, reaction }),
    });
    if (res.ok) {
      const json = await res.json() as { action: "added" | "removed" | "updated"; reaction: string };
      setMyPostReaction(prev => ({ ...prev, [postId]: json.action === "removed" ? null : reaction }));
      setPostReactions(prev => {
        const current = prev[postId] ?? {};
        const prevCount = current[reaction] ?? 0;
        if (json.action === "removed") {
          return { ...prev, [postId]: { ...current, [reaction]: Math.max(0, prevCount - 1) } };
        }
        if (json.action === "updated") {
          const oldReaction = myPostReaction[postId];
          const updated: PostReactions = { ...current, [reaction]: prevCount + 1 };
          if (oldReaction && oldReaction !== reaction) {
            updated[oldReaction] = Math.max(0, (current[oldReaction] ?? 0) - 1);
          }
          return { ...prev, [postId]: updated };
        }
        return { ...prev, [postId]: { ...current, [reaction]: prevCount + 1 } };
      });
    }
    setReactionPickerOpen(null);
  }, [nurseId, myPostReaction]);

  const handleMarkNotificationsRead = useCallback(async () => {
    setShowNotifications(true);
    setUnreadCount(0);
    await fetch("/api/blueroom/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nurse_id: nurseId }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [nurseId]);

  const handleSubmitComment = useCallback(async (postId: string) => {
    const message = commentText[postId]?.trim();
    const mediaFile = commentMedia[postId];
    if (!message && !mediaFile) return;
    setCommentLoading(postId);

    let mediaUrl: string | null = null;
    if (mediaFile) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const { createClient } = await import("@supabase/supabase-js");
          const sbWithAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
          );
          const ext = mediaFile.name.split(".").pop();
          const path = `comments/${nurseId}/${Date.now()}.${ext}`;
          const { error } = await sbWithAuth.storage
            .from("blueroom-media")
            .upload(path, mediaFile, { contentType: mediaFile.type });
          if (!error) {
            const { data: urlData } = sbWithAuth.storage
              .from("blueroom-media")
              .getPublicUrl(path);
            mediaUrl = urlData.publicUrl;
          }
        }
      } catch (e) {
        console.error("Comment media upload error:", e);
      }
    }

    const res = await fetch("/api/blueroom/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: postId,
        nurse_id: nurseId,
        nurse_name: nurseName,
        message: message || "",
        media_url: mediaUrl,
      }),
    });
    if (res.ok) {
      const json = await res.json() as { comment: Comment };
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), json.comment] }));
      setCommentText(prev => ({ ...prev, [postId]: "" }));
      setCommentMedia(prev => ({ ...prev, [postId]: null }));
      setCommentMediaPreview(prev => ({ ...prev, [postId]: null }));
      setShowEmojiPicker(null);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, blueroom_comments: [{ count: (p.blueroom_comments?.[0]?.count ?? 0) + 1 }] } : p));
    }
    setCommentLoading(null);
  }, [commentText, commentMedia, nurseId, nurseName]);

  const handleCommentReaction = useCallback(async (commentId: string, reaction: "like" | "dislike") => {
    const res = await fetch("/api/blueroom/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_id: commentId, nurse_id: nurseId, reaction }),
    });
    if (res.ok) {
      const json = await res.json() as { action: "added" | "removed" | "updated" };
      setCommentReactions(prev => {
        const current = prev[commentId] ?? { likes: 0, dislikes: 0, myReaction: null };
        const wasLike = current.myReaction === "like";
        const wasDislike = current.myReaction === "dislike";
        if (json.action === "removed") {
          return { ...prev, [commentId]: { likes: reaction === "like" ? Math.max(0, current.likes - 1) : current.likes, dislikes: reaction === "dislike" ? Math.max(0, current.dislikes - 1) : current.dislikes, myReaction: null } };
        } else if (json.action === "updated") {
          return { ...prev, [commentId]: { likes: reaction === "like" ? current.likes + 1 : Math.max(0, current.likes - (wasLike ? 1 : 0)), dislikes: reaction === "dislike" ? current.dislikes + 1 : Math.max(0, current.dislikes - (wasDislike ? 1 : 0)), myReaction: reaction } };
        } else {
          return { ...prev, [commentId]: { likes: reaction === "like" ? current.likes + 1 : current.likes, dislikes: reaction === "dislike" ? current.dislikes + 1 : current.dislikes, myReaction: reaction } };
        }
      });
    }
  }, [nurseId]);

  const searchGifs = useCallback(async (query: string) => {
    setGifLoading(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
      const searchTerm = query || "funny";
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(searchTerm)}&limit=12&rating=g`);
      const data = await res.json() as { data?: Array<{ id: string; images: { fixed_height: { url: string }; fixed_height_small: { url: string } } }> };
      setGifs((data.data ?? []).map(g => ({
        id: g.id,
        url: g.images.fixed_height.url,
        preview: g.images.fixed_height_small.url,
      })));
    } catch (e) {
      console.error("GIF search error:", e);
    }
    setGifLoading(false);
  }, []);

  const handleGifSelect = useCallback(async (postId: string, gifUrl: string) => {
    setCommentLoading(postId);
    const res = await fetch("/api/blueroom/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: postId,
        nurse_id: nurseId,
        nurse_name: nurseName,
        message: "",
        media_url: gifUrl,
      }),
    });
    if (res.ok) {
      const json = await res.json() as { comment: Comment };
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), json.comment] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, blueroom_comments: [{ count: (p.blueroom_comments?.[0]?.count ?? 0) + 1 }] } : p));
      setShowGifPicker(null);
      setGifs([]);
      setGifSearch("");
    }
    setCommentLoading(null);
  }, [nurseId, nurseName]);

  const handleDeleteComment = useCallback(async (postId: string, commentId: string, authorId: string) => {
    if (authorId !== nurseId) return;
    setDeletingComment(commentId);
    const res = await fetch("/api/blueroom/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_id: commentId, nurse_id: nurseId }),
    });
    if (res.ok) {
      setComments(prev => ({ ...prev, [postId]: (prev[postId] ?? []).filter(c => c.id !== commentId) }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, blueroom_comments: [{ count: Math.max(0, (p.blueroom_comments?.[0]?.count ?? 1) - 1) }] } : p));
    }
    setDeletingComment(null);
  }, [nurseId]);

  const handleSubmitPost = useCallback(async () => {
    if (!newPostText.trim() && !mediaFile) return;
    setPostSubmitting(true);
    let mediaUrl: string | null = null;
    let mediaMimeType: string | null = null;

    if (mediaFile) {
      setUploadingMedia(true);
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        void sb; // referenced for side-effects only
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const ext = mediaFile.name.split(".").pop();
          const path = `${nurseId}/${Date.now()}.${ext}`;
          const sbWithAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
          );
          const { error } = await sbWithAuth.storage
            .from("blueroom-media")
            .upload(path, mediaFile, { contentType: mediaFile.type });
          if (!error) {
            const { data: urlData } = sbWithAuth.storage
              .from("blueroom-media")
              .getPublicUrl(path);
            mediaUrl = urlData.publicUrl;
            mediaMimeType = mediaFile.type;
          }
        }
      } catch (e) {
        console.error("Upload error:", e);
      }
      setUploadingMedia(false);
    }

    const res = await fetch("/api/blueroom/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newPostText.slice(0, 80) || "Shared a photo",
        content: newPostText,
        category: newPostCategory,
        emoji: mediaType === "video" ? "🎥" : mediaType === "image" ? "📸" : "💙",
        author_id: nurseId,
        author_name: nurseName,
        media_url: mediaUrl,
        media_type: mediaMimeType,
      }),
    });
    if (res.ok) {
      const json = await res.json() as { post: Post };
      setPosts(prev => [{ ...json.post, blueroom_comments: [{ count: 0 }] }, ...prev]);
      setNewPostText("");
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType(null);
      setPostBoxOpen(false);
    }
    setPostSubmitting(false);
  }, [newPostText, newPostCategory, nurseId, nurseName, mediaFile, mediaType]);

  const handleMediaSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) return;
    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
  }, []);

  const filteredPosts = activeCategory === "all" ? posts : posts.filter(p => p.category === activeCategory);
  const firstName = nurseName.split(" ")[0] ?? nurseName;
  const initials = nurseName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  function detectCategory(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("trend") || lower.includes("popular") || lower.includes("everyone") || lower.includes("viral") || lower.includes("hot")) return "trending";
    if (lower.includes("technique") || lower.includes("how to") || lower.includes("tip") || lower.includes("inject") || lower.includes("cannula") || lower.includes("needle") || lower.includes("filler") || lower.includes("botox") || lower.includes("dissolve")) return "techniques";
    if (lower.includes("business") || lower.includes("client") || lower.includes("booking") || lower.includes("price") || lower.includes("marketing") || lower.includes("instagram") || lower.includes("income") || lower.includes("money") || lower.includes("grow")) return "business";
    if (lower.includes("news") || lower.includes("fda") || lower.includes("approved") || lower.includes("study") || lower.includes("research") || lower.includes("allergan") || lower.includes("galderma") || lower.includes("launch")) return "news";
    return "general";
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5]">
        <p className="text-sm text-slate-500">Loading The Blue Room…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans antialiased">

      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:gap-3">
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
            {/* Notification bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => void handleMarkNotificationsRead()}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {/* Notification dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-[#1a2744]">Notifications</p>
                    <button type="button" onClick={() => setShowNotifications(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-400">No notifications yet 🔔</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`border-b border-slate-50 px-4 py-3 ${!n.is_read ? "bg-blue-50" : ""}`}>
                          <p className="text-xs text-slate-700">
                            <span className="font-semibold">{n.actor_name ?? "Someone"}</span>{" "}
                            {n.type === "comment" ? "commented on" : "liked"}{" "}
                            <span className="font-semibold">&quot;{n.post_title ?? "your post"}&quot;</span>
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Avatar with online dot */}
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0d9488] text-xs font-bold text-white">
                {initials}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-400" />
            </div>
            <span className="hidden text-sm font-semibold text-[#1a2744] sm:block">{firstName}</span>
            <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-4 lg:grid lg:grid-cols-12 lg:gap-6">

        {/* Left sidebar */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-20 space-y-1">
            <p className="px-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Categories</p>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  activeCategory === cat.id ? "bg-teal-50 text-[#0d9488]" : "text-slate-700 hover:bg-slate-100"
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
              <p className="text-xs leading-relaxed text-slate-500">Your private community for nurse injectors. Share, learn, and grow together 💙</p>
            </div>
          </div>
        </aside>

        {/* Main feed */}
        <main className="lg:col-span-9 space-y-3">

          {/* Mobile categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  activeCategory === cat.id ? "bg-[#0d9488] text-white" : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Create post box — like Facebook */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-sm font-bold text-white">
                {initials}
              </div>
              <button
                type="button"
                onClick={() => setPostBoxOpen(true)}
                className="flex-1 rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-left text-sm text-slate-500 transition hover:bg-slate-200"
              >
                What&apos;s on your mind, {firstName}?
              </button>
            </div>
            {postBoxOpen && (
              <div className="mt-4 space-y-3">
                <textarea
                  value={newPostText}
                  onChange={e => {
                    setNewPostText(e.target.value);
                    if (e.target.value.length > 20) {
                      setNewPostCategory(detectCategory(e.target.value));
                    }
                  }}
                  placeholder={`What's on your mind, ${firstName}? Share a tip, question, or update with the community 💙`}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20 placeholder:text-slate-400"
                  autoFocus
                />
                {mediaPreview && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    {mediaType === "video" ? (
                      <video src={mediaPreview} controls className="w-full max-h-64 rounded-xl" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaPreview} alt="Preview" className="w-full max-h-64 object-cover rounded-xl" />
                    )}
                    <button
                      type="button"
                      onClick={() => { setMediaFile(null); setMediaPreview(null); setMediaType(null); }}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
                    >✕</button>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <select
                      value={newPostCategory}
                      onChange={e => setNewPostCategory(e.target.value)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none"
                    >
                      <option value="general">💙 General</option>
                      <option value="trending">🔥 Trending</option>
                      <option value="techniques">💉 Techniques</option>
                      <option value="business">📈 Business</option>
                      <option value="news">📰 News</option>
                    </select>
                    <p className="text-xs text-slate-400">✨ Category auto-detected based on your post</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 flex items-center gap-1">
                        📸 Photo
                        <input type="file" accept="image/*" className="hidden" onChange={handleMediaSelect} />
                      </label>
                      <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 flex items-center gap-1">
                        🎥 Video
                        <input type="file" accept="video/*" className="hidden" onChange={handleMediaSelect} />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPostBoxOpen(false); setNewPostText(""); }}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={postSubmitting || (!newPostText.trim() && !mediaFile)}
                      onClick={() => void handleSubmitPost()}
                      className="rounded-full bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      {postSubmitting ? (uploadingMedia ? "Uploading…" : "Posting…") : "Post"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Posts feed */}
          {filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <p className="text-4xl mb-3">💙</p>
              <p className="font-semibold text-[#1a2744]">No posts yet — be the first!</p>
              <p className="mt-1 text-sm text-slate-500">Share something with the community above 💙</p>
            </div>
          ) : (
            filteredPosts.map(post => {
              const isAdonisBlue = !post.author_id || post.author_name === "AdonisBlue";
              const authorInitials = isAdonisBlue ? "AB" : (post.author_name ?? "N").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
              return (
                <div key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {/* Post header */}
                  <div className="flex items-start gap-2 px-3 pt-3 pb-2 sm:gap-3 sm:px-5 sm:pt-4 sm:pb-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${isAdonisBlue ? "bg-gradient-to-br from-[#1a2744] to-[#0d9488]" : "bg-[#0d9488]"}`}>
                      {authorInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-[#1a2744]">{isAdonisBlue ? "AdonisBlue" : (post.author_name ?? "Nurse")}</p>
                        {isAdonisBlue && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">Official</span>}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CATEGORY_COLORS[post.category] ?? "bg-teal-100 text-teal-700"}`}>
                          {CATEGORIES.find(c => c.id === post.category)?.label ?? post.category}
                        </span>
                        {post.is_pinned && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">📌 Pinned</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{new Date(post.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                    </div>
                    <span className="text-2xl">{post.emoji}</span>
                  </div>

                  {/* Post content */}
                  <div className="px-3 pb-3 sm:px-5">
                    <h3 className="text-base font-bold text-[#1a2744] mb-2">{post.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{post.content}</p>
                  </div>

                  {post.media_url && (
                    <div className="px-3 pb-3 sm:px-5">
                      {post.media_type?.startsWith("video") ? (
                        <video src={post.media_url} controls className="w-full rounded-xl max-h-96 bg-black" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.media_url} alt="" className="w-full rounded-xl max-h-96 object-cover" />
                      )}
                    </div>
                  )}

                  {/* Reaction counts bar */}
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-1.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {REACTIONS.map(emoji => {
                        const count = (postReactions[post.id] ?? {})[emoji] ?? 0;
                        if (count === 0) return null;
                        return (
                          <span key={emoji} className="flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">
                            {emoji} <span className="text-slate-600 font-medium">{count}</span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3">
                      {(post.view_count ?? 0) > 0 && (
                        <span className="text-[10px] text-slate-400">👁 {post.view_count} view{post.view_count !== 1 ? "s" : ""}</span>
                      )}
                      <button type="button" onClick={() => void handleExpandPost(post.id)} className="text-[10px] text-slate-400 hover:underline">
                        {post.blueroom_comments?.[0]?.count ?? 0} comment{(post.blueroom_comments?.[0]?.count ?? 0) !== 1 ? "s" : ""}
                      </button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="relative flex border-t border-slate-100">
                    {/* React button with picker */}
                    <div className="relative flex-1">
                      <button
                        type="button"
                        onClick={() => setReactionPickerOpen(prev => prev === post.id ? null : post.id)}
                        className={`flex w-full min-h-[44px] items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition hover:bg-slate-50 sm:text-sm sm:gap-2 ${myPostReaction[post.id] ? "text-[#0d9488]" : "text-slate-500"}`}
                        style={{ touchAction: "manipulation" }}
                      >
                        <span>{myPostReaction[post.id] ?? "👍"}</span>
                        <span>{myPostReaction[post.id] ? "Liked" : "Like"}</span>
                      </button>
                      {reactionPickerOpen === post.id && (
                        <div className="absolute bottom-full left-0 z-50 mb-1 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-xl">
                          {REACTIONS.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => void handlePostReaction(post.id, emoji)}
                              className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:scale-125 hover:bg-slate-100 active:scale-95"
                              style={{ touchAction: "manipulation" }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleExpandPost(post.id)}
                      className="flex flex-1 min-h-[44px] items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 sm:text-sm sm:gap-2"
                      style={{ touchAction: "manipulation" }}
                    >
                      <span>💬</span> Comment
                    </button>
                  </div>

                  {/* Comments */}
                  {expandedPost === post.id && (
                    <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 sm:px-5 sm:py-4">
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
                                  {comment.media_url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={comment.media_url} alt="" className="mt-2 max-h-40 rounded-xl object-cover border border-slate-100" />
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-3 px-2">
                                  <p className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleDateString()}</p>
                                  <button
                                    type="button"
                                    onClick={() => void handleCommentReaction(comment.id, "like")}
                                    className={`flex items-center gap-1 text-[10px] font-semibold transition ${commentReactions[comment.id]?.myReaction === "like" ? "text-[#0d9488]" : "text-slate-400 hover:text-[#0d9488]"}`}
                                  >
                                    👍 {commentReactions[comment.id]?.likes ?? 0}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleCommentReaction(comment.id, "dislike")}
                                    className={`flex items-center gap-1 text-[10px] font-semibold transition ${commentReactions[comment.id]?.myReaction === "dislike" ? "text-red-500" : "text-slate-400 hover:text-red-400"}`}
                                  >
                                    👎 {commentReactions[comment.id]?.dislikes ?? 0}
                                  </button>
                                  {comment.nurse_id === nurseId && (
                                    <button
                                      type="button"
                                      disabled={deletingComment === comment.id}
                                      onClick={() => void handleDeleteComment(post.id, comment.id, comment.nurse_id)}
                                      className="px-2 text-[10px] text-red-400 hover:text-red-600 transition disabled:opacity-40"
                                    >
                                      {deletingComment === comment.id ? "Deleting…" : "Delete"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="space-y-2">
                        {/* Media preview */}
                        {commentMediaPreview[post.id] && (
                          <div className="relative inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={commentMediaPreview[post.id]!} alt="" className="h-20 w-20 rounded-xl object-cover border border-slate-200" />
                            <button
                              type="button"
                              onClick={() => {
                                setCommentMedia(prev => ({ ...prev, [post.id]: null }));
                                setCommentMediaPreview(prev => ({ ...prev, [post.id]: null }));
                              }}
                              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px]"
                            >✕</button>
                          </div>
                        )}

                        {/* Emoji picker */}
                        {showEmojiPicker === post.id && (
                          <div className="absolute z-50">
                            <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                setCommentText(prev => ({ ...prev, [post.id]: (prev[post.id] ?? "") + emojiData.emoji }));
                                setShowEmojiPicker(null);
                              }}
                              height={350}
                              width={300}
                            />
                          </div>
                        )}

                        {showGifPicker === post.id && (
                          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-lg max-w-xs">
                            <div className="flex gap-1.5 mb-2">
                              <input
                                value={gifSearch}
                                onChange={e => setGifSearch(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") void searchGifs(gifSearch); }}
                                placeholder="Search GIFs…"
                                className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-800 outline-none focus:border-[#0d9488] placeholder:text-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() => void searchGifs(gifSearch)}
                                className="rounded-full bg-[#0d9488] px-2.5 py-1 text-xs font-bold text-white"
                              >
                                Go
                              </button>
                            </div>
                            {gifLoading ? (
                              <p className="text-center text-xs text-slate-400 py-2">Loading…</p>
                            ) : (
                              <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto">
                                {gifs.map(gif => (
                                  <button
                                    key={gif.id}
                                    type="button"
                                    onClick={() => void handleGifSelect(post.id, gif.url)}
                                    className="overflow-hidden rounded-lg hover:opacity-80 transition"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={gif.preview} alt="GIF" className="w-full h-12 object-cover" />
                                  </button>
                                ))}
                              </div>
                            )}
                            <p className="mt-1 text-center text-[9px] text-slate-400">Powered by GIPHY</p>
                          </div>
                        )}

                        <div className="flex gap-2 items-center">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-xs font-bold text-white">
                            {initials}
                          </div>
                          <div className="flex flex-1 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2">
                            <input
                              value={commentText[post.id] ?? ""}
                              onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSubmitComment(post.id); } }}
                              placeholder="Write a comment…"
                              className="min-w-0 flex-1 bg-transparent text-xs outline-none text-slate-800 placeholder:text-slate-400"
                            />
                            {/* Emoji button */}
                            <button
                              type="button"
                              onClick={() => setShowEmojiPicker(prev => prev === post.id ? null : post.id)}
                              className="shrink-0 text-slate-400 hover:text-slate-600 transition text-sm"
                            >😊</button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowGifPicker(prev => prev === post.id ? null : post.id);
                                if (showGifPicker !== post.id) void searchGifs("funny");
                              }}
                              className="shrink-0 rounded border border-slate-300 px-1 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 transition"
                            >
                              GIF
                            </button>
                            {/* Photo button */}
                            <label className="shrink-0 cursor-pointer text-slate-400 hover:text-slate-600 transition text-sm">
                              📸
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setCommentMedia(prev => ({ ...prev, [post.id]: file }));
                                  setCommentMediaPreview(prev => ({ ...prev, [post.id]: URL.createObjectURL(file) }));
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              disabled={commentLoading === post.id || (!commentText[post.id]?.trim() && !commentMedia[post.id])}
                              onClick={() => void handleSubmitComment(post.id)}
                              className="shrink-0 text-[#0d9488] font-bold text-xs disabled:opacity-40 transition hover:text-teal-700"
                            >
                              Post
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}
