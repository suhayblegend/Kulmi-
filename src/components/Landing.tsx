import React from 'react';
import { motion } from 'motion/react';
import { Shield, HeartHandshake, Sparkles, Star, UserPlus } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
}

export function Landing({ onStart, onTerms, onPrivacy }: LandingProps) {
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
            { step: '03', title: 'Guided Session', desc: 'Meet one match in an AI-hosted compatibility session.' },
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

      {/* Testimonials */}
      <section className="w-full bg-[#F0EEE8] py-24 border-y border-[#E5E0D8]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-[#1B4332] mb-4 italic">Success Stories</h2>
            <p className="text-[#8B7355]">Join couples who found their match through intentional introduction.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-[#E5E0D8] shadow-sm">
              <div className="flex gap-1 mb-6 text-[#8B7355]">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-[#2D2926] font-serif text-lg italic mb-6 leading-relaxed">
                "I was exhausted by traditional apps. The compatibility session on Kulmi forced us to focus on what actually matters—our deen and future goals—before getting distracted by pictures. We are getting married next month Alhamdulillah."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E5E0D8] flex items-center justify-center font-serif text-[#1B4332]">S</div>
                <div>
                  <p className="text-sm font-bold text-[#1B4332]">Salma & Ahmed</p>
                  <p className="text-[10px] uppercase tracking-widest text-[#8B7355]">London, UK</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-[#E5E0D8] shadow-sm">
              <div className="flex gap-1 mb-6 text-[#8B7355]">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-[#2D2926] font-serif text-lg italic mb-6 leading-relaxed">
                "The privacy aspect was exactly what I needed. Knowing my photos aren't just out there for anyone to see made me feel secure. When we finally unlocked our profiles, we already knew we aligned on the big things."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E5E0D8] flex items-center justify-center font-serif text-[#1B4332]">F</div>
                <div>
                  <p className="text-sm font-bold text-[#1B4332]">Fatima & Omar</p>
                  <p className="text-[10px] uppercase tracking-widest text-[#8B7355]">Toronto, CA</p>
                </div>
              </div>
            </div>
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
        </div>
      </section>
    </div>
  );
}
