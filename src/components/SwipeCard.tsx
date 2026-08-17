import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { Heart, X as XIcon } from 'lucide-react';

// A draggable discover card: swipe right to invite, left to skip. Each card owns
// its own motion value (it's keyed + remounted per person), so state never
// leaks between cards. Buttons inside still work — a tap isn't a drag.
interface SwipeCardProps {
  onInvite: () => void;
  onSkip: () => void;
  canInvite?: boolean;
  onBlocked?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  onInvite,
  onSkip,
  canInvite = true,
  onBlocked,
  disabled,
  children,
}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-11, 11]);
  const likeOpacity = useTransform(x, [40, 140], [0, 1]);
  const nopeOpacity = useTransform(x, [-40, -140], [0, 1]);
  const [flung, setFlung] = useState(false);

  const fling = (dir: 1 | -1) => {
    if (flung) return;
    setFlung(true);
    animate(x, dir * 640, { type: 'spring', stiffness: 220, damping: 30 });
    if (dir === 1) onInvite(); else onSkip();
  };

  return (
    <motion.div
      drag={disabled || flung ? false : 'x'}
      style={{ x, rotate }}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.55}
      onDragEnd={(_, info) => {
        const wantInvite = info.offset.x > 110 || info.velocity.x > 650;
        const wantSkip = info.offset.x < -110 || info.velocity.x < -650;
        if (wantInvite) {
          if (canInvite) fling(1);
          else { animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 }); onBlocked?.(); }
        } else if (wantSkip) {
          fling(-1);
        }
      }}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2, delay: 0.06 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="relative w-full border border-[#E5E0D8] bg-white shadow-[0_8px_40px_rgba(27,67,50,0.10)] rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
    >
      {/* Swipe intent overlays */}
      <motion.div style={{ opacity: likeOpacity }} className="pointer-events-none absolute z-30 top-6 left-6 flex items-center gap-1.5 border-[3px] border-green-400 text-green-400 font-bold text-xl px-3 py-1 rounded-xl -rotate-12">
        <Heart className="w-5 h-5" /> INVITE
      </motion.div>
      <motion.div style={{ opacity: nopeOpacity }} className="pointer-events-none absolute z-30 top-6 right-6 flex items-center gap-1.5 border-[3px] border-gray-300 text-gray-300 font-bold text-xl px-3 py-1 rounded-xl rotate-12">
        <XIcon className="w-5 h-5" /> SKIP
      </motion.div>

      {children}
    </motion.div>
  );
}
