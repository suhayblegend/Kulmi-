import { supabase } from './supabase';

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------
export interface Profile {
  id: string;
  email?: string | null;
  first_name: string | null;
  last_name?: string | null;
  age: number | null;
  gender: string | null;
  location: string | null;
  bio: string | null;
  role: string;
  profile_picture_url: string | null;
  country: string | null;
  city: string | null;
  occupation: string | null;
  education: string | null;
  languages: string | null;
  marriage_intent: string | null;
  timeline: string | null;
  relocate: string | null;
  children: string | null;
  prayer_level: string | null;
  islamic_practice: string | null;
  faith_statement: string | null;
  personality_traits: string[] | null;
  future_goals: string[] | null;
  communication_style: string[] | null;
  deal_breakers: string | null;
  marital_status?: string | null;
  height?: string | null;
  heritage?: string | null;
  has_children?: string | null;
  photo_verified: boolean | null;
  verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected' | null;
  verification_selfie_url?: string | null;
  wali_email?: string | null;
  gallery?: string[] | null;
  intro_audio_url?: string | null;
  intro_public?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  show_in_discovery?: boolean | null;
  push_notifications?: boolean | null;
  email_summaries?: boolean | null;
  read_receipts?: boolean | null;
}

export interface InvitationWithProfile {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender: Profile;
}

export interface ChatSummary {
  id: string;
  partner: Profile;
  lastMessage: string;
  lastMessageAt: string | null;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type?: 'text' | 'audio';
  created_at: string;
}

// Read OTHER users' safe columns through the public_profiles VIEW.
// If that view isn't present yet (the privacy migration hasn't been run),
// transparently fall back to the base `profiles` table so the app still works.
const PUBLIC_PROFILE_COLS =
  'id, first_name, age, gender, location, bio, role, profile_picture_url, country, city, occupation, education, languages, marital_status, height, heritage, marriage_intent, timeline, relocate, children, has_children, prayer_level, islamic_practice, faith_statement, personality_traits, future_goals, communication_style, photo_verified, verification_status, intro_audio_url';

let PROFILE_SRC = 'public_profiles';
// Only fall back when the VIEW genuinely doesn't exist (missing relation),
// not on any transient error — otherwise a blip would permanently break reads.
const isMissingView = (err: any): boolean =>
  !!err && (err.code === 'PGRST205' || err.code === '42P01') && /public_profiles/i.test(err.message || '');

/** Query safe profile columns of OTHER users, with automatic view→table fallback. */
async function readProfiles(cols: string, build: (q: any) => any): Promise<{ data: any; error: any }> {
  let res = await build(supabase.from(PROFILE_SRC).select(cols));
  if (isMissingView(res.error) && PROFILE_SRC !== 'profiles') {
    PROFILE_SRC = 'profiles';
    res = await build(supabase.from('profiles').select(cols));
  }
  return res;
}

const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400';

export function avatarFor(p: Pick<Profile, 'profile_picture_url'>): string {
  return p.profile_picture_url || FALLBACK_AVATAR;
}

// -------------------------------------------------------------
// Session
// -------------------------------------------------------------
// Uses getSession() (reads the local session — instant) instead of getUser()
// which makes a network round-trip on EVERY call. This is called by almost
// every query, so it was the main source of lag.
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// -------------------------------------------------------------
// Profile
// -------------------------------------------------------------
// Short-lived cache: getMyProfile is called many times per screen render.
let profileCache: { uid: string; profile: Profile | null; at: number } | null = null;
export function clearProfileCache() { profileCache = null; }

export async function getMyProfile(force = false): Promise<Profile | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  if (!force && profileCache && profileCache.uid === uid && Date.now() - profileCache.at < 8000) {
    return profileCache.profile;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  profileCache = { uid, profile: (data as Profile) ?? null, at: Date.now() };
  return profileCache.profile;
}

