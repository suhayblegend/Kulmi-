import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, ArrowLeft, BookOpen, Calendar } from 'lucide-react';
import { listPublishedPosts, type BlogPost } from '../lib/db';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function Blog({ onBack }: { onBack: () => void }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<BlogPost | null>(null);

  useEffect(() => {
    listPublishedPosts().then(setPosts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Reading view
  if (open) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto py-8 px-1">
        <button onClick={() => { setOpen(null); window.scrollTo(0, 0); }} className="flex items-center gap-2 text-sm font-medium text-[#8B7355] hover:text-[#1B4332] mb-8">
          <ArrowLeft className="w-4 h-4" /> All articles
        </button>
        <article className="bg-white border border-[#E5E0D8] rounded-3xl p-7 md:p-10 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs text-[#8B7355] mb-3"><Calendar className="w-3.5 h-3.5" /> {fmtDate(open.created_at)}</p>
          <h1 className="font-serif text-3xl text-[#1B4332] mb-6 leading-snug">{open.title}</h1>
          <div className="text-[15px] text-[#2D2926] leading-[1.9] whitespace-pre-wrap font-serif">{open.content}</div>
        </article>
      </motion.div>
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
              onClick={() => { setOpen(p); window.scrollTo(0, 0); }}
              className="w-full text-left bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm hover:border-[#1B4332]/40 hover:shadow transition-all"
            >
              <p className="flex items-center gap-1.5 text-[11px] text-[#8B7355] mb-2"><Calendar className="w-3 h-3" /> {fmtDate(p.created_at)}</p>
              <h2 className="font-serif text-xl text-[#1B4332] mb-1.5 leading-snug">{p.title}</h2>
              {p.excerpt && <p className="text-sm text-[#5C574F] leading-relaxed line-clamp-2">{p.excerpt}</p>}
              <p className="text-sm font-medium text-[#1B4332] mt-3">Read →</p>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
