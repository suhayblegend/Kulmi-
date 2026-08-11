import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Heart, Loader2 } from 'lucide-react';
import { listChats, avatarFor, type ChatSummary } from '../lib/db';

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

export function Chats({ onSelectChat }: ChatsProps) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    listChats()
      .then((data) => active && setChats(data))
      .catch(() => active && setChats([]))
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
    <div className="w-full max-w-3xl mx-auto h-[80vh] flex flex-col bg-white rounded-3xl border border-[#E5E0D8] shadow-sm overflow-hidden mt-4">
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
          <div className="flex items-center justify-center py-16 text-[#8B7355]">
            <Loader2 className="w-6 h-6 animate-spin" />
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
                className="flex items-center gap-4 p-4 rounded-2xl hover:bg-[#FDFBF7] cursor-pointer transition-colors group relative"
              >
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#E5E0D8] group-hover:border-[#1B4332] transition-colors">
                    <img src={avatarFor(chat.partner)} alt={chat.partner.first_name || ''} className="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-serif font-medium text-lg text-[#1B4332] truncate pr-4">
                      {chat.partner.first_name}
                      {chat.partner.age ? `, ${chat.partner.age}` : ''}
                    </h3>
                    <span className="text-xs whitespace-nowrap text-[#8B7355]">{timeAgo(chat.lastMessageAt)}</span>
                  </div>
                  <p className="text-sm truncate text-[#5C574F]">{chat.lastMessage}</p>
                  {(chat.partner.location || chat.partner.city) && (
                    <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mt-2">
                      {chat.partner.location || chat.partner.city}
                    </p>
                  )}
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
