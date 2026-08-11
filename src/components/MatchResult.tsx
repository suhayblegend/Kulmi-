import React from 'react';
import { Search } from 'lucide-react';

interface MatchResultProps {
  isMutual: boolean;
  onContinue: () => void;
}

export function MatchResult({ isMutual, onContinue }: MatchResultProps) {
  if (!isMutual) {
    return (
      <div className="w-full max-w-md mx-auto text-center border border-[#E5E0D8] bg-white rounded-2xl shadow-sm">
        <div className="pt-16 pb-14 px-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-[#F0EEE8] rounded-full flex items-center justify-center mb-8 border border-[#E5E0D8]">
            <Search className="w-6 h-6 text-[#8B7355]" />
          </div>
          <h2 className="text-2xl font-serif font-medium text-[#1B4332] mb-4 italic">
            Thank you for completing your Compatibility Session.
          </h2>
          <p className="text-sm text-[#5C574F] mb-10 leading-relaxed">
            Unfortunately, this introduction wasn't mutual. We respect everyone's privacy, so no further details are shared. We'll continue searching for another compatible introduction.
          </p>
          <button 
            className="w-full bg-[#1B4332] text-white hover:bg-[#143326] h-14 rounded-xl font-medium tracking-wide transition-colors" 
            onClick={onContinue}
          >
            Return to Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto text-center border border-[#E5E0D8] bg-white rounded-2xl overflow-hidden shadow-md">
      <div className="bg-[#1B4332] py-12 px-8 text-[#F0EEE8] relative overflow-hidden flex flex-col items-center">
        <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
           <div className="w-64 h-64 border-4 border-white rounded-full rotate-45 scale-150"></div>
        </div>
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6 mx-auto backdrop-blur-sm border border-white/20 relative z-10">
          <div className="w-6 h-6 border-2 border-[#F0EEE8] rotate-45"></div>
        </div>
        <h2 className="text-3xl font-serif font-medium mb-3 relative z-10">
          Alhamdulillah, it's a mutual match!
        </h2>
        <p className="text-[#F0EEE8]/80 text-sm relative z-10 max-w-sm">
          You both chose to continue getting to know each other.
        </p>
      </div>

      <div className="pt-10 pb-10 px-10 flex flex-col items-center bg-white">
        <div className="flex -space-x-4 mb-10">
          <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-[#F0EEE8] z-10">
            {/* User photo */}
            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop" alt="You" className="w-full h-full object-cover" />
          </div>
          <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-[#F0EEE8] z-0">
             {/* Match photo unblurred */}
             <img src="https://images.unsplash.com/photo-1542206395-9feb3edaa68d?w=400&h=400&fit=crop" alt="Match" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="space-y-3 w-full">
          <p className="text-sm text-[#5C574F] mb-6">
            Full profiles and private chat are now unlocked.
          </p>
          <button 
            className="w-full bg-[#1B4332] text-white hover:bg-[#143326] h-14 rounded-xl font-medium tracking-wide transition-colors" 
            onClick={onContinue}
          >
            View Profile & Chat
          </button>
        </div>
      </div>
    </div>
  );
}
