import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, UserMinus, MapPin, Send, Inbox, SlidersHorizontal, BadgeCheck,
  Heart, Sparkles, ChevronRight, Briefcase, Moon, Baby, Users, X,
} from 'lucide-react';
import {
  discoverCandidates,
  listIncomingInvitations,
  listActiveSessions,
  listMySentInvitations,
  countMyOpenThreads,
  sendInvitation,
  avatarFor,
  getMyProfile,
  isPremium,
  recordProfileView,
  type Profile,
  type InvitationWithProfile,
  type SentInvitation,
  type SessionSummary,
  type DiscoverFilters,
} from '../lib/db';

interface HomeProps {
  onOpenSession: (sessionId: string) => void;
  onOpenActivity: () => void;
  onActivityCount?: (n: number) => void;
}

const MAX_OPEN_FREE = 3; // intentionality cap — Kulmi+ members get 5
const MAX_OPEN_PLUS = 5;
// Module scope for a stable identity — defined inside the component it caused
// the whole discover subtree to remount (and images to reload) on every state
// change, which showed up as UI flicker.
const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full max-w-md mx-auto space-y-5">{children}</div>
);

const PRAYER_OPTS = ['5 Daily Prayers', 'Usually prays', 'Sometimes prays', 'Working on it'];
const MARITAL_OPTS = ['Never married', 'Divorced', 'Widowed'];
const WANT_KIDS_OPTS = ['Want children', "Don't want children", 'Open / not sure'];
const EMPTY_FILTERS: DiscoverFilters = {};

// A single detail chip with an icon, used on the candidate card.
const DetailChip = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] border border-[#E5E0D8] rounded-full text-xs text-[#1B4332]">
    <span className="text-[#8B7355]">{icon}</span>{label}
  </span>
);

// A compact fact tile (icon + label + value), used in the full-profile modal grid.
const Fact = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <div className="bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-[#8B7355] mb-0.5">{label}</p>
      <p className="text-sm text-[#2D2926] leading-snug">{value}</p>
    </div>
  ) : null;

const ModalSection = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const has = React.Children.toArray(children).some(Boolean);
  if (!has) return null;
  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{children}</div>
    </div>
  );
};

// "Kulmi+" badge shown next to premium members' names.
const KulmiPlus = () => (
  <span className="flex items-center gap-1 bg-[#1B4332] text-[#F0EEE8] text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
    <Sparkles className="w-3 h-3" /> Kulmi+
  </span>
);

const TagSection = ({ title, items }: { title: string; items?: string[] | null }) =>
  items && items.length ? (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => <span key={t} className="px-3 py-1.5 bg-[#FDFBF7] border border-[#E5E0D8] rounded-full text-xs text-[#1B4332]">{t}</span>)}
      </div>
    </div>
  ) : null;

// Normalise a value for comparison (case/space-insensitive).
const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();

