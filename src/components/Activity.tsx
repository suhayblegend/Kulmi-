import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, MapPin, Send, Inbox, BadgeCheck, Clock, Sparkles, ArrowLeft, HeartHandshake } from 'lucide-react';
import { ListRowSkeleton } from './ui/Skeleton';
import { cacheGet, cacheSet } from '../lib/cache';
import { KulmiPlus } from './ui/KulmiPlus';
import {
  listIncomingInvitations,
  listActiveSessions,
  listMySentInvitations,
  respondToInvitation,
  avatarFor,
  getMyProfile,
  isPremium,
  listMyViewers,
  COMPATIBILITY_QUESTIONS,
  type InvitationWithProfile,
  type SentInvitation,
  type SessionSummary,
  type ViewerRow,
} from '../lib/db';

const DISMISSED_KEY = 'kulmi_dismissed_declines';
const loadDismissed = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); } catch { return new Set(); }
};

interface ActivityProps {
  onCount?: (n: number) => void;
  onOpenSession: (sessionId: string) => void;
  onBack: () => void;
  onChanged?: () => void;
}

// Module scope for a stable identity (avoids remount flicker on every render).
const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full max-w-md mx-auto space-y-6">{children}</div>
);

const SectionCard = ({
  icon, title, count, tone = 'default', children,
}: {
  icon: React.ReactNode; title: string; count?: number;
  tone?: 'default' | 'accent'; children: React.ReactNode;
}) => (
  <div className={`w-full bg-white shadow-sm rounded-2xl overflow-hidden border ${tone === 'accent' ? 'border-[#1B4332]/25' : 'border-[#E5E0D8]'}`}>
    <div className="px-5 py-3.5 border-b border-[#E5E0D8] bg-[#FDFBF7] flex items-center gap-2">
      <span className="text-[#1B4332]">{icon}</span>
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#1B4332]">
        {title}{typeof count === 'number' ? ` (${count})` : ''}
      </h3>
    </div>
    {children}
  </div>
);