export async function updateMyProfile(fields: Partial<Profile>): Promise<void> {
  clearProfileCache();
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  // never let the client change privileged columns (the DB trigger also enforces this).
  // verification_status is kept so the user can set it to 'pending' when submitting a selfie.
  const { id, email, role, photo_verified, ...safe } = fields;
  const { error } = await supabase
    .from('profiles')
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq('id', uid);
  if (error) throw error;
}

// -------------------------------------------------------------
// Photo upload (Supabase Storage: bucket "avatars")
// -------------------------------------------------------------
async function uploadToAvatars(file: File, prefix: string): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${uid}/${prefix}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type || undefined });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/** Upload a photo to storage and return its public URL (does not touch the profile). */
export async function uploadPhoto(file: File): Promise<string> {
  return uploadToAvatars(file, 'photo');
}

/** Upload a profile picture and save its URL on the profile. Returns the URL. */
export async function uploadAvatar(file: File): Promise<string> {
  const url = await uploadToAvatars(file, 'avatar');
  await updateMyProfile({ profile_picture_url: url });
  return url;
}

/** Add an extra photo to the gallery (revealed only to matches). Returns the new gallery. */
export async function addGalleryPhoto(file: File): Promise<string[]> {
  const me = await getMyProfile();
  const url = await uploadToAvatars(file, 'photo');
  const gallery = [...(me?.gallery ?? []), url];
  await updateMyProfile({ gallery });
  return gallery;
}

export async function removeGalleryPhoto(url: string): Promise<string[]> {
  const me = await getMyProfile();
  const gallery = (me?.gallery ?? []).filter((u) => u !== url);
  await updateMyProfile({ gallery });
  return gallery;
}

/** A matched partner's extra photos (empty unless you share a chat with them). */
export async function getMatchGallery(partnerId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_gallery', { target: partnerId });
  if (error) return [];
  return (data as string[]) ?? [];
}

// -------------------------------------------------------------
// Voice intro
// -------------------------------------------------------------
export async function uploadIntro(blob: Blob): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const path = `${uid}/intro_${Date.now()}.webm`;
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true });
  if (error) throw error;
  const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
  await updateMyProfile({ intro_audio_url: url });
  return url;
}

export async function setIntroPublic(isPublic: boolean): Promise<void> {
  await updateMyProfile({ intro_public: isPublic });
}

export async function removeIntro(): Promise<void> {
  await updateMyProfile({ intro_audio_url: null });
}

/** A matched partner's voice intro (works even if they set it to matches-only). */
export async function getMatchIntro(partnerId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_intro', { target: partnerId });
  if (error) return null;
  return (data as string) ?? null;
}

/**
 * Submit a selfie for photo verification. Goes to a PENDING queue an admin
 * reviews — it does NOT auto-verify. (A DB trigger blocks self-verification.)
 */
export async function submitPhotoVerification(selfie: File): Promise<void> {
  const url = await uploadToAvatars(selfie, 'selfie');
  await updateMyProfile({ verification_status: 'pending', verification_selfie_url: url });
}

// -------------------------------------------------------------
// Discovery + invitations
// -------------------------------------------------------------
/**
 * Candidates the current user can invite: opposite gender (when known),
 * excluding self, anyone already invited (either direction), and anyone
 * already in a chat with the user.
 */
export interface DiscoverFilters {
  ageMin?: number;
  ageMax?: number;
  country?: string;
  city?: string;
  prayerLevel?: string;
  maritalStatus?: string;
  wantChildren?: string;
}

