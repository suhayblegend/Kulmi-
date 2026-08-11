import React, { useEffect, useState } from 'react';
import { Shield, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getMyProfile } from '../lib/db';
import { AdminDashboard } from './AdminDashboard';
import { WaliDashboard } from './WaliDashboard';

/**
 * A self-contained staff area mounted only at /admin and /wali.
 * It has its OWN sign-in (separate from the member app) and only lets in
 * accounts with the matching role.
 */
export function StaffArea({ kind }: { kind: 'admin' | 'wali' }) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const label = kind === 'admin' ? 'Admin' : 'Wali';
  const allowed = (role?: string | null) => role === 'admin' || (kind === 'wali' && role === 'wali');

  const goHome = () => { window.location.href = '/'; };

  const [notice, setNotice] = useState('');
  const handleForgot = async () => {
    setError(''); setNotice('');
    if (!email) { setError('Enter your email above first, then tap "Forgot password?".'); return; }
    setSubmitting(true);
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (e) throw e;
      setNotice('Password reset link sent — check your email. After resetting, you\'ll return here.');
    } catch (err: any) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    (async () => {
      const p = await getMyProfile();
      setAuthorized(allowed(p?.role));
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
      const p = await getMyProfile();
      if (allowed(p?.role)) {
        setAuthorized(true);
      } else {
        await supabase.auth.signOut();
        setError(`This account doesn't have ${label} access.`);
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-[#8B7355]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (authorized) {
    return kind === 'admin' ? <AdminDashboard onExit={goHome} /> : <WaliDashboard onBack={goHome} />;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D2926] font-sans flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl p-8 border border-[#E5E0D8] shadow-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#1B4332] rounded-2xl flex items-center justify-center mx-auto mb-4 text-white">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-serif text-[#1B4332] italic">{label} Sign In</h2>
            <p className="text-[#8B7355] text-sm mt-2">Restricted area — {label.toLowerCase()} accounts only.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent"
                placeholder="admin@yourdomain.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Password</label>
                <button type="button" onClick={handleForgot} className="text-xs font-medium text-[#8B7355] hover:text-[#1B4332] hover:underline">Forgot password?</button>
              </div>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>

            {notice && (
              <div className="p-3 bg-[#E8F3ED] text-[#1B4332] text-sm rounded-xl border border-[#1B4332]/10">{notice}</div>
            )}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>
            )}

            <button
              type="submit" disabled={submitting}
              className="w-full bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign In <ChevronRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>

        <button onClick={goHome} className="w-full text-center text-sm font-medium text-[#8B7355] hover:text-[#1B4332] mt-6">
          ← Back to Kulmi
        </button>
      </div>
    </div>
  );
}
