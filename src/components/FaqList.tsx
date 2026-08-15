import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

export const FAQS: [string, string][] = [
  ['Is Kulmi free?', 'Yes — joining, matching, compatibility sessions and chatting are free, forever. Kulmi+ adds optional extras (see who viewed you, 5 open introductions, priority verification).'],
  ['How does verification work?', 'Every member submits a live selfie which a human reviewer compares against their profile photo and stated gender. AI images, stock photos, hidden faces and duplicate photos are rejected. Nobody appears in Discover until they pass.'],
  ['What is the wali feature — is it required?', "It's optional but encouraged. You can appoint a guardian (father, brother, uncle, imam) who can view your introductions read-only. They receive an email and get access only after they personally confirm — honouring both deen and dhaqan."],
  ['Who can see my photos?', 'Only your main photo is visible in Discover, and only to verified members of the opposite gender. Your other photos and voice recordings stay locked until you both match.'],
  ['How do introductions actually work?', "No swiping. We show you one suitable person at a time. If you invite them and they accept, you both answer the same 8 serious questions about deen, family and life goals — then decide. Only a mutual yes opens a chat. You can hold at most 3 open introductions (5 with Kulmi+), so everyone is intentional."],
  ['What happens if someone behaves badly?', 'Report them from their profile or the chat — a human reviews every report. We warn by email, and remove and permanently ban repeat or serious offenders. Ending contact with someone is always silent: they simply never see you again.'],
  ['Can I use Kulmi outside the UK?', 'Yes — Kulmi is for the Somali community worldwide. Use the country and city filters to search where you intend to build your life.'],
  ['Can I delete my account completely?', 'Yes, in one step from Settings. Your profile, photos, voice recordings, matches and login are permanently removed — we do not keep your data.'],
];

export function FaqList({ light = false }: { light?: boolean }) {
  return (
    <div className="space-y-3">
      {FAQS.map(([q, a]) => (
        <details key={q} className={`group border border-[#E5E0D8] rounded-2xl overflow-hidden ${light ? 'bg-white' : 'bg-[#FDFBF7]'}`}>
          <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 font-medium text-[#1B4332] text-sm md:text-base">
            {q}
            <span className="shrink-0 w-6 h-6 rounded-full bg-[#F0EEE8] text-[#1B4332] flex items-center justify-center text-sm transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="px-5 pb-5 text-sm text-[#5C574F] leading-relaxed">{a}</p>
        </details>
      ))}
    </div>
  );
}

export function Faq({ onBack, onContact }: { onBack: () => void; onContact: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto py-8 px-1">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-[#8B7355] hover:text-[#1B4332] mb-8">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="text-center mb-10">
        <h1 className="font-serif text-4xl text-[#1B4332] italic mb-3">Questions, answered</h1>
        <p className="text-[#8B7355]">Everything families ask us before joining.</p>
      </div>
      <FaqList light />
      <div className="text-center mt-10">
        <p className="text-sm text-[#8B7355] mb-3">Still have a question?</p>
        <button onClick={onContact} className="bg-[#1B4332] text-white px-8 py-3 rounded-xl font-medium hover:bg-[#143326] transition-colors">Contact us</button>
      </div>
    </motion.div>
  );
}