export async function discoverCandidates(filters: DiscoverFilters = {}): Promise<Profile[]> {
  const me = await getMyProfile();
  if (!me) return [];

  // Everyone I've already interacted with via invitations.
  const { data: invs } = await supabase
    .from('invitations')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`);

  // Everyone I already share a chat with.
  const { data: chats } = await supabase
    .from('chats')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${me.id},user2_id.eq.${me.id}`);

  const excluded = new Set<string>([me.id]);
  (invs ?? []).forEach((r: any) => {
    excluded.add(r.sender_id);
    excluded.add(r.receiver_id);
  });
  (chats ?? []).forEach((r: any) => {
    excluded.add(r.user1_id);
    excluded.add(r.user2_id);
  });

  const { data, error } = await readProfiles(PUBLIC_PROFILE_COLS, (q) => {
    q = q.eq('show_in_discovery', true).limit(100);
    if (me.gender === 'male' || me.gender === 'female') {
      q = q.eq('gender', me.gender === 'male' ? 'female' : 'male');
    }
    if (filters.ageMin) q = q.gte('age', filters.ageMin);
    if (filters.ageMax) q = q.lte('age', filters.ageMax);
    if (filters.country?.trim()) q = q.ilike('country', `%${filters.country.trim()}%`);
    if (filters.city?.trim()) q = q.ilike('city', `%${filters.city.trim()}%`);
    if (filters.prayerLevel) q = q.eq('prayer_level', filters.prayerLevel);
    if (filters.maritalStatus) q = q.eq('marital_status', filters.maritalStatus);
    if (filters.wantChildren) q = q.eq('children', filters.wantChildren);
    return q;
  });
  if (error) throw error;

  return (data as Profile[]).filter((p) => !excluded.has(p.id)).slice(0, 50);
}

export interface SentInvitation {
  id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  receiver: Profile;
}

/** Invitations the user has sent, so they can see progress (awaiting / declined). */
export async function listMySentInvitations(): Promise<SentInvitation[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data } = await supabase
    .from('invitations')
    .select('id, receiver_id, status, created_at')
    .eq('sender_id', uid)
    .in('status', ['pending', 'declined'])
    .order('created_at', { ascending: false });
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r: any) => r.receiver_id))];
  const { data: profs } = await readProfiles(PUBLIC_PROFILE_COLS, (q) => q.in('id', ids));
  const byId = new Map(((profs as any[]) ?? []).map((p: any) => [p.id, p as Profile]));
  return rows.filter((r: any) => byId.has(r.receiver_id)).map((r: any) => ({ ...r, receiver: byId.get(r.receiver_id)! }));
}

/** How many introductions the user has open right now (pending sent invites + active sessions). */
export async function countMyOpenThreads(): Promise<number> {
  const uid = await getCurrentUserId();
  if (!uid) return 0;
  const [{ count: sent }, { count: sess }] = await Promise.all([
    supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('sender_id', uid).eq('status', 'pending'),
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('status', 'active').or(`user1_id.eq.${uid},user2_id.eq.${uid}`),
  ]);
  return (sent ?? 0) + (sess ?? 0);
}

export async function sendInvitation(receiverId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase
    .from('invitations')
    .insert([{ sender_id: uid, receiver_id: receiverId, status: 'pending' }]);
  if (error) throw error;
}

export async function listIncomingInvitations(): Promise<InvitationWithProfile[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('invitations')
    .select('id, sender_id, receiver_id, status, created_at')
    .eq('receiver_id', uid)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const senderIds = [...new Set(rows.map((r: any) => r.sender_id))];
  const { data: senders } = await readProfiles(PUBLIC_PROFILE_COLS, (q) => q.in('id', senderIds));
  const byId = new Map((senders ?? []).map((p: any) => [p.id, p as Profile]));

  return rows
    .filter((r: any) => byId.has(r.sender_id))
    .map((r: any) => ({ ...r, sender: byId.get(r.sender_id)! })) as InvitationWithProfile[];
}

/** Accept or decline. On accept, a DB trigger creates a SESSION; we return its id. */
export async function respondToInvitation(
  invitationId: string,
  accept: boolean
): Promise<string | null> {
  const { data, error } = await supabase
    .from('invitations')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', invitationId)
    .select('sender_id, receiver_id')
    .single();
  if (error) throw error;
  if (!accept || !data) return null;
  const uid = await getCurrentUserId();
  const otherId = data.sender_id === uid ? data.receiver_id : data.sender_id;
  return findSessionWith(otherId);
}

