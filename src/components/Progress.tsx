import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Trophy, Star } from 'lucide-react';
import { getMyStats, type MyStats } from '../lib/db';
import { Skeleton } from './ui/Skeleton';

export function Progress() {
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    let active = true;
    getMyStats().then((s) => active && setStats(s)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!stats) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const StepIcon = ({ done }: { done: boolean }) =>
    done ? <CheckCircle2 className="w-6 h-6 text-[#1B4332]" /> : <Circle className="w-6 h-6 text-[#E5E0D8]" />;

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <h2 className="text-3xl font-serif text-[#1B4332] mb-6">Your Journey Progress</h2>
        
        <div className="bg-white rounded-3xl p-8 border border-[#E5E0D8] shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-[#1B4332]">Milestones</h3>
            <span className="text-sm font-medium text-[#8B7355] bg-[#F0EEE8] px-3 py-1 rounded-full">Level 2 Seeker</span>
          </div>
          
          <div className="space-y-6">
            {[
              { done: stats.profileComplete, title: 'Profile Completed', desc: "You've set up your profile and preferences." },
              { done: stats.photoVerified, title: 'Photo Verified', desc: 'Your identity was reviewed and approved by our team.' },
              { done: stats.invitationsSent > 0, title: 'First Invitation Sent', desc: 'You reached out to a potential match.' },
              { done: stats.matches > 0, title: 'First Match', desc: 'An introduction was mutually accepted.', last: true },
            ].map((m, i, arr) => (
              <div key={m.title} className="flex gap-4">
                <div className="mt-1 flex flex-col items-center">
                  <StepIcon done={m.done} />
                  {i < arr.length - 1 && (
                    <div className={`w-0.5 h-12 my-1 ${m.done ? 'bg-[#1B4332]' : 'bg-[#E5E0D8]'}`}></div>
                  )}
                </div>
                <div>
                  <h4 className={`font-medium ${m.done ? 'text-[#2D2926]' : 'text-[#8B7355]'}`}>{m.title}</h4>
                  <p className={`text-sm mt-1 ${m.done ? 'text-[#5C574F]' : 'text-[#8B7355]/70'}`}>{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1B4332] rounded-3xl p-6 text-white shadow-sm relative overflow-hidden">
            <Trophy className="w-24 h-24 absolute -bottom-4 -right-4 opacity-10" />
            <h3 className="font-serif text-xl mb-2 relative z-10">Your Matches</h3>
            <p className="text-4xl font-bold mb-1 relative z-10">{stats.matches} <span className="text-lg font-normal opacity-80">{stats.matches === 1 ? 'Match' : 'Matches'}</span></p>
            <p className="text-sm opacity-80 relative z-10">Quality over quantity — meaningful introductions.</p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#E5E0D8] shadow-sm">
            <h3 className="font-serif text-xl text-[#1B4332] mb-4">Insights</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F0EEE8] flex items-center justify-center text-[#1B4332]">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-[#2D2926]">{stats.invitationsSent}</p>
                  <p className="text-xs text-[#8B7355] uppercase tracking-wide">Invitations Sent</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F0EEE8] flex items-center justify-center text-[#1B4332]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-[#2D2926]">{stats.incomingPending}</p>
                  <p className="text-xs text-[#8B7355] uppercase tracking-wide">Pending Invitations</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
