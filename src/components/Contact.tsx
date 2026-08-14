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
      </motion.div>
    </div>
  );
}
