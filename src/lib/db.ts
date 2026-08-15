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
  religious_dress?: string | null;
  smoking?: string | null;
  khat?: string | null;
  open_to_polygyny?: string | null;
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
  verification_note?: string | null;
  wali_email?: string | null;
  gallery?: string[] | null;
  photo_hash?: string | null;
  compat_questions?: string[] | null;
  intro_audio_url?: string | null;
  intro_public?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  show_in_discovery?: boolean | null;
  push_notifications?: boolean | null;
  email_summaries?: boolean | null;
  email_unsubscribed?: boolean | null;
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
  'id, first_name, age, gender, location, bio, role, profile_picture_url, country, city, occupation, education, languages, marital_status, height, heritage, marriage_intent, timeline, relocate, children, has_children, prayer_level, islamic_practice, faith_statement, religious_dress, smoking, khat, open_to_polygyny, personality_traits, future_goals, communication_style, photo_verified, verification_status, intro_audio_url';

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
  // Voice intros are stored as private paths — resolve them to playable signed
  // URLs here so every caller (Discover, invitations, chats) gets a usable src.
  if (Array.isArray(res.data)) {
    await Promise.all(res.data.map(async (p: any) => {
      if (p?.intro_audio_url && !/^(https?:|data:|blob:)/.test(p.intro_audio_url)) {
        p.intro_audio_url = await resolveMediaUrl(p.intro_audio_url);
      }
    }));
  } else if (res.data?.intro_audio_url && !/^(https?:|data:|blob:)/.test(res.data.intro_audio_url)) {
    res.data.intro_audio_url = await resolveMediaUrl(res.data.intro_audio_url);
  }
  return res;
}

/** Profiles you have a RELATIONSHIP with (invitation/session/chat) — readable
 *  even if they've hidden from discovery, via a definer RPC. Falls back to the
 *  public view if the RPC isn't installed yet. */
async function readProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const rpc = await supabase.rpc('get_profile_cards', { ids });
  if (!rpc.error && Array.isArray(rpc.data)) {
    await Promise.all((rpc.data as any[]).map(async (p: any) => {
      if (p?.intro_audio_url && !/^(https?:|data:|blob:)/.test(p.intro_audio_url)) {
        p.intro_audio_url = await resolveMediaUrl(p.intro_audio_url);
      }
    }));
    return rpc.data as Profile[];
  }
  const { data } = await readProfiles(PUBLIC_PROFILE_COLS, (q) => q.in('id', ids));
  return ((data as Profile[]) ?? []);
}

/** A safe stand-in when a partner's public profile can't be read (e.g. they've
 *  hidden from discovery and the get_profile_cards RPC isn't installed yet). It
 *  keeps a relationship you're already in — a session or chat — from ever
 *  vanishing or looking "ended" just because the display fetch came back empty. */
function minimalPartner(id: string): Profile {
  return { id, first_name: 'Member' } as unknown as Profile;
}

// Neutral placeholder (no human face) — a real photo is required at onboarding,
// so this only shows for edge cases, never as someone's apparent face.
const FALLBACK_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
      '<rect width="400" height="400" fill="#E5E0D8"/>' +
      '<circle cx="200" cy="160" r="60" fill="#C9C1B4"/>' +
      '<path d="M90 340c0-60 50-104 110-104s110 44 110 104z" fill="#C9C1B4"/>' +
    '</svg>'
  );

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
  const { id, email, role, photo_verified, verification_note, ...safe } = fields;
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

/** Upload a photo to storage and return its public URL (does not touch the profile).
 *  Used for the MAIN profile photo only — that one is shown in Discover. */
export async function uploadPhoto(file: File): Promise<string> {
  return uploadToAvatars(file, 'photo');
}

// -------------------------------------------------------------
// Private media (bucket "secure": selfies, gallery, chat voice notes)
// Stored as PATHS, never public URLs. Read back via short-lived signed URLs
// gated by storage RLS (owner / admin / a match who shares a chat).
// -------------------------------------------------------------
const SECURE_BUCKET = 'secure';

