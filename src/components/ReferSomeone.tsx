import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, X, Loader2, CheckCircle2, Heart } from 'lucide-react';
import { referFriend } from '../lib/db';

// A member privately nominates a serious person they know. Kulmi sends a warm,
// one-time invite — the referrer stays anonymous unless they choose otherwise.
export function ReferSomeone() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [revealName, setRevealName] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName(''); setEmail(''); setNote(''); setRevealName(false);
    setSending(false); setDone(false); setError('');
  };

  const close = () => { setOpen(false); setTimeout(reset, 200); };

  const submit = async () => {
    const em = email.trim();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(em)) {
      setError('Please enter their name and a valid email.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await referFriend(name, em, revealName, note);
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Could not send the invitation. Please try again.');
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 bg-white border border-[#E5E0D8] rounded-2xl px-4 py-3.5 text-left hover:border-[#1B4332] transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-[#1B4332]/10 flex items-center justify-center shrink-0 group-hover:bg-[#1B4332]/15">
          <UserPlus className="w-4.5 h-4.5 text-[#1B4332]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1B4332] leading-tight">Know someone ready for marriage?</p>
          <p className="text-[11px] text-[#8B7355] mt-0.5">Privately invite a serious brother or sister you trust.</p>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={close}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-[#E5E0D8] rounded-3xl shadow-xl max-w-md w-full p-7 relative max-h-[90vh] overflow-y-auto"
            >
              <button onClick={close} className="absolute top-5 right-5 text-[#8B7355] hover:text-[#1B4332] transition-colors">
                <X className="w-5 h-5" />
              </button>

              {done ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-serif text-[#1B4332] mb-2">Invitation sent, insha'Allah</h3>
                  <p className="text-sm text-[#5C574F] leading-relaxed mb-6">
                    We've sent {name.trim().split(/\s+/)[0] || 'them'} a warm, private invitation to Kulmi.
                    May Allah reward you for helping a brother or sister on their path.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={reset} className="flex-1 px-4 py-3 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium text-sm hover:bg-[#FDFBF7] transition-colors">
                      Invite another
                    </button>
                    <button onClick={close} className="flex-1 px-4 py-3 rounded-xl bg-[#1B4332] text-white font-medium text-sm hover:bg-[#143326] transition-colors">
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-2xl flex items-center justify-center mb-4">
                    <Heart className="w-6 h-6 text-[#1B4332]" />
                  </div>
                  <h3 className="text-xl font-serif text-[#1B4332] mb-1.5">Refer someone serious</h3>
                  <p className="text-sm text-[#5C574F] leading-relaxed mb-6">
                    Know a brother or sister genuinely ready for marriage? Invite them privately.
                    They'll get a thoughtful, one-time email — never spam.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#8B7355] uppercase tracking-wider mb-2">Their name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Yusuf"
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#8B7355] uppercase tracking-wider mb-2">Their email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#8B7355] uppercase tracking-wider mb-2">Personal note (optional)</label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        maxLength={280}
                        placeholder="A short, kind word to include in the invite…"
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332] resize-none"
                      />
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={revealName}
                        onChange={(e) => setRevealName(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-[#E5E0D8]"
                      />
                      <span className="text-sm text-[#5C574F]">
                        Let them know it's from me. <span className="text-[#8B7355]">(Otherwise the invite stays anonymous — "someone who knows you".)</span>
                      </span>
                    </label>
                  </div>

                  {error && <p className="text-xs text-red-600 mt-4">{error}</p>}

                  <button
                    onClick={submit}
                    disabled={sending}
                    className="w-full mt-6 px-4 py-3.5 rounded-xl bg-[#1B4332] text-white font-medium text-sm hover:bg-[#143326] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    {sending ? 'Sending…' : 'Send invitation'}
                  </button>
                  <p className="text-[11px] text-[#8B7355] text-center mt-3">
                    Only invite people you believe are genuinely seeking marriage.
                  </p>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
