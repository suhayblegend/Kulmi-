import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Eye, LogOut, Users, X, Mail, Link as LinkIcon, CheckCircle2, Loader2, Lock, Key, LifeBuoy, FileText, ShieldCheck, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getMyProfile, updateMyProfile, setWaliEmail, signOut, deleteMyAccount, type Profile } from '../lib/db';

const SUPPORT_EMAIL = 'support@kulmi.app'; // TODO: replace with your real support inbox
const APP_VERSION = '1.0';

type ToggleKey = 'show_in_discovery' | 'push_notifications' | 'email_summaries' | 'read_receipts';

interface SettingsProps {
  onTerms?: () => void;
  onPrivacy?: () => void;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full relative transition-colors ${on ? 'bg-[#1B4332]' : 'bg-[#E5E0D8]'}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-all ${on ? 'right-1' : 'left-1'}`} />
    </button>
  );
}

export function Settings({ onTerms, onPrivacy }: SettingsProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [showWaliModal, setShowWaliModal] = useState(false);
  const [inviteStep, setInviteStep] = useState(1);
  const [isInviting, setIsInviting] = useState(false);
  const [waliEmail, setWaliEmailInput] = useState('');

  // Change-password modal
  const [showPwd, setShowPwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdDone, setPwdDone] = useState(false);

  const handleChangePassword = async () => {
    setPwdError('');
    if (newPwd.length < 6) { setPwdError('Password must be at least 6 characters.'); return; }
    if (newPwd !== confirmPwd) { setPwdError('Passwords do not match.'); return; }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setPwdDone(true);
      setNewPwd('');
      setConfirmPwd('');
    } catch (e: any) {
      setPwdError(e.message || 'Could not update password.');
    } finally {
      setSavingPwd(false);
    }
  };

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        setProfile(p);
        setWaliEmailInput(p?.wali_email ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  const setToggle = async (key: ToggleKey, value: boolean) => {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    try {
      await updateMyProfile({ [key]: value } as Partial<Profile>);
    } catch {
      setProfile((p) => (p ? { ...p, [key]: !value } : p)); // revert
    }
  };

  const handleInvite = async () => {
    if (!waliEmail.includes('@')) return;
    setIsInviting(true);
    try {
      await setWaliEmail(waliEmail.trim());
      setProfile((p) => (p ? { ...p, wali_email: waliEmail.trim() } : p));
      setInviteStep(2);
    } catch (e: any) {
      alert(e.message || 'Could not save.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete your account and profile? This cannot be undone.')) return;
    await deleteMyAccount();
  };

  if (loading || !profile) {
    return <div className="w-full max-w-3xl mx-auto py-24 flex justify-center text-[#8B7355]"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <h2 className="text-3xl font-serif text-[#1B4332] mb-6">Settings</h2>

        <div className="bg-white rounded-3xl overflow-hidden border border-[#E5E0D8] shadow-sm">
          {/* Wali */}
          <div className="p-6 border-b border-[#E5E0D8]">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-[#1B4332]" />
              <h3 className="font-bold text-[#2D2926]">Family Mode (Wali)</h3>
            </div>
            <p className="text-xs text-[#8B7355] mb-4 leading-relaxed">
              Add a trusted family member or Wali by email. They can view your sessions and conversations (read-only) to support you.
            </p>
            {profile.wali_email ? (
              <div className="flex items-center justify-between bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-[#2D2926]"><CheckCircle2 className="w-4 h-4 text-green-600" /> {profile.wali_email}</div>
                <button onClick={() => { setInviteStep(1); setShowWaliModal(true); }} className="text-xs font-medium text-[#1B4332] hover:underline">Change</button>
              </div>
            ) : (
              <button onClick={() => { setInviteStep(1); setShowWaliModal(true); }} className="text-sm font-medium text-[#1B4332] border border-[#1B4332] px-4 py-2 rounded-xl hover:bg-[#F0EEE8] transition-colors">
                Add Family Member
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="p-6 border-b border-[#E5E0D8]">
            <div className="flex items-center gap-3 mb-2"><Bell className="w-5 h-5 text-[#1B4332]" /><h3 className="font-bold text-[#2D2926]">Notifications</h3></div>
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm text-[#2D2926]">Push Notifications</p><p className="text-xs text-[#8B7355]">Get alerted for new matches and messages</p></div>
                <Toggle on={profile.push_notifications !== false} onChange={(v) => setToggle('push_notifications', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm text-[#2D2926]">Email Summaries</p><p className="text-xs text-[#8B7355]">Weekly updates on your activity</p></div>
                <Toggle on={profile.email_summaries === true} onChange={(v) => setToggle('email_summaries', v)} />
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div className="p-6 border-b border-[#E5E0D8]">
            <div className="flex items-center gap-3 mb-2"><Eye className="w-5 h-5 text-[#1B4332]" /><h3 className="font-bold text-[#2D2926]">Privacy & Discovery</h3></div>
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm text-[#2D2926]">Show in Discovery</p><p className="text-xs text-[#8B7355]">Allow your profile to be matched with others</p></div>
                <Toggle on={profile.show_in_discovery !== false} onChange={(v) => setToggle('show_in_discovery', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm text-[#2D2926]">Read Receipts</p><p className="text-xs text-[#8B7355]">Let matches know when you've read their messages</p></div>
                <Toggle on={profile.read_receipts !== false} onChange={(v) => setToggle('read_receipts', v)} />
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="p-6 border-b border-[#E5E0D8]">
            <div className="flex items-center gap-3 mb-2"><Lock className="w-5 h-5 text-[#1B4332]" /><h3 className="font-bold text-[#2D2926]">Security</h3></div>
            {profile.email && (
              <p className="text-xs text-[#8B7355] mt-1 mb-3">Signed in as <span className="font-medium text-[#2D2926]">{profile.email}</span></p>
            )}
            <button onClick={() => { setPwdDone(false); setPwdError(''); setShowPwd(true); }} className="w-full flex items-center justify-between text-sm font-medium text-[#2D2926] hover:text-[#1B4332] py-2">
              <span className="flex items-center gap-2"><Key className="w-4 h-4 text-[#8B7355]" /> Change Password</span>
              <ChevronRight className="w-4 h-4 text-[#8B7355]" />
            </button>
            {profile.verification_status === 'verified' && (
              <div className="flex items-center gap-2 text-sm text-[#1B4332] mt-2"><ShieldCheck className="w-4 h-4 text-green-600" /> Identity verified</div>
            )}
          </div>

          {/* Support & About */}
          <div className="p-6 border-b border-[#E5E0D8]">
            <div className="flex items-center gap-3 mb-2"><LifeBuoy className="w-5 h-5 text-[#1B4332]" /><h3 className="font-bold text-[#2D2926]">Support &amp; About</h3></div>
            <div className="space-y-3 mt-3">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="w-full flex items-center justify-between text-sm font-medium text-[#2D2926] hover:text-[#1B4332] py-2">
                <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#8B7355]" /> Contact Support</span>
                <ChevronRight className="w-4 h-4 text-[#8B7355]" />
              </a>
              {onPrivacy && (
                <button onClick={onPrivacy} className="w-full flex items-center justify-between text-sm font-medium text-[#2D2926] hover:text-[#1B4332] py-2">
                  <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-[#8B7355]" /> Privacy Policy</span>
                  <ChevronRight className="w-4 h-4 text-[#8B7355]" />
                </button>
              )}
              {onTerms && (
                <button onClick={onTerms} className="w-full flex items-center justify-between text-sm font-medium text-[#2D2926] hover:text-[#1B4332] py-2">
                  <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-[#8B7355]" /> Terms of Service</span>
                  <ChevronRight className="w-4 h-4 text-[#8B7355]" />
                </button>
              )}
              <p className="text-xs text-[#8B7355] pt-2">Kulmi v{APP_VERSION}</p>
            </div>
          </div>

          {/* Account */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-2 text-red-600"><LogOut className="w-5 h-5" /><h3 className="font-bold">Account</h3></div>
            <div className="space-y-3 mt-4">
              <button onClick={() => signOut()} className="w-full text-left text-sm font-medium text-[#2D2926] hover:text-[#1B4332] py-2">Log Out</button>
              <button onClick={handleDelete} className="w-full text-left text-sm font-medium text-red-600 hover:text-red-700 py-2">Delete Account</button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Change password modal */}
      <AnimatePresence>
        {showPwd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#2D2926]/40 backdrop-blur-sm" onClick={() => !savingPwd && setShowPwd(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white w-full max-w-md rounded-3xl overflow-hidden relative z-10 shadow-2xl border border-[#E5E0D8]">
              <div className="p-6 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FDFBF7]">
                <h3 className="font-serif text-xl text-[#1B4332]">Change Password</h3>
                <button onClick={() => !savingPwd && setShowPwd(false)} className="p-2 text-[#8B7355] hover:text-[#2D2926] rounded-full hover:bg-white" disabled={savingPwd}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-8">
                {pwdDone ? (
                  <div className="text-center space-y-5 py-2">
                    <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-600 mx-auto"><CheckCircle2 className="w-9 h-9" /></div>
                    <p className="text-[#5C574F]">Your password has been updated.</p>
                    <button onClick={() => setShowPwd(false)} className="w-full py-4 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors">Done</button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">New Password</label>
                      <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="At least 6 characters" className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Confirm Password</label>
                      <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Re-enter password" className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
                    </div>
                    {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
                    <button onClick={handleChangePassword} disabled={savingPwd} className="w-full py-4 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                      {savingPwd ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWaliModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#2D2926]/40 backdrop-blur-sm" onClick={() => !isInviting && setShowWaliModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white w-full max-w-md rounded-3xl overflow-hidden relative z-10 shadow-2xl border border-[#E5E0D8]">
              <div className="p-6 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FDFBF7]">
                <h3 className="font-serif text-xl text-[#1B4332]">Add Family Member</h3>
                <button onClick={() => !isInviting && setShowWaliModal(false)} className="p-2 text-[#8B7355] hover:text-[#2D2926] rounded-full hover:bg-white" disabled={isInviting}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-8">
                {inviteStep === 1 ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-[#F0EEE8] flex items-center justify-center text-[#1B4332] mx-auto border border-[#E5E0D8] mb-4"><Users className="w-8 h-8" /></div>
                      <p className="text-sm text-[#5C574F] leading-relaxed mb-6">Enter your Wali's email. When they sign up (or sign in) with this email and a Wali account, they'll be able to view your matches and conversations.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-2">Email Address</label>
                      <div className="relative">
                        <input type="email" value={waliEmail} onChange={(e) => setWaliEmailInput(e.target.value)} placeholder="family@example.com" className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl pl-11 pr-4 py-3 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                        <Mail className="w-5 h-5 text-[#8B7355] absolute left-4 top-3.5" />
                      </div>
                    </div>
                    <button onClick={handleInvite} disabled={isInviting || !waliEmail.includes('@')} className="w-full py-4 rounded-xl bg-[#1B4332] text-white font-medium shadow-sm hover:bg-[#143326] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {isInviting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LinkIcon className="w-5 h-5" /> Save Wali</>}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 text-center py-4">
                    <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center text-green-600 mx-auto"><CheckCircle2 className="w-10 h-10" /></div>
                    <div>
                      <h4 className="text-2xl font-serif text-[#1B4332] mb-2 italic">Wali Added</h4>
                      <p className="text-sm text-[#5C574F] leading-relaxed"><span className="font-medium text-[#2D2926]">{waliEmail}</span> can now oversee your matches once they sign in with a Wali account.</p>
                    </div>
                    <button onClick={() => { setShowWaliModal(false); setInviteStep(1); }} className="w-full py-4 rounded-xl bg-[#1B4332] text-white font-medium shadow-sm hover:bg-[#143326] transition-colors">Done</button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
