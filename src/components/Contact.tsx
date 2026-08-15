import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Mail, ArrowLeft, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { submitContactMessage, getMyProfile } from '../lib/db';

export function Contact({ onBack }: { onBack?: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Prefill from the signed-in profile if there is one.
  useEffect(() => {
    getMyProfile().then((p) => {
      if (p?.first_name) setName((n) => n || [p.first_name, p.last_name].filter(Boolean).join(' '));
      if (p?.email) setEmail((e) => e || p.email || '');
    }).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (message.trim().length < 5) { setError('Please write a little more.'); return; }
    setSending(true);
    try {
      await submitContactMessage(name, email, message);
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8 relative">
      {onBack && (
        <button onClick={onBack} className="absolute left-0 top-10 flex items-center gap-2 text-[#8B7355] hover:text-[#1B4332] transition-colors">
          <ArrowLeft className="w-4 h-4" /><span className="text-sm font-medium">Back</span>
        </button>
      )}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#FDFBF7] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#E5E0D8]">
            <Mail className="w-8 h-8 text-[#1B4332]" />
          </div>
          <h1 className="text-4xl font-serif text-[#1B4332] mb-3">Contact Us</h1>
          <p className="text-[#8B7355]">Questions, feedback, or need help? Send us a message and we'll get back to you.</p>
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-10 border border-[#E5E0D8] shadow-sm">
          {sent ? (
            <div className="text-center space-y-5 py-6">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-600 mx-auto"><CheckCircle2 className="w-9 h-9" /></div>
              <h2 className="text-2xl font-serif text-[#1B4332] italic">Message sent</h2>
              <p className="text-[#5C574F] max-w-sm mx-auto">Jazakallah khayr — we've received your message and will reply to your email soon, insha'Allah.</p>
              {onBack && <button onClick={onBack} className="mt-2 bg-[#1B4332] text-white px-8 py-3 rounded-xl font-medium hover:bg-[#143326] transition-colors">Done</button>}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Your name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332]" placeholder="Name (optional)" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Your email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332]" placeholder="so we can reply" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Message</label>
                <textarea required rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] resize-none" placeholder="How can we help?" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={sending} className="w-full py-4 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Send message</>}
              </button>
            </form>
          )}
        </div>

        {/* FAQ — answers most questions before a message is needed */}
        <div>
          <div className="text-center mb-8 mt-4">
            <h2 className="text-2xl md:text-3xl font-serif text-[#1B4332] mb-2 italic">Questions, answered</h2>
            <p className="text-sm text-[#8B7355]">Everything families ask us before joining — your answer may already be here.</p>
          </div>
          <div className="space-y-3">
            {[
              ['Is Kulmi free?', 'Yes — joining, matching, compatibility sessions and chatting are free. We will always keep the core journey to marriage accessible.'],
              ['How does verification work?', 'Every member submits a live selfie which a human reviewer compares against their profile photo and stated gender. AI images, stock photos, hidden faces and duplicate photos are rejected. Nobody appears in Discover until they pass.'],
              ['What is the wali feature — is it required?', "It's optional but encouraged. You can appoint a guardian (father, brother, uncle, imam) who can view your introductions read-only. They receive an email and get access only after they personally confirm — honouring both deen and dhaqan."],
              ['Who can see my photos?', 'Only your main photo is visible in Discover, and only to verified members of the opposite gender. Your other photos and voice recordings stay locked until you both match.'],
              ['How do introductions actually work?', "No swiping. We show you one suitable person at a time. If you invite them and they accept, you both answer the same 8 serious questions about deen, family and life goals — then decide. Only a mutual yes opens a chat. You can hold at most 3 open introductions, so everyone is intentional."],
              ['What happens if someone behaves badly?', 'Report them from their profile or the chat — a human reviews every report. We warn by email, and remove and permanently ban repeat or serious offenders. Ending contact with someone is always silent: they simply never see you again.'],
              ['Can I use Kulmi outside the UK?', 'Yes — Kulmi is for the Somali community worldwide. Use the country and city filters to search where you intend to build your life.'],
              ['Can I delete my account completely?', 'Yes, in one step from Settings. Your profile, photos, voice recordings, matches and login are permanently removed — we do not keep your data.'],
            ].map(([q, a]) => (
              <details key={q as string} className="group bg-white border border-[#E5E0D8] rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 font-medium text-[#1B4332] text-sm md:text-base">
                  {q}
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#F0EEE8] text-[#1B4332] flex items-center justify-center text-sm transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 text-sm text-[#5C574F] leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
