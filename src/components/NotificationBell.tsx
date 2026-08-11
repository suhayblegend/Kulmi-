import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Heart, Mail, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  listNotifications,
  markNotificationsRead,
  getCurrentUserId,
  type AppNotification,
} from '../lib/db';

const iconFor = (type: string) => {
  if (type === 'match') return <Heart className="w-4 h-4 text-[#1B4332]" />;
  if (type === 'message') return <MessageCircle className="w-4 h-4 text-[#1B4332]" />;
  return <Mail className="w-4 h-4 text-[#1B4332]" />;
};

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export function NotificationBell({ onNavigate }: { onNavigate: (link: string) => void }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  const load = async () => setItems(await listNotifications());

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      await load();
      const uid = await getCurrentUserId();
      if (!uid || !active) return;
      channel = supabase
        .channel(`notifications:${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          (payload) => setItems((prev) => [payload.new as AppNotification, ...prev].slice(0, 30))
        )
        .subscribe();
    })();
    return () => { active = false; channel?.unsubscribe(); };
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      try { await markNotificationsRead(); } catch { /* non-critical */ }
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={toggle}
        className="relative w-10 h-10 rounded-full border border-[#E5E0D8] flex items-center justify-center bg-white text-[#1B4332] hover:bg-[#F0EEE8] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-[#E5E0D8] rounded-2xl shadow-xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-[#E5E0D8] bg-[#FDFBF7]">
              <p className="font-serif text-[#1B4332] text-lg">Notifications</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-[#8B7355] text-center py-10 px-4">No notifications yet.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { setOpen(false); if (n.link) onNavigate(n.link); }}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 border-b border-[#F0EEE8] hover:bg-[#FDFBF7] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#F0EEE8] flex items-center justify-center shrink-0 mt-0.5">
                      {iconFor(n.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[#2D2926] leading-snug">{n.body}</p>
                      <p className="text-[10px] text-[#8B7355] uppercase tracking-wide mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
