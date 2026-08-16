import React from 'react';
import { ArrowLeft, ShieldCheck, Lock, HeartHandshake, Users } from 'lucide-react';

interface AboutProps {
  onBack: () => void;
  onContact?: () => void;
}

export function About({ onBack, onContact }: AboutProps) {
  return (
    <div className="w-full max-w-3xl mx-auto py-10 px-1">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#8B7355] hover:text-[#1B4332] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Hero */}
      <div className="text-center mb-12">
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#8B7355] mb-3">About Kulmi</p>
        <h1 className="font-serif text-4xl md:text-5xl text-[#1B4332] italic leading-tight mb-4">Built by our community, for our community</h1>
        <p className="font-serif italic text-[#8B7355]">Isla Kulma, Isla Noolada — come together, live together.</p>
      </div>

      {/* Founders photo + intro */}
      <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-sm overflow-hidden mb-8">
        <img src="/founders.jpg" alt="Fardowza and Suhayb, founders of Kulmi" className="w-full max-h-[520px] object-cover object-center" />
        <div className="p-7 md:p-9">
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#8B7355] mb-4">Why we built Kulmi</p>
          <div className="space-y-4 text-[#5C574F] leading-relaxed">
            <p className="font-serif text-lg text-[#1B4332] italic">Assalamu alaikum,</p>
            <p>
              We're <span className="text-[#1B4332] font-medium">Suhayb</span> and{' '}
              <span className="text-[#1B4332] font-medium">Fardowza</span> — two Somali developers and classmates who
              kept hearing the same thing from brothers and sisters around us: finding a spouse the halal way had become
              hard, and the apps out there felt like dating apps with a Muslim label.
            </p>
            <p>
              So we built Kulmi ourselves — a serious, verified, wali-friendly place made for marriage, not for swiping.
              Every decision, from mandatory selfie verification to keeping your photos private until you both match, was
              made to protect your dignity and your Deen.
            </p>
            <p>
              We're new, and we know trust is earned, not claimed. We're building this carefully, listening to our
              community, and improving it every week, insha'Allah. If you have a question, an idea, or a concern, we'd
              genuinely love to hear from you.
            </p>
            <p className="font-serif italic text-[#1B4332] pt-1">— Suhayb &amp; Fardowza, founders of Kulmi</p>
          </div>
        </div>
      </div>

      {/* Our promises */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {[
          { icon: ShieldCheck, t: 'Everyone is verified', d: 'A live selfie check for every member — real people only, no catfish, no fakes.' },
          { icon: Lock, t: 'Your privacy is sacred', d: 'Photos stay private until you both match. We never sell your data — ever.' },
          { icon: HeartHandshake, t: 'Wali-friendly by design', d: 'Involve a guardian with their own consent — honouring Deen and Dhaqan.' },
          { icon: Users, t: 'Marriage, not games', d: 'One thoughtful introduction at a time. Values before photos. No endless swiping.' },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="bg-white p-6 rounded-2xl border border-[#E5E0D8] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#F0EEE8] flex items-center justify-center text-[#1B4332] mb-3">
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg text-[#1B4332] italic mb-1.5">{t}</h3>
            <p className="text-sm text-[#5C574F] leading-relaxed">{d}</p>
          </div>
        ))}
      </div>

      {/* Contact + agency credit */}
      <div className="bg-[#1B4332] text-white rounded-3xl p-7 md:p-9 text-center">
        <h3 className="font-serif text-2xl italic mb-2">Questions? Talk to a real person.</h3>
        <p className="text-white/75 text-sm mb-5 max-w-md mx-auto">
          A founder reads every message. Email us at{' '}
          <a href="mailto:support@kulmi.uk" className="underline underline-offset-2">support@kulmi.uk</a>.
        </p>
        {onContact && (
          <button onClick={onContact} className="bg-white text-[#1B4332] px-6 py-3 rounded-xl font-medium hover:bg-[#F0EEE8] transition-colors">
            Contact us
          </button>
        )}
        <p className="text-xs text-white/50 mt-6">
          Kulmi was designed and built by{' '}
          <a href="https://egehagency.com/" target="_blank" rel="noreferrer" className="text-white/80 underline underline-offset-2 hover:text-white">Egeh Agency</a>
          {' '}— a Somali web development studio building websites and apps for businesses. Need one? We'd love to help.
        </p>
      </div>
    </div>
  );
}
