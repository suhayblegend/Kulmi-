import React from 'react';
import { ArrowLeft, Phone, Video, MoreVertical } from 'lucide-react';

interface ChatHeaderProps {
  partnerName: string;
  partnerAvatar?: string;
  onExit: () => void;
  setShowStatusModal: (v: boolean) => void;
  setShowEndConfirm: (v: boolean) => void;
}

export function ChatHeader({ partnerName, partnerAvatar, onExit, setShowStatusModal, setShowEndConfirm }: ChatHeaderProps) {
  return (
    <div className="h-[72px] border-b border-[#E5E0D8] bg-[#FDFBF7] flex items-center justify-between px-6 sm:px-8 shrink-0">
      <div className="flex items-center gap-4">
        <div className="md:hidden">
            <button onClick={onExit} className="-ml-2 text-[#8B7355] hover:text-[#1B4332] p-2 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="w-10 h-10 rounded-full overflow-hidden md:hidden border border-[#E5E0D8]">
          {partnerAvatar && <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />}
        </div>
        <div>
          <h2 className="font-serif text-xl font-medium text-[#1B4332]">{partnerName}</h2>
          <p className="text-[10px] text-[#8B7355] font-bold uppercase tracking-widest mt-0.5">Introduced</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[#8B7355]">
        <button className="p-2 hover:text-[#1B4332] transition-colors">
          <Phone className="w-5 h-5" />
        </button>
        <button className="p-2 hover:text-[#1B4332] transition-colors">
          <Video className="w-5 h-5" />
        </button>
        <div className="relative group">
          <button className="p-2 hover:text-[#1B4332] transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
          <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#E5E0D8] rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 flex flex-col p-1">
            <button 
              className="w-full text-left px-4 py-2 text-sm text-[#1B4332] hover:bg-[#F0EEE8] transition-colors rounded-lg font-medium"
              onClick={() => setShowStatusModal(true)}
            >
              Update Status
            </button>
            <div className="h-px bg-[#E5E0D8] my-1"></div>
            <button 
              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors rounded-lg font-medium"
              onClick={() => setShowEndConfirm(true)}
            >
              End Introduction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
