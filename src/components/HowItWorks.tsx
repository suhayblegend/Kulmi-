import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, UserPlus, Camera, Compass, Mail, MessageSquareHeart,
  HeartHandshake, Users, ShieldCheck, Sparkles, Clock, Lock, Flag,
} from 'lucide-react';

interface HowItWorksProps {
  onBack: () => void;
  onStart: () => void;
  onSafety: () => void;
  onFaq: () => void;
}

const Step = ({
  n, icon, title, children,
}: { n: string; icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }}
    className="relative bg-white rounded-3xl border border-[#E5E0D8] shadow-sm p-6 md:p-8"
  >
    <div className="flex items-start gap-4">
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-[#F0EEE8] flex items-center justify-center text-[#1B4332]">{icon}</div>
        <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#1B4332] text-white text-[11px] font-bold flex items-center justify-center">{n}</span>
      </div>
      <div className="min-w-0">
        <h3 className="font-serif text-xl text-[#1B4332] italic mb-2">{title}</h3>
        <div className="text-sm text-[#5C574F] leading-relaxed space-y-2.5">{children}</div>
      </div>
    </div>
  </motion.div>
);

export function HowItWorks({ onBack, onStart, onSafety, onFaq }: HowItWorksProps) {
  return (
    <div className="w-full max-w-3xl mx-auto py-10 px-1">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#8B7355] hover:text-[#1B4332] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Hero */}
      <div className="text-center mb-12">
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#8B7355] mb-3">Your guide</p>
        <h1 className="font-serif text-4xl md:text-5xl text-[#1B4332] italic leading-tight mb-4">How Kulmi works</h1>
        <p className="text-[#5C574F] max-w-xl mx-auto leading-relaxed">
          From your first salaam to a serious introduction — here is the whole journey, step by step.
          No swiping, no games. Just a thoughtful, halal path built for marriage.
        </p>
      </div>

      <div className="space-y-5">
        <Step n="1" icon={<UserPlus className="w-5 h-5" />} title="Create your account">
          <p>
            Sign up with your email in under a minute, then complete your profile — your values, your faith,
            your hopes for family life. Be honest and thorough: on Kulmi, your <em>answers</em> are your first
            impression, not your photo.
          </p>
          <p className="text-[#8B7355] text-[13px]">
            Founding members who join now get Kulmi+ free until 30 September — no card needed.
          </p>
        </Step>

        <Step n="2" icon={<Camera className="w-5 h-5" />} title="Verify with a live selfie">
          <p>
            Before anyone can see you — or you can see anyone — you take a quick live selfie. A real person on
            our team compares it to your profile photo and approves you, usually within hours.
          </p>
          <p>
            This is why there are no catfish and no fake profiles on Kulmi: <strong className="text-[#1B4332]">every single member is a
            verified, real person.</strong>
          </p>
        </Step>

        <Step n="3" icon={<Compass className="w-5 h-5" />} title="Discover — one person at a time">
          <p>
            We show you one thoughtful suggestion at a time, chosen from verified members of the opposite gender.
            Each card shows how many of your core values align — prayer life, wanting children, timeline, and more.
          </p>
          <p>
            Use <strong className="text-[#1B4332]">"Show people near me"</strong> in the filters to find members in your area, and look out for
            your <strong className="text-[#1B4332]">Introduction of the Day</strong> — the person whose values align with yours most strongly.
          </p>
        </Step>

        <Step n="4" icon={<Mail className="w-5 h-5" />} title="Send an invitation">
          <p>
            If someone feels right, send them an invitation. They have <strong className="text-[#1B4332]">7 days</strong> to respond — and you can
            only have a few introductions open at once. That is deliberate: quality over quantity, seriousness over collecting matches.
          </p>
          <p>
            You will be notified the moment they answer, whichever way it goes. If it is not accepted, your slot
            frees up and your search continues — what is written for you will not miss you.
          </p>
        </Step>

        <Step n="5" icon={<MessageSquareHeart className="w-5 h-5" />} title="The compatibility session">
          <p>
            Here is what makes Kulmi different. When an invitation is accepted, you don't go straight to chatting —
            you both privately answer the same <strong className="text-[#1B4332]">8 serious questions</strong> about deen, family, finances,
            children, and your five-year picture.
          </p>
          <p>
            Your answers are revealed to each other <em>only when both of you have finished</em> — side by side, with a
            compatibility report showing where you align and what to discuss. Character before photos. Values before small talk.
          </p>
          <p className="text-[#8B7355] text-[13px]">
            Tip: you can customise and reorder your own questions in your Profile — the session uses the inviter's set.
          </p>
        </Step>

        <Step n="6" icon={<HeartHandshake className="w-5 h-5" />} title="Both say yes — it's a match">
          <p>
            After reading each other's answers, you each make a <em>private</em> decision. Nobody is embarrassed:
            only if <strong className="text-[#1B4332]">both</strong> of you say yes does your chat open. Extra photos and voice intros unlock
            only now — after you've connected on what matters.
          </p>
          <p>
            New matches have <strong className="text-[#1B4332]">48 hours to say salaam</strong> — if neither of you starts, the match quietly
            closes and frees you both. Kulmi never lets things go stale.
          </p>
        </Step>

        <Step n="7" icon={<Users className="w-5 h-5" />} title="Involve your Wali — any time">
          <p>
            From Settings, invite your wali or a trusted family member by email. They confirm from their own
            inbox and receive <strong className="text-[#1B4332]">read-only oversight</strong> of your conversations — they can see, never write,
            and they are never involved without your knowledge.
          </p>
          <p>
            This honours our deen and our dhaqan — and it instantly filters out anyone whose intentions are not
            serious. A person with pure intentions is <em>pleased</em> to be transparent.
          </p>
        </Step>

        <Step n="8" icon={<ShieldCheck className="w-5 h-5" />} title="Protected at every step">
          <p>Safety is not one feature — it is woven through everything:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {[
              { icon: <Lock className="w-3.5 h-3.5" />, t: 'Photos private until you match' },
              { icon: <Camera className="w-3.5 h-3.5" />, t: 'Screenshots blocked in the app' },
              { icon: <Flag className="w-3.5 h-3.5" />, t: 'Report & block from any chat' },
              { icon: <Clock className="w-3.5 h-3.5" />, t: 'Nothing lingers — everything expires or moves' },
            ].map((x) => (
              <span key={x.t} className="flex items-center gap-2 text-[13px] text-[#1B4332] bg-[#E8F3ED] border border-[#1B4332]/10 rounded-xl px-3 py-2">
                {x.icon} {x.t}
              </span>
            ))}
          </div>
          <p className="pt-1">
            Every report reaches a real person on our team. Read our{' '}
            <button onClick={onSafety} className="text-[#1B4332] font-medium underline underline-offset-2">Trust &amp; Safety</button> page
            for the full picture.
          </p>
        </Step>

        <Step n="9" icon={<Sparkles className="w-5 h-5" />} title="Kulmi+ — optional extras">
          <p>
            The core journey — discovering, matching, sessions, chatting — is free, always. Kulmi+ adds extras for
            the most intentional members: see who viewed your profile, 5 open introductions instead of 3, priority
            verification, and Wali oversight.
          </p>
          <p className="text-[#8B7355] text-[13px]">
            During our founding period, every member gets Kulmi+ free — our gift for trusting us early.
          </p>
        </Step>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-[#1B4332] to-[#143326] text-white rounded-3xl p-8 md:p-10 text-center mt-10">
        <h3 className="font-serif text-2xl md:text-3xl italic mb-2">Ready when you are, insha'Allah</h3>
        <p className="text-white/75 text-sm mb-6 max-w-md mx-auto">
          Isla Kulma, Isla Noolada — come together, live together. Your story could start with one thoughtful introduction.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={onStart} className="w-full sm:w-auto bg-white text-[#1B4332] px-8 py-3.5 rounded-xl font-medium hover:bg-[#F0EEE8] transition-colors">
            Create your account
          </button>
          <button onClick={onFaq} className="w-full sm:w-auto border border-white/30 text-white px-8 py-3.5 rounded-xl font-medium hover:bg-white/10 transition-colors">
            Read the FAQ
          </button>
        </div>
      </div>
    </div>
  );
}
