import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Sparkles, ArrowLeft } from 'lucide-react';
import { FOUNDING_ACTIVE, FOUNDING_DEADLINE, PRICE_QUARTERLY, DONATE_URL } from '../lib/billing';

/** Live countdown to the founding deadline. */
export function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, target.getTime() - now);
  const d = Math.floor(ms / 86400_000);
  const h = Math.floor((ms % 86400_000) / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { d, h, m, s, over: ms <= 0 };
}

const FREE_FEATURES = [
  'Create your profile & get verified',
  'Discover suitable introductions',
  '3 open introductions at a time',
  'Compatibility sessions (8 questions)',
  'Unlimited chat with your matches',
  'Voice notes & voice answers',
  'Wali (guardian) oversight',
  'Report, block & privacy controls',
];

const PLUS_FEATURES = [
  'Everything in Free, plus:',
  'See who viewed your profile',
  '5 open introductions at a time',
  'Priority verification (reviewed first)',
];

export function Pricing({ onJoin, onBack }: { onJoin: () => void; onBack: () => void }) {
  const { d, h, m, s, over } = useCountdown(FOUNDING_DEADLINE);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl mx-auto py-8 px-2">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-[#8B7355] hover:text-[#1B4332] mb-8">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-10">
        <h1 className="font-serif text-4xl text-[#1B4332] italic mb-3">Simple, honest pricing</h1>
        <p className="text-[#8B7355] max-w-lg mx-auto">
          The journey to marriage is free — finding, matching and talking will never cost you anything.
          Kulmi+ adds helpful extras for those who want them.
        </p>
      </div>

      {/* Founding offer with live countdown */}
      {FOUNDING_ACTIVE && !over && (
        <div className="bg-gradient-to-br from-[#1B4332] to-[#143326] text-white rounded-3xl p-6 md:p-8 mb-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-2">🌟 Founding Member offer</p>
          <p className="font-serif text-2xl mb-1">Join this August — get Kulmi+ free until 30 September</p>
          <p className="text-sm text-white/75 mb-5">Automatically applied to every new member. No card needed.</p>
          <div className="flex items-center justify-center gap-3 mb-6">
            {[[d, 'days'], [h, 'hours'], [m, 'min'], [s, 'sec']].map(([v, l]) => (
              <div key={l as string} className="bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 min-w-[64px]">
                <p className="font-serif text-2xl leading-none tabular-nums">{String(v).padStart(2, '0')}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/60 mt-1">{l}</p>
              </div>
            ))}
          </div>
          <button onClick={onJoin} className="bg-white text-[#1B4332] px-8 py-3.5 rounded-xl font-bold hover:bg-[#F0EEE8] transition-colors">
            Claim your founding membership →
          </button>
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E5E0D8] rounded-3xl p-7 md:p-8">
          <h2 className="font-serif text-2xl text-[#1B4332] mb-1">Free</h2>
          <p className="text-3xl font-serif text-[#1B4332] mb-1">£0</p>
          <p className="text-xs text-[#8B7355] mb-6">Forever. The full journey to marriage.</p>
          <ul className="space-y-3">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-[#2D2926]">
                <Check className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" /> {f}
              </li>
            ))}
          </ul>
          <button onClick={onJoin} className="w-full mt-8 border border-[#1B4332] text-[#1B4332] py-3 rounded-xl font-medium hover:bg-[#F0EEE8] transition-colors">
            Join free
          </button>
        </div>

        <div className="bg-white border-2 border-[#1B4332] rounded-3xl p-7 md:p-8 relative">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1B4332] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Kulmi+
          </span>
          <h2 className="font-serif text-2xl text-[#1B4332] mb-1 mt-2">Kulmi+</h2>
          <p className="text-3xl font-serif text-[#1B4332] mb-1">£9.99<span className="text-base text-[#8B7355]">/month</span></p>
          <p className="text-xs text-[#8B7355] mb-6">or {PRICE_QUARTERLY}</p>
          <ul className="space-y-3">
            {PLUS_FEATURES.map((f, i) => (
              <li key={f} className={`flex items-start gap-2.5 text-sm ${i === 0 ? 'text-[#8B7355] italic' : 'text-[#2D2926]'}`}>
                {i > 0 && <Check className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />} {f}
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#8B7355] mt-6 bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-3">
            No boosts. No "pay to be seen". No pay-per-message. Kulmi+ never changes who appears in
            anyone's Discover — that would betray what Kulmi stands for.
          </p>
          <button onClick={onJoin} className="w-full mt-6 bg-[#1B4332] text-white py-3 rounded-xl font-medium hover:bg-[#143326] transition-colors">
            {FOUNDING_ACTIVE ? 'Join now — free until 30 Sept' : 'Get Kulmi+'}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-[#8B7355] mt-8">
        Cancel anytime. Payments are handled securely by Stripe — Kulmi never sees your card details.
      </p>

      {/* Support Kulmi */}
      <div className="mt-10 bg-white border border-[#E5E0D8] rounded-3xl p-7 md:p-8 text-center">
        <p className="text-3xl mb-3">☕</p>
        <h2 className="font-serif text-2xl text-[#1B4332] italic mb-2">Support Kulmi</h2>
        <p className="text-sm text-[#5C574F] max-w-md mx-auto leading-relaxed mb-5">
          Kulmi is independently built for our community — servers, human verification and
          moderation all cost money, and we refuse to fund them with ads or by selling data.
          If Kulmi has helped you (or you simply believe in the mission), you can gift any
          amount. Jazakallahu khairan.
        </p>
        {DONATE_URL ? (
          <a href={DONATE_URL} target="_blank" rel="noreferrer"
            className="inline-block bg-[#1B4332] text-white px-8 py-3 rounded-xl font-medium hover:bg-[#143326] transition-colors">
            ☕ Buy us a coffee
          </a>
        ) : (
          <p className="text-xs text-[#8B7355]">Donation link coming soon, insha'Allah.</p>
        )}
      </div>
    </motion.div>
  );
}
