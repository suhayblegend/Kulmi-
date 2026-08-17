import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Heart, BadgeCheck, Hourglass, Clock } from 'lucide-react';
import { listChats, avatarFor, type ChatSummary } from '../lib/db';
import { cacheGet, cacheSet } from '../lib/cache';
import { ListRowSkeleton } from './ui/Skeleton';
import { KulmiPlus } from './ui/KulmiPlus';

interface ChatsProps {
  onSelectChat: (chatId: string) => void;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function iceLeft(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'soon';
  const h = Math.floor(ms / 3600_000);
  return h >= 1 ? `${h}h` : `${Math.floor(ms / 60_000)}m`;
}

export function Chats({ onSelectChat }: ChatsProps) {
  const cached = cacheGet<ChatSummary[]>('chats');
  const [chats, setChats] = useState<ChatSummary[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached); // instant if we've loaded before
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    listChats()
      .then((data) => { if (!active) return; setChats(data); cacheSet('chats', data); })
      .catch(() => { /* keep showing cached data on a network blip */ })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? chats.filter((c) =>
        `${c.partner.first_name ?? ''} ${c.partner.location ?? ''} ${c.partner.city ?? ''} ${c.lastMessage ?? ''}`
          .toLowerCase()
          .includes(q)
      )
    : chats;

  return (
    <div className="w-full max-w-3xl mx-auto h-[calc(100dvh-12rem)] sm:h-[80vh] flex flex-col bg-white rounded-3xl border border-[#E5E0D8] shadow-sm overflow-hidden sm:mt-4">
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-[#E5E0D8] bg-[#FDFBF7]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif text-[#1B4332]">Messages</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7355]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search matches or messages..."
            className="w-full bg-white border border-[#E5E0D8] rounded-full py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-[#1B4332] transition-colors"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto bg-white p-4">
        {loading ? (
          <div className="divide-y divide-[#F0EEE8]">
            {Array.from({ length: 5 }).map((_, i) => <ListRowSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {filtered.map((chat, idx) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => onSelectChat(chat.id)}
                className={`flex items-center gap-4 p-4 rounded-2xl hover:bg-[#FDFBF7] cursor-pointer transition-colors group relative ${chat.status === 'expired' ? 'opacity-60' : ''}`}
              >
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#E5E0D8] group-hover:border-[#1B4332] transition-colors">
                    <img src={avatarFor(chat.partner)} alt={chat.partner.first_name || ''} className="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-serif font-medium text-lg text-[#1B4332] truncate pr-4 flex items-center gap-1.5">
                      <span className="truncate">{chat.partner.first_name}{chat.partner.age ? `, ${chat.partner.age}` : ''}</span>
                      {(chat.partner.verification_status === 'verified' || chat.partner.photo_verified) && (
                        <BadgeCheck className="w-4 h-4 text-[#1B4332] shrink-0" />
                      )}
                      {(chat.partner as any).is_premium && <KulmiPlus />}
                    </h3>
                    <span className="text-xs whitespace-nowrap text-[#8B7355]">{timeAgo(chat.lastMessageAt)}</span>
                  </div>
                  <p className="text-sm truncate text-[#5C574F]">{chat.lastMessage}</p>
                  {chat.status === 'expired' ? (
                    <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-[#8B7355] bg-[#F0EEE8] border border-[#E5E0D8] rounded-full px-2 py-0.5">
                      <Clock className="w-3 h-3" /> Closed — went quiet
                    </span>
                  ) : chat.iceDeadline ? (
                    <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      <Hourglass className="w-3 h-3" /> Say salaam · {iceLeft(chat.iceDeadline)} left
                    </span>
                  ) : (chat.partner.location || chat.partner.city) ? (
                    <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mt-2">
                      {chat.partner.location || chat.partner.city}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center p-8">
                <p className="text-[#8B7355] text-sm">You have no active chats yet.</p>
              </div>
            )}

            {/* Bottom Info */}
            <div className="mt-8 text-center p-8 bg-[#FDFBF7] rounded-2xl border border-dashed border-[#E5E0D8]">
              <Heart className="w-8 h-8 text-[#E5E0D8] mx-auto mb-3" />
              <p className="text-sm text-[#5C574F] font-medium">Keep discovering to find more matches!</p>
              <p className="text-xs text-[#8B7355] mt-1">Remember to keep conversations respectful and purposeful.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