export function Activity({ onOpenSession, onBack, onChanged, onCount }: ActivityProps) {
  const cached = cacheGet<{ invites: InvitationWithProfile[]; sessions: SessionSummary[]; sent: SentInvitation[]; premium: boolean; viewers: ViewerRow[] }>('activity');
  const [loading, setLoading] = useState(!cached); // instant if we've loaded before
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<InvitationWithProfile[]>(cached?.invites ?? []);
  const [sessions, setSessions] = useState<SessionSummary[]>(cached?.sessions ?? []);
  const [sent, setSent] = useState<SentInvitation[]>(cached?.sent ?? []);
  const [viewingInvite, setViewingInvite] = useState<InvitationWithProfile | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [premium, setPremium] = useState(cached?.premium ?? false);
  const [viewers, setViewers] = useState<ViewerRow[]>(cached?.viewers ?? []);
  const actionRef = useRef(false);

  const dismissDecline = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const load = useCallback(async () => {
    setError('');
    try {
      const [incoming, active, mySent] = await Promise.all([
        listIncomingInvitations(),
        listActiveSessions(),
        listMySentInvitations(),
      ]);
      setInvites(incoming);
      setSessions(active);
      setSent(mySent);
      onCount?.(incoming.length + active.filter((x) => x.status !== 'completed').length);
      // Kulmi+ — who viewed you
      const me = await getMyProfile();
      const prem = isPremium(me);
      setPremium(prem);
      let vw: ViewerRow[] = [];
      if (prem) { try { vw = await listMyViewers(); setViewers(vw); } catch { /* ignore */ } }
      cacheSet('activity', { invites: incoming, sessions: active, sent: mySent, premium: prem, viewers: vw });
    } catch (err: any) {
      // Keep showing cached data on a network blip; only surface an error cold.
      if (!cached) setError(err.message || 'Could not load your activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRespond = async (inv: InvitationWithProfile, accept: boolean) => {
    if (actionRef.current) return;
    if (!accept && !window.confirm(`Decline ${inv.sender?.first_name ?? 'this person'}'s introduction? You won't be matched with them again.`)) return;
    actionRef.current = true;
    setBusy(true);
    setError('');
    try {
      const sessionId = await respondToInvitation(inv.id, accept);
      setInvites((prev) => prev.filter((i) => i.id !== inv.id));
      onChanged?.();
      if (accept && sessionId) {
        onOpenSession(sessionId);
      } else if (accept) {
        // Accepted but the session id wasn't returned in time — reload so the
        // new compatibility session shows up, and tell the user where it is.
        await load();
        setNotice('Accepted! Your compatibility session is ready below — tap it to begin.');
      } else {
        load();
      }
    } catch (err: any) {
      setError(err.message || 'Could not respond.');
    } finally {
      setBusy(false);
      actionRef.current = false;
    }
  };

  const pendingSent = sent.filter((s) => s.status === 'pending');
  const declinedSent = sent.filter((s) => s.status === 'declined' && !dismissed.has(s.id));
  const isEmpty = !loading && invites.length === 0 && sessions.length === 0 && pendingSent.length === 0 && declinedSent.length === 0;

  return (
    <Shell>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full border border-[#E5E0D8] bg-white flex items-center justify-center text-[#1B4332] hover:bg-[#FDFBF7] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-serif text-2xl text-[#1B4332] italic leading-none">Activity</h2>
          <p className="text-xs text-[#8B7355] mt-1">Invitations, sessions & the requests you've sent</p>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-[#E8F3ED] text-[#1B4332] text-sm rounded-xl border border-[#1B4332]/10 text-center">{notice}</div>
      )}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 text-center">{error}</div>
      )}

      {loading ? (
        <div className="w-full border border-[#E5E0D8] bg-white shadow-sm rounded-2xl divide-y divide-[#F0EEE8]">
          {Array.from({ length: 4 }).map((_, i) => <ListRowSkeleton key={i} />)}
        </div>
      ) : isEmpty ? (
        <div className="w-full overflow-hidden border border-[#E5E0D8] bg-white shadow-sm rounded-2xl">
          <div className="pt-16 pb-20 flex flex-col items-center text-center px-10">
            <div className="w-16 h-16 bg-[#F0EEE8] rounded-full flex items-center justify-center mb-6">
              <HeartHandshake className="w-8 h-8 text-[#8B7355]" />
            </div>
            <h2 className="text-2xl font-medium text-[#1B4332] mb-4 font-serif italic">Nothing here yet</h2>
            <p className="text-[#8B7355] text-sm max-w-[280px] leading-relaxed mb-8">
              When you send an invitation or someone reaches out to you, it will appear here. Head to Discover to find a suitable introduction.
            </p>
            <button onClick={onBack} className="bg-[#1B4332] text-white hover:bg-[#143326] px-8 py-3 rounded-xl font-medium tracking-wide transition-colors">
              Go to Discover
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Incoming invitations */}
          {invites.length > 0 && (
            <SectionCard icon={<Inbox className="w-4 h-4" />} title="Invitations for you" count={invites.length} tone="accent">
              <div className="divide-y divide-[#F0EEE8]">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-4 p-4">
                    <button onClick={() => setViewingInvite(inv)} className="flex items-center gap-4 flex-1 min-w-0 text-left group">
                      <img src={avatarFor(inv.sender)} alt="" className="w-12 h-12 rounded-full object-cover border border-[#E5E0D8]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-serif font-medium text-[#1B4332] truncate">
                          {inv.sender.first_name}{inv.sender.age ? `, ${inv.sender.age}` : ''}{(inv.sender as any).is_premium && <KulmiPlus className="ml-1.5" />}
                        </p>
                        <p className="text-xs text-[#1B4332] truncate font-medium group-hover:underline">Tap to view profile →</p>
                      </div>
                    </button>
                    <button disabled={busy} onClick={() => handleRespond(inv, false)} className="w-9 h-9 rounded-full border border-[#E5E0D8] text-[#8B7355] flex items-center justify-center hover:bg-[#FDFBF7] transition-colors disabled:opacity-50" aria-label="Decline">
                      <X className="w-4 h-4" />
                    </button>
                    <button disabled={busy} onClick={() => handleRespond(inv, true)} className="w-9 h-9 rounded-full bg-[#1B4332] text-white flex items-center justify-center hover:bg-[#143326] transition-colors disabled:opacity-50" aria-label="Accept">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Active compatibility sessions */}
          {sessions.length > 0 && (
            <SectionCard icon={<Sparkles className="w-4 h-4" />} title="Compatibility sessions" count={sessions.length}>
              <div className="divide-y divide-[#F0EEE8]">
                {sessions.map((s) => {
                  const total = COMPATIBILITY_QUESTIONS.length;
                  const label = s.status === 'completed'
                    ? "It's a match — open chat"
                    : s.myAnsweredCount === 0
                    ? '🎉 Accepted — start your session'
                    : s.myAnsweredCount < total
                    ? `Continue — ${s.myAnsweredCount}/${total} answered`
                    : s.bothFinished
                    ? 'Review & decide'
                    : `Waiting for ${s.partner.first_name}`;
                  return (
                    <button key={s.id} onClick={() => onOpenSession(s.id)} className="w-full flex items-center gap-4 p-4 text-left hover:bg-[#FDFBF7] transition-colors">
                      <img src={avatarFor(s.partner)} alt="" className="w-12 h-12 rounded-full object-cover border border-[#E5E0D8]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-serif font-medium text-[#1B4332] truncate">{s.partner.first_name}{s.partner.age ? `, ${s.partner.age}` : ''}</p>
                        <p className="text-xs text-[#8B7355] truncate">{label}</p>
                      </div>
                      <span className="text-[#1B4332] text-sm font-medium">Open →</span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Sent invitations */}
          {(pendingSent.length > 0 || declinedSent.length > 0) && (
            <SectionCard icon={<Send className="w-4 h-4" />} title="Invitations you sent">
              <div className="divide-y divide-[#F0EEE8]">
                {pendingSent.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 p-4">
                    <img src={avatarFor(s.receiver)} alt="" className="w-11 h-11 rounded-full object-cover border border-[#E5E0D8]" />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif font-medium text-[#1B4332] truncate">{s.receiver.first_name}{s.receiver.age ? `, ${s.receiver.age}` : ''}</p>
                      <p className="text-xs text-[#8B7355] flex items-center gap-1"><Clock className="w-3 h-3" /> Awaiting their response</p>
                    </div>
                  </div>
                ))}
                {declinedSent.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 p-4 opacity-80">
                    <img src={avatarFor(s.receiver)} alt="" className="w-11 h-11 rounded-full object-cover border border-[#E5E0D8] grayscale" />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif font-medium text-[#5C574F] truncate">{s.receiver.first_name}</p>
                      <p className="text-xs text-[#8B7355]">Not this time — it wasn't the right fit. Keep going, in shaa Allah.</p>
                    </div>
                    <button onClick={() => dismissDecline(s.id)} className="text-xs font-medium text-[#8B7355] hover:text-[#1B4332] px-2">Dismiss</button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Kulmi+ — who viewed you (always visible for premium, incl. empty state) */}
      {!loading && (
        premium ? (
          <SectionCard icon={<Sparkles className="w-4 h-4" />} title="Who viewed you" count={viewers.length}>
            {viewers.length > 0 ? (
              <div className="divide-y divide-[#F0EEE8]">
                {viewers.map((v) => (
                  <div key={v.id} className="flex items-center gap-4 p-4">
                    <img src={avatarFor(v as any)} alt="" className="w-11 h-11 rounded-full object-cover border border-[#E5E0D8]" />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif font-medium text-[#1B4332] truncate">{v.first_name || 'Member'}{v.age ? `, ${v.age}` : ''}</p>
                      <p className="text-xs text-[#8B7355] truncate">
                        {[v.city, v.country].filter(Boolean).join(', ') || 'Viewed your profile'} · {new Date(v.viewed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-[#5C574F]">No one has viewed your profile yet.</p>
                <p className="text-xs text-[#8B7355] mt-1">When a verified member views you in Discover, they'll appear here. ✨</p>
              </div>
            )}
          </SectionCard>
        ) : (
          <div className="w-full bg-gradient-to-br from-[#1B4332] to-[#143326] text-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">✨ Kulmi+</p>
            <p className="font-serif text-lg mb-1">See who viewed your profile</p>
            <p className="text-sm text-white/75 leading-relaxed">Plus invite your Wali, 5 open introductions and priority verification. Upgrade any time from Settings.</p>
          </div>
        )
      )}

      {/* Inviter profile modal */}
      <AnimatePresence>
        {viewingInvite && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#2D2926]/50 backdrop-blur-sm" onClick={() => setViewingInvite(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} className="relative z-10 w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E5E0D8] max-h-[90vh] overflow-y-auto">
              <button onClick={() => setViewingInvite(null)} className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"><X className="w-4 h-4" /></button>
              <div className="relative h-72 bg-[#F0EEE8]">
                <img src={avatarFor(viewingInvite.sender)} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-serif drop-shadow-sm flex items-center gap-2">{viewingInvite.sender.first_name}{viewingInvite.sender.age ? `, ${viewingInvite.sender.age}` : ''}{(viewingInvite.sender as any).is_premium && <KulmiPlus />}</h2>
                    {(viewingInvite.sender.verification_status === 'verified' || viewingInvite.sender.photo_verified) && (
                      <span className="flex items-center gap-1 bg-white/90 text-[#1B4332] text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"><BadgeCheck className="w-3 h-3" /> Verified</span>
                    )}
                  </div>
                  {(viewingInvite.sender.location || viewingInvite.sender.city) && (
                    <p className="flex items-center gap-1.5 text-sm opacity-90 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {viewingInvite.sender.location || [viewingInvite.sender.city, viewingInvite.sender.country].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-[#8B7355] mb-3">💌 {viewingInvite.sender.first_name} sent you an invitation.</p>
                <div className="flex flex-wrap gap-2">
                  {[viewingInvite.sender.prayer_level, viewingInvite.sender.marital_status, viewingInvite.sender.occupation, viewingInvite.sender.children, viewingInvite.sender.marriage_intent]
                    .filter(Boolean).slice(0, 5).map((chip) => (
                      <span key={chip as string} className="px-3 py-1 bg-[#FDFBF7] border border-[#E5E0D8] rounded-full text-xs text-[#1B4332]">{chip}</span>
                    ))}
                </div>
                {viewingInvite.sender.bio && <p className="text-sm text-[#5C574F] leading-relaxed mt-4 font-serif italic">"{viewingInvite.sender.bio}"</p>}
                {viewingInvite.sender.intro_audio_url && (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">🎤 Voice intro</p>
                    <audio controls src={viewingInvite.sender.intro_audio_url} className="w-full" />
                  </div>
                )}
                <p className="text-[11px] text-[#8B7355] mt-4">More photos unlock after you both match.</p>
                <div className="flex gap-3 mt-5">
                  <button disabled={busy} onClick={() => { const inv = viewingInvite; setViewingInvite(null); handleRespond(inv, false); }} className="flex-1 px-6 py-3 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors disabled:opacity-50">Decline</button>
                  <button disabled={busy} onClick={() => { const inv = viewingInvite; setViewingInvite(null); handleRespond(inv, true); }} className="flex-1 px-6 py-3 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"><Check className="w-4 h-4" /> Accept &amp; start session</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
