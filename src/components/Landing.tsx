import React from 'react';
import { motion } from 'motion/react';
import { Shield, HeartHandshake, Sparkles, UserPlus } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
  onContact?: () => void;
}

export function Landing({ onStart, onTerms, onPrivacy, onContact }: LandingProps) {
  return (
    <div className="w-full flex flex-col items-center">
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
            <p className="text-[#8B7355] max-w-xl mx-auto">Built for one purpose — a serious, halal path to marriage.</p>
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

      {/* FAQ */}
      <section className="w-full bg-white border-y border-[#E5E0D8] py-24">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif text-[#1B4332] mb-4 italic">Questions, answered</h2>
            <p className="text-[#8B7355]">Everything families ask us before joining.</p>
          </div>
          <div className="space-y-3">
            {[
              ['Is Kulmi free?', 'Yes — joining, matching, compatibility sessions and chatting are free. We will always keep the core journey to marriage accessible.'],
              ['How does verification work?', 'Every member submits a live selfie which a human reviewer compares against their profile photo and stated gender. AI images, stock photos, hidden faces and duplicate photos are rejected. Nobody appears in Discover until they pass.'],
              ['What is the wali feature — is it required?', "It's optional but encouraged. You can appoint a guardian (father, brother, uncle, imam) who can view your introductions read-only. They receive an email and get access only after they personally confirm — honouring both deen and dhaqan."],
              ['Who can see my photos?', 'Only your main photo is visible in Discover, and only to verified members of the opposite gender. Your other photos and voice recordings stay locked until you both match.'],
              ['How do introductions actually work?', "No swiping. We show you one suitable person at a time. If you invite them and they accept, you both answer the same 8 serious questions about deen, family and life goals — then decide. Only a mutual yes opens a chat. You can hold at most 3 open introductions, so everyone is intentional."],
              ['What happens if someone behaves badly?', 'Report them from their profile or the chat — a human reviews every report. We warn by email, and remove and permanently ban repeat or serious offenders. Ending contact with someone is always silent: they simply never see you again.'],
              ['Can I use Kulmi outside the UK?', 'Yes — Kulmi is for the Somali community worldwide. Use the country and city filters to search where you intend to build your life.'],
              ['Can I delete my account completely?', 'Yes, in one step from Settings. Your profile, photos, voice recordings, matches and login are permanently removed — we do not keep your data.'],
            ].map(([q, a]) => (
              <details key={q as string} className="group bg-[#FDFBF7] border border-[#E5E0D8] rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 font-medium text-[#1B4332] text-sm md:text-base">
                  {q}
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#F0EEE8] text-[#1B4332] flex items-center justify-center text-sm transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 text-sm text-[#5C574F] leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
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
        <div className="mt-12 flex items-center justify-center gap-6 text-sm text-[#8B7355]">
          <button onClick={onTerms} className="hover:text-[#1B4332] transition-colors">Terms of Service</button>
          <span>•</span>
          <button onClick={onPrivacy} className="hover:text-[#1B4332] transition-colors">Privacy Policy</button>
          {onContact && <><span>•</span><button onClick={onContact} className="hover:text-[#1B4332] transition-colors">Contact</button></>}
          <span>•</span>
          <button onClick={() => { window.history.pushState({}, '', '/safety'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="hover:text-[#1B4332] transition-colors">Trust &amp; Safety</button>
          <span>•</span>
          <button onClick={() => { window.history.pushState({}, '', '/blog'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="hover:text-[#1B4332] transition-colors">Journal</button>
        </div>
      </section>
    </div>
  );
}
