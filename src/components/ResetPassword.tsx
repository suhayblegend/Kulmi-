import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

/** Shown when a user returns via a password-reset email link (PASSWORD_RECOVERY). */
export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Could not update your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-white rounded-3xl p-8 border border-[#E5E0D8] shadow-sm">
        {done ? (
          <div className="text-center space-y-6 py-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-600 mx-auto"><CheckCircle2 className="w-9 h-9" /></div>
            <h2 className="text-2xl font-serif text-[#1B4332] italic">Password updated</h2>
            <p className="text-sm text-[#5C574F]">You're all set. You can continue to Kulmi.</p>
            <button onClick={onDone} className="w-full bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium transition-colors">Continue</button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-[#F0EEE8] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#1B4332]"><Shield className="w-6 h-6" /></div>
              <h2 className="text-2xl font-serif text-[#1B4332] italic">Set a new password</h2>
              <p className="text-[#8B7355] text-sm mt-2">Choose a new password for your account.</p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">New Password</label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332]" placeholder="At least 6 characters" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B7355] hover:text-[#1B4332]">
                    {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Confirm Password</label>
                <input type={show ? 'text' : 'password'} required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332]" placeholder="Re-enter password" />
              </div>
              {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
