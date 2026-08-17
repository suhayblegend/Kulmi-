import React from 'react';
import { motion } from 'motion/react';
import { Shield, HeartHandshake, Sparkles, UserPlus } from 'lucide-react';
import { FOUNDING_ACTIVE, FOUNDING_DEADLINE } from '../lib/billing';
import { useCountdown } from './Pricing';

// Compact founding-offer strip: urgency (live timer) + one link to the details.
function FoundingBanner() {
  const { d, h, m, s, over } = useCountdown(FOUNDING_DEADLINE);
  if (over) return null;
  const goPricing = () => { window.history.pushState({}, '', '/pricing'); window.dispatchEvent(new PopStateEvent('popstate')); };
  return (
    <button onClick={goPricing} className="w-full bg-[#1B4332] text-white px-4 py-2.5 text-sm hover:bg-[#143326] transition-colors">
      <span className="inline-flex items-center gap-2.5 flex-wrap justify-center">
        <span>🌟 <b>Founding offer</b> ends in</span>
        <span className="font-mono tabular-nums bg-white/10 border border-white/20 rounded-lg px-2.5 py-0.5">
          {d}d {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </span>
        <span className="underline underline-offset-2 font-medium">See what you get →</span>
      </span>
    </button>
  );
}

interface LandingProps {
  onStart: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
  onContact?: () => void;
}

export function Landing({ onStart, onTerms, onPrivacy, onContact }: LandingProps) {
  return (
    <div className="w-full flex flex-col items-center">
      {/* Founding Member offer — compact, with live countdown */}
      {FOUNDING_ACTIVE && <FoundingBanner />}
      {/* Hero Section */}
      <section className="w-full max-w-5xl mx-auto flex flex-col items-center text-center py-20 px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#8B7355] border border-[#E5E0D8] px-4 py-2 rounded-full bg-white shadow-sm">
            Halal Somali Marriage
          </span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-serif text-[#1B4332] mb-6 leading-[1.1]"
        >
          No Swiping.<br/>
          <span className="italic text-[#8B7355]">Meaningful Introductions.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="font-serif italic text-lg md:text-xl text-[#1B4332] mb-6"
        >
          Isla Kulma, Isla Noolada
          <span className="block text-sm not-italic text-[#8B7355] mt-1">Come together, live together.</span>
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-base md:text-lg text-[#5C574F] max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Kulmi intelligently finds one highly compatible person at a time. Experience a guided compatibility session before unlocking profiles. Quality over quantity.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <button
            onClick={onStart}
            className="w-full sm:w-auto bg-[#1B4332] hover:bg-[#143326] text-white px-8 py-4 rounded-2xl font-medium tracking-wide transition-colors text-base shadow-sm flex items-center justify-center gap-3"
          >
            <UserPlus className="w-5 h-5" />
            <span>Find Your Match</span>
          </button>
        </motion.div>
      </section>

      {/* Trust & Safety Section */}
      <section className="w-full bg-white border-y border-[#E5E0D8] py-16">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-left">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F0EEE8] flex items-center justify-center text-[#1B4332] border border-[#E5E0D8]">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-serif font-medium text-[#1B4332] italic">Intelligent Matching</h3>
            <p className="text-sm text-[#5C574F] leading-relaxed">We analyze values, faith, and life goals to present only the most compatible introductions, one at a time.</p>
          </div>
          
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F0EEE8] flex items-center justify-center text-[#1B4332] border border-[#E5E0D8]">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-serif font-medium text-[#1B4332] italic">Guided Sessions</h3>
            <p className="text-sm text-[#5C574F] leading-relaxed">Engage in structured, meaningful activities designed to reveal true alignment before seeing photos.</p>
          </div>
          
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F0EEE8] flex items-center justify-center text-[#1B4332] border border-[#E5E0D8]">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-serif font-medium text-[#1B4332] italic">Private & Secure</h3>
            <p className="text-sm text-[#5C574F] leading-relaxed">Your photos and full profile are only revealed when both parties express mutual interest.</p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="w-full max-w-5xl mx-auto py-24 px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif text-[#1B4332] mb-4">How Kulmi Works</h2>
          <p className="text-[#8B7355] max-w-xl mx-auto">A respectful, intentional process designed for serious marriage seekers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Complete Profile', desc: 'Detail your values, faith level, and marriage goals.' },
            { step: '02', title: 'Photo Verification', desc: 'Take a selfie to verify your identity and keep the community safe.' },
            { step: '03', title: 'Guided Session', desc: 'Meet one match in a guided compatibility session — answer the same questions and reveal them together.' },
            { step: '04', title: 'Mutual Choice', desc: 'Profiles and photos unlock only if you both say yes.' }
          ].map((item) => (
            <div key={item.step} className="relative">
              <div className="text-5xl font-serif italic text-[#E5E0D8] mb-4">{item.step}</div>
              <h4 className="text-lg font-medium text-[#1B4332] mb-2">{item.title}</h4>
              <p className="text-sm text-[#5C574F] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Kulmi (honest value props — real success stories added here as couples confirm) */}
      <section className="w-full bg-[#F0EEE8] py-24 border-y border-[#E5E0D8]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-[#1B4332] mb-4 italic">Not another dating app</h2>
            <p className="text-[#8B7355] max-w-xl mx-auto">Kulmi is Somali matchmaking done the halal way — the serious, verified alternative to Somali dating apps, built for one purpose: marriage.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { t: 'Character before photos', d: 'You answer meaningful questions together and see each other\'s answers before any photos — so it starts with values, not looks.' },
              { t: 'Every member verified', d: 'A live selfie check keeps out fakes and catfish. Real people, serious about marriage.' },
              { t: 'Your privacy protected', d: 'Only your main photo is public; the rest stays private until you both match. No endless browsing of your pictures.' },
              { t: 'Family involved (Wali)', d: 'Invite a guardian to oversee your conversations — honouring both Deen and Dhaqan.' },
            ].map((x) => (
              <div key={x.t} className="bg-white p-6 rounded-2xl border border-[#E5E0D8] shadow-sm">
                <h3 className="font-serif text-lg text-[#1B4332] italic mb-2">{x.t}</h3>
                <p className="text-sm text-[#5C574F] leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-[#8B7355] mt-10 italic">Real success stories will be featured here, with permission, as our community grows insha'Allah.</p>
        </div>
      </section>

      {/* Meet the founders — teaser linking to the full About page */}
      <section className="w-full max-w-4xl mx-auto py-24 px-6">
        <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-sm overflow-hidden grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          <div className="bg-[#1B4332] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/25 flex items-center justify-center mb-3">
              <span className="font-serif text-2xl text-white italic">K</span>
            </div>
            <p className="text-white font-serif italic text-base leading-tight">Suhayb &amp; Fardowza</p>
            <p className="text-white/60 text-[10px] uppercase tracking-widest mt-1">Founders</p>
          </div>
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#8B7355] mb-3">Built by our community</p>
            <h2 className="font-serif text-2xl md:text-3xl text-[#1B4332] italic mb-3">Made by two Somali developers who cared enough to build it</h2>
            <p className="text-sm text-[#5C574F] leading-relaxed mb-5">
              We're Suhayb &amp; Fardowza. We built Kulmi because our community deserves a serious, halal way to find a
              spouse — verified, private, and wali-friendly. We're real people, and we'd love for you to know us.
            </p>
            <button
              onClick={() => { window.history.pushState({}, '', '/about'); window.dispatchEvent(new PopStateEvent('popstate')); }}
              className="self-start text-sm font-medium text-[#1B4332] border border-[#E5E0D8] rounded-xl px-5 py-2.5 hover:bg-[#FDFBF7] transition-colors"
            >
              Read our story →
            </button>
          </div>
        </div>
      </section>

      {/* Comparison — why Kulmi over the swipe apps */}
      <section className="w-full max-w-4xl mx-auto py-24 px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-[#1B4332] mb-4 italic">Why Kulmi?</h2>
          <p className="text-[#8B7355] max-w-xl mx-auto">
            Muslim swipe apps borrowed their design from dating apps. We started from the sunnah instead — see the difference.
          </p>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-[#E5E0D8] shadow-sm bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[#E5E0D8]">
                <th className="text-left p-4 md:p-5 font-medium text-[#8B7355] w-1/2"></th>
                <th className="p-4 md:p-5 text-center font-serif text-base text-[#8B7355]">Muslim swipe apps</th>
                <th className="p-4 md:p-5 text-center bg-[#1B4332] text-white font-serif text-base rounded-t-none">Kulmi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EEE8]">
              {[
                ['Endless swiping through faces', '✓ The core of the app', '✗ One thoughtful introduction at a time'],
                ['Every member human-verified by live selfie', 'Optional or automated', '✓ Mandatory — nobody unverified appears'],
                ['Values conversation before any chat', '✗ Chat opens instantly', '✓ 8 questions on deen, family & life first'],
                ['Photos private until you match', '✗ Whole gallery public', '✓ Only one photo public — rest unlock on match'],
                ['Wali / family involvement', '✗ Not part of the design', '✓ Built-in, with the wali\'s own consent'],
                ['Limit on open conversations', '✗ Unlimited — quantity wins', '✓ Max 3 — quality wins'],
                ['Built for the Somali community', '✗ Generic', '✓ Deen iyo dhaqan, by design'],
                ['Pressure to pay to be seen', 'Boosts, gold tiers, ads', '✗ None of that'],
              ].map(([feature, them, us]) => (
                <tr key={feature as string}>
                  <td className="p-4 md:p-5 text-[#2D2926] font-medium">{feature}</td>
                  <td className="p-4 md:p-5 text-center text-[#8B7355]">{them}</td>
                  <td className="p-4 md:p-5 text-center bg-[#E8F3ED]/60 text-[#1B4332] font-medium">{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-[11px] text-[#8B7355] mt-4">Comparison reflects the typical design of swipe-based apps; features vary by app.</p>
      </section>

      {/* CTA */}
      <section className="w-full max-w-3xl mx-auto text-center py-24 px-6">
        <h2 className="text-4xl font-serif text-[#1B4332] mb-6">Ready to find your match?</h2>
        <p className="text-[#5C574F] mb-10 leading-relaxed max-w-lg mx-auto">
          Join a community of serious individuals looking for marriage built on shared values and mutual respect.
        </p>
        <button 
          onClick={onStart}
          className="bg-[#1B4332] hover:bg-[#143326] text-white px-10 py-5 rounded-2xl font-medium tracking-wide transition-colors shadow-sm inline-flex items-center gap-3"
        >
          <span>Create Your Profile</span>
          <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
        </button>
      </section>

    </div>
  );
}