async function findSessionWith(otherId: string): Promise<string | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const a = uid < otherId ? uid : otherId;
  const b = uid < otherId ? otherId : uid;
  const { data } = await supabase
    .from('sessions')
    .select('id')
    .eq('user1_id', a)
    .eq('user2_id', b)
    .maybeSingle();
  return data?.id ?? null;
}

// -------------------------------------------------------------
// Compatibility sessions (guided Q&A that gates a match)
// -------------------------------------------------------------
// Serious, marriage-focused questions — the deliberate filter that keeps Kulmi
// a real marriage platform rather than a casual dating app.
export const COMPATIBILITY_QUESTIONS: string[] = [
  'What does practising Islam look like in your daily life, and how do you hope it will shape your marriage?',
  'How do you see the roles and responsibilities of a husband and wife in the home?',
  "What are your expectations around where you'll live and how close you'll be to family and in-laws?",
  'How do you approach money in a marriage — providing, spending, saving, and financial decisions?',
  "What kind of Islamic upbringing do you want for your children, insha'Allah?",
  'When you disagree with someone close to you, how do you handle it and work things through?',
  'What are your main goals for the next five to ten years — in your deen, family, and life?',
  'What role should family and your Wali play in your marriage journey?',
];

export interface SessionSummary {
  id: string;
  partner: Profile;
  status: 'active' | 'completed' | 'ended';
  myAnsweredCount: number;
  partnerAnsweredCount: number;
  bothFinished: boolean;
  myDecision: 'yes' | 'no' | null;
}

export interface SessionAnswers {
  mine: Record<number, string>;
  theirs: Record<number, string>;
  partnerAnsweredCount: number;
}

export interface CompatibilityAnalysis {
  score: number;
  summary: string;
  strengths: string[];
  considerations: string[];
}

async function partnerIdFor(session: { user1_id: string; user2_id: string }, uid: string) {
  return session.user1_id === uid ? session.user2_id : session.user1_id;
}

export async function listActiveSessions(): Promise<SessionSummary[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, user1_id, user2_id, status')
    .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
    .neq('status', 'ended')
    .order('created_at', { ascending: false });
  if (!sessions || sessions.length === 0) return [];

  const partnerIds = sessions.map((s: any) => (s.user1_id === uid ? s.user2_id : s.user1_id));
  const { data: partners } = await readProfiles(PUBLIC_PROFILE_COLS, (q) => q.in('id', partnerIds));
  const byId = new Map(((partners as any[]) ?? []).map((p: any) => [p.id, p as Profile] as [string, Profile]));

  const out: SessionSummary[] = [];
  for (const s of sessions as any[]) {
    const partnerId = s.user1_id === uid ? s.user2_id : s.user1_id;
    const partner = byId.get(partnerId);
    if (!partner) continue;
    const [{ count: mine }, { count: theirs }, myDec] = await Promise.all([
      supabase.from('session_answers').select('id', { count: 'exact', head: true }).eq('session_id', s.id).eq('user_id', uid),
      supabase.from('session_answers').select('id', { count: 'exact', head: true }).eq('session_id', s.id).eq('user_id', partnerId),
      supabase.from('session_decisions').select('decision').eq('session_id', s.id).eq('user_id', uid).maybeSingle(),
    ]);
    const myAnsweredCount = mine ?? 0;
    const partnerAnsweredCount = theirs ?? 0;
    out.push({
      id: s.id,
      partner,
      status: s.status,
      myAnsweredCount,
      partnerAnsweredCount,
      bothFinished:
        myAnsweredCount >= COMPATIBILITY_QUESTIONS.length &&
        partnerAnsweredCount >= COMPATIBILITY_QUESTIONS.length,
      myDecision: (myDec.data?.decision as 'yes' | 'no') ?? null,
    });
  }
  return out;
}