async function uploadSecure(data: File | Blob, category: 'selfie' | 'gallery' | 'voice' | 'answer' | 'intro', ext: string): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const path = `${uid}/${category}/${Date.now()}.${ext}`;
  const contentType = (data as File).type || (category === 'voice' ? 'audio/webm' : undefined);
  const { error } = await supabase.storage.from(SECURE_BUCKET).upload(path, data, { upsert: true, contentType });
  if (error) throw error;
  return path;
}

const isUrlLike = (ref: string) => /^(https?:|data:|blob:)/.test(ref);

// path → {signed url, expiry}; keeps media URLs stable across refreshes.
const signedUrlCache = new Map<string, { url: string; exp: number }>();

/** Turn a stored media reference into a loadable URL. Full URLs / data URIs
 *  (public or legacy) pass through unchanged; bare paths are signed against the
 *  private bucket (1h). Returns null if it can't be resolved. */
export async function resolveMediaUrl(ref?: string | null): Promise<string | null> {
  if (!ref) return null;
  if (isUrlLike(ref)) return ref;
  // 1-week signed URLs, cached per path: repeated refreshes reuse the SAME URL,
  // so <img>/<audio> elements don't reload (which looked like flicker) and the
  // browser cache works. Re-signed well before expiry.
  const cached = signedUrlCache.get(ref);
  if (cached && cached.exp > Date.now()) return cached.url;
  const { data } = await supabase.storage.from(SECURE_BUCKET).createSignedUrl(ref, 60 * 60 * 24 * 7);
  if (data?.signedUrl) signedUrlCache.set(ref, { url: data.signedUrl, exp: Date.now() + 60 * 60 * 24 * 6 * 1000 });
  return data?.signedUrl ?? null;
}

export async function resolveMediaUrls(refs: string[]): Promise<string[]> {
  const out = await Promise.all(refs.map((r) => resolveMediaUrl(r)));
  return out.filter((u): u is string => !!u);
}

/** Best-effort removal of just-uploaded files when the following save fails
 *  (e.g. duplicate-photo rejection), so we don't leave orphans in storage. */
export async function cleanupUploads(mainUrl: string | null, galleryPaths: string[]): Promise<void> {
  try {
    if (mainUrl && mainUrl.includes('/avatars/')) {
      const path = decodeURIComponent(mainUrl.split('/avatars/')[1].split('?')[0]);
      if (path) await supabase.storage.from('avatars').remove([path]);
    }
    const secure = galleryPaths.filter((p) => p && !isUrlLike(p));
    if (secure.length) await supabase.storage.from(SECURE_BUCKET).remove(secure);
  } catch { /* best effort */ }
}

// -------------------------------------------------------------
// Photo authenticity helpers (duplicate blocking + basic quality)
// -------------------------------------------------------------
/** SHA-256 of a file's bytes — an exact-image fingerprint. */
export async function sha256Hex(data: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await data.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Reject obviously-unusable images (too small / undecodable → likely not a real photo). */
export async function isAcceptablePhoto(file: Blob): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(file);
    const ok = bmp.width >= 200 && bmp.height >= 200;
    (bmp as any).close?.();
    return ok;
  } catch {
    return true; // if the browser can't decode it, don't hard-block here
  }
}

export function isDuplicatePhotoError(e: any): boolean {
  return e?.code === '23505' || /photo_hash|duplicate key/i.test(String(e?.message || ''));
}

const DUP_PHOTO_MSG = 'This photo is already used by another Kulmi account. Please upload a genuine photo of yourself.';

/** Upload a profile picture and save its URL + fingerprint. Returns the URL.
 *  Throws a friendly error if the image is already used by someone else. */
export async function uploadAvatar(file: File): Promise<string> {
  if (!(await isAcceptablePhoto(file))) throw new Error('Please upload a clearer, larger photo of your face.');
  const hash = await sha256Hex(file);
  const url = await uploadToAvatars(file, 'avatar');
  try {
    await updateMyProfile({ profile_picture_url: url, photo_hash: hash } as Partial<Profile>);
  } catch (e) {
    if (isDuplicatePhotoError(e)) throw new Error(DUP_PHOTO_MSG);
    throw e;
  }
  return url;
}

