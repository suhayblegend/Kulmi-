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
  listMyViewers,
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
import { DiscoverCardSkeleton } from './ui/Skeleton';
import { SmartImage } from './ui/SmartImage';
import { ComparePanel } from './ComparePanel';
import { detectNearby } from '../lib/geo';
import { cacheGet, cacheSet } from '../lib/cache';
import { haptic } from '../lib/native';

interface DiscoverCache {
  candidates: Profile[];
  invites: InvitationWithProfile[];
  sessions: SessionSummary[];
  openThreads: number;
  pendingSent: number;
  premium: boolean;
  viewersCount: number;
  myProfile: Profile | null;
  index: number;
}

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


export function Home({ onOpenSession, onOpenActivity, onActivityCount }: HomeProps) {
  const cached = cacheGet<DiscoverCache>('discover');
  const [loading, setLoading] = useState(!cached); // instant on revisit
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>(cached?.candidates ?? []);
  const [invites, setInvites] = useState<InvitationWithProfile[]>(cached?.invites ?? []);
  const [sessions, setSessions] = useState<SessionSummary[]>(cached?.sessions ?? []);
  const [index, setIndex] = useState(cached?.index ?? 0);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [openThreads, setOpenThreads] = useState(cached?.openThreads ?? 0);
  const [premium, setPremium] = useState(cached?.premium ?? false);
  const [pendingSent, setPendingSent] = useState(cached?.pendingSent ?? 0);
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(cached?.myProfile ?? null);
  const [viewersCount, setViewersCount] = useState(cached?.viewersCount ?? 0);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== '' && v !== null).length;

  // silent=true → refresh in the background without a skeleton (used on revisit).
  const load = useCallback(async (f: DiscoverFilters = {}, silent = false) => {
    if (!silent) setLoading(true);
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
      const prem = isPremium(meProf);
      const pending = mySent.filter((s) => s.status === 'pending').length;
      setPremium(prem);
      setMyProfile(meProf);
      let vc = 0;
      if (prem) { try { vc = (await listMyViewers()).length; setViewersCount(vc); } catch { /* ignore */ } }
      setCandidates(cands);
      setInvites(incoming);
      setSessions(active);
      setOpenThreads(open);
      setPendingSent(pending);
      // Fresh load starts at the top; a silent refresh keeps your place.
      const nextIndex = silent ? Math.min(indexRef.current, Math.max(0, cands.length - 1)) : 0;
      setIndex(nextIndex);
      onActivityCount?.(incoming.length + active.filter((s) => s.status !== 'completed').length);
      cacheSet<DiscoverCache>('discover', {
        candidates: cands, invites: incoming, sessions: active, openThreads: open,
        pendingSent: pending, premium: prem, viewersCount: vc, myProfile: meProf, index: nextIndex,
      });
    } catch (err: any) {
      if (!silent) setError(err.message || 'Could not load matches.');
    } finally {
      if (!silent) setLoading(false);
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

  // "Show people near me" — detect location, set city/country, apply.
  const [locating, setLocating] = useState(false);
  const [nearbyErr, setNearbyErr] = useState('');
  const handleNearby = async () => {
    setLocating(true);
    setNearbyErr('');
    try {
      const place = await detectNearby();
      if (!place.city && !place.country) { setNearbyErr('Could not detect your area — try typing your city.'); return; }
      const next: DiscoverFilters = { ...draftFilters, city: place.city, country: place.country };
      setDraftFilters(next);
      setFilters(next);
      setShowFilters(false);
      load(next);
    } catch {
      setNearbyErr('Location unavailable. Please allow location access, or type your city.');
    } finally {
      setLocating(false);
    }
  };

  // Keep a live ref of the index so a silent refresh can preserve the user's place.
  const indexRef = useRef(index);
  useEffect(() => { indexRef.current = index; }, [index]);
  // Persist the current card position so returning to Discover resumes there.
  useEffect(() => {
    const c = cacheGet<DiscoverCache>('discover');
    if (c && c.index !== index) cacheSet('discover', { ...c, index });
  }, [index]);

  // On first mount: skeleton only if we have nothing cached; otherwise refresh silently.
  const hadCacheRef = useRef(!!cached);
  useEffect(() => { load(filters, hadCacheRef.current); }, [load]);

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
      haptic('medium');
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
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-serif text-2xl text-[#1B4332] italic leading-none">Discover</h2>
            <p className="text-xs text-[#8B7355] mt-1.5">Thoughtful introductions, one at a time</p>
          </div>
        </div>
        <DiscoverCardSkeleton />
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

      {/* Kulmi+ — who viewed you (visible nudge, taps through to Activity) */}
      {premium && viewersCount > 0 && (
        <button
          onClick={onOpenActivity}
          className="w-full flex items-center gap-3 bg-white border border-[#E5E0D8] rounded-2xl px-4 py-3.5 text-left hover:border-[#1B4332] transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-[#F0EEE8] flex items-center justify-center shrink-0 text-lg">👀</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1B4332] leading-tight">
              {viewersCount} {viewersCount === 1 ? 'person' : 'people'} viewed your profile
            </p>
            <p className="text-[11px] text-[#8B7355] mt-0.5">Tap to see who's interested</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8B7355] shrink-0" />
        </button>
      )}

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="border border-[#E5E0D8] bg-white rounded-2xl p-5 space-y-4">
              <button
                onClick={handleNearby}
                disabled={locating}
                className="w-full flex items-center justify-center gap-2 bg-[#1B4332] text-white rounded-xl px-4 py-3 text-sm font-medium active:bg-[#143326] transition-colors disabled:opacity-60"
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                {locating ? 'Finding your area…' : 'Show people near me'}
              </button>
              {nearbyErr && <p className="text-[11px] text-red-600 text-center -mt-1">{nearbyErr}</p>}
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#8B7355]">
                <div className="flex-1 h-px bg-[#E5E0D8]" /> or filter manually <div className="flex-1 h-px bg-[#E5E0D8]" />
              </div>
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
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">City</label>
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

          <div className="relative">
            {/* Deck depth — a peek of the introductions still waiting behind. */}
            {remaining > 1 && (
              <div className="absolute inset-x-3 -bottom-2 h-8 bg-white border border-[#E5E0D8] rounded-3xl shadow-sm" aria-hidden />
            )}
            {remaining > 2 && (
              <div className="absolute inset-x-6 -bottom-4 h-8 bg-[#FBF9F4] border border-[#E5E0D8] rounded-3xl" aria-hidden />
            )}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="relative w-full border border-[#E5E0D8] bg-white shadow-[0_8px_40px_rgba(27,67,50,0.10)] rounded-3xl overflow-hidden"
            >
              <div className="relative h-80 bg-[#F0EEE8]">
                <SmartImage src={avatarFor(current)} className="absolute inset-0 w-full h-full" fit="cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

                {/* Suggested ribbon + values-alignment chip */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 bg-white/90 backdrop-blur text-[#1B4332] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">
                    <Sparkles className="w-3 h-3" /> Suggested for you
                  </span>
                  {(() => {
                    if (!myProfile) return null;
                    const nrm = (v?: string | null) => (v ?? '').trim().toLowerCase();
                    const keys: (keyof Profile)[] = ['prayer_level', 'children', 'timeline', 'relocate', 'marital_status', 'smoking'];
                    const comparable = keys.filter((k) => (myProfile as any)[k] && (current as any)[k]);
                    const aligned = comparable.filter((k) => nrm((myProfile as any)[k]) === nrm((current as any)[k])).length;
                    if (comparable.length < 2 || aligned === 0) return null;
                    return (
                      <span className="flex items-center gap-1 bg-[#1B4332]/85 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full shadow-sm">
                        💚 {aligned} {aligned === 1 ? 'value aligns' : 'values align'}
                      </span>
                    );
                  })()}
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
                  onClick={() => { if (current?.id) recordProfileView(current.id); setViewProfile(current); }}
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
          </div>
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
          <div className="fixed inset-0 z-[70] flex justify-center sm:items-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#2D2926]/50 sm:backdrop-blur-sm" onClick={() => setViewProfile(null)} />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative z-10 flex flex-col w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-white sm:rounded-3xl overflow-hidden shadow-2xl border border-[#E5E0D8]"
            >
              <button onClick={() => setViewProfile(null)} style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }} className="absolute right-3 z-20 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center active:bg-black/60"><X className="w-4.5 h-4.5" /></button>
              {/* Photo header — clean cover fill, stays pinned while details scroll. */}
              <div className="relative shrink-0 h-[42vh] sm:h-80 bg-[#F0EEE8]">
                <SmartImage src={avatarFor(viewProfile)} className="absolute inset-0 w-full h-full" fit="cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
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

              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                {viewProfile.bio && <p className="text-sm text-[#5C574F] leading-relaxed font-serif italic mb-5">"{viewProfile.bio}"</p>}

                {/* How you compare — interactive alignment panel */}
                {myProfile && <ComparePanel mine={myProfile} theirs={viewProfile} theirName={viewProfile.first_name || 'them'} />}

                <ModalSection title="About">
                  <Fact label="Occupation" value={viewProfile.occupation} />
                  <Fact label="Education" value={viewProfile.education} />
                  <Fact label="Languages" value={viewProfile.languages} />
                  <Fact label="Height" value={viewProfile.height} />
                  <Fact label="Heritage" value={viewProfile.heritage} />
                  <Fact label="Qabiil" value={(viewProfile as any).qabiil} />
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

                <p className="text-[11px] text-[#8B7355] text-center">More photos unlock after you both match.</p>
              </div>

              {/* Always-visible action bar (never scrolled off or cropped). */}
              <div
                className="shrink-0 flex gap-3 border-t border-[#E5E0D8] bg-white px-5 pt-3"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
              >
                <button disabled={busy} onClick={() => { setViewProfile(null); handleSkip(); }} className="flex-1 px-6 py-3.5 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium active:bg-[#FDFBF7] transition-colors disabled:opacity-50">Not now</button>
                <button disabled={busy} onClick={() => { setViewProfile(null); handleInvite(); }} className="flex-[1.4] px-6 py-3.5 rounded-xl bg-[#1B4332] text-white font-medium active:bg-[#143326] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"><Heart className="w-4 h-4" /> Send invitation</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