export function Home({ onOpenSession, onOpenActivity, onActivityCount }: HomeProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<InvitationWithProfile[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [openThreads, setOpenThreads] = useState(0);
  const [premium, setPremium] = useState(false);
  const [pendingSent, setPendingSent] = useState(0);
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== '' && v !== null).length;

  const load = useCallback(async (f: DiscoverFilters = {}) => {
    setLoading(true);
    setError('');
    try {
      const [cands, incoming, active, open, mySent, meProf] = await Promise.all([
        discoverCandidates(f),
        listIncomingInvitations(),
        listActiveSessions(),
        countMyOpenThreads(),
        listMySentInvitations(),
        getMyProfile(),
      ]);
      setPremium(isPremium(meProf));
      setMyProfile(meProf);
      setCandidates(cands);
      setInvites(incoming);
      setSessions(active);
      setOpenThreads(open);
      setPendingSent(mySent.filter((s) => s.status === 'pending').length);
      setIndex(0);
      onActivityCount?.(incoming.length + active.filter((s) => s.status !== 'completed').length);
    } catch (err: any) {
      setError(err.message || 'Could not load matches.');
    } finally {
      setLoading(false);
    }
  }, [onActivityCount]);

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

  useEffect(() => { load(); }, [load]);

  const current = candidates[index];
  useEffect(() => { if (current?.id) recordProfileView(current.id); }, [current?.id]);
  const remaining = candidates.length - index;

  const actionRef = useRef(false); // synchronous guard against rapid double-clicks
  const handleInvite = async () => {
    if (!current || actionRef.current) return;
    const maxOpen = premium ? MAX_OPEN_PLUS : MAX_OPEN_FREE;
    if (openThreads >= maxOpen) {
      setError(premium
        ? `You can have ${maxOpen} introductions at a time. Finish or end one before starting another — quality over quantity.`
        : `You can have ${maxOpen} introductions at a time (Kulmi+ members get ${MAX_OPEN_PLUS}). Finish or end one before starting another.`);
      return;
    }
    actionRef.current = true;
    setBusy(true);
    setError('');
    try {
      await sendInvitation(current.id);
      setSentTo(current.first_name || 'them');
      setOpenThreads((n) => n + 1);
      setPendingSent((n) => n + 1);
      setIndex((i) => i + 1);
    } catch (err: any) {
      setError(err.message || 'Could not send invitation.');
    } finally {
      setBusy(false);
      actionRef.current = false;
    }
  };

  const handleSkip = () => { setSentTo(null); setIndex((i) => i + 1); };

  if (loading) {
    return (
      <Shell>
        <div className="w-full overflow-hidden border border-[#E5E0D8] bg-white shadow-sm rounded-3xl">
          <div className="pt-16 pb-20 flex flex-col items-center text-center px-10">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="mb-10 relative">
              <div className="absolute inset-0 bg-[#F0EEE8] rounded-full blur-xl opacity-70" />
              <Loader2 className="w-12 h-12 text-[#1B4332] relative z-10" />
            </motion.div>
            <h2 className="text-2xl font-medium text-[#1B4332] mb-4 font-serif italic">Finding suitable introductions</h2>
            <p className="text-[#8B7355] text-sm max-w-[280px] leading-relaxed">
              Reviewing values, faith, and goals to show you someone truly suitable.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  const activityTotal = invites.length + sessions.length + pendingSent;

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif text-2xl text-[#1B4332] italic leading-none">Discover</h2>
          <p className="text-xs text-[#8B7355] mt-1.5">Thoughtful introductions, one at a time</p>
        </div>
        <button
          onClick={() => { setDraftFilters(filters); setShowFilters((s) => !s); }}
          className="flex items-center gap-2 text-sm font-medium text-[#1B4332] border border-[#E5E0D8] bg-white px-4 py-2 rounded-xl hover:bg-[#FDFBF7] transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {/* Activity strip — links to the dedicated Activity page */}
      {activityTotal > 0 && (
        <button
          onClick={onOpenActivity}
          className="w-full flex items-center gap-3 bg-[#1B4332] text-white rounded-2xl px-4 py-3.5 shadow-sm hover:bg-[#143326] transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Inbox className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">
              {invites.length > 0
                ? `${invites.length} ${invites.length === 1 ? 'invitation is' : 'invitations are'} waiting for you`
                : 'Your activity'}
            </p>
            <p className="text-[11px] text-white/70 mt-0.5">
              {[
                invites.length ? `${invites.length} received` : '',
                sessions.length ? `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}` : '',
                pendingSent ? `${pendingSent} sent` : '',
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 opacity-80 shrink-0" />
        </button>
      )}

      {/* Filters panel */}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">Country</label>
                  <input value={draftFilters.country ?? ''} onChange={(e) => setDF('country', e.target.value)} placeholder="e.g. UK" className="w-full px-3 py-2 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">City (nearby)</label>
                  <input value={draftFilters.city ?? ''} onChange={(e) => setDF('city', e.target.value)} placeholder="e.g. London" className="w-full px-3 py-2 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]" />
                </div>
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
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 text-center">{error}</div>
      )}

      {sentTo && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-[#E8F3ED] text-[#1B4332] text-sm rounded-xl border border-[#1B4332]/10 text-center">
          Invitation sent to {sentTo}. You'll begin a compatibility session once they accept — track it in{' '}
          <button onClick={onOpenActivity} className="underline font-medium">Activity</button>.
        </motion.div>
      )}

      {/* Gate: respond to incoming invitations before browsing more */}
      {invites.length > 0 ? (
        <div className="w-full border border-[#E5E0D8] bg-white shadow-sm rounded-3xl">
          <div className="pt-12 pb-12 flex flex-col items-center text-center px-8">
            <div className="w-16 h-16 bg-[#F0EEE8] rounded-full flex items-center justify-center mb-5">
              <Inbox className="w-8 h-8 text-[#1B4332]" />
            </div>
            <h2 className="text-xl font-serif text-[#1B4332] italic mb-2">Someone is waiting on you</h2>
            <p className="text-[#8B7355] text-sm max-w-[280px] leading-relaxed mb-6">
              Please respond to your {invites.length === 1 ? 'invitation' : 'invitations'} before we show you new introductions. On Kulmi, we honour the people who reach out — no window-shopping.
            </p>
            <button onClick={onOpenActivity} className="bg-[#1B4332] text-white hover:bg-[#143326] px-8 py-3 rounded-xl font-medium tracking-wide transition-colors flex items-center gap-2">
              Review {invites.length === 1 ? 'invitation' : 'invitations'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : current ? (
        <>
          {/* progress indicator */}
          <div className="flex items-center justify-center gap-1.5">
            {candidates.slice(0, Math.min(candidates.length, 8)).map((_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === index ? 'w-6 bg-[#1B4332]' : i < index ? 'w-1.5 bg-[#1B4332]/30' : 'w-1.5 bg-[#E5E0D8]'}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="w-full border border-[#E5E0D8] bg-white shadow-[0_8px_40px_rgba(27,67,50,0.10)] rounded-3xl overflow-hidden"
            >
              <div className="relative h-80 bg-[#F0EEE8]">
                <img src={avatarFor(current)} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

                {/* Suggested ribbon */}
                <div className="absolute top-4 left-4">
                  <span className="flex items-center gap-1.5 bg-white/90 backdrop-blur text-[#1B4332] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">
                    <Sparkles className="w-3 h-3" /> Suggested for you
                  </span>
                </div>

                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-serif drop-shadow-sm">
                      {current.first_name}{current.age ? `, ${current.age}` : ''}
                    </h2>
                    {(current.verification_status === 'verified' || current.photo_verified) && (
                      <span className="flex items-center gap-1 bg-white/90 text-[#1B4332] text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
                        <BadgeCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                    {(current as any).is_premium && <KulmiPlus />}
                  </div>
                  {(current.location || current.city) && (
                    <p className="flex items-center gap-1.5 text-sm opacity-90 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {current.location || [current.city, current.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {current.occupation && <DetailChip icon={<Briefcase className="w-3.5 h-3.5" />} label={current.occupation} />}
                  {current.prayer_level && <DetailChip icon={<Moon className="w-3.5 h-3.5" />} label={current.prayer_level} />}
                  {current.marital_status && <DetailChip icon={<Users className="w-3.5 h-3.5" />} label={current.marital_status} />}
                  {current.children && <DetailChip icon={<Baby className="w-3.5 h-3.5" />} label={current.children} />}
                </div>

                {current.bio && (
                  <p className="text-sm text-[#5C574F] leading-relaxed mt-4 font-serif italic">"{current.bio}"</p>
                )}

                {current.intro_audio_url && (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1.5">🎤 Voice intro</p>
                    <audio controls src={current.intro_audio_url} className="w-full" />
                  </div>
                )}

                <button
                  onClick={() => setViewProfile(current)}
                  className="w-full mt-5 text-sm font-medium text-[#1B4332] border border-[#E5E0D8] rounded-2xl py-3 hover:bg-[#FDFBF7] transition-colors flex items-center justify-center gap-2"
                >
                  View full profile <ChevronRight className="w-4 h-4" />
                </button>

                <div className="flex gap-3 mt-3">
                  <button
                    disabled={busy}
                    onClick={handleSkip}
                    className="flex-1 px-6 py-3.5 rounded-2xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors disabled:opacity-50"
                  >
                    Not now
                  </button>
                  <button
                    disabled={busy}
                    onClick={handleInvite}
                    className="flex-[1.4] px-6 py-3.5 rounded-2xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                    Send invitation
                  </button>
                </div>
                <p className="text-[11px] text-[#8B7355] text-center mt-3">
                  {remaining > 1 ? `${remaining - 1} more suitable ${remaining - 1 === 1 ? 'introduction' : 'introductions'} after this` : 'Last suggestion for now'}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </>
      ) : (
        <div className="w-full overflow-hidden border border-[#E5E0D8] bg-white shadow-sm rounded-3xl">
          <div className="pt-16 pb-20 flex flex-col items-center text-center px-10">
            <div className="w-16 h-16 bg-[#F0EEE8] rounded-full flex items-center justify-center mb-6">
              <UserMinus className="w-8 h-8 text-[#8B7355]" />
            </div>
            <h2 className="text-2xl font-medium text-[#1B4332] mb-4 font-serif italic">No introductions right now</h2>
            <p className="text-[#8B7355] text-sm max-w-[280px] leading-relaxed mb-8">
              We've shown you everyone suitable for now. Check back soon as new members join{activeFilterCount ? ', or widen your filters' : ''}.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="border border-[#E5E0D8] text-[#1B4332] hover:bg-[#FDFBF7] px-8 py-3 rounded-xl font-medium tracking-wide transition-colors">
                  Clear filters
                </button>
              )}
              <button onClick={() => load(filters)} className="bg-[#1B4332] text-white hover:bg-[#143326] px-8 py-3 rounded-xl font-medium tracking-wide transition-colors">
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full profile modal */}
      <AnimatePresence>
        {viewProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#2D2926]/50 backdrop-blur-sm" onClick={() => setViewProfile(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative z-10 w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E5E0D8] max-h-[92vh] overflow-y-auto"
            >
              <button onClick={() => setViewProfile(null)} className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"><X className="w-4 h-4" /></button>
              <div className="relative h-72 bg-[#F0EEE8]">
                <img src={avatarFor(viewProfile)} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-serif drop-shadow-sm">{viewProfile.first_name}{viewProfile.age ? `, ${viewProfile.age}` : ''}</h2>
                    {(viewProfile.verification_status === 'verified' || viewProfile.photo_verified) && (
                      <span className="flex items-center gap-1 bg-white/90 text-[#1B4332] text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"><BadgeCheck className="w-3 h-3" /> Verified</span>
                    )}
                    {(viewProfile as any).is_premium && <KulmiPlus />}
                  </div>
                  {(viewProfile.location || viewProfile.city) && (
                    <p className="flex items-center gap-1.5 text-sm opacity-90 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {viewProfile.location || [viewProfile.city, viewProfile.country].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>

              <div className="p-6">
                {viewProfile.bio && <p className="text-sm text-[#5C574F] leading-relaxed font-serif italic mb-5">"{viewProfile.bio}"</p>}

                {/* How you compare */}
                {(() => {
                  if (!myProfile) return null;
                  const dims: { label: string; key: keyof Profile }[] = [
                    { label: 'Prayer', key: 'prayer_level' as keyof Profile },
                    { label: 'Wants children', key: 'children' as keyof Profile },
                    { label: 'Timeline', key: 'timeline' as keyof Profile },
                    { label: 'Relocate', key: 'relocate' as keyof Profile },
                    { label: 'Marital status', key: 'marital_status' as keyof Profile },
                    { label: 'Smoking', key: 'smoking' as keyof Profile },
                  ];
                  const rows = dims
                    .map((d) => ({ label: d.label, mine: (myProfile as any)[d.key] as string, theirs: (viewProfile as any)[d.key] as string }))
                    .filter((r) => r.mine || r.theirs);
                  if (rows.length === 0) return null;
                  const comparable = rows.filter((r) => r.mine && r.theirs);
                  const aligned = comparable.filter((r) => norm(r.mine) === norm(r.theirs)).length;
                  const pct = comparable.length ? Math.round((aligned / comparable.length) * 100) : 0;
                  return (
                    <div className="bg-[#E8F3ED] border border-[#1B4332]/15 rounded-2xl p-4 mb-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-[#1B4332]">How you compare</p>
                        {comparable.length > 0 && (
                          <span className="text-xs font-bold text-[#1B4332] bg-white rounded-full px-2.5 py-1">{pct}% aligned</span>
                        )}
                      </div>
                      <div className="grid grid-cols-[1fr_20px_1fr] gap-x-2 text-[10px] uppercase tracking-wider text-[#8B7355] mb-1.5">
                        <span className="text-right">You</span><span></span><span>{viewProfile.first_name}</span>
                      </div>
                      <div className="space-y-1.5">
                        {rows.map((r) => {
                          const match = r.mine && r.theirs && norm(r.mine) === norm(r.theirs);
                          return (
                            <div key={r.label} className="grid grid-cols-[1fr_20px_1fr] items-center gap-x-2">
                              <span className="text-xs text-[#2D2926] text-right leading-tight">{r.mine || '—'}</span>
                              <span className={`text-center text-sm ${match ? 'text-green-600' : 'text-[#C9C4BA]'}`}>{match ? '✓' : '·'}</span>
                              <span className="text-xs text-[#2D2926] leading-tight">{r.theirs || '—'}</span>
                              <span className="col-span-3 text-[10px] text-[#8B7355] -mt-1">{r.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <ModalSection title="About">
                  <Fact label="Occupation" value={viewProfile.occupation} />
                  <Fact label="Education" value={viewProfile.education} />
                  <Fact label="Languages" value={viewProfile.languages} />
                  <Fact label="Height" value={viewProfile.height} />
                  <Fact label="Heritage" value={viewProfile.heritage} />
                  <Fact label="Marital status" value={viewProfile.marital_status} />
                </ModalSection>

                <ModalSection title="Faith & values">
                  <Fact label="Prayer" value={viewProfile.prayer_level} />
                  <Fact label="Practice" value={(viewProfile as any).islamic_practice} />
                  <Fact label={viewProfile.gender === 'male' ? 'Beard' : 'Hijab'} value={(viewProfile as any).religious_dress} />
                </ModalSection>
                {(viewProfile as any).faith_statement && (
                  <p className="text-sm text-[#5C574F] leading-relaxed italic -mt-2 mb-5">"{(viewProfile as any).faith_statement}"</p>
                )}

                <ModalSection title="Lifestyle">
                  <Fact label="Smoking" value={(viewProfile as any).smoking} />
                  <Fact label="Khat" value={(viewProfile as any).khat} />
                  <Fact label="Polygyny" value={(viewProfile as any).open_to_polygyny} />
                </ModalSection>

                <ModalSection title="Marriage intentions">
                  <Fact label="Looking for" value={viewProfile.marriage_intent} />
                  <Fact label="Timeline" value={viewProfile.timeline} />
                  <Fact label="Relocate" value={viewProfile.relocate} />
                  <Fact label="Children" value={viewProfile.children} />
                </ModalSection>

                <TagSection title="Personality" items={(viewProfile as any).personality_traits} />
                <TagSection title="Communication style" items={(viewProfile as any).communication_style} />
                <TagSection title="Future goals" items={(viewProfile as any).future_goals} />

                {viewProfile.intro_audio_url && (
                  <div className="mb-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">🎤 Voice intro</p>
                    <audio controls src={viewProfile.intro_audio_url} className="w-full" />
                  </div>
                )}

                <p className="text-[11px] text-[#8B7355] mb-4 text-center">More photos unlock after you both match.</p>

                <div className="flex gap-3 sticky bottom-0 bg-white pt-2">
                  <button disabled={busy} onClick={() => { setViewProfile(null); handleSkip(); }} className="flex-1 px-6 py-3 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors disabled:opacity-50">Not now</button>
                  <button disabled={busy} onClick={() => { setViewProfile(null); handleInvite(); }} className="flex-[1.4] px-6 py-3 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"><Heart className="w-4 h-4" /> Send invitation</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