export interface GalleryPhoto { path: string; url: string }

/** Upload one gallery image to the private bucket and return its PATH (no profile write). */
export async function uploadGalleryPhoto(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  return uploadSecure(file, 'gallery', ext);
}

/** Add an extra photo to the gallery (revealed only to matches). Stored privately. */
export async function addGalleryPhoto(file: File): Promise<void> {
  const me = await getMyProfile(true);
  const path = await uploadGalleryPhoto(file);
  const gallery = [...(me?.gallery ?? []), path];
  await updateMyProfile({ gallery });
}

export async function removeGalleryPhoto(ref: string): Promise<void> {
  const me = await getMyProfile(true);
  const gallery = (me?.gallery ?? []).filter((u) => u !== ref);
  await updateMyProfile({ gallery });
  if (!isUrlLike(ref)) {
    try { await supabase.storage.from(SECURE_BUCKET).remove([ref]); } catch { /* best effort */ }
  }
}

/** My own gallery as {path, signed-url} pairs for display + management. */
export async function getMyGallery(): Promise<GalleryPhoto[]> {
  const me = await getMyProfile();
  const refs = me?.gallery ?? [];
  const pairs = await Promise.all(refs.map(async (path) => ({ path, url: (await resolveMediaUrl(path)) ?? '' })));
  return pairs.filter((p) => p.url);
}

/** A matched partner's extra photos as signed URLs (empty unless you share a chat). */
export async function getMatchGallery(partnerId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_gallery', { target: partnerId });
  if (error) return [];
  return resolveMediaUrls((data as string[]) ?? []);
}

// -------------------------------------------------------------
// Voice intro
// -------------------------------------------------------------
/** Record a voice intro. Stored PRIVATELY (secure bucket); access is governed by
 *  storage rules: everyone signed-in if intro_public, otherwise matches only.
 *  Returns a playable (signed) URL. */
export async function uploadIntro(blob: Blob): Promise<string> {
  const path = await uploadSecure(blob, 'intro', 'webm');
  await updateMyProfile({ intro_audio_url: path });
  return (await resolveMediaUrl(path)) ?? path;
}

export async function setIntroPublic(isPublic: boolean): Promise<void> {
  await updateMyProfile({ intro_public: isPublic });
}

export async function removeIntro(): Promise<void> {
  const me = await getMyProfile(true);
  const ref = me?.intro_audio_url;
  await updateMyProfile({ intro_audio_url: null });
  if (ref && !isUrlLike(ref)) {
    try { await supabase.storage.from(SECURE_BUCKET).remove([ref]); } catch { /* best effort */ }
  }
}

/** A matched partner's voice intro (works even if they set it to matches-only). */
export async function getMatchIntro(partnerId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_intro', { target: partnerId });
  if (error) return null;
  return resolveMediaUrl((data as string) ?? null);
}

/**
 * Submit a selfie for photo verification. Goes to a PENDING queue an admin
 * reviews — it does NOT auto-verify. (A DB trigger blocks self-verification.)
 */
