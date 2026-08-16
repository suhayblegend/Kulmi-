import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, ArrowLeft, BookOpen, Calendar, Clock, Share2, Check } from 'lucide-react';
import { listPublishedPosts, getPostReactions, reactToPost, type BlogPost } from '../lib/db';

const REACTIONS: { key: 'love' | 'ameen' | 'helpful'; emoji: string; label: string }[] = [
  { key: 'love', emoji: '❤️', label: 'Love it' },
  { key: 'ameen', emoji: '🤲', label: 'Ameen' },
  { key: 'helpful', emoji: '💡', label: 'Helpful' },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// ~200 words per minute, minimum 1.
const readMins = (text: string) => Math.max(1, Math.round((text || '').trim().split(/\s+/).filter(Boolean).length / 200));

export function Blog({ onBack }: { onBack: () => void }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<BlogPost | null>(null);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());

  const loadReactions = (postId: string) => {
    getPostReactions(postId).then(setReactions).catch(() => setReactions({}));
    try {
      const raw = localStorage.getItem(`kulmi_reacted_${postId}`);
      setMyReactions(new Set(raw ? JSON.parse(raw) : []));
    } catch { setMyReactions(new Set()); }
  };

  const react = async (postId: string, key: 'love' | 'ameen' | 'helpful') => {
    if (myReactions.has(key)) return; // one of each per reader (this browser)
    setReactions((r) => ({ ...r, [key]: (r[key] || 0) + 1 }));
    const next = new Set(myReactions).add(key);
    setMyReactions(next);
    try { localStorage.setItem(`kulmi_reacted_${postId}`, JSON.stringify([...next])); } catch { /* ignore */ }
    try { await reactToPost(postId, key); } catch { /* count is best-effort */ }
  };

  const openPost = (p: BlogPost) => {
    setOpen(p);
    loadReactions(p.id);
    window.history.replaceState({}, '', `/blog?post=${p.id}`);
    window.scrollTo(0, 0);
  };
  const closePost = () => {
    setOpen(null);
    window.history.replaceState({}, '', '/blog');
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    listPublishedPosts()
      .then((list) => {
        setPosts(list);
        // Deep link: /blog?post=<id> opens that article directly (for shares).
        const id = new URLSearchParams(window.location.search).get('post');
        if (id) {
          const p = list.find((x) => x.id === id);
          if (p) { setOpen(p); loadReactions(p.id); window.scrollTo(0, 0); }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Reading progress bar (only while an article is open).
  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [open]);

  const share = async (p: BlogPost) => {
    const url = `https://kulmi.uk/blog?post=${p.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.title, text: p.excerpt || 'Read on Kulmi', url });
        return;
      }
    } catch { /* user cancelled share sheet */ return; }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // Reading view
  if (open) {
    return (
      <>
        {/* Reading progress bar */}
        <div className="fixed top-0 left-0 right-0 h-1 z-[60] bg-transparent">
          <div className="h-full bg-[#1B4332] transition-[width] duration-75" style={{ width: `${progress}%` }} />
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto py-8 px-1">
          <div className="flex items-center justify-between mb-8">
            <button onClick={closePost} className="flex items-center gap-2 text-sm font-medium text-[#8B7355] hover:text-[#1B4332]">
              <ArrowLeft className="w-4 h-4" /> All articles
            </button>
            <button onClick={() => share(open)} className="flex items-center gap-1.5 text-sm font-medium text-[#1B4332] border border-[#E5E0D8] px-3 py-1.5 rounded-lg hover:bg-[#FDFBF7] transition-colors">
              {copied ? <><Check className="w-4 h-4 text-green-600" /> Copied</> : <><Share2 className="w-4 h-4" /> Share</>}
            </button>
          </div>
          <article className="bg-white border border-[#E5E0D8] rounded-3xl overflow-hidden shadow-sm">
            {open.image_url && (
              <img src={open.image_url} alt="" className="w-full h-56 md:h-72 object-cover" />
            )}
            <div className="p-7 md:p-10">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8B7355] mb-3">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {fmtDate(open.created_at)}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {readMins(open.content)} min read</span>
              </div>
              <h1 className="font-serif text-3xl text-[#1B4332] mb-6 leading-snug">{open.title}</h1>
              <div className="text-[15px] text-[#2D2926] leading-[1.9] whitespace-pre-wrap font-serif">{open.content}</div>

              {/* Reactions */}
              <div className="mt-8 pt-6 border-t border-[#F0EEE8]">
                <p className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-3">Did this benefit you?</p>
                <div className="flex flex-wrap gap-2.5">
                  {REACTIONS.map((r) => {
                    const reacted = myReactions.has(r.key);
                    const n = reactions[r.key] || 0;
                    return (
                      <button
                        key={r.key}
                        onClick={() => react(open.id, r.key)}
                        disabled={reacted}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition-colors ${reacted ? 'bg-[#E8F3ED] border-[#1B4332]/30 text-[#1B4332] font-medium' : 'bg-white border-[#E5E0D8] text-[#5C574F] hover:border-[#1B4332]/40'}`}
                      >
                        <span className="text-base leading-none">{r.emoji}</span>
                        <span>{r.label}</span>
                        {n > 0 && <span className="text-xs text-[#8B7355] tabular-nums">{n}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </article>

          <div className="mt-8 text-center">
            <button onClick={() => share(open)} className="inline-flex items-center gap-2 bg-[#1B4332] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#143326] transition-colors">
              {copied ? <><Check className="w-4 h-4" /> Link copied</> : <><Share2 className="w-4 h-4" /> Share this article</>}
            </button>
            <p className="text-xs text-[#8B7355] mt-3">Share beneficial knowledge — it is a continuing reward, insha'Allah.</p>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto py-8 px-1">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-[#8B7355] hover:text-[#1B4332] mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-[#1B4332] text-white flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-7 h-7" />
        </div>
        <h1 className="font-serif text-3xl text-[#1B4332] italic mb-2">The Kulmi Journal</h1>
        <p className="text-[#8B7355] text-sm">Honest writing on marriage, deen &amp; family.</p>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-[#8B7355]"><Loader2 className="w-7 h-7 animate-spin" /></div>
      ) : posts.length === 0 ? (
        <div className="bg-white border border-[#E5E0D8] rounded-3xl py-16 px-8 text-center">
          <p className="font-serif italic text-lg text-[#1B4332] mb-2">First articles coming soon, insha'Allah</p>
          <p className="text-sm text-[#8B7355]">Guidance on marriage, compatibility and family — written for our community.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <button
              key={p.id}
              onClick={() => openPost(p)}
              className="w-full text-left bg-white border border-[#E5E0D8] rounded-2xl overflow-hidden shadow-sm hover:border-[#1B4332]/40 hover:shadow transition-all"
            >
              {p.image_url && <img src={p.image_url} alt="" className="w-full h-40 object-cover" />}
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8B7355] mb-2">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {fmtDate(p.created_at)}</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {readMins(p.content)} min read</span>
                </div>
                <h2 className="font-serif text-xl text-[#1B4332] mb-1.5 leading-snug">{p.title}</h2>
                {p.excerpt && <p className="text-sm text-[#5C574F] leading-relaxed line-clamp-2">{p.excerpt}</p>}
                <p className="text-sm font-medium text-[#1B4332] mt-3">Read →</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
