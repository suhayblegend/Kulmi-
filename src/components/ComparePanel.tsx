import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import type { Profile } from '../lib/db';

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

// Animated circular gauge for the alignment %.
function AlignRing({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(value), 120); return () => clearTimeout(t); }, [value]);
  const r = 30, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, shown)) / 100);
  return (
    <div className="relative w-[72px] h-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#ffffff" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1B4332" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-lg text-[#1B4332] leading-none">{value}%</span>
      </div>
    </div>
  );
}

// An interactive, at-a-glance comparison of you vs another member on key values.
export function ComparePanel({ mine, theirs, theirName }: { mine: Profile; theirs: Profile; theirName: string }) {
  const dims: { label: string; key: keyof Profile }[] = [
    { label: 'Prayer', key: 'prayer_level' },
    { label: 'Wants children', key: 'children' },
    { label: 'Timeline', key: 'timeline' },
    { label: 'Relocate', key: 'relocate' },
    { label: 'Marital status', key: 'marital_status' },
    { label: 'Smoking', key: 'smoking' },
  ];
  const rows = dims
    .map((d) => ({ label: d.label, mine: (mine as any)[d.key] as string, theirs: (theirs as any)[d.key] as string }))
    .filter((r) => r.mine || r.theirs);
  if (rows.length === 0) return null;
  const comparable = rows.filter((r) => r.mine && r.theirs);
  const aligned = comparable.filter((r) => norm(r.mine) === norm(r.theirs)).length;
  const pct = comparable.length ? Math.round((aligned / comparable.length) * 100) : 0;

  return (
    <div className="bg-gradient-to-br from-[#E8F3ED] to-[#F4F1EA] border border-[#1B4332]/15 rounded-2xl p-5 mb-5">
      <div className="flex items-center gap-4 mb-4">
        <AlignRing value={pct} />
        <div className="min-w-0">
          <p className="font-serif text-lg text-[#1B4332] italic leading-tight">How you compare</p>
          <p className="text-xs text-[#5C574F] mt-0.5">
            {comparable.length > 0
              ? `${aligned} of ${comparable.length} key values align, insha'Allah`
              : 'Add more to your profile to compare'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] text-[10px] uppercase tracking-wider text-[#8B7355] px-3 mb-1.5">
        <span className="text-right">You</span><span className="px-2"></span><span>{theirName}</span>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const match = !!(r.mine && r.theirs && norm(r.mine) === norm(r.theirs));
          return (
            <motion.div
              key={r.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 26 }}
              className={`rounded-xl px-3 py-2 border ${match ? 'bg-green-50 border-green-200' : 'bg-white/70 border-[#E5E0D8]'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-[#8B7355]">{r.label}</span>
                {match ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700"><Check className="w-3 h-3" /> Match</span>
                ) : r.mine && r.theirs ? (
                  <span className="text-[10px] text-[#B08968]">Differs</span>
                ) : null}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="text-xs font-medium text-[#2D2926] text-right leading-tight">{r.mine || '—'}</span>
                <span className={`text-xs ${match ? 'text-green-600' : 'text-[#C9C4BA]'}`}>{match ? '=' : 'vs'}</span>
                <span className="text-xs font-medium text-[#2D2926] leading-tight">{r.theirs || '—'}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