export async function submitPhotoVerification(selfie: File): Promise<void> {
  const ext = (selfie.name.split('.').pop() || 'jpg').toLowerCase();
  const path = await uploadSecure(selfie, 'selfie', ext); // PRIVATE — only admins can view
  await updateMyProfile({ verification_status: 'pending', verification_selfie_url: path });
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

  // Anyone I've ended contact with — OR who ended contact with me (both
  // directions, via a SECURITY DEFINER function so it's silent to them).
  const { data: blockedIds } = await supabase.rpc('blocked_user_ids');

  const excluded = new Set<string>([me.id]);
  (invs ?? []).forEach((r: any) => {
    excluded.add(r.sender_id);
    excluded.add(r.receiver_id);
  });
  (chats ?? []).forEach((r: any) => {
    excluded.add(r.user1_id);
    excluded.add(r.user2_id);
  });
  ((blockedIds as string[]) ?? []).forEach((id) => excluded.add(id));

  const { data, error } = await readProfiles(PUBLIC_PROFILE_COLS, (q) => {
    // Only verified members with a real photo appear in Discover.
    q = q.eq('show_in_discovery', true).eq('verification_status', 'verified').not('profile_picture_url', 'is', null).limit(100);
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
  const profs = await readProfilesByIds(ids);
  const byId = new Map(profs.map((p: any) => [p.id, p as Profile]));
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
  const senders = await readProfilesByIds(senderIds);
  const byId = new Map(senders.map((p: any) => [p.id, p as Profile]));

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
  questions: string[];
  myAnsweredCount: number;
  partnerAnsweredCount: number;
  bothFinished: boolean;
  myDecision: 'yes' | 'no' | null;
}

export interface SessionAnswers {
  mine: Record<number, string>;
  theirs: Record<number, string>;
  mineAudio: Record<number, string>;   // signed URLs
  theirsAudio: Record<number, string>; // signed URLs
  partnerAnsweredCount: number;
}

/** The default question set, or the user's own customised/ordered list. */
export async function getMyCompatQuestions(): Promise<string[]> {
  const me = await getMyProfile();
  const custom = (me as any)?.compat_questions as string[] | null | undefined;
  return custom && custom.length ? custom : [...COMPATIBILITY_QUESTIONS];
}

/** Save the user's preferred question set (pass the default list to reset). */
export async function setMyCompatQuestions(questions: string[]): Promise<void> {
  const cleaned = questions.map((q) => q.trim()).filter(Boolean);
  await updateMyProfile({ compat_questions: cleaned.length ? cleaned : null } as any);
}

/** Upload a recorded voice answer to the private bucket; returns its path. */
export async function uploadSessionAnswerAudio(blob: Blob): Promise<string> {
  return uploadSecure(blob, 'answer', 'webm');
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
    .select('id, user1_id, user2_id, status, questions')
    .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
    .neq('status', 'ended')
    .order('created_at', { ascending: false });
  if (!sessions || sessions.length === 0) return [];

  const partnerIds = sessions.map((s: any) => (s.user1_id === uid ? s.user2_id : s.user1_id));
  const partners = await readProfilesByIds(partnerIds);
  const byId = new Map(partners.map((p: any) => [p.id, p as Profile] as [string, Profile]));

  const out: SessionSummary[] = [];
  for (const s of sessions as any[]) {
    const partnerId = s.user1_id === uid ? s.user2_id : s.user1_id;
    // Never DROP a session just because the partner's display profile couldn't
    // be read — that made a live session look like it had "ended". Fall back to
    // a minimal stand-in; real details appear once get_profile_cards is present.
    const partner = byId.get(partnerId) ?? minimalPartner(partnerId);
    out.push(await buildSessionSummary(s, uid, partnerId, partner));
  }
  return out;
}

/** Compute a SessionSummary (progress + decision) for one session row. */
async function buildSessionSummary(
  s: any, uid: string, partnerId: string, partner: Profile
): Promise<SessionSummary> {
  const [prog, myDec] = await Promise.all([
    supabase.rpc('session_progress', { sess: s.id }),
    supabase.from('session_decisions').select('decision').eq('session_id', s.id).eq('user_id', uid).maybeSingle(),
  ]);
  let myAnsweredCount = 0;
  let partnerAnsweredCount = 0;
  if (!prog.error && Array.isArray(prog.data)) {
    for (const row of prog.data as { uid: string; answered: number }[]) {
      if (row.uid === uid) myAnsweredCount = row.answered; else partnerAnsweredCount = row.answered;
    }
  } else {
    // Fallback if the progress function isn't there yet (SQL not re-run).
    const [{ count: mine }, { count: theirs }] = await Promise.all([
      supabase.from('session_answers').select('id', { count: 'exact', head: true }).eq('session_id', s.id).eq('user_id', uid),
      supabase.from('session_answers').select('id', { count: 'exact', head: true }).eq('session_id', s.id).eq('user_id', partnerId),
    ]);
    myAnsweredCount = mine ?? 0;
    partnerAnsweredCount = theirs ?? 0;
  }
  const questions = (s.questions as string[] | null)?.length ? (s.questions as string[]) : [...COMPATIBILITY_QUESTIONS];
  return {
    id: s.id,
    partner,
    status: s.status,
    questions,
    myAnsweredCount,
    partnerAnsweredCount,
    bothFinished: myAnsweredCount >= questions.length && partnerAnsweredCount >= questions.length,
    myDecision: (myDec.data?.decision as 'yes' | 'no') ?? null,
  };
}

export async function getSession(sessionId: string): Promise<SessionSummary | null> {
  // Fetch the session row DIRECTLY (RLS lets a member read their own session),
  // so a session you belong to is never mistaken for "ended" just because it
  // fell out of a filtered list or the partner's profile couldn't be read.
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data: s } = await supabase
    .from('sessions')
    .select('id, user1_id, user2_id, status, questions')
    .eq('id', sessionId)
    .maybeSingle();
  if (!s) return null;
  if (s.user1_id !== uid && s.user2_id !== uid) return null; // not a participant
  const partnerId = s.user1_id === uid ? s.user2_id : s.user1_id;
  const found = await readProfilesByIds([partnerId]);
  const partner = found[0] ?? minimalPartner(partnerId);
  return buildSessionSummary(s, uid, partnerId, partner);
}

export async function getSessionAnswers(sessionId: string): Promise<SessionAnswers> {
  const uid = await getCurrentUserId();
  // Prefer the privacy-gated RPC (hides the partner's answers until both finish).
  // Fall back to a direct read if the function isn't there yet (SQL not re-run).
  let data: any[] | null = null;
  const rpc = await supabase.rpc('get_session_answers', { sess: sessionId });
  if (!rpc.error && Array.isArray(rpc.data)) {
    data = rpc.data;
  } else {
    const direct = await supabase
      .from('session_answers')
      .select('user_id, question_index, answer, answer_audio')
      .eq('session_id', sessionId);
    data = direct.data ?? [];
  }
  const mine: Record<number, string> = {};
  const theirs: Record<number, string> = {};
  const mineAudio: Record<number, string> = {};
  const theirsAudio: Record<number, string> = {};
  await Promise.all((data ?? []).map(async (r: any) => {
    const audioUrl = r.answer_audio ? await resolveMediaUrl(r.answer_audio) : null;
    if (r.user_id === uid) {
      mine[r.question_index] = r.answer ?? '';
      if (audioUrl) mineAudio[r.question_index] = audioUrl;
    } else {
      theirs[r.question_index] = r.answer ?? '';
      if (audioUrl) theirsAudio[r.question_index] = audioUrl;
    }
  }));
  return { mine, theirs, mineAudio, theirsAudio, partnerAnsweredCount: Object.keys(theirs).length };
}

export async function submitSessionAnswer(sessionId: string, questionIndex: number, answer: string, audioPath?: string | null): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase
    .from('session_answers')
    .upsert(
      { session_id: sessionId, user_id: uid, question_index: questionIndex, answer, answer_audio: audioPath ?? null },
      { onConflict: 'session_id,user_id,question_index' }
    );
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

  // Conversations I've ended (End match / stop contact) drop out of my list.
  const { data: endedRows } = await supabase
    .from('chat_status')
    .select('chat_id')
    .eq('user_id', uid)
    .eq('status', 'ended');
  const endedIds = new Set(((endedRows as any[]) ?? []).map((r) => r.chat_id));
  const visibleChats = (chats as any[]).filter((c) => !endedIds.has(c.id));
  if (visibleChats.length === 0) return [];

  const partnerIds = visibleChats.map((c: any) => (c.user1_id === uid ? c.user2_id : c.user1_id));
  const partners = await readProfilesByIds(partnerIds);
  const byId = new Map(partners.map((p: any) => [p.id, p as Profile]));

  const summaries: ChatSummary[] = [];
  for (const c of visibleChats as any[]) {
    const partnerId = c.user1_id === uid ? c.user2_id : c.user1_id;
    // Keep the conversation visible even if the partner's display profile can't
    // be read (hidden from discovery + RPC not installed) — use a stand-in.
    const partner = byId.get(partnerId) ?? minimalPartner(partnerId);
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
    .maybeSingle(); // partner may have deleted their account → no row, don't throw
  if (!chat) return null;
  const partnerId = chat.user1_id === uid ? chat.user2_id : chat.user1_id;
  const partners = await readProfilesByIds([partnerId]);
  // Chat row exists → the partner exists; if their display profile is unreadable
  // (hidden + RPC missing) fall back to a stand-in so the chat still opens.
  return partners[0] ?? minimalPartner(partnerId);
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
  const path = await uploadSecure(blob, 'voice', 'webm'); // PRIVATE — only the two matched people can play it
  return sendMessage(chatId, path, 'audio');
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
// Wali / contact
// -------------------------------------------------------------
/** True if the signed-in account is a guardian (Wali) for at least one member
 *  — i.e. their email is set as someone's wali_email. Works even with no
 *  member profile of their own. */
export async function iAmWali(): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_my_wards');
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export interface ContactMessage {
  id: string;
  name: string | null;
  email: string | null;
  message: string;
  handled: boolean;
  created_at: string;
}

/** Send a contact-form message (works for logged-out visitors too). */
export async function submitContactMessage(name: string, email: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('contact_messages')
    .insert([{ name: name.trim() || null, email: email.trim() || null, message: message.trim() }]);
  if (error) throw error;
}

export async function adminListContactMessages(): Promise<ContactMessage[]> {
  const { data } = await supabase
    .from('contact_messages')
    .select('id, name, email, message, handled, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  return (data as ContactMessage[]) ?? [];
}

export async function adminMarkContactHandled(id: string, handled: boolean): Promise<void> {
  const { error } = await supabase.from('contact_messages').update({ handled }).eq('id', id);
  if (error) throw error;
}

export interface DeletionRow { id: string; reason: string | null; detail: string | null; created_at: string }
export async function adminListDeletions(): Promise<DeletionRow[]> {
  const { data } = await supabase
    .from('account_deletions')
    .select('id, reason, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  return (data as DeletionRow[]) ?? [];
}

// -------------------------------------------------------------
// Admin email blast (sends via the "broadcast" Edge Function + Resend)
// -------------------------------------------------------------
export type BroadcastAudience = 'all' | 'verified';

/** How many people a blast to this audience would reach. */
export async function adminCountRecipients(audience: BroadcastAudience): Promise<number> {
  const base = () => {
    let q = supabase.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'is', null);
    if (audience === 'verified') q = q.eq('verification_status', 'verified');
    return q;
  };
  // Prefer excluding opt-outs, but fall back if the email_unsubscribed column
  // isn't there yet (i.e. the latest SQL hasn't been run) so the count still works.
  let { count, error } = await base().not('email_unsubscribed', 'is', true);
  if (error) ({ count } = await base());
  return count ?? 0;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Turn the admin's plain-text message into simple, safe HTML. */
function messageToHtml(subject: string, message: string): string {
  const body = escapeHtml(message).split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br/>')}</p>`).join('');
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2D2926;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="color:#1B4332;font-family:Georgia,serif">${escapeHtml(subject)}</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #E5E0D8;margin:24px 0"/>
    <p style="font-size:12px;color:#8B7355">You're receiving this because you have a Kulmi account. — kulmi.uk</p>
  </div>`;
}

// The Supabase Edge Function slug that holds the broadcast code. It was deployed
// under Supabase's default name "smart-service"; the slug can't be renamed.
const BROADCAST_FN = 'smart-service';

export async function adminBroadcast(subject: string, message: string, audience: BroadcastAudience): Promise<{ sent: number; total?: number; note?: string; errors?: string[] }> {
  const html = messageToHtml(subject, message);
  const { data, error } = await supabase.functions.invoke(BROADCAST_FN, { body: { subject, html, audience } });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { sent: number; total?: number; note?: string; errors?: string[] };
}

// -------------------------------------------------------------
// Notifications (in-app; created by DB triggers on invite/match/message)
// -------------------------------------------------------------
export interface AppNotification {
  id: string;
  type: 'invitation' | 'match' | 'message' | string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export async function listNotifications(limit = 30): Promise<AppNotification[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data } = await supabase
    .from('notifications')
    .select('id, type, body, link, read, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as AppNotification[]) ?? [];
}

export async function countUnreadNotifications(): Promise<number> {
  const uid = await getCurrentUserId();
  if (!uid) return 0;
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('read', false);
  return count ?? 0;
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  let q = supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false);
  if (ids && ids.length) q = q.in('id', ids);
  await q;
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

/** Quietly prevent any further contact with someone (our dignified take on
 *  "block"): they can no longer invite you, you won't be shown to each other,
 *  and any shared conversation is ended. No notification is sent to them. */
export async function stopContact(otherId: string, chatId?: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  if (uid === otherId) return;
  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: uid, blocked_id: otherId }, { onConflict: 'blocker_id,blocked_id' });
  if (error) throw error;
  if (chatId) {
    try { await setChatStatus(chatId, 'ended'); } catch { /* the block is what matters */ }
  }
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

/** Records why someone is leaving (kept for admin insight; no PII, survives the delete). */
export async function submitDeletionFeedback(reason: string, detail: string): Promise<void> {
  try {
    await supabase.from('account_deletions').insert([{ reason: reason || null, detail: detail?.trim() || null }]);
  } catch { /* feedback is best-effort — never block the actual deletion */ }
}

/** Deletes the account. Tries the Edge Function (removes the auth login + profile
 *  via cascade); falls back to deleting just the profile row if it's unavailable. */
export async function deleteMyAccount(): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  try {
    const { data, error } = await supabase.functions.invoke(BROADCAST_FN, { body: { action: 'delete-account' } });
    if (!error && (data as any)?.deleted) return;
  } catch { /* fall back below */ }
  const { error } = await supabase.from('profiles').delete().eq('id', uid);
  if (error) throw error; // surfaced to the UI so the user isn't left thinking it worked
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
    .not('profile_picture_url', 'is', null) // hide legacy/incomplete rows the current app can't create
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function adminReviewVerification(userId: string, approve: boolean, note?: string): Promise<void> {
  // Prefer the service-role function so the status change can never be silently
  // blocked by RLS; fall back to a direct update if the function is unavailable.
  let done = false;
  try {
    const { data, error } = await supabase.functions.invoke(BROADCAST_FN, {
      body: { action: 'review-verification', userId, approve, note: note ?? '' },
    });
    if (!error && (data as any)?.ok) done = true;
  } catch { /* fall back below */ }
  if (!done) {
    const { error } = await supabase
      .from('profiles')
      .update({
        photo_verified: approve,
        verification_status: approve ? 'verified' : 'rejected',
        verification_note: approve ? null : (note?.trim() || null),
      })
      .eq('id', userId);
    if (error) throw error;
  }
  // On rejection, email the member the reason (best-effort — never blocks the review).
  if (!approve) {
    try {
      await supabase.functions.invoke(BROADCAST_FN, { body: { action: 'notify-rejection', userId, reason: note ?? '' } });
    } catch { /* email is best-effort */ }
  }
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

/** Remove a member: emails them the reason, optionally bans the email from
 *  re-registering, wipes their storage + data + login (via the Edge function). */
export async function adminDeleteUser(userId: string, reason?: string, ban?: boolean): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke(BROADCAST_FN, {
      body: { action: 'admin-remove-user', userId, reason: reason ?? '', ban: !!ban },
    });
    if (!error && (data as any)?.removed) return;
    if ((data as any)?.error) throw new Error((data as any).error);
  } catch (e: any) {
    if (e?.message && !/Failed to send|FunctionsFetchError/i.test(String(e.message))) throw e;
    // Function unreachable → fall back to removing the profile row only.
  }
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
  // Admin-only context: admins read the base table directly (RLS permits),
  // so hidden/suspended members still show up in admin lists.
  const { data } = await supabase.from('profiles').select('id, first_name').in('id', ids);
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