export async function getSession(sessionId: string): Promise<SessionSummary | null> {
  const all = await listActiveSessions();
  return all.find((s) => s.id === sessionId) ?? null;
}

export async function getSessionAnswers(sessionId: string): Promise<SessionAnswers> {
  const uid = await getCurrentUserId();
  const { data } = await supabase
    .from('session_answers')
    .select('user_id, question_index, answer')
    .eq('session_id', sessionId);
  const mine: Record<number, string> = {};
  const theirs: Record<number, string> = {};
  (data ?? []).forEach((r: any) => {
    if (r.user_id === uid) mine[r.question_index] = r.answer;
    else theirs[r.question_index] = r.answer;
  });
  return { mine, theirs, partnerAnsweredCount: Object.keys(theirs).length };
}

export async function submitSessionAnswer(sessionId: string, questionIndex: number, answer: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase
    .from('session_answers')
    .upsert({ session_id: sessionId, user_id: uid, question_index: questionIndex, answer }, { onConflict: 'session_id,user_id,question_index' });
  if (error) throw error;
}

export async function submitSessionDecision(sessionId: string, decision: 'yes' | 'no'): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  // Decisions are final (there is no UPDATE policy) — insert once, ignore a duplicate.
  const { error } = await supabase
    .from('session_decisions')
    .insert([{ session_id: sessionId, user_id: uid, decision }]);
  if (error && error.code !== '23505') throw error; // 23505 = already decided
}

/** Did the mutual "yes" already create a chat? Returns its id or null. */
export async function chatForSession(sessionId: string): Promise<string | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data: s } = await supabase.from('sessions').select('user1_id, user2_id').eq('id', sessionId).maybeSingle();
  if (!s) return null;
  const partnerId = await partnerIdFor(s as any, uid);
  const { data } = await supabase
    .from('chats')
    .select('id, user1_id, user2_id')
    .or(`user1_id.eq.${uid},user2_id.eq.${uid}`);
  const match = (data ?? []).find(
    (c: any) =>
      (c.user1_id === uid && c.user2_id === partnerId) || (c.user2_id === uid && c.user1_id === partnerId)
  );
  return match?.id ?? null;
}

function computeCompatibility(mine: Profile, theirs: Profile): CompatibilityAnalysis {
  let score = 55;
  const strengths: string[] = [];
  const considerations: string[] = [];
  const overlap = (a?: string[] | null, b?: string[] | null) =>
    (a ?? []).filter((x) => (b ?? []).includes(x));

  if (mine.prayer_level && mine.prayer_level === theirs.prayer_level) {
    score += 12;
    strengths.push('You share a similar approach to prayer and practice.');
  }
  const goals = overlap(mine.future_goals, theirs.future_goals);
  if (goals.length) {
    score += Math.min(15, goals.length * 5);
    strengths.push(`Shared goals: ${goals.join(', ')}.`);
  }
  if (mine.children && mine.children === theirs.children) {
    score += 8;
    strengths.push('Aligned on wanting children.');
  }
  if (mine.relocate && theirs.relocate && mine.relocate !== theirs.relocate) {
    considerations.push('Talk through relocation expectations — your answers differ.');
  }
  if (mine.timeline && theirs.timeline && mine.timeline !== theirs.timeline) {
    considerations.push('Your marriage timelines may differ — worth discussing.');
  }
  if (strengths.length === 0) strengths.push('You are both intentional about marriage on a faith-first platform.');
  if (considerations.length === 0) considerations.push('Take time to discuss family expectations and daily life.');

  return {
    score: Math.max(0, Math.min(100, score)),
    summary:
      'A promising start based on your profiles. Use the conversation to explore shared values and where your visions of family life align.',
    strengths,
    considerations,
  };
}

/**
 * Compute a compatibility analysis locally from both profiles.
 * Entirely private — no third-party AI, nothing leaves your database.
 */
