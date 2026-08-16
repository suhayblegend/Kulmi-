import { cacheSet } from './cache';
import {
  discoverCandidates,
  listIncomingInvitations,
  listActiveSessions,
  countMyOpenThreads,
  listMySentInvitations,
  getMyProfile,
  isPremium,
  listMyViewers,
  listChats,
} from './db';

// Warm the main screens right after sign-in so Discover / Chats / Activity are
// already cached before the user taps them — the closest thing to native-app
// instant loading. Fire-and-forget; failures are ignored (screens still load
// normally on demand).
let inflight = false;

export async function prefetchAppData(): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    const [cands, incoming, active, open, mySent, meProf, chats] = await Promise.all([
      discoverCandidates({}).catch(() => [] as any),
      listIncomingInvitations().catch(() => [] as any),
      listActiveSessions().catch(() => [] as any),
      countMyOpenThreads().catch(() => 0),
      listMySentInvitations().catch(() => [] as any),
      getMyProfile().catch(() => null),
      listChats().catch(() => [] as any),
    ]);
    const prem = isPremium(meProf);
    const viewers = prem ? await listMyViewers().catch(() => [] as any) : [];
    const pending = (mySent as any[]).filter((s) => s.status === 'pending').length;

    cacheSet('discover', {
      candidates: cands, invites: incoming, sessions: active, openThreads: open,
      pendingSent: pending, premium: prem, viewersCount: viewers.length, myProfile: meProf, index: 0,
    });
    cacheSet('activity', {
      invites: incoming, sessions: active, sent: mySent, premium: prem, viewers,
    });
    cacheSet('chats', chats);
  } catch { /* best-effort warm-up */ }
  finally { inflight = false; }
}
