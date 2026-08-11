import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Shield, User, MessageSquare, Heart, Loader2, X } from 'lucide-react';
import { listWardActivity, readTranscript, avatarFor, type WardActivity, type Message } from '../lib/db';

interface WaliDashboardProps {
  onBack: () => void;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString();

export function WaliDashboard({ onBack }: WaliDashboardProps) {
  const [wards, setWards] = useState<WardActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [transcript, setTranscript] = useState<{ title: string; messages: Message[] } | null>(null);

  useEffect(() => {
    listWardActivity()
      .then(setWards)
      .catch(() => setWards([]))
      .finally(() => setLoading(false));
  }, []);

  const openTranscript = async (chatId: string, partnerName: string, wardName: string) => {
    const messages = await readTranscript(chatId);
    setTranscript({ title: `${wardName} & ${partnerName}`, messages });
  };

  return (
    <div className="w-full max-w-4xl mx-auto min-h-[80vh] flex flex-col bg-white rounded-3xl border border-[#E5E0D8] shadow-sm overflow-hidden mt-4">
      <div className="p-6 md:p-8 border-b border-[#E5E0D8] bg-[#FDFBF7]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#1B4332]" />
            <h2 className="text-2xl font-serif text-[#1B4332]">Wali Dashboard</h2>
          </div>
          <button onClick={onBack} className="text-sm font-medium text-[#8B7355] hover:text-[#1B4332] uppercase tracking-wider transition-colors">Exit</button>
        </div>
        <p className="text-[#5C574F] text-sm max-w-xl">
          You can see the compatibility sessions and conversations of anyone who has listed your email
          as their Wali. This view is read-only, to help you support them respectfully.
        </p>
      </div>

      <div className="flex-1 bg-white p-6 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16 text-[#8B7355]"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : wards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-[#8B7355]">
            <User className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm max-w-sm">No one has added you as their Wali yet. In their Settings, they enter your email under "Family Mode (Wali)".</p>
          </div>
        ) : (
          <div className="space-y-8">
            {wards.map((w) => (
              <motion.div key={w.ward.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center gap-3">
                  <img src={avatarFor(w.ward)} alt="" className="w-12 h-12 rounded-full object-cover border border-[#E5E0D8]" />
                  <div>
                    <h3 className="font-serif font-medium text-lg text-[#1B4332]">{w.ward.first_name}{w.ward.age ? `, ${w.ward.age}` : ''}</h3>
                    <p className="text-xs text-[#8B7355]">{w.ward.location || w.ward.city || 'Your ward'}</p>
                  </div>
                </div>

                <div className="pl-2 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">Compatibility sessions</p>
                  {w.sessions.length === 0 && <p className="text-sm text-[#8B7355]">None yet.</p>}
                  {w.sessions.map((s) => (
                    <div key={s.id} className="p-4 rounded-2xl border border-[#E5E0D8] bg-[#FDFBF7] flex items-center gap-3">
                      <Heart className="w-5 h-5 text-[#1B4332]" />
                      <span className="text-sm text-[#2D2926] flex-1">With {s.partnerName}</span>
                      <span className="text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-800 capitalize">{s.status}</span>
                    </div>
                  ))}

                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] pt-2">Conversations</p>
                  {w.chats.length === 0 && <p className="text-sm text-[#8B7355]">None yet.</p>}
                  {w.chats.map((c) => (
                    <div key={c.id} className="p-4 rounded-2xl border border-[#E5E0D8] flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1B4332]/10 flex items-center justify-center text-[#1B4332]"><MessageSquare className="w-5 h-5" /></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#1B4332]">{w.ward.first_name} & {c.partnerName}</p>
                        <p className="text-xs text-[#8B7355]">{c.messageCount} messages</p>
                      </div>
                      <button onClick={() => openTranscript(c.id, c.partnerName, w.ward.first_name || 'Ward')} className="text-sm font-medium text-[#1B4332] hover:underline">Review</button>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {transcript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTranscript(null)} />
          <div className="relative bg-white w-full max-w-lg max-h-[80vh] rounded-2xl border border-[#E5E0D8] shadow-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FDFBF7]">
              <h3 className="font-serif text-[#1B4332]">{transcript.title}</h3>
              <button onClick={() => setTranscript(null)} className="p-1 text-[#8B7355] hover:text-[#1B4332]"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {transcript.messages.length === 0 && <p className="text-sm text-[#8B7355] text-center py-8">No messages yet.</p>}
              {transcript.messages.map((m) => (
                <div key={m.id} className="text-sm bg-[#FDFBF7] border border-[#E5E0D8] rounded-lg p-2">
                  <span className="text-[10px] uppercase tracking-wider text-[#8B7355]">{fmtDate(m.created_at)}</span>
                  <p className="text-[#2D2926]">{m.type === 'audio' ? '🎤 Voice note' : m.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