export async function analyzeCompatibility(sessionId: string): Promise<CompatibilityAnalysis> {
  const me = await getMyProfile();
  const summary = await getSession(sessionId);
  if (!me || !summary) throw new Error('Session not found');
  return computeCompatibility(me, summary.partner);
}

// -------------------------------------------------------------
// Chats + messages
// -------------------------------------------------------------
export async function listChats(): Promise<ChatSummary[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const { data: chats, error } = await supabase
    .from('chats')
    .select('id, user1_id, user2_id, created_at')
    .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!chats || chats.length === 0) return [];

  const partnerIds = chats.map((c: any) => (c.user1_id === uid ? c.user2_id : c.user1_id));
  const { data: partners } = await readProfiles(PUBLIC_PROFILE_COLS, (q) => q.in('id', partnerIds));
  const byId = new Map(((partners as any[]) ?? []).map((p: any) => [p.id, p as Profile]));

  const summaries: ChatSummary[] = [];
  for (const c of chats as any[]) {
    const partnerId = c.user1_id === uid ? c.user2_id : c.user1_id;
    const partner = byId.get(partnerId);
    if (!partner) continue;
    const { data: last } = await supabase
      .from('messages')
      .select('content, created_at')
      .eq('chat_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    summaries.push({
      id: c.id,
      partner,
      lastMessage: last?.content ?? 'Say Asalamu alaikum!',
      lastMessageAt: last?.created_at ?? null,
    });
  }
  return summaries;
}

export async function getChatPartner(chatId: string): Promise<Profile | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data: chat } = await supabase
    .from('chats')
    .select('user1_id, user2_id')
    .eq('id', chatId)
    .single();
  if (!chat) return null;
  const partnerId = chat.user1_id === uid ? chat.user2_id : chat.user1_id;
  const { data } = await readProfiles(PUBLIC_PROFILE_COLS, (q) => q.eq('id', partnerId).maybeSingle());
  return (data as Profile) ?? null;
}

export async function listMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Message[];
}

// -------------------------------------------------------------
// Stats (Progress screen)
// -------------------------------------------------------------
export interface MyStats {
  invitationsSent: number;
  incomingPending: number;
  matches: number;
  profileComplete: boolean;
  photoVerified: boolean;
}

export async function getMyStats(): Promise<MyStats> {
  const me = await getMyProfile();
  if (!me) {
    return { invitationsSent: 0, incomingPending: 0, matches: 0, profileComplete: false, photoVerified: false };
  }
  const [sent, incoming, chats] = await Promise.all([
    supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('sender_id', me.id),
    supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('receiver_id', me.id).eq('status', 'pending'),
    supabase.from('chats').select('id', { count: 'exact', head: true }).or(`user1_id.eq.${me.id},user2_id.eq.${me.id}`),
  ]);
  return {
    invitationsSent: sent.count ?? 0,
    incomingPending: incoming.count ?? 0,
    matches: chats.count ?? 0,
    profileComplete: !!(me.first_name && me.bio && me.age),
    photoVerified: !!me.photo_verified,
  };
}

export async function sendMessage(
  chatId: string,
  content: string,
  type: 'text' | 'audio' = 'text'
): Promise<Message | null> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('messages')
    .insert([{ chat_id: chatId, sender_id: uid, content, type }])
    .select()
    .single();
  if (error) throw error;
  return (data as Message) ?? null;
}

/** Upload a recorded voice note to the "media" bucket and send it as an audio message. */
export async function sendVoiceMessage(chatId: string, blob: Blob): Promise<Message | null> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const path = `${uid}/voice_${Date.now()}.webm`;
  const { error: upErr } = await supabase.storage
    .from('media')
    .upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true });
  if (upErr) throw upErr;
  const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
  return sendMessage(chatId, url, 'audio');
}

