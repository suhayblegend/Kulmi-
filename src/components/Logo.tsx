import React from 'react';

export function Logo({ className = "w-8 h-8", iconClassName = "w-5 h-5" }: { className?: string, iconClassName?: string }) {
  return (
    <div className={`bg-gradient-to-br from-[#1B4332] to-[#0A261A] rounded-xl flex items-center justify-center shrink-0 border border-[#2D5A47] shadow-sm ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`text-[#F0EEE8] ${iconClassName}`}>
        <circle cx="9" cy="8" r="3.5" fill="currentColor" fillOpacity="0.2" />
        <path d="M9 14c-3 0-5.5 2-5.5 5v1h11v-1c0-3-2.5-5-5.5-5z" fill="currentColor" fillOpacity="0.2" />
        <circle cx="15" cy="8" r="3.5" />
        <path d="M15 14c3 0 5.5 2 5.5 5v1h-11v-1c0-3 2.5-5 5.5-5" />
      </svg>
    </div>
  );
}
