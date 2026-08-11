import React, { useEffect, useState } from 'react';
import { Loader2, BellRing, UserCheck, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WaitingRoomProps {
  onStart: () => void;
}

export function WaitingRoom({ onStart }: WaitingRoomProps) {
  const [phase, setPhase] = useState<'notified' | 'viewing' | 'accepted'>('notified');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('viewing'), 2500);
    const t2 = setTimeout(() => setPhase('accepted'), 5000);
    const t3 = setTimeout(() => onStart(), 6500);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onStart]);

  return (
    <div className="w-full max-w-md mx-auto text-center border border-[#E5E0D8] bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="pt-16 pb-16 flex flex-col items-center px-8">
        <AnimatePresence mode="wait">
          {phase === 'notified' && (
            <motion.div key="notified" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex flex-col items-center">
              <div className="w-20 h-20 bg-[#F0EEE8] rounded-full flex items-center justify-center mb-8 border border-[#E5E0D8] relative">
                <BellRing className="w-8 h-8 text-[#1B4332] animate-pulse" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
              </div>
              <h2 className="text-2xl font-serif font-medium text-[#1B4332] mb-3 italic">
                Invitation Sent
              </h2>
              <p className="text-sm text-[#8B7355] max-w-[260px] leading-relaxed">
                We've notified the other user. Waiting for them to come online.
              </p>
            </motion.div>
          )}

          {phase === 'viewing' && (
            <motion.div key="viewing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex flex-col items-center">
              <div className="w-20 h-20 bg-[#F0EEE8] rounded-full flex items-center justify-center mb-8 border border-[#E5E0D8]">
                <Smartphone className="w-8 h-8 text-[#1B4332]" />
              </div>
              <h2 className="text-2xl font-serif font-medium text-[#1B4332] mb-3 italic">
                They are viewing...
              </h2>
              <p className="text-sm text-[#8B7355] max-w-[260px] leading-relaxed">
                The other user is currently looking at your invitation.
              </p>
            </motion.div>
          )}

          {phase === 'accepted' && (
            <motion.div key="accepted" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex flex-col items-center">
              <div className="w-20 h-20 bg-[#1B4332] rounded-full flex items-center justify-center mb-8 shadow-lg">
                <UserCheck className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-serif font-medium text-[#1B4332] mb-3 italic">
                Invitation Accepted!
              </h2>
              <p className="text-sm text-[#8B7355] max-w-[260px] leading-relaxed">
                Starting compatibility session now...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {phase !== 'accepted' && (
          <div className="mt-12 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8B7355]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Please Wait</span>
          </div>
        )}
      </div>
    </div>
  );
}
