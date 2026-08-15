/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Landing } from './components/Landing';
import { Home } from './components/Home';
import { Activity } from './components/Activity';
import { CompatibilitySession } from './components/CompatibilitySession';
import { Chats } from './components/Chats';
import { Chat } from './components/Chat';
import { Logo } from './components/Logo';
import { Profile } from './components/Profile';
import { Progress } from './components/Progress';
import { Settings } from './components/Settings';
import { Terms } from './components/Terms';
import { Privacy } from './components/Privacy';
import { Auth } from './components/Auth';
import { Onboarding } from './components/Onboarding/Onboarding';
import { VerificationGate } from './components/VerificationGate';
import { ResetPassword } from './components/ResetPassword';
import { StaffArea } from './components/StaffArea';
import { NotificationBell } from './components/NotificationBell';
import { Contact } from './components/Contact';
import { supabase } from './lib/supabase';
import { getMyProfile, type Profile as DbProfile } from './lib/db';

export type AppState =
  | 'landing'
  | 'verify'
  | 'reset'
  | 'discover'
  | 'activity'
  | 'session'
  | 'chats'
  | 'chat'
  | 'profile'
  | 'progress'
  | 'settings'
  | 'wali'
  | 'admin'
  | 'terms'
  | 'privacy'
  | 'auth'
  | 'contact'
  | 'onboarding';

const PUBLIC_STATES: AppState[] = ['landing', 'terms', 'privacy', 'auth', 'contact'];

// URL <-> state mapping so /admin, /wali, etc. work as real links.
const STATE_PATHS: Partial<Record<AppState, string>> = {
  landing: '/', discover: '/discover', activity: '/activity', chats: '/chats', profile: '/profile',
  progress: '/progress', settings: '/settings', wali: '/wali', admin: '/admin',
  auth: '/login', terms: '/terms', privacy: '/privacy', contact: '/contact',
};

// Extra readable URLs that all resolve to the auth screen.
const PATH_ALIASES: Record<string, AppState> = {
  '/auth': 'auth', '/signin': 'auth', '/sign-in': 'auth',
  '/signup': 'auth', '/sign-up': 'auth', '/join': 'auth', '/register': 'auth',
};

function pathToState(path: string): AppState | null {
  const clean = path.replace(/\/+$/, '') || '/';
  const found = (Object.entries(STATE_PATHS) as [AppState, string][]).find(([, p]) => p === clean);
  if (found) return found[0];
  return PATH_ALIASES[clean] ?? null;
}

/** Is this arrival URL a "create account" link (so we open signup, not signin)? */
function pathWantsSignup(path: string): boolean {
  const clean = path.replace(/\/+$/, '') || '/';
  return ['/signup', '/sign-up', '/join', '/register'].includes(clean);
}

// Captured at module load (before Supabase cleans the URL) so a password-reset
// link reliably shows the reset screen instead of racing into the app.
const IS_RECOVERY = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

export default function App() {
  if (IS_RECOVERY) {
    // After resetting, send admins/walis to their dashboard, members to the app.
    return (
      <ResetPassword
        onDone={async () => {
          let dest = '/';
          try {
            const p = await getMyProfile(true);
            if (p?.role === 'admin') dest = '/admin';
            else if (p?.role === 'wali') dest = '/wali';
          } catch { /* ignore */ }
          window.location.hash = '';
          window.location.replace(dest);
        }}
      />
    );
  }
  const path = (typeof window !== 'undefined' ? window.location.pathname : '/').replace(/\/+$/, '') || '/';
  if (path === '/admin') return <StaffArea kind="admin" />;
  if (path === '/wali') return <StaffArea kind="wali" />;
  return <MemberApp />;
}

