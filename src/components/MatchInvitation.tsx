import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, MapPin, Briefcase, GraduationCap, Globe, CheckCircle2, MessageSquare, Heart, X, Sparkles, Target, Star, ChevronDown, ChevronUp } from 'lucide-react';

interface MatchInvitationProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function MatchInvitation({ onAccept, onDecline }: MatchInvitationProps) {
  const [showFullProfile, setShowFullProfile] = useState(false);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto pb-24">
      {/* Top Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-3 px-5 py-2 bg-[#FDFBF7] border border-[#E5E0D8] rounded-full shadow-sm">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1B4332] opacity-20"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#1B4332]"></span>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#1B4332]">New Introduction</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#8B7355]">Compatibility</span>
          <span className="text-xl font-serif font-bold text-[#1B4332]">94%</span>
        </div>
      </motion.div>

      {/* Main Profile Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full bg-white border border-[#E5E0D8] shadow-sm rounded-3xl overflow-hidden mb-8"
      >
        {/* Blurred Photo Header */}
        <div className="w-full h-64 md:h-80 relative overflow-hidden bg-[#2D2926]">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#1B4332] to-[#8B7355] opacity-40 blur-2xl"></div>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-24 h-24 rounded-full border-2 border-white/20 mb-4 flex items-center justify-center bg-white/5 backdrop-blur-md">
              <Lock className="w-8 h-8 text-white/70" />
            </div>
            <h2 className="text-3xl font-serif text-white mb-2">Ahmed, 28</h2>
            <div className="flex flex-wrap items-center justify-center gap-4 text-white/80 text-sm">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> London, UK</span>
              <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> Software Engineer</span>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex justify-end items-end z-20">
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-right max-w-[200px]">
              <p className="text-[10px] uppercase tracking-wider font-bold text-white/70 mb-0.5">Photo Privacy</p>
              <p className="text-xs text-white/90 leading-tight">Photos unlock after mutual compatibility session.</p>
            </div>
          </div>
        </div>

        {/* AI Summary Section */}
        <div className="p-6 md:p-10 border-b border-[#E5E0D8] bg-gradient-to-b from-[#FDFBF7] to-white">
          <div className="flex items-start gap-4">
            <div className="mt-1 bg-[#1B4332]/10 p-2 rounded-xl text-[#1B4332] shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-2">AI Profile Summary</h3>
              <p className="text-lg text-[#2D2926] leading-relaxed font-serif">
                "Ahmed is family-oriented, values faith deeply, hopes to marry within 1-2 years, enjoys continuous learning, and is looking to build a peaceful Islamic home."
              </p>
            </div>
          </div>
        </div>

        {/* Core Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Marriage Intent & Faith */}
          <div className="p-6 md:p-10 border-b md:border-b-0 md:border-r border-[#E5E0D8]">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-6 flex items-center gap-2">
              <Target className="w-4 h-4" /> Marriage Intent
            </h3>
            <ul className="space-y-4">
              <li className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                <span className="text-[#5C574F]">Looking for</span>
                <span className="font-medium text-[#1B4332]">Marriage Only</span>
              </li>
              <li className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                <span className="text-[#5C574F]">Timeline</span>
                <span className="font-medium text-[#1B4332]">Within 1-2 Years</span>
              </li>
              <li className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                <span className="text-[#5C574F]">Relocation</span>
                <span className="font-medium text-[#1B4332]">Willing to relocate</span>
              </li>
              <li className="flex justify-between items-center text-sm pb-1">
                <span className="text-[#5C574F]">Children</span>
                <span className="font-medium text-[#1B4332]">Wants children</span>
              </li>
            </ul>

            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-6 mt-10 flex items-center gap-2">
              <Star className="w-4 h-4" /> Faith
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#5C574F]">Prayer Level</span>
                <span className="font-medium text-[#1B4332] bg-[#FDFBF7] px-3 py-1 rounded-lg border border-[#E5E0D8]">5 Daily Prayers</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#5C574F]">Practice</span>
                <span className="font-medium text-[#1B4332] bg-[#FDFBF7] px-3 py-1 rounded-lg border border-[#E5E0D8]">Practicing</span>
              </div>
              <div className="bg-[#F0EEE8] p-4 rounded-xl mt-4">
                <p className="text-sm text-[#2D2926] italic">"Striving to improve my deen daily and looking for a partner to grow with spiritually."</p>
              </div>
            </div>
          </div>

          {/* Personality & Goals */}
          <div className="p-6 md:p-10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-6">About Me</h3>
            <p className="text-sm text-[#5C574F] leading-relaxed mb-8">
              I am a software engineer who enjoys a quiet life. I value honesty, respect, and deep conversations. Outside of work, I spend time with my family and stay active.
            </p>

            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-4">Personality Traits</h3>
            <div className="flex flex-wrap gap-2 mb-8">
              {['Calm', 'Patient', 'Family-Oriented', 'Organized'].map(trait => (
                <span key={trait} className="px-3 py-1.5 bg-white border border-[#1B4332] text-[#1B4332] rounded-full text-xs font-medium">
                  {trait}
                </span>
              ))}
            </div>

            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-4">Future Goals</h3>
            <div className="space-y-2">
              {[
                { rank: 1, title: 'Strong Islamic Home' },
                { rank: 2, title: 'Financial Stability' },
                { rank: 3, title: 'Travel & Exploration' }
              ].map(goal => (
                <div key={goal.rank} className="flex items-center gap-3 bg-[#FDFBF7] border border-[#E5E0D8] p-3 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-xs font-bold">
                    {goal.rank}
                  </div>
                  <span className="text-sm font-medium text-[#2D2926]">{goal.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Conversation Starters */}
        <div className="p-6 md:p-10 border-t border-[#E5E0D8] bg-[#FDFBF7]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1B4332] mb-6 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Mutual Compatibility Insights
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#E5E0D8] shadow-sm">
              <p className="text-sm text-[#2D2926]">You both ranked <span className="font-bold text-[#1B4332]">Family</span> as your highest priority for the future.</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E5E0D8] shadow-sm">
              <p className="text-sm text-[#2D2926]">Both of you indicated a willingness to <span className="font-bold text-[#1B4332]">Relocate</span> for marriage.</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E5E0D8] shadow-sm">
              <p className="text-sm text-[#2D2926]">Ask Ahmed about his favorite destinations for <span className="font-bold text-[#1B4332]">Travel</span>.</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E5E0D8] shadow-sm">
              <p className="text-sm text-[#2D2926]">You both prefer a <span className="font-bold text-[#1B4332]">Calm</span> communication style.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-[#E5E0D8] flex justify-center gap-4 z-50">
        <div className="w-full max-w-2xl flex gap-4">
          <button 
            onClick={onDecline}
            className="flex-1 bg-white border border-[#E5E0D8] text-[#8B7355] py-4 rounded-xl font-medium tracking-wide hover:bg-[#F0EEE8] transition-colors"
          >
            Pass
          </button>
          <button 
            onClick={onAccept}
            className="flex-[2] bg-[#1B4332] text-white py-4 rounded-xl font-medium tracking-wide hover:bg-[#143326] transition-colors flex items-center justify-center gap-3 shadow-lg"
          >
            <span>Start Compatibility Session</span>
            <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
