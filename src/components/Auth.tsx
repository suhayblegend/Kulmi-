import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ChevronRight, Check, Eye, EyeOff, MailCheck, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthProps {
  onSuccess: () => void;
  onSignedUp?: (firstName: string) => void; // fresh account created + auto-signed-in
  onTerms: () => void;
  onPrivacy: () => void;
  initialMode?: 'signin' | 'signup';
  onModeChange?: (m: 'signin' | 'signup') => void;
}

export function Auth({ onSuccess, onSignedUp, onTerms, onPrivacy, initialMode = 'signin', onModeChange }: AuthProps) {
  const [mode, setModeState] = useState<'signin' | 'signup'>(initialMode);
  const setMode = (m: 'signin' | 'signup') => { setModeState(m); onModeChange?.(m); };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [seriousPledge, setSeriousPledge] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [awaitingConfirm, setAwaitingConfirm] = useState<string | null>(null); // email we just signed up
  const [justCreated, setJustCreated] = useState(false); // auto-confirmed → show a welcome step
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!awaitingConfirm) return;
    setError('');
    setResent(false);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: awaitingConfirm,
        options: { emailRedirectTo: window.location.origin + '/auth' },
      });
      if (error) throw error;
      setResent(true);
    } catch (err: any) {
      setError(err.message || 'Could not resend the email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setNotice('');
    if (!email) { setError('Enter your email above first, then tap "Forgot password?".'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
      setNotice('Password reset link sent — check your email.');
    } catch (err: any) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!firstName.trim() || !lastName.trim()) {
          setError('Please enter your first and last name.');
          setIsLoading(false);
          return;
        }
        if (!termsAccepted || !privacyAccepted) {
          setError('You must agree to the Terms of Service and Privacy Policy.');
          setIsLoading(false);
          return;
        }
        if (!seriousPledge) {
          setError('Please confirm you are here for marriage with sincere intention.');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName.trim(), last_name: lastName.trim() },
            emailRedirectTo: window.location.origin + '/auth',
          },
        });

        if (error) throw error;

        if (data.session) {
          // Email confirmation is disabled in Supabase → the user is signed in
          // now. Hand off to App, which shows the welcome step on top of routing
          // (this component unmounts as soon as SIGNED_IN fires).
          if (onSignedUp) onSignedUp(firstName.trim());
          else { setJustCreated(true); onSuccess(); }
        } else {
          // Confirmation required → show a clear, dedicated "check your inbox" screen.
          setAwaitingConfirm(email);
        }
        setIsLoading(false);
        return;
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  if (justCreated) {
    return (
      <div className="w-full max-w-md mx-auto py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-8 border border-[#E5E0D8] shadow-sm text-center">
          <div className="w-16 h-16 bg-[#E8F3ED] rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#1B4332]">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif text-[#1B4332] italic mb-2">Account created 🎉</h2>
          <p className="text-[#5C574F] text-sm leading-relaxed">
            Assalamu alaikum{firstName ? ' ' + firstName : ''}, and welcome to <span className="font-medium text-[#1B4332]">Kulmi</span>. Here's what happens next:
          </p>

          <div className="mt-5 space-y-3 text-left">
            {[
              { n: '1', t: 'Complete your profile', d: 'Tell us about yourself so we can find thoughtful introductions.' },
              { n: '2', t: 'Verify with a quick selfie', d: 'This keeps Kulmi real — only verified members can be seen or send invitations.' },
              { n: '3', t: 'Start discovering', d: 'Meet one serious introduction at a time, insha’Allah.' },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-3 bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl p-3">
                <div className="w-6 h-6 rounded-full bg-[#1B4332] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</div>
                <div>
                  <p className="text-sm font-medium text-[#1B4332] leading-tight">{s.t}</p>
                  <p className="text-[12px] text-[#8B7355] mt-0.5 leading-snug">{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onSuccess}
            className="w-full mt-6 bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>Set up my profile</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  if (awaitingConfirm) {
    return (
      <div className="w-full max-w-md mx-auto py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-8 border border-[#E5E0D8] shadow-sm text-center">
          <div className="w-16 h-16 bg-[#E8F3ED] rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#1B4332]">
            <MailCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif text-[#1B4332] italic mb-2">Check your inbox</h2>
          <p className="text-[#5C574F] text-sm leading-relaxed">
            We've sent a confirmation link to
          </p>
          <p className="font-medium text-[#1B4332] my-2 break-all">{awaitingConfirm}</p>
          <p className="text-[#5C574F] text-sm leading-relaxed">
            Tap the link in that email to verify your account, then come back and sign in, insha'Allah.
          </p>

          <div className="mt-5 bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl p-3 text-left">
            <p className="text-[12px] text-[#8B7355] leading-relaxed">
              Can't find it? Check your <span className="font-medium text-[#5C574F]">spam / junk</span> folder — the email is from <span className="font-medium text-[#5C574F]">noreply@kulmi.uk</span>. It can take a minute to arrive.
            </p>
          </div>

          {resent && (
            <div className="mt-4 p-3 bg-[#E8F3ED] text-[#1B4332] text-sm rounded-xl border border-[#1B4332]/10">
              Confirmation email sent again — check your inbox.
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={isLoading}
            className="w-full mt-6 bg-white border border-[#E5E0D8] hover:border-[#1B4332] text-[#1B4332] py-3.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {isLoading ? 'Sending…' : 'Resend confirmation email'}
          </button>
          <button
            onClick={() => { setAwaitingConfirm(null); setResent(false); setError(''); setPassword(''); setConfirmPassword(''); setMode('signin'); }}
            className="w-full mt-3 bg-[#1B4332] hover:bg-[#143326] text-white py-3.5 rounded-xl font-medium transition-colors"
          >
            Back to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-8 border border-[#E5E0D8] shadow-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#F0EEE8] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#1B4332]">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-serif text-[#1B4332] italic">
            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-[#8B7355] text-sm mt-2">
            {mode === 'signin' ? 'Sign in to continue your journey.' : 'Join our mindful marriage community.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">First Name</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent text-[#2D2926]" placeholder="First" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Last Name</label>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent text-[#2D2926]" placeholder="Last" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent transition-all text-[#2D2926]"
              placeholder="Enter your email"
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Password</label>
              {mode === 'signin' && (
                <button type="button" onClick={handleForgot} className="text-xs font-medium text-[#8B7355] hover:text-[#1B4332] hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent transition-all text-[#2D2926]"
                placeholder="Enter your password"
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B7355] hover:text-[#1B4332]">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Repeat Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent transition-all text-[#2D2926]"
                placeholder="Re-enter your password"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-red-600 mt-1">Passwords don't match.</p>
              )}
            </div>
          )}

          <AnimatePresence>
            {mode === 'signup' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2 overflow-hidden"
              >
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${termsAccepted ? 'bg-[#1B4332] border-[#1B4332]' : 'border-[#E5E0D8] bg-white group-hover:border-[#1B4332]'}`}>
                    {termsAccepted && <Check className="w-3.5 h-3.5 text-white" />}
                    <input type="checkbox" className="hidden" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                  </div>
                  <span className="text-sm text-[#5C574F] leading-snug">
                    I have read and agree to the <button type="button" onClick={onTerms} className="text-[#1B4332] font-medium hover:underline">Terms of Service</button>.
                  </span>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${privacyAccepted ? 'bg-[#1B4332] border-[#1B4332]' : 'border-[#E5E0D8] bg-white group-hover:border-[#1B4332]'}`}>
                    {privacyAccepted && <Check className="w-3.5 h-3.5 text-white" />}
                    <input type="checkbox" className="hidden" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
                  </div>
                  <span className="text-sm text-[#5C574F] leading-snug">
                    I have read and agree to the <button type="button" onClick={onPrivacy} className="text-[#1B4332] font-medium hover:underline">Privacy Policy</button>.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group bg-[#FDFBF7] border border-[#1B4332]/20 rounded-xl p-3">
                  <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${seriousPledge ? 'bg-[#1B4332] border-[#1B4332]' : 'border-[#E5E0D8] bg-white group-hover:border-[#1B4332]'}`}>
                    {seriousPledge && <Check className="w-3.5 h-3.5 text-white" />}
                    <input type="checkbox" className="hidden" checked={seriousPledge} onChange={(e) => setSeriousPledge(e.target.checked)} />
                  </div>
                  <span className="text-sm text-[#2D2926] leading-snug">
                    <span className="font-bold text-[#1B4332]">Wallahi</span>, I am here for <span className="font-medium">marriage</span> with sincere and serious intention.
                  </span>
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          {notice && (
            <div className="p-3 bg-[#E8F3ED] text-[#1B4332] text-sm rounded-xl border border-[#1B4332]/10">
              {notice}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading || (mode === 'signup' && (!termsAccepted || !privacyAccepted || !seriousPledge || !firstName.trim() || !lastName.trim()))}
            className="w-full bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            <span>{isLoading ? 'Loading...' : (mode === 'signin' ? 'Sign In' : 'Create Account')}</span>
            {!isLoading && <ChevronRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-[#E5E0D8] pt-6">
          <p className="text-sm text-[#8B7355]">
            {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError('');
                setNotice('');
              }}
              className="ml-2 font-medium text-[#1B4332] hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
