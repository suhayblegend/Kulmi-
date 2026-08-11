import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ChevronRight, Check, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthProps {
  onSuccess: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
}

export function Auth({ onSuccess, onTerms, onPrivacy }: AuthProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
        if (!termsAccepted || !privacyAccepted) {
          setError('You must agree to the Terms of Service and Privacy Policy.');
          setIsLoading(false);
          return;
        }
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          // Email confirmation is disabled → the user is signed in now.
          onSuccess();
        } else {
          // Confirmation required → tell them to verify, then sign in.
          setError('Success! Please check your email to verify your account, then sign in.');
          setMode('signin');
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
            disabled={isLoading || (mode === 'signup' && (!termsAccepted || !privacyAccepted))}
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