// -------------------------------------------------------------
// Relationship status / success tracking
// -------------------------------------------------------------
export async function setChatStatus(chatId: string, status: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase
    .from('chat_status')
    .upsert({ chat_id: chatId, user_id: uid, status, updated_at: new Date().toISOString() }, { onConflict: 'chat_id,user_id' });
  if (error) throw error;
}

export async function getChatMeta(chatId: string): Promise<{ confirmedStatus: string | null; myStatus: string | null }> {
  const uid = await getCurrentUserId();
  const [{ data: chat }, { data: mine }] = await Promise.all([
    supabase.from('chats').select('confirmed_status').eq('id', chatId).maybeSingle(),
    supabase.from('chat_status').select('status').eq('chat_id', chatId).eq('user_id', uid ?? '').maybeSingle(),
  ]);
  return { confirmedStatus: (chat as any)?.confirmed_status ?? null, myStatus: (mine as any)?.status ?? null };
}

// -------------------------------------------------------------
// Moderation / reports
// -------------------------------------------------------------
export async function reportUser(reportedId: string, reason: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase
    .from('reports')
    .insert([{ reporter_id: uid, reported_id: reportedId, reason }]);
  if (error) throw error;
}

// -------------------------------------------------------------
// Settings
// -------------------------------------------------------------
export async function signOut(): Promise<void> {
  clearProfileCache();
  await supabase.auth.signOut();
}

export async function setWaliEmail(email: string): Promise<void> {
  await updateMyProfile({ wali_email: email });
}

/** Deletes the user's profile row + signs out. (Removing the auth record itself
 *  requires a server-side admin call — do that from Supabase if needed.) */
export async function deleteMyAccount(): Promise<void> {
  const uid = await getCurrentUserId();
  if (uid) await supabase.from('profiles').delete().eq('id', uid);
  await supabase.auth.signOut();
}

// -------------------------------------------------------------
// Admin
// -------------------------------------------------------------
export interface AdminStats {
  users: number;
  verified: number;
  pendingVerifications: number;
  matches: number;
  activeSessions: number;
  pendingReports: number;
  successes: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [users, verified, pendingV, matches, sessions, reports, successes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'verified'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    supabase.from('chats').select('id', { count: 'exact', head: true }),
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('chats').select('id', { count: 'exact', head: true }).not('confirmed_status', 'is', null),
  ]);
  return {
    users: users.count ?? 0,
    verified: verified.count ?? 0,
    pendingVerifications: pendingV.count ?? 0,
    matches: matches.count ?? 0,
    activeSessions: sessions.count ?? 0,
    pendingReports: reports.count ?? 0,
    successes: successes.count ?? 0,
  };
}

export async function adminListSuccesses(): Promise<AdminPair[]> {
  const { data } = await supabase
    .from('chats')
    .select('id, user1_id, user2_id, confirmed_status, confirmed_at')
    .not('confirmed_status', 'is', null)
    .order('confirmed_at', { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const names = await namesFor(rows.flatMap((r: any) => [r.user1_id, r.user2_id]));
  return rows.map((r: any) => ({
    id: r.id,
    userA: names.get(r.user1_id) ?? '—',
    userB: names.get(r.user2_id) ?? '—',
    status: r.confirmed_status,
    created_at: r.confirmed_at,
  }));
}

export async function adminListUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function adminListPendingVerifications(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('verification_status', 'pending')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function adminReviewVerification(userId: string, approve: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ photo_verified: approve, verification_status: approve ? 'verified' : 'rejected' })
    .eq('id', userId);
  if (error) throw error;
}

export async function adminSetRole(userId: string, role: 'user' | 'wali' | 'admin'): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

/** Suspend/unsuspend = hide/show from discovery. */
export async function adminSetDiscovery(userId: string, show: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ show_in_discovery: show }).eq('id', userId);
  if (error) throw error;
}

export async function adminDeleteUser(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
}

export interface AdminPair {
  id: string;
  userA: string;
  userB: string;
  status: string;
  created_at: string;
}

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await readProfiles('id, first_name', (q) => q.in('id', ids));
  return new Map(((data as any[]) ?? []).map((p: any) => [p.id, p.first_name || 'Member']));
}