function MemberApp() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [user, setUser] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<DbProfile | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activityCount, setActivityCount] = useState(0);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(
    pathWantsSignup(typeof window !== 'undefined' ? window.location.pathname : '/') ? 'signup' : 'signin'
  );
  const goAuth = (mode: 'signin' | 'signup') => { setAuthMode(mode); setAppState('auth'); };
  // A staff (admin/wali) account is signed in, but staff are NOT members — the
  // consumer app stays logged-out for them. `staffRef` keeps the auth listener
  // from re-populating `user` on token refresh.
  const [staffSession, setStaffSession] = useState<'admin' | 'wali' | null>(null);
  const staffRef = useRef(false);
  // Show a splash until we've resolved the session, so a returning/just-confirmed
  // user never sees the logged-out landing page flash (which looks broken).
  const [initializing, setInitializing] = useState(true);

  // The URL the app was opened at, used to honour a deep link (e.g. /admin)
  // once the session has loaded.
  const initialPathRef = useRef<string>(window.location.pathname);
  // Guards against auth firing multiple times (INITIAL_SESSION, TOKEN_REFRESHED…)
  // yanking the user off the page they deep-linked to.
  const routedRef = useRef(false);

  // Route a signed-in user, honouring the URL they arrived at.
  const routeFor = (profile: DbProfile | null): AppState => {
    const target = pathToState(initialPathRef.current);
    if (!profile) return 'onboarding';
    // Mandatory identity verification before any profiles are shown.
    // Staff accounts (admin/wali) are exempt.
    const exempt = profile.role === 'admin' || profile.role === 'wali';
    // A profile that was never finished (e.g. connection dropped during signup)
    // resumes onboarding instead of getting stuck at the verify gate. Gender is
    // as essential as the photo — without it, opposite-gender-only discovery
    // cannot work, so the member must complete onboarding first.
    if (!exempt && (!profile.profile_picture_url || !(profile.gender ?? '').trim())) return 'onboarding';
    if (!exempt && profile.verification_status !== 'verified') return 'verify';
    if (!target || target === 'landing' || target === 'auth') return 'discover';
    if (target === 'admin' && profile.role !== 'admin') return 'discover';
    if (target === 'wali' && !(profile.role === 'wali' || profile.role === 'admin')) return 'discover';
    return target;
  };

  const loadProfileAndRoute = async (sessionUser?: any) => {
    routedRef.current = true;
    const su = sessionUser ?? (await supabase.auth.getSession()).data.session?.user ?? null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const profile = await getMyProfile(true); // fresh — reflects a just-finished onboarding/verify
        setMyProfile(profile);
        const staffRole = profile?.role === 'admin' ? 'admin' : profile?.role === 'wali' ? 'wali' : null;
        if (staffRole) {
          // Staff sign-in should NOT log them into the consumer app. Show the
          // public landing; a small bar offers their dashboard or sign-out.
          staffRef.current = true;
          setStaffSession(staffRole);
          setUser(null);
          setAppState('landing');
          return;
        }
        staffRef.current = false;
        setStaffSession(null);
        setUser(su);
        setAppState(routeFor(profile));
        return;
      } catch {
        // transient error (e.g. network) — back off and retry before giving up
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    // Couldn't load the profile after retries. Don't leave a signed-in user
    // stranded on the landing page — release the guard so the next auth event
    // (token refresh, focus) re-attempts routing.
    routedRef.current = false;
  };

  useEffect(() => {
    // Restore an existing session on reload (reliable path).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && !routedRef.current) {
        await loadProfileAndRoute(session.user);
      }
      setInitializing(false);
    });
    // Safety net: never get stuck on the splash.
    const splashTimer = setTimeout(() => setInitializing(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User arrived via a reset-password email link.
        setUser(session?.user ?? null);
        routedRef.current = true;
        setAppState('reset');
        return;
      }
      if (event === 'SIGNED_OUT') {
        // Real sign-out only.
        setUser(null);
        setMyProfile(null);
        setStaffSession(null);
        staffRef.current = false;
        setAppState('landing');
        routedRef.current = false;
        initialPathRef.current = '/';
        return;
      }

      if (!session?.user) {
        // No session on a non-signout event (e.g. INITIAL_SESSION while logged
        // out). Only decide the screen on first load; never yank an active user.
        if (!routedRef.current) {
          const wantAuth = pathToState(initialPathRef.current) === 'auth';
          setUser(null);
          setMyProfile(null);
          setAppState(wantAuth ? 'auth' : 'landing');
        }
        setInitializing(false);
        return;
      }

      if (!routedRef.current) {
        // First time we learn who the user is (initial load or a fresh sign-in) → route in.
        loadProfileAndRoute(session.user).finally(() => setInitializing(false));
      } else if (!staffRef.current) {
        // Already inside the member app: token refresh / focus / spurious SIGNED_IN →
        // keep the profile fresh, NEVER navigate. (Staff stay logged-out here.)
        setUser(session.user);
        getMyProfile().then(setMyProfile).catch(() => {});
      }
    });

    return () => { subscription.unsubscribe(); clearTimeout(splashTimer); };
  }, []);

  // Keep the address bar in sync with the current screen.
  useEffect(() => {
    let path = STATE_PATHS[appState];
    if (appState === 'auth') path = authMode === 'signup' ? '/signup' : '/login';
    if (path && appState !== 'chat' && appState !== 'session' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  }, [appState, authMode]);

  // Support the browser back/forward buttons and manual URL edits.
  useEffect(() => {
    const onPop = () => {
      const p = window.location.pathname.replace(/\/+$/, '') || '/';
      if (p === '/admin' || p === '/wali') { window.location.href = p; return; } // hand off to the separate staff area
      const target = pathToState(p);
      if (target) setAppState(target);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setAppState('chat');
  };

  const openSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setAppState('session');
  };

  // ---- Splash while the session resolves (prevents a landing-page flash) ----
  if (initializing) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center gap-5">
        <span className="font-serif text-3xl font-bold tracking-tight text-[#1B4332] uppercase">Kulmi</span>
        <div className="w-8 h-8 rounded-full border-2 border-[#E5E0D8] border-t-[#1B4332] animate-spin" />
      </div>
    );
  }

  // ---- Full-screen states (no app chrome) ----
  if (appState === 'onboarding') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-[#2D2926] font-sans selection:bg-[#F0EEE8] selection:text-[#1B4332] flex flex-col pt-24 px-4">
        <Onboarding
          onComplete={async () => {
            await loadProfileAndRoute();
          }}
        />
      </div>
    );
  }

  if (appState === 'verify') {
    return <VerificationGate onVerified={() => loadProfileAndRoute()} />;
  }

  if (appState === 'reset') {
    return <ResetPassword onDone={() => loadProfileAndRoute()} />;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D2926] font-sans selection:bg-[#F0EEE8] selection:text-[#1B4332] flex flex-col">
      <header className="fixed top-0 left-0 right-0 h-16 sm:h-24 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#E5E0D8] z-50 flex items-center px-4 sm:px-6 lg:px-12">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <button
              onClick={() => setAppState(user ? 'discover' : 'landing')}
              className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#1B4332] hover:opacity-80 transition-opacity uppercase"
            >
              Kulmi
            </button>
          </div>
          {PUBLIC_STATES.includes(appState) ? (
            <nav className="flex items-center gap-6">
              <button
                onClick={() => goAuth('signin')}
                className="hidden sm:block text-sm font-medium tracking-wide text-[#8B7355] hover:text-[#1B4332] uppercase transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => goAuth('signup')}
                className="bg-[#1B4332] text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#143326] transition-colors shadow-sm"
              >
                Join Now
              </button>
            </nav>
          ) : (
            <div className="flex items-center gap-3 sm:gap-6">
              <NotificationBell onNavigate={(link) => { const s = pathToState(link); if (s) setAppState(s); }} />
            <nav className="hidden sm:flex items-center gap-8 text-sm font-medium tracking-wide text-[#8B7355] uppercase">
              <button
                onClick={() => setAppState('discover')}
                className={`pb-0.5 transition-colors ${appState === 'discover' ? 'border-b border-[#8B7355] text-[#1B4332]' : 'opacity-50 hover:opacity-100 hover:text-[#1B4332]'}`}
              >
                Discover
              </button>
              <button
                onClick={() => setAppState('activity')}
                className={`relative pb-0.5 transition-colors ${appState === 'activity' ? 'border-b border-[#8B7355] text-[#1B4332]' : 'opacity-50 hover:opacity-100 hover:text-[#1B4332]'}`}
              >
                Activity
                {activityCount > 0 && (
                  <span className="absolute -top-2 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-[#1B4332] text-white text-[9px] font-bold flex items-center justify-center">{activityCount}</span>
                )}
              </button>
              <button
                onClick={() => setAppState('chats')}
                className={`pb-0.5 transition-colors ${appState === 'chats' || appState === 'chat' ? 'border-b border-[#8B7355] text-[#1B4332]' : 'opacity-50 hover:opacity-100 hover:text-[#1B4332]'}`}
              >
                Chats
              </button>
              <button
                onClick={() => setAppState('progress')}
                className={`pb-0.5 transition-colors ${appState === 'progress' ? 'border-b border-[#8B7355] text-[#1B4332]' : 'opacity-50 hover:opacity-100 hover:text-[#1B4332]'}`}
              >
                Progress
              </button>
              <button
                onClick={() => setAppState('settings')}
                className={`pb-0.5 transition-colors ${appState === 'settings' ? 'border-b border-[#8B7355] text-[#1B4332]' : 'opacity-50 hover:opacity-100 hover:text-[#1B4332]'}`}
              >
                Settings
              </button>
              <button
                onClick={() => setAppState('profile')}
                className="w-10 h-10 rounded-full border border-[#E5E0D8] flex items-center justify-center bg-white text-[#1B4332] italic font-serif hover:bg-[#F0EEE8] transition-colors ml-2 uppercase"
              >
                {(myProfile?.first_name?.[0] ?? 'A').toUpperCase()}
              </button>
            </nav>
            </div>
          )}
        </div>
      </header>

      <main className="pt-20 sm:pt-32 pb-24 sm:pb-16 px-3 sm:px-4 min-h-screen flex flex-col items-center justify-center w-full max-w-6xl mx-auto">
        {staffSession && PUBLIC_STATES.includes(appState) && (
          <div className="w-full max-w-3xl mx-auto mb-6 bg-[#1B4332] text-white rounded-2xl px-5 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <span>You're signed in as <b className="capitalize">{staffSession}</b> — not shown as a member here.</span>
            <button onClick={() => { window.location.href = staffSession === 'admin' ? '/admin' : '/wali'; }} className="underline font-medium">Go to dashboard</button>
            <button onClick={() => supabase.auth.signOut()} className="underline">Sign out</button>
          </div>
        )}
        <AnimatePresence mode="wait">
          {appState === 'landing' && (
            <motion.div key="landing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Landing onStart={() => goAuth('signup')} onTerms={() => setAppState('terms')} onPrivacy={() => setAppState('privacy')} onContact={() => setAppState('contact')} />
            </motion.div>
          )}

          {appState === 'auth' && (
            <motion.div key={`auth-${authMode}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Auth initialMode={authMode} onModeChange={setAuthMode} onSuccess={() => { /* routing handled by the auth listener (SIGNED_IN) */ }} onTerms={() => setAppState('terms')} onPrivacy={() => setAppState('privacy')} />
            </motion.div>
          )}

          {appState === 'contact' && (
            <motion.div key="contact" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Contact onBack={() => setAppState(user ? 'discover' : 'landing')} />
            </motion.div>
          )}

          {appState === 'discover' && (
            <motion.div key="discover" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Home onOpenSession={openSession} onOpenActivity={() => setAppState('activity')} onActivityCount={setActivityCount} />
            </motion.div>
          )}

          {appState === 'activity' && (
            <motion.div key="activity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Activity onOpenSession={openSession} onBack={() => setAppState('discover')} onChanged={() => setActivityCount((n) => Math.max(0, n - 1))} />
            </motion.div>
          )}

          {appState === 'session' && selectedSessionId && (
            <motion.div key="session" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
              <CompatibilitySession
                sessionId={selectedSessionId}
                onExit={() => setAppState('discover')}
                onMatched={openChat}
              />
            </motion.div>
          )}

          {appState === 'chats' && (
            <motion.div key="chats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
              <Chats onSelectChat={openChat} />
            </motion.div>
          )}

          {appState === 'chat' && selectedChatId && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
              <Chat chatId={selectedChatId} onExit={() => setAppState('chats')} onEndIntroduction={() => setAppState('chats')} />
            </motion.div>
          )}

          {appState === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Profile />
            </motion.div>
          )}

          {appState === 'progress' && (
            <motion.div key="progress" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Progress />
            </motion.div>
          )}

          {appState === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Settings onTerms={() => setAppState('terms')} onPrivacy={() => setAppState('privacy')} onContact={() => setAppState('contact')} />
            </motion.div>
          )}

          {appState === 'terms' && (
            <motion.div key="terms" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Terms onBack={() => setAppState(user ? 'discover' : 'auth')} />
            </motion.div>
          )}

          {appState === 'privacy' && (
            <motion.div key="privacy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Privacy onBack={() => setAppState(user ? 'discover' : 'auth')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Navigation */}
      {!PUBLIC_STATES.includes(appState) && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E0D8] z-50 flex items-center justify-around py-3 px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setAppState('discover')}
            className={`flex flex-col items-center gap-1 ${appState === 'discover' ? 'text-[#1B4332]' : 'text-[#8B7355] opacity-70 hover:opacity-100'}`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider">Discover</span>
          </button>
          <button
            onClick={() => setAppState('activity')}
            className={`relative flex flex-col items-center gap-1 ${appState === 'activity' ? 'text-[#1B4332]' : 'text-[#8B7355] opacity-70 hover:opacity-100'}`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider">Activity</span>
            {activityCount > 0 && (
              <span className="absolute -top-1.5 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[#1B4332] text-white text-[9px] font-bold flex items-center justify-center">{activityCount}</span>
            )}
          </button>
          <button
            onClick={() => setAppState('chats')}
            className={`flex flex-col items-center gap-1 ${appState === 'chats' || appState === 'chat' ? 'text-[#1B4332]' : 'text-[#8B7355] opacity-70 hover:opacity-100'}`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider">Chats</span>
          </button>
          <button
            onClick={() => setAppState('progress')}
            className={`flex flex-col items-center gap-1 ${appState === 'progress' ? 'text-[#1B4332]' : 'text-[#8B7355] opacity-70 hover:opacity-100'}`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider">Progress</span>
          </button>
          <button
            onClick={() => setAppState('profile')}
            className={`flex flex-col items-center gap-1 ${appState === 'profile' ? 'text-[#1B4332]' : 'text-[#8B7355] opacity-70 hover:opacity-100'}`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider">Profile</span>
          </button>
          <button
            onClick={() => setAppState('settings')}
            className={`flex flex-col items-center gap-1 ${appState === 'settings' ? 'text-[#1B4332]' : 'text-[#8B7355] opacity-70 hover:opacity-100'}`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider">Settings</span>
          </button>
        </nav>
      )}
    </div>
  );
}
