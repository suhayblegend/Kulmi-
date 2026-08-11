import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, UserMinus, Check, X, MapPin, Send, Inbox, SlidersHorizontal } from 'lucide-react';
import {
  discoverCandidates,
  listIncomingInvitations,
  listActiveSessions,
  sendInvitation,
  respondToInvitation,
  avatarFor,
  COMPATIBILITY_QUESTIONS,
  type Profile,
  type InvitationWithProfile,
  type SessionSummary,
  type DiscoverFilters,
} from '../lib/db';

interface HomeProps {
  onOpenSession: (sessionId: string) => void;
}

const PRAYER_OPTS = ['5 Daily Prayers', 'Usually prays', 'Sometimes prays', 'Working on it'];
const MARITAL_OPTS = ['Never married', 'Divorced', 'Widowed'];
const WANT_KIDS_OPTS = ['Want children', "Don't want children", 'Open / not sure'];
const EMPTY_FILTERS: DiscoverFilters = {};

export function Home({ onOpenSession }: HomeProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<InvitationWithProfile[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== '' && v !== null).length;

  const load = useCallback(async (f: DiscoverFilters = {}) => {
    setLoading(true);
    setError('');
    try {
      const [cands, incoming, active] = await Promise.all([
        discoverCandidates(f),
        listIncomingInvitations(),
        listActiveSessions(),
      ]);
      setCandidates(cands);
      setInvites(incoming);
      setSessions(active);
      setIndex(0);
    } catch (err: any) {
      setError(err.message || 'Could not load matches.');
    } finally {
      setLoading(false);
    }
  }, []);

  const applyFilters = () => {
    setFilters(draftFilters);
    setShowFilters(false);
    load(draftFilters);
  };
  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setShowFilters(false);
    load({});
  };
  const setDF = (k: keyof DiscoverFilters, v: any) => setDraftFilters((d) => ({ ...d, [k]: v === '' ? undefined : v }));

  useEffect(() => {
    load();
  }, [load]);

  const current = candidates[index];

  const handleInvite = async () => {
    if (!current) return;
    setBusy(true);
    setError('');
    try {
      await sendInvitation(current.id);
      setSentTo(current.first_name || 'them');
      setIndex((i) => i + 1);
    } catch (err: any) {
      setError(err.message || 'Could not send invitation.');
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => setIndex((i) => i + 1);

  const handleRespond = async (inv: InvitationWithProfile, accept: boolean) => {
    setBusy(true);
    setError('');
    try {
      const sessionId = await respondToInvitation(inv.id, accept);
      setInvites((prev) => prev.filter((i) => i.id !== inv.id));
      if (accept && sessionId) {
        onOpenSession(sessionId);
      }
    } catch (err: any) {
      setError(err.message || 'Could not respond.');
    } finally {
      setBusy(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="w-full max-w-md mx-auto space-y-6">{children}</div>
  );

  if (loading) {
    return (
      <Shell>
        <div className="w-full overflow-hidden border border-[#E5E0D8] bg-white shadow-sm rounded-2xl">
          <div className="pt-16 pb-20 flex flex-col items-center text-center px-10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="mb-10 relative"
            >
              <div className="absolute inset-0 bg-[#F0EEE8] rounded-full blur-xl opacity-70" />
              <Loader2 className="w-12 h-12 text-[#1B4332] relative z-10" />
            </motion.div>
            <h2 className="text-2xl font-medium text-[#1B4332] mb-4 font-serif italic">
              Finding suitable introductions
            </h2>
            <p className="text-[#8B7355] text-sm max-w-[280px] leading-relaxed">
              Reviewing values, faith, and goals to show you someone truly suitable.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Filters bar */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#1B4332] italic">Discover</h2>
        <button
          onClick={() => { setDraftFilters(filters); setShowFilters((s) => !s); }}
          className="flex items-center gap-2 text-sm font-medium text-[#1B4332] border border-[#E5E0D8] bg-white px-4 py-2 rounded-xl hover:bg-[#FDFBF7] transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="border border-[#E5E0D8] bg-white rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">Min age</label>
                  <input type="number" min={18} value={draftFilters.ageMin ?? ''} onChange={(e) => setDF('ageMin', e.target.value ? parseInt(e.target.value, 10) : '')} className="w-full px-3 py-2 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">Max age</label>
                  <input type="number" min={18} value={draftFilters.ageMax ?? ''} onChange={(e) => setDF('ageMax', e.target.value ? parseInt(e.target.value, 10) : '')} className="w-full px-3 py-2 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">Country</label>
                <input value={draftFilters.country ?? ''} onChange={(e) => setDF('country', e.target.value)} placeholder="e.g. UK" className="w-full px-3 py-2 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">Prayer</label>
                  <select value={draftFilters.prayerLevel ?? ''} onChange={(e) => setDF('prayerLevel', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]">
                    <option value="">Any</option>
                    {PRAYER_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">Marital status</label>
                  <select value={draftFilters.maritalStatus ?? ''} onChange={(e) => setDF('maritalStatus', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]">
                    <option value="">Any</option>
                    {MARITAL_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">Wants children</label>
                  <select value={draftFilters.wantChildren ?? ''} onChange={(e) => setDF('wantChildren', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]">
                    <option value="">Any</option>
                    {WANT_KIDS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={clearFilters} className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium text-sm hover:bg-[#FDFBF7] transition-colors">Clear</button>
                <button onClick={applyFilters} className="flex-1 px-4 py-2.5 rounded-xl bg-[#1B4332] text-white font-medium text-sm hover:bg-[#143326] transition-colors">Apply filters</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 text-center">
          {error}
        </div>
      )}

      {sentTo && (
        <div className="p-3 bg-[#E8F3ED] text-[#1B4332] text-sm rounded-xl border border-[#1B4332]/10 text-center">
          Invitation sent to {sentTo}. You'll begin a compatibility session once they accept.
        </div>
      )}

      {/* Incoming invitations */}
      {invites.length > 0 && (
        <div className="w-full border border-[#E5E0D8] bg-white shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E0D8] bg-[#FDFBF7] flex items-center gap-2">
            <Inbox className="w-4 h-4 text-[#1B4332]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1B4332]">
              Invitations for you ({invites.length})
            </h3>
          </div>
          <div className="divide-y divide-[#F0EEE8]">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 p-4">
                <img
                  src={avatarFor(inv.sender)}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover border border-[#E5E0D8]"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-medium text-[#1B4332] truncate">
                    {inv.sender.first_name}
                    {inv.sender.age ? `, ${inv.sender.age}` : ''}
                  </p>
                  <p className="text-xs text-[#8B7355] truncate">
                    {inv.sender.location || inv.sender.city || 'Somewhere'}
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => handleRespond(inv, false)}
                  className="w-9 h-9 rounded-full border border-[#E5E0D8] text-[#8B7355] flex items-center justify-center hover:bg-[#FDFBF7] transition-colors disabled:opacity-50"
                  aria-label="Decline"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleRespond(inv, true)}
                  className="w-9 h-9 rounded-full bg-[#1B4332] text-white flex items-center justify-center hover:bg-[#143326] transition-colors disabled:opacity-50"
                  aria-label="Accept"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active compatibility sessions */}
      {sessions.length > 0 && (
        <div className="w-full border border-[#1B4332]/20 bg-white shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E0D8] bg-[#FDFBF7] flex items-center gap-2">
            <Send className="w-4 h-4 text-[#1B4332]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1B4332]">Compatibility sessions</h3>
          </div>
          <div className="divide-y divide-[#F0EEE8]">
            {sessions.map((s) => {
              const total = COMPATIBILITY_QUESTIONS.length;
              const label = s.status === 'completed'
                ? "It's a match — open chat"
                : s.myAnsweredCount < total
                ? `Continue — ${s.myAnsweredCount}/${total} answered`
                : s.bothFinished
                ? 'Review & decide'
                : `Waiting for ${s.partner.first_name}`;
              return (
                <button
                  key={s.id}
                  onClick={() => onOpenSession(s.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-[#FDFBF7] transition-colors"
                >
                  <img src={avatarFor(s.partner)} alt="" className="w-12 h-12 rounded-full object-cover border border-[#E5E0D8]" />
                  <div className="flex-1 min-w-0">
                    <p className="font-serif font-medium text-[#1B4332] truncate">
                      {s.partner.first_name}{s.partner.age ? `, ${s.partner.age}` : ''}
                    </p>
                    <p className="text-xs text-[#8B7355] truncate">{label}</p>
                  </div>
                  <span className="text-[#1B4332] text-sm font-medium">Open →</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidate to invite */}
      {current ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full border border-[#E5E0D8] bg-white shadow-sm rounded-2xl overflow-hidden"
          >
            <div className="h-56 bg-[#F0EEE8] relative">
              <img src={avatarFor(current)} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-serif text-[#1B4332]">
                {current.first_name}
                {current.age ? `, ${current.age}` : ''}
              </h2>
              {(current.location || current.city) && (
                <p className="flex items-center gap-1.5 text-sm text-[#8B7355] mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {current.location || [current.city, current.country].filter(Boolean).join(', ')}
                </p>
              )}
              {current.bio && (
                <p className="text-sm text-[#5C574F] leading-relaxed mt-4 font-serif italic">
                  "{current.bio}"
                </p>
              )}
              {current.intro_audio_url && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5 flex items-center gap-1.5">🎤 Voice intro</p>
                  <audio controls src={current.intro_audio_url} className="w-full" />
                </div>
              )}
              {current.prayer_level && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-[#FDFBF7] border border-[#E5E0D8] rounded-full text-xs text-[#1B4332]">
                    {current.prayer_level}
                  </span>
                  {current.marriage_intent && (
                    <span className="px-3 py-1 bg-[#FDFBF7] border border-[#E5E0D8] rounded-full text-xs text-[#1B4332]">
                      {current.marriage_intent}
                    </span>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <button
                  disabled={busy}
                  onClick={handleSkip}
                  className="flex-1 px-6 py-3 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors disabled:opacity-50"
                >
                  Not now
                </button>
                <button
                  disabled={busy}
                  onClick={handleInvite}
                  className="flex-1 px-6 py-3 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Invite
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        invites.length === 0 && (
          <div className="w-full overflow-hidden border border-[#E5E0D8] bg-white shadow-sm rounded-2xl">
            <div className="pt-16 pb-20 flex flex-col items-center text-center px-10">
              <div className="w-16 h-16 bg-[#F0EEE8] rounded-full flex items-center justify-center mb-6">
                <UserMinus className="w-8 h-8 text-[#8B7355]" />
              </div>
              <h2 className="text-2xl font-medium text-[#1B4332] mb-4 font-serif italic">
                No introductions right now
              </h2>
              <p className="text-[#8B7355] text-sm max-w-[280px] leading-relaxed mb-8">
                We've shown you everyone suitable for now. Check back soon as new members join.
              </p>
              <button
                onClick={() => load(filters)}
                className="bg-[#1B4332] text-white hover:bg-[#143326] px-8 py-3 rounded-xl font-medium tracking-wide transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        )
      )}
    </Shell>
  );
}