export async function adminListSessions(): Promise<AdminPair[]> {
  const { data } = await supabase
    .from('sessions')
    .select('id, user1_id, user2_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const names = await namesFor(rows.flatMap((r: any) => [r.user1_id, r.user2_id]));
  return rows.map((r: any) => ({
    id: r.id, userA: names.get(r.user1_id) ?? '—', userB: names.get(r.user2_id) ?? '—', status: r.status, created_at: r.created_at,
  }));
}

export async function adminListChats(): Promise<AdminPair[]> {
  const { data } = await supabase
    .from('chats')
    .select('id, user1_id, user2_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const names = await namesFor(rows.flatMap((r: any) => [r.user1_id, r.user2_id]));
  return rows.map((r: any) => ({
    id: r.id, userA: names.get(r.user1_id) ?? '—', userB: names.get(r.user2_id) ?? '—', status: 'active', created_at: r.created_at,
  }));
}

export interface ReportRow {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  reported: string;
  reporter: string;
}

export async function adminListReports(): Promise<ReportRow[]> {
  const { data } = await supabase
    .from('reports')
    .select('id, reason, status, created_at, reporter_id, reported_id')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const names = await namesFor(rows.flatMap((r: any) => [r.reporter_id, r.reported_id]));
  return rows.map((r: any) => ({
    id: r.id, reason: r.reason, status: r.status, created_at: r.created_at,
    reported: names.get(r.reported_id) ?? '—', reporter: names.get(r.reporter_id) ?? '—',
  }));
}

export async function adminUpdateReport(reportId: string, status: 'reviewed' | 'dismissed'): Promise<void> {
  const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
  if (error) throw error;
}

// -------------------------------------------------------------
// Wali (guardian) — read-only oversight of wards
// -------------------------------------------------------------
export interface WardActivity {
  ward: Profile;
  sessions: { id: string; partnerName: string; status: string }[];
  chats: { id: string; partnerName: string; messageCount: number }[];
}

export async function listWardActivity(): Promise<WardActivity[]> {
  // Wards' safe columns via a SECURITY DEFINER function (no PII leak).
  const { data: wards } = await supabase.rpc('get_my_wards');
  if (!wards || wards.length === 0) return [];

  const out: WardActivity[] = [];
  for (const ward of wards as Profile[]) {
    const [{ data: sess }, { data: chats }] = await Promise.all([
      supabase.from('sessions').select('id, user1_id, user2_id, status').or(`user1_id.eq.${ward.id},user2_id.eq.${ward.id}`),
      supabase.from('chats').select('id, user1_id, user2_id').or(`user1_id.eq.${ward.id},user2_id.eq.${ward.id}`),
    ]);
    const partnerIds = [
      ...(sess ?? []).map((s: any) => (s.user1_id === ward.id ? s.user2_id : s.user1_id)),
      ...(chats ?? []).map((c: any) => (c.user1_id === ward.id ? c.user2_id : c.user1_id)),
    ];
    const names = await namesFor(partnerIds);
    const chatRows = [];
    for (const c of chats ?? []) {
      const partnerId = c.user1_id === ward.id ? c.user2_id : c.user1_id;
      const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('chat_id', c.id);
      chatRows.push({ id: c.id, partnerName: names.get(partnerId) ?? '—', messageCount: count ?? 0 });
    }
    out.push({
      ward,
      sessions: (sess ?? []).map((s: any) => ({
        id: s.id, partnerName: names.get(s.user1_id === ward.id ? s.user2_id : s.user1_id) ?? '—', status: s.status,
      })),
      chats: chatRows,
    });
  }
  return out;
}

/** Read-only transcript of a chat (used by admin + wali). */
export async function readTranscript(chatId: string): Promise<Message[]> {
  return listMessages(chatId);
}
