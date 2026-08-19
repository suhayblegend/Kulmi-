import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, HeartHandshake, Sparkles, ChevronRight } from 'lucide-react';
import { FOUNDING_ACTIVE } from '../lib/billing';

interface AppWelcomeProps {
  onSignup: () => void;
  onSignin: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
}

// The native app's launch screen — a single, premium, deep-green moment.
// No scrolling marketing: brand, promise, trust, and one clear way in.
export function AppWelcome({ onSignup, onSignin, onTerms, onPrivacy }: AppWelcomeProps) {
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#173C29] via-[#1B4332] to-[#0E2819] text-white"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)',
      }}
    >
      {/* Soft decorative glows */}
      <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-[#2B6B4C]/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-28 -left-24 w-80 h-80 rounded-full bg-[#2B6B4C]/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[26rem] h-[26rem] rounded-full border border-white/5" aria-hidden />

      {/* Brand + pitch */}
      <div className="relative flex-1 flex flex-col items-center justify-center text-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative mb-6"
        >
          <div className="absolute inset-0 rounded-[28px] bg-white/20 blur-xl scale-110" aria-hidden />
          <img src="/kulmi-logo.png" alt="Kulmi" className="relative w-24 h-24 rounded-[28px] border border-white/25 shadow-2xl" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="font-serif text-[44px] font-bold uppercase tracking-[0.08em] leading-none"
        >
          Kulmi
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="font-serif italic text-[17px] text-[#D9C79A] mt-2.5"
        >
          Isla Kulma, Isla Noolada
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-[15px] text-white/75 leading-relaxed mt-4 max-w-[280px]"
        >
          Serious, halal Somali matchmaking — built for marriage, not swiping.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="flex items-center justify-center gap-2 mt-7 flex-wrap"
        >
          {[
            { icon: ShieldCheck, t: 'Verified' },
            { icon: Lock, t: 'Private' },
            { icon: HeartHandshake, t: 'Wali-friendly' },
          ].map(({ icon: Icon, t }) => (
            <span key={t} className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 backdrop-blur-sm rounded-full px-3.5 py-1.5 text-xs font-medium text-white/90">
              <Icon className="w-3.5 h-3.5 text-[#D9C79A]" /> {t}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Founding offer — gold-trimmed moment, not a plain notice */}
      {FOUNDING_ACTIVE && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="relative mx-6 mb-4 rounded-2xl border border-[#D9C79A]/40 bg-white/[0.07] backdrop-blur-sm px-4 py-3.5 overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-8 -right-6 w-24 h-24 rounded-full bg-[#D9C79A]/15 blur-2xl" aria-hidden />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D9C79A]/15 border border-[#D9C79A]/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-[#D9C79A]" />
            </div>
            <p className="text-[13px] leading-snug text-white/90">
              <span className="font-bold text-[#D9C79A]">Founding offer</span> — join now and get{' '}
              <span className="font-bold">Kulmi+ free until 30 September</span>. No card needed.
            </p>
          </div>
        </motion.div>
      )}

      {/* Get started */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="relative px-6 space-y-3"
      >
        <button
          onClick={onSignup}
          className="w-full bg-[#F5EFE3] text-[#143322] py-[17px] rounded-full font-semibold text-[16px] tracking-wide shadow-xl shadow-black/25 active:shadow-md transition-shadow flex items-center justify-center gap-2"
        >
          Create your account <ChevronRight className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={onSignin}
          className="w-full border border-white/25 text-white py-[15px] rounded-full font-medium text-[15px] active:bg-white/10 transition-colors"
        >
          I already have an account
        </button>
        <p className="text-[11px] text-white/45 text-center pt-1.5 leading-relaxed">
          By continuing you agree to our{' '}
          <button onClick={onTerms} className="underline text-white/70">Terms</button> &amp;{' '}
          <button onClick={onPrivacy} className="underline text-white/70">Privacy Policy</button>.
        </p>
      </motion.div>
    </div>
  );
}
