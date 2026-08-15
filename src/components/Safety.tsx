import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, BadgeCheck, Lock, Users, Flag, EyeOff, Trash2, HeartHandshake, ArrowLeft } from 'lucide-react';

const Item = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4 p-5 bg-white border border-[#E5E0D8] rounded-2xl">
    <div className="w-10 h-10 rounded-xl bg-[#E8F3ED] text-[#1B4332] flex items-center justify-center shrink-0">{icon}</div>
    <div>
      <h3 className="font-bold text-[#1B4332] mb-1">{title}</h3>
      <p className="text-sm text-[#5C574F] leading-relaxed">{children}</p>
    </div>
  </div>
);

export function Safety({ onBack, onContact }: { onBack: () => void; onContact: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto py-8 px-1">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-[#8B7355] hover:text-[#1B4332] mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-[#1B4332] text-white flex items-center justify-center mx-auto mb-5">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="font-serif text-3xl text-[#1B4332] italic mb-3">Trust &amp; Safety</h1>
        <p className="text-[#8B7355] text-sm max-w-md mx-auto leading-relaxed">
          Kulmi is built for one purpose: halal marriage. Every design decision protects your dignity, your privacy, and your family's trust.
        </p>
      </div>

      <div className="space-y-4">
        <Item icon={<BadgeCheck className="w-5 h-5" />} title="Every member is verified by a live selfie">
          Nobody appears in Discover until a human reviewer has matched their live selfie to their profile photo — and to their stated gender. AI images, stock photos, hidden faces and duplicate photos are rejected. One photo can only ever belong to one account.
        </Item>
        <Item icon={<Lock className="w-5 h-5" />} title="Your photos and voice are private">
          Gallery photos unlock only after you both match. Voice introductions and voice answers are stored privately and are never publicly accessible. Nothing about you is visible to people you haven't chosen to meet.
        </Item>
        <Item icon={<Users className="w-5 h-5" />} title="Family involvement, done properly">
          You can appoint a wali (guardian) who can oversee your introductions with full transparency — and they get access only after they personally confirm by email. Read-only, no surprises, exactly as it should be.
        </Item>
        <Item icon={<HeartHandshake className="w-5 h-5" />} title="No swiping. No games.">
          Introductions come one at a time, with a limit on how many you can have open. Both people answer the same serious compatibility questions about deen, family and life before any chat opens. People who reach out to you must be answered before you browse on.
        </Item>
        <Item icon={<Flag className="w-5 h-5" />} title="Report anything, we act on everything">
          Every report goes straight to our moderation team. Warnings are issued by email; serious or repeated behaviour means permanent removal and an email ban that survives account deletion. Reports are kept even if the reported account is deleted — no one launders their history.
        </Item>
        <Item icon={<EyeOff className="w-5 h-5" />} title="End contact silently, any time">
          If a conversation isn't right, end it — they simply never see you again, and you never see them. No confrontation needed.
        </Item>
        <Item icon={<Trash2 className="w-5 h-5" />} title="Leave completely, whenever you choose">
          Deleting your account removes your profile, photos, voice recordings, matches and login — permanently. We don't hold your data hostage.
        </Item>
      </div>

      <div className="mt-10 bg-[#1B4332] text-white rounded-2xl p-6 text-center">
        <h3 className="font-serif text-lg mb-2">Seen something that worries you?</h3>
        <p className="text-sm text-white/80 mb-4">Use the report button on any profile or chat — or write to us directly. A human reads every message.</p>
        <button onClick={onContact} className="bg-white text-[#1B4332] px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#F0EEE8] transition-colors">
          Contact us
        </button>
      </div>
    </motion.div>
  );
}
