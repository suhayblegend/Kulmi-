/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Landing } from './components/Landing';
import { Home } from './components/Home';
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
import { supabase } from './lib/supabase';
import { getMyProfile, type Profile as DbProfile } from './lib/db';

export type AppState =
  | 'landing'
  | 'verify'
  | 'reset'
  | 'discover'
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
  | 'onboarding';

const PUBLIC_STATES: AppState[] = ['landing', 'terms', 'privacy', 'auth'];

// URL <-> state mapping so /admin, /wali, etc. work as real links.
const STATE_PATHS: Partial<Record<AppState, string>> = {
  landing: '/', discover: '/discover', chats: '/chats', profile: '/profile',
  progress: '/progress', settings: '/settings', wali: '/wali', admin: '/admin',
  auth: '/auth', terms: '/terms', privacy: '/privacy',
};

function pathToState(path: string): AppState | null {
  const clean = path.replace(/\/+$/, '') || '/';
  const found = (Object.entries(STATE_PATHS) as [AppState, string][]).find(([, p]) => p === clean);
  return found ? found[0] : null;
}

// Captured at module load (before Supabase cleans the URL) so a password-reset
// link reliably shows the reset screen instead of racing into the app.
const IS_RECOVERY = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

export default function App() {
  if (IS_RECOVERY) {
    return <ResetPassword onDone={() => { window.location.hash = ''; window.location.replace('/'); }} />;
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
    if (!exempt && profile.verification_status !== 'verified') return 'verify';
    if (!target || target === 'landing' || target === 'auth') return 'discover';
    if (target === 'admin' && profile.role !== 'admin') return 'discover';
    if (target === 'wali' && !(profile.role === 'wali' || profile.role === 'admin')) return 'discover';
    return target;
  };

  const loadProfileAndRoute = async () => {
    routedRef.current = true;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const profile = await getMyProfile();
        setMyProfile(profile);
        setAppState(routeFor(profile));
        return;
      } catch {
        // transient error (e.g. network) — retry once before giving up
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  };

  useEffect(() => {
    // Restore an existing session on reload (reliable path).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !routedRef.current) {
        setUser(session.user);
        loadProfileAndRoute();
      }
    });

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
        return;
      }

      setUser(session.user);
      if (!routedRef.current) {
        // First time we learn who the user is (initial load or a fresh sign-in) → route in.
        loadProfileAndRoute();
      } else {
        // Already inside the app: token refresh / focus / spurious SIGNED_IN →
        // just keep the profile fresh, NEVER navigate. (Fixes the "jumps to home
        // after a few minutes" bug.)
        getMyProfile().then(setMyProfile).catch(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Keep the address bar in sync with the current screen.
  useEffect(() => {
    const path = STATE_PATHS[appState];
    if (path && appState !== 'chat' && appState !== 'session' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  }, [appState]);

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
      <header className="fixed top-0 left-0 right-0 h-24 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#E5E0D8] z-50 flex items-center px-6 lg:px-12">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <button
              onClick={() => setAppState(user ? 'discover' : 'landing')}
              className="font-serif text-2xl font-bold tracking-tight text-[#1B4332] hover:opacity-80 transition-opacity uppercase"
            >
              Kulmi
            </button>
          </div>
          {PUBLIC_STATES.includes(appState) ? (
            <nav className="flex items-center gap-6">
              <button
                onClick={() => setAppState('auth')}
                className="hidden sm:block text-sm font-medium tracking-wide text-[#8B7355] hover:text-[#1B4332] uppercase transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => setAppState('auth')}
                className="bg-[#1B4332] text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#143326] transition-colors shadow-sm"
              >
                Join Now
              </button>
            </nav>
          ) : (
            <nav className="hidden sm:flex items-center gap-8 text-sm font-medium tracking-wide text-[#8B7355] uppercase">
              <button
                onClick={() => setAppState('discover')}
                className={`pb-0.5 transition-colors ${appState === 'discover' ? 'border-b border-[#8B7355] text-[#1B4332]' : 'opacity-50 hover:opacity-100 hover:text-[#1B4332]'}`}
              >
                Discover
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
          )}
        </div>
      </header>

      <main className="pt-32 pb-16 px-4 min-h-screen flex flex-col items-center justify-center w-full max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          {appState === 'landing' && (
            <motion.div key="landing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Landing onStart={() => setAppState('auth')} onTerms={() => setAppState('terms')} onPrivacy={() => setAppState('privacy')} />
            </motion.div>
          )}

          {appState === 'auth' && (
            <motion.div key="auth" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Auth onSuccess={() => { /* routing handled by the auth listener (SIGNED_IN) */ }} onTerms={() => setAppState('terms')} onPrivacy={() => setAppState('privacy')} />
            </motion.div>
          )}

          {appState === 'discover' && (
            <motion.div key="discover" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
              <Home onOpenSession={openSession} />
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
              <Settings onTerms={() => setAppState('terms')} onPrivacy={() => setAppState('privacy')} />
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
