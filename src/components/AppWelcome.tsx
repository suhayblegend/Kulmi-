import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, HeartHandshake, Sparkles } from 'lucide-react';
import { FOUNDING_ACTIVE } from '../lib/billing';

interface AppWelcomeProps {
  onSignup: () => void;
  onSignin: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
}

// A single-screen launch page shown ONLY inside the native app (never the
// website). No scrolling marketing — just brand, trust, and get-started.
export function AppWelcome({ onSignup, onSignin, onTerms, onPrivacy }: AppWelcomeProps) {
  return (
    <div
      className="fixed inset-0 bg-[#FDFBF7] text-[#2D2926] flex flex-col"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
      }}
    >
      {/* Brand + pitch */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <motion.img
          src="/kulmi-logo.png"
          alt="Kulmi"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-24 h-24 rounded-3xl shadow-sm mb-6"
        />
        <h1 className="font-serif text-4xl font-bold uppercase tracking-tight text-[#1B4332]">Kulmi</h1>
        <p className="font-serif italic text-[#8B7355] mt-1.5">Isla Kulma, Isla Noolada</p>
        <p className="text-[15px] text-[#5C574F] leading-relaxed mt-5 max-w-xs">
          Serious, halal Somali matchmaking — built for marriage, not swiping.
        </p>

        <div className="flex items-center justify-center gap-2 mt-7 flex-wrap">
          {[
            { icon: ShieldCheck, t: 'Verified' },
            { icon: Lock, t: 'Private' },
            { icon: HeartHandshake, t: 'Wali-friendly' },
          ].map(({ icon: Icon, t }) => (
            <span key={t} className="inline-flex items-center gap-1.5 bg-white border border-[#E5E0D8] rounded-full px-3 py-1.5 text-xs font-medium text-[#1B4332]">
              <Icon className="w-3.5 h-3.5" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* Founding offer — free Kulmi+ for early members */}
      {FOUNDING_ACTIVE && (
        <div className="mx-6 mb-3 rounded-2xl bg-[#1B4332] text-white px-4 py-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 shrink-0 text-amber-300" />
          <p className="text-[13px] leading-snug">
            <span className="font-bold">Founding offer:</span> join now and get{' '}
            <span className="font-bold">Kulmi+ free until 30 September</span> — no card needed.
          </p>
        </div>
      )}

      {/* Get started */}
      <div className="px-6 space-y-3">
        <button
          onClick={onSignup}
          className="w-full bg-[#1B4332] text-white py-4 rounded-2xl font-medium tracking-wide active:bg-[#143326] transition-colors shadow-sm"
        >
          Create your account
        </button>
        <button
          onClick={onSignin}
          className="w-full bg-white border border-[#E5E0D8] text-[#1B4332] py-4 rounded-2xl font-medium active:bg-[#F0EEE8] transition-colors"
        >
          I already have an account
        </button>
        <p className="text-[11px] text-[#8B7355] text-center pt-1 leading-relaxed">
          By continuing you agree to our{' '}
          <button onClick={onTerms} className="underline text-[#1B4332]">Terms</button> &amp;{' '}
          <button onClick={onPrivacy} className="underline text-[#1B4332]">Privacy Policy</button>.
        </p>
      </div>
    </div>
  );
}
