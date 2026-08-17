import React from 'react';
import { Sparkles } from 'lucide-react';

// "Kulmi+" badge shown next to premium members' names, everywhere a name appears.
export function KulmiPlus({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 bg-gradient-to-r from-[#1B4332] to-[#2B6B4C] text-[#F5EFE3] text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shadow-sm shrink-0 ${className}`}>
      <Sparkles className="w-3 h-3 text-amber-300" /> Kulmi+
    </span>
  );
}
