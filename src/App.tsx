/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Bell, MessageCircle, TrendingUp, User, Settings as SettingsIcon } from 'lucide-react';
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
import { Footer } from './components/Footer';
import { Safety } from './components/Safety';
import { About } from './components/About';
import { Blog } from './components/Blog';
import { Pricing } from './components/Pricing';
import { Faq } from './components/FaqList';
import { supabase } from './lib/supabase';
import { getMyProfile, touchLastActive, type Profile as DbProfile } from './lib/db';
import { cacheClear } from './lib/cache';
import { prefetchAppData } from './lib/prefetch';
import { registerPush, isNative } from './lib/native';
import { AppWelcome } from './components/AppWelcome';

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
  | 'safety'
  | 'about'
  | 'blog'
  | 'pricing'
  | 'faq'
  | 'notfound'
  | 'onboarding';

// The admin dashboard lives at an unguessable path (not /admin) so bots and
// randoms can't even find the login. Real security is still the role + RLS
// checks inside — this just removes it from casual discovery.
const ADMIN_PATH = '/hooyomacan2001';

const PUBLIC_STATES: AppState[] = ['landing', 'terms', 'privacy', 'auth', 'contact', 'safety', 'about', 'blog', 'pricing', 'faq', 'notfound'];

// URL <-> state mapping so /admin, /wali, etc. work as real links.
const STATE_PATHS: Partial<Record<AppState, string>> = {
  landing: '/', discover: '/discover', activity: '/activity', chats: '/chats', profile: '/profile',
  progress: '/progress', settings: '/settings', wali: '/wali', admin: ADMIN_PATH,
  auth: '/login', terms: '/terms', privacy: '/privacy', contact: '/contact', safety: '/safety', about: '/about', blog: '/blog', pricing: '/pricing', faq: '/faq',
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

// Synchronous check: does this browser hold a stored Supabase session? If yes,
// the user is (almost certainly) logged in — keep the splash up until routing
// finishes instead of flashing the logged-out homepage while the (sometimes
// slow / cold-starting) backend restores the session.
// Set once a member has a real profile; lets refresh-restore distinguish an
// existing member (transient read miss → retry) from a brand-new signup.
const HAS_PROFILE_KEY = 'kulmi_has_profile';

const HAS_STORED_SESSION = (() => {
  try {
    return Object.keys(window.localStorage).some((k) => k.startsWith('sb-') && k.includes('auth-token'));
  } catch { return false; }
})();

export default function App() {
  if (IS_RECOVERY) {
    // After resetting, send admins/walis to their dashboard, members to the app.
    return (
      <ResetPassword
        onDone={async () => {
          let dest = '/';
          try {
            const p = await getMyProfile(true);
            if (p?.role === 'admin') dest = ADMIN_PATH;
            else if (p?.role === 'wali') dest = '/wali';
          } catch { /* ignore */ }
          window.location.hash = '';
          window.location.replace(dest);
        }}
      />
    );
  }
  const path = (typeof window !== 'undefined' ? window.location.pathname : '/').replace(/\/+$/, '') || '/';
  if (path === ADMIN_PATH) return <StaffArea kind="admin" />;
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
  const [signupWelcome, setSignupWelcome] = useState<string | null>(null); // first name of a just-created account
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
    if (target === 'landing' || target === 'auth') return 'discover';
    // pathToState('/') === 'landing', so a null target here is a genuinely
    // unknown URL → show a 404 rather than silently dumping them on Discover.
    const clean = (initialPathRef.current || '/').replace(/\/+$/, '') || '/';
    if (!target) return clean === '/' ? 'discover' : 'notfound';
    if (target === 'admin' && profile.role !== 'admin') return 'discover';
    if (target === 'wali' && !(profile.role === 'wali' || profile.role === 'admin')) return 'discover';
    return target;
  };

  const loadProfileAndRoute = async (sessionUser?: any) => {
    routedRef.current = true;
    const su = sessionUser ?? (await supabase.auth.getSession()).data.session?.user ?? null;
    // We remember (in localStorage) once someone has a real profile. So if the
    // profile read comes back empty for a KNOWN member, we treat it as a
    // transient miss (expired-token window / RLS timing) and retry — we never
    // dump an existing member back into onboarding.
    const knownMember = (() => { try { return localStorage.getItem(HAS_PROFILE_KEY) === '1'; } catch { return false; } })();
    const maxAttempts = knownMember ? 8 : 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const profile = await getMyProfile(true); // fresh — reflects a just-finished onboarding/verify
        const staffRole = profile?.role === 'admin' ? 'admin' : profile?.role === 'wali' ? 'wali' : null;
        if (staffRole) {
          setMyProfile(profile);
          staffRef.current = true;
          setStaffSession(staffRole);
          setUser(null);
          setAppState('landing');
          return;
        }
        if (profile) {
          // Real profile loaded → route normally, and remember they're a member.
          if (profile.profile_picture_url) { try { localStorage.setItem(HAS_PROFILE_KEY, '1'); } catch { /* ignore */ } }
          setMyProfile(profile);
          staffRef.current = false;
          setStaffSession(null);
          setUser(su);
          setAppState(routeFor(profile));
          touchLastActive(); // stamp activity for admin analytics (best-effort)
          // Warm Discover/Chats/Activity in the background so they open instantly.
          if (profile.verification_status === 'verified') { prefetchAppData(); registerPush(); }
          return;
        }
        // profile === null:
        if (!knownMember && attempt >= 1) {
          // No stored membership + persistent null → genuinely a new signup.
          setMyProfile(null);
          setUser(su);
          setAppState('onboarding');
          return;
        }
        // Known member (or first try) → transient miss. Refresh the session
        // once mid-way, then keep retrying.
        if (attempt === 3) { try { await supabase.auth.refreshSession(); } catch { /* ignore */ } }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      } catch {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    // Exhausted. Never strand a known member on onboarding/landing — release the
    // guard so the next auth event (token refresh, focus) re-attempts routing.
    routedRef.current = false;
  };

  useEffect(() => {
    // Restore an existing session on reload (reliable path).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && !routedRef.current) {
        await loadProfileAndRoute(session.user);
        setInitializing(false);
      } else if (!HAS_STORED_SESSION) {
        setInitializing(false);
      }
      // else: a stored session exists but the access token has expired and is
      // being refreshed — getSession() reports null during that window. Keep
      // the splash; the auth listener routes us in when the refresh lands
      // (the 20s cap is the backstop).
    });
    // Safety net: never get stuck on the splash. With a stored session we KNOW
    // the user is logged in, so wait generously (cold backend starts can take
    // >5s) — flashing the logged-out homepage at a member is far worse than a
    // longer spinner. Without one, give up quickly.
    const splashTimer = setTimeout(() => setInitializing(false), HAS_STORED_SESSION ? 20000 : 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User arrived via a reset-password email link.
        setUser(session?.user ?? null);
        routedRef.current = true;
        setAppState('reset');
        return;
      }
      if (event === 'SIGNED_OUT') {
        // Real sign-out only (including a failed token refresh).
        setUser(null);
        setMyProfile(null);
        setStaffSession(null);
        staffRef.current = false;
        setAppState('landing');
        routedRef.current = false;
        initialPathRef.current = '/';
        cacheClear(); // drop cached lists so the next account starts clean
        try { localStorage.removeItem(HAS_PROFILE_KEY); } catch { /* ignore */ }
        setInitializing(false); // in case we were still holding the splash
        return;
      }

      if (!session?.user) {
        // No session on a non-signout event (e.g. INITIAL_SESSION while logged
        // out). Only decide the screen on first load; never yank an active user.
        // With a STORED session this is just the expired-token refresh window —
        // keep the splash and wait for SIGNED_IN/TOKEN_REFRESHED (or SIGNED_OUT
        // if the refresh truly fails) instead of flashing the homepage.
        if (!routedRef.current && HAS_STORED_SESSION && event === 'INITIAL_SESSION') return;
        if (!routedRef.current) {
          const known = pathToState(initialPathRef.current);
          const clean = (initialPathRef.current || '/').replace(/\/+$/, '') || '/';
          setUser(null);
          setMyProfile(null);
          // Public pages (pricing, faq, terms…) render directly. Unknown URLs →
          // 404. Member-only URLs while logged out, or root → landing.
          if (known && PUBLIC_STATES.includes(known)) setAppState(known);
          else if (!known && clean !== '/') setAppState('notfound');
          else setAppState('landing');
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

  // Every page change starts at the top — otherwise navigating from the bottom
  // of a long page (e.g. landing footer → terms) opens the new page scrolled down.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [appState]);

  // Support the browser back/forward buttons and manual URL edits.
  useEffect(() => {
    const onPop = () => {
      const p = window.location.pathname.replace(/\/+$/, '') || '/';
      if (p === ADMIN_PATH || p === '/wali') { window.location.href = p; return; } // hand off to the separate staff area
      const target = pathToState(p);
      if (target) setAppState(target);
      else if (p !== '/') setAppState('notfound');
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

  // ---- In-app confirmation after signup (shows before onboarding so a freshly
  //      created account always gets an acknowledgment, even when the app
  //      auto-signs them in and routes straight to onboarding). ----
  if (signupWelcome !== null) {
    return <SignupWelcome firstName={signupWelcome} onContinue={() => setSignupWelcome(null)} />;
  }

  // ---- Native app: a clean single-screen welcome instead of the long
  //      marketing landing (which is web-only). ----
  if (appState === 'landing' && isNative()) {
    return (
      <AppWelcome
        onSignup={() => goAuth('signup')}
        onSignin={() => goAuth('signin')}
        onTerms={() => setAppState('terms')}
        onPrivacy={() => setAppState('privacy')}
      />
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
          {PUBLIC_STATES.includes(appState) && !user ? (
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

      <main className="pt-20 sm:pt-32 pb-28 sm:pb-16 px-4 sm:px-4 min-h-screen flex flex-col items-center justify-start w-full max-w-6xl mx-auto">
        {staffSession && PUBLIC_STATES.includes(appState) && (
          <div className="w-full max-w-3xl mx-auto mb-6 bg-[#1B4332] text-white rounded-2xl px-5 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <span>You're signed in as <b className="capitalize">{staffSession}</b> — not shown as a member here.</span>
            <button onClick={() => { window.location.href = staffSession === 'admin' ? ADMIN_PATH : '/wali'; }} className="underline font-medium">Go to dashboard</button>
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
              <Auth initialMode={authMode} onModeChange={setAuthMode} onSuccess={() => { /* routing handled by the auth listener (SIGNED_IN) */ }} onSignedUp={(name) => setSignupWelcome(name || '')} onTerms={() => setAppState('terms')} onPrivacy={() => setAppState('privacy')} />
            </motion.div>
          )}

          {appState === 'contact' && (
            <motion.div key="contact" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Contact onBack={() => setAppState(user ? 'discover' : 'landing')} />
            </motion.div>
          )}

          {appState === 'safety' && (
            <motion.div key="safety" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Safety onBack={() => setAppState(user ? 'settings' : 'landing')} onContact={() => setAppState('contact')} />
            </motion.div>
          )}

          {appState === 'about' && (
            <motion.div key="about" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <About onBack={() => setAppState(user ? 'discover' : 'landing')} onContact={() => setAppState('contact')} />
            </motion.div>
          )}

          {appState === 'blog' && (
            <motion.div key="blog" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Blog onBack={() => setAppState(user ? 'discover' : 'landing')} />
            </motion.div>
          )}

          {appState === 'pricing' && (
            <motion.div key="pricing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Pricing onJoin={() => (user ? setAppState('settings') : goAuth('signup'))} onBack={() => setAppState(user ? 'discover' : 'landing')} />
            </motion.div>
          )}

          {appState === 'faq' && (
            <motion.div key="faq" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Faq onBack={() => setAppState(user ? 'discover' : 'landing')} onContact={() => setAppState('contact')} />
            </motion.div>
          )}

          {appState === 'notfound' && (
            <motion.div key="notfound" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <NotFound onHome={() => setAppState(user ? 'discover' : 'landing')} loggedIn={!!user} />
            </motion.div>
          )}

          {appState === 'discover' && (
            <motion.div key="discover" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Home onOpenSession={openSession} onOpenActivity={() => setAppState('activity')} onActivityCount={setActivityCount} />
            </motion.div>
          )}

          {appState === 'activity' && (
            <motion.div key="activity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Activity onOpenSession={openSession} onBack={() => setAppState('discover')} onCount={setActivityCount} />
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
              <Settings onTerms={() => setAppState('terms')} onPrivacy={() => setAppState('privacy')} onContact={() => setAppState('contact')} onSafety={() => setAppState('safety')} />
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

      {/* Footer on public content pages (not the login screen) so navigation is
          always available. */}
      {(['landing', 'terms', 'privacy', 'contact', 'safety', 'about', 'blog', 'pricing', 'faq', 'notfound'] as AppState[]).includes(appState) && (
        <Footer />
      )}

      {/* Mobile Navigation */}
      {!PUBLIC_STATES.includes(appState) && (
        <nav
          className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E5E0D8] z-50 flex items-stretch justify-around px-1 pt-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}
        >
          {[
            { key: 'discover', label: 'Discover', icon: Compass, active: appState === 'discover' },
            { key: 'activity', label: 'Activity', icon: Bell, active: appState === 'activity', badge: activityCount },
            { key: 'chats', label: 'Chats', icon: MessageCircle, active: appState === 'chats' || appState === 'chat' },
            { key: 'progress', label: 'Progress', icon: TrendingUp, active: appState === 'progress' },
            { key: 'profile', label: 'Profile', icon: User, active: appState === 'profile' },
            { key: 'settings', label: 'Settings', icon: SettingsIcon, active: appState === 'settings' },
          ].map(({ key, label, icon: Icon, active, badge }) => (
            <button
              key={key}
              onClick={() => setAppState(key as AppState)}
              className={`relative flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors ${
                active ? 'text-[#1B4332]' : 'text-[#8B7355]'
              }`}
            >
              <span className="relative">
                <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                {!!badge && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-[#1B4332] text-white text-[9px] font-bold flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className={`text-[9.5px] tracking-tight leading-none ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function NotFound({ onHome, loggedIn }: { onHome: () => void; loggedIn: boolean }) {
  return (
    <div className="w-full max-w-md mx-auto text-center py-24 px-6">
      <p className="font-serif text-7xl text-[#1B4332] italic mb-2">404</p>
      <h1 className="font-serif text-2xl text-[#1B4332] mb-3">This page doesn't exist</h1>
      <p className="text-[#8B7355] text-sm leading-relaxed mb-8">
        The link may be broken or the page may have moved. Let's get you back on track, insha'Allah.
      </p>
      <button onClick={onHome} className="bg-[#1B4332] text-white hover:bg-[#143326] px-8 py-3 rounded-xl font-medium tracking-wide transition-colors">
        {loggedIn ? 'Back to Discover' : 'Back to home'}
      </button>
    </div>
  );
}

// Shown once, right after a new account is created, so the member always gets a
// clear in-app confirmation and knows what to do next.
function SignupWelcome({ firstName, onContinue }: { firstName: string; onContinue: () => void }) {
  const steps = [
    { n: '1', t: 'Complete your profile', d: 'Tell us about yourself so we can find thoughtful introductions.' },
    { n: '2', t: 'Verify with a quick selfie', d: 'This keeps Kulmi real — only verified members can be seen or send invitations.' },
    { n: '3', t: 'Start discovering', d: 'Meet one serious introduction at a time, insha’Allah.' },
  ];
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 border border-[#E5E0D8] shadow-sm text-center"
      >
        <div className="w-16 h-16 bg-[#E8F3ED] rounded-2xl flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">🎉</span>
        </div>
        <h2 className="text-2xl font-serif text-[#1B4332] italic mb-2">Account created</h2>
        <p className="text-[#5C574F] text-sm leading-relaxed">
          Assalamu alaikum{firstName ? ' ' + firstName : ''}, and welcome to{' '}
          <span className="font-medium text-[#1B4332]">Kulmi</span>. Here's what happens next:
        </p>

        <div className="mt-5 space-y-3 text-left">
          {steps.map((s) => (
            <div key={s.n} className="flex items-start gap-3 bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl p-3">
              <div className="w-6 h-6 rounded-full bg-[#1B4332] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</div>
              <div>
                <p className="text-sm font-medium text-[#1B4332] leading-tight">{s.t}</p>
                <p className="text-[12px] text-[#8B7355] mt-0.5 leading-snug">{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onContinue}
          className="w-full mt-6 bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium tracking-wide transition-colors"
        >
          Set up my profile
        </button>
      </motion.div>
    </div>
  );
}
