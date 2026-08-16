import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Eye, LogOut, Users, X, Mail, Link as LinkIcon, CheckCircle2, Loader2, Lock, Key, LifeBuoy, FileText, ShieldCheck, ChevronRight, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getMyProfile, updateMyProfile, setWaliEmail, sendWaliInvite, signOut, deleteMyAccount, submitDeletionFeedback, isPremium, premiumDaysLeft, openBillingPortal, claimFounding, type Profile } from '../lib/db';
import { STRIPE_LINK_MONTHLY, STRIPE_LINK_QUARTERLY, PRICE_MONTHLY, PRICE_QUARTERLY, BILLING_READY, DONATE_URL, FOUNDING_ACTIVE, checkoutUrl } from '../lib/billing';

const DELETE_REASONS = [
  'I found my spouse (on Kulmi!)',
  'I found my spouse elsewhere',
  'Taking a break for now',
  'Not enough matches / people nearby',
  'Privacy concerns',
  'Had a bad experience',
  'Other',
];

const SUPPORT_EMAIL = 'support@kulmi.uk';
const APP_VERSION = '1.0';

type ToggleKey = 'show_in_discovery' | 'push_notifications' | 'email_summaries' | 'email_unsubscribed' | 'read_receipts';

interface SettingsProps {
  onTerms?: () => void;
  onPrivacy?: () => void;
  onContact?: () => void;
  onSafety?: () => void;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${on ? 'bg-[#1B4332]' : 'bg-[#E5E0D8]'}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-all ${on ? 'right-1' : 'left-1'}`} />
    </button>
  );
}

export function Settings({ onTerms, onPrivacy, onContact, onSafety }: SettingsProps) {
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
      setProfile((p) => (p ? { ...p, wali_email: waliEmail.trim(), wali_confirmed: false } : p));
      // Email the wali their confirmation link — access opens only when they click it.
      try { await sendWaliInvite(); } catch { /* member can resend from Settings */ }
      setInviteStep(2);
    } catch (e: any) {
      alert(e.message || 'Could not save.');
    } finally {
      setIsInviting(false);
    }
  };

  const [claiming, setClaiming] = useState(false);
  const claimFoundingOffer = async () => {
    setClaiming(true);
    try {
      await claimFounding();
      const fresh = await getMyProfile(true);
      setProfile(fresh);
      alert('MashaAllah — your Founding Membership is active until 30 September! 🌟');
    } catch (e: any) {
      alert(e?.message || 'Could not claim the offer.');
    } finally {
      setClaiming(false);
    }
  };

  const [portalBusy, setPortalBusy] = useState(false);
  const manageSubscription = async () => {
    setPortalBusy(true);
    try {
      const url = await openBillingPortal();
      window.location.href = url;
    } catch (e: any) {
      alert(e?.message || 'Could not open the billing portal.');
      setPortalBusy(false);
    }
  };

  const [resending, setResending] = useState(false);
  const resendWali = async () => {
    setResending(true);
    try {
      const sent = await sendWaliInvite();
      alert(sent ? 'Confirmation email sent to your wali.' : 'Could not send right now — please try again shortly.');
    } catch (e: any) {
      alert(e.message || 'Could not send.');
    } finally {
      setResending(false);
    }
  };

  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [delReason, setDelReason] = useState('');
  const [delDetail, setDelDetail] = useState('');
  const [delConfirm, setDelConfirm] = useState('');

  const doDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await submitDeletionFeedback(delReason, delDetail);
      await deleteMyAccount();
      await signOut();
    } catch (e: any) {
      setDeleting(false);
      alert(e?.message || 'Could not delete your account. Please try again or contact support.');
    }
  };

  if (loading || !profile) {
    return <div className="w-full max-w-3xl mx-auto py-24 flex justify-center text-[#8B7355]"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <h2 className="text-3xl font-serif text-[#1B4332] mb-6">Settings</h2>

        {/* Kulmi+ membership */}
        <div className="bg-gradient-to-br from-[#1B4332] to-[#143326] text-white rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">✨ Kulmi+</p>
              {isPremium(profile) ? (
                <>
                  <h3 className="font-serif text-xl mb-1">
                    {profile.founding_member ? "You're a Founding Member 🌟" : "You're a Kulmi+ member"}
                  </h3>
                  {profile.premium_until && (
                    <div className="inline-flex items-baseline gap-1.5 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 my-2">
                      <span className="font-serif text-2xl leading-none tabular-nums">{premiumDaysLeft(profile)}</span>
                      <span className="text-xs text-white/70">{premiumDaysLeft(profile) === 1 ? 'day left' : 'days left'}</span>
                    </div>
                  )}
                  <p className="text-sm text-white/75">
                    {profile.premium_until
                      ? `${profile.founding_member && profile.plan !== 'premium' ? 'Your founding gift is active' : 'Active'} until ${new Date(profile.premium_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                      : 'Active.'}
                    {' '}You have Wali oversight, who-viewed-you, 5 open introductions & priority verification.
                  </p>
                </>
              ) : FOUNDING_ACTIVE ? (
                <>
                  <h3 className="font-serif text-xl mb-1">🌟 Claim your Founding Membership</h3>
                  <p className="text-sm text-white/75">Get <b>Kulmi+ free until 30 September</b> — Wali oversight, who viewed you, 5 introductions & priority verification. No card needed.</p>
                </>
              ) : (
                <>
                  <h3 className="font-serif text-xl mb-1">Upgrade to Kulmi+</h3>
                  <p className="text-sm text-white/75">Invite your Wali · see who viewed you · 5 open introductions · priority verification.</p>
                </>
              )}
            </div>
          </div>

          {/* Claim the founding trial (non-premium members, during the window) */}
          {!isPremium(profile) && FOUNDING_ACTIVE && (
            <button onClick={claimFoundingOffer} disabled={claiming}
              className="w-full mt-5 bg-white text-[#1B4332] py-3 rounded-xl font-bold hover:bg-[#F0EEE8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : '🌟 Claim free membership until 30 Sept'}
            </button>
          )}
          {/* Pricing is hidden for founding members — their Kulmi+ is already free
              until 30 Sept, so no upsell. Only genuinely free members (after the
              founding window) see plans. */}
          {!isPremium(profile) && !FOUNDING_ACTIVE && (
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              {BILLING_READY ? (
                <>
                  <a href={checkoutUrl(STRIPE_LINK_MONTHLY, profile.id, profile.email)} target="_blank" rel="noreferrer"
                    className="flex-1 bg-white text-[#1B4332] text-center px-5 py-3 rounded-xl text-sm font-bold hover:bg-[#F0EEE8] transition-colors">
                    {PRICE_MONTHLY}
                  </a>
                  <a href={checkoutUrl(STRIPE_LINK_QUARTERLY, profile.id, profile.email)} target="_blank" rel="noreferrer"
                    className="flex-1 bg-white/15 border border-white/30 text-white text-center px-5 py-3 rounded-xl text-sm font-bold hover:bg-white/25 transition-colors">
                    {PRICE_QUARTERLY}
                  </a>
                </>
              ) : (
                <p className="text-xs text-white/60">
                  {isPremium(profile) ? 'Continue after your founding gift — plans open soon.' : 'Membership plans open soon, insha’Allah.'}
                </p>
              )}
            </div>
          )}
          {isPremium(profile) && profile.founding_member && profile.plan !== 'premium' && premiumDaysLeft(profile) <= 10 && (
            <p className="text-xs text-white/70 mt-3">Your founding gift ends soon. The core app — matching, sessions and chat — always stays free, insha'Allah.</p>
          )}
          {profile.plan === 'premium' && (
            <button onClick={manageSubscription} disabled={portalBusy} className="mt-4 text-sm font-medium text-white/90 underline underline-offset-2 hover:text-white disabled:opacity-50">
              {portalBusy ? 'Opening…' : 'Manage or cancel subscription'}
            </button>
          )}
        </div>

        <div className="bg-white rounded-3xl overflow-hidden border border-[#E5E0D8] shadow-sm">
          {/* Wali */}
          <div className="p-6 border-b border-[#E5E0D8]">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-[#1B4332]" />
              <h3 className="font-bold text-[#2D2926]">Family Mode (Wali)</h3>
            </div>
            <p className="text-xs text-[#8B7355] mb-4 leading-relaxed">
              Add a trusted family member or Wali by email. They can view your sessions and conversations (read-only) to support you.
              <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#1B4332] bg-[#E8F3ED] rounded-full px-2 py-0.5">✨ Kulmi+</span>
            </p>
            {!isPremium(profile) ? (
              <div className="bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-4 text-center">
                <p className="text-sm text-[#5C574F] mb-3">Wali oversight is a Kulmi+ feature — {FOUNDING_ACTIVE ? 'claim your free founding membership above to enable it.' : 'upgrade to invite your wali.'}</p>
                <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm font-bold text-[#1B4332] hover:underline">
                  {FOUNDING_ACTIVE ? '🌟 See the founding offer above' : 'See Kulmi+ above'}
                </button>
              </div>
            ) : profile.wali_email ? (
              <div className="bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-[#2D2926]">
                    {profile.wali_confirmed
                      ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                    {profile.wali_email}
                  </div>
                  <button onClick={() => { setInviteStep(1); setShowWaliModal(true); }} className="text-xs font-medium text-[#1B4332] hover:underline">Change</button>
                </div>
                {profile.wali_confirmed ? (
                  <p className="text-xs text-green-700">Confirmed — your wali can view your introductions.</p>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-amber-700">Awaiting their confirmation — they have no access until they accept the emailed link.</p>
                    <button onClick={resendWali} disabled={resending} className="text-xs font-medium text-[#1B4332] underline disabled:opacity-50 shrink-0">
                      {resending ? 'Sending…' : 'Resend email'}
                    </button>
                  </div>
                )}
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
            <div className="flex items-start gap-2 mt-3 mb-4 text-xs text-[#5C574F] bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span>In-app alerts are on. The bell at the top shows you new introductions, matches and messages in real time.</span>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div><p className="font-medium text-sm text-[#2D2926]">Product &amp; tips emails</p><p className="text-xs text-[#8B7355]">News, tips and announcements from Kulmi. Account emails (like password resets) always send.</p></div>
                <Toggle on={profile.email_unsubscribed !== true} onChange={(v) => setToggle('email_unsubscribed', !v)} />
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div className="p-6 border-b border-[#E5E0D8]">
            <div className="flex items-center gap-3 mb-2"><Eye className="w-5 h-5 text-[#1B4332]" /><h3 className="font-bold text-[#2D2926]">Privacy & Discovery</h3></div>
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between gap-4">
                <div><p className="font-medium text-sm text-[#2D2926]">Pause my profile</p><p className="text-xs text-[#8B7355]">Hide yourself from Discover — great while you're focused on a conversation. Your existing chats and sessions are unaffected, and you can un-pause any time.</p></div>
                <Toggle on={profile.show_in_discovery === false} onChange={(v) => setToggle('show_in_discovery', !v)} />
              </div>
              <div className="flex items-center justify-between gap-4">
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
              {DONATE_URL && (
                <a href={DONATE_URL} target="_blank" rel="noreferrer" className="w-full flex items-center justify-between text-sm font-medium text-[#2D2926] hover:text-[#1B4332] py-2">
                  <span className="flex items-center gap-2">☕ Support Kulmi <span className="text-xs font-normal text-[#8B7355]">— optional, never required</span></span>
                  <ChevronRight className="w-4 h-4 text-[#8B7355]" />
                </a>
              )}
              {onSafety && (
                <button onClick={onSafety} className="w-full flex items-center justify-between text-sm font-medium text-[#2D2926] hover:text-[#1B4332] py-2">
                  <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#8B7355]" /> Trust &amp; Safety</span>
                  <ChevronRight className="w-4 h-4 text-[#8B7355]" />
                </button>
              )}
              {onContact && (
                <button onClick={onContact} className="w-full flex items-center justify-between text-sm font-medium text-[#2D2926] hover:text-[#1B4332] py-2">
                  <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#8B7355]" /> Contact Us</span>
                  <ChevronRight className="w-4 h-4 text-[#8B7355]" />
                </button>
              )}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="w-full flex items-center justify-between text-sm font-medium text-[#2D2926] hover:text-[#1B4332] py-2">
                <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#8B7355]" /> Email Support</span>
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
              <button onClick={() => { setDelReason(''); setDelDetail(''); setDelConfirm(''); setShowDelete(true); }} className="w-full text-left text-sm font-medium text-red-600 hover:text-red-700 py-2 flex items-center gap-2">Delete Account</button>
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

      {/* Delete account — strong warning + reason */}
      <AnimatePresence>
        {showDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#2D2926]/50 backdrop-blur-sm" onClick={() => !deleting && setShowDelete(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white w-full max-w-md rounded-3xl overflow-hidden relative z-10 shadow-2xl border border-red-200 max-h-[90vh] overflow-y-auto">
              <div className="p-6 bg-red-50 border-b border-red-100 text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto mb-3"><AlertTriangle className="w-7 h-7" /></div>
                <h3 className="font-serif text-xl text-red-700">Delete your account?</h3>
              </div>
              <div className="p-6 space-y-5">
                <div className="text-sm text-[#5C574F] bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl p-4 space-y-1">
                  <p className="font-bold text-[#2D2926]">This is permanent and cannot be undone.</p>
                  <p>It removes your profile, photos, voice notes, matches and all conversations. Your matches will no longer be able to reach you.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Why are you leaving? <span className="text-[#8B7355] normal-case font-normal">(helps us improve)</span></label>
                  <select value={delReason} onChange={(e) => setDelReason(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-red-300 text-sm">
                    <option value="">Select a reason…</option>
                    {DELETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <textarea rows={2} value={delDetail} onChange={(e) => setDelDetail(e.target.value)} placeholder="Anything else you'd like us to know? (optional)" className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-red-300 text-sm resize-none" />

                <div>
                  <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Type <span className="text-red-600">DELETE</span> to confirm</label>
                  <input value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE" className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-red-300 text-sm tracking-widest" />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowDelete(false)} disabled={deleting} className="flex-1 py-3 rounded-xl border border-[#E5E0D8] text-[#2D2926] font-medium hover:bg-[#FDFBF7] transition-colors disabled:opacity-50">Keep my account</button>
                  <button onClick={doDelete} disabled={deleting || delConfirm.trim().toUpperCase() !== 'DELETE' || !delReason} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                    {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete forever'}
                  </button>
                </div>
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
                      <p className="text-sm text-[#5C574F] leading-relaxed mb-6">Enter your Wali's email. We'll send them a confirmation link — they can view your matches and conversations only after they personally accept.</p>
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
                      <p className="text-sm text-[#5C574F] leading-relaxed">We've emailed <span className="font-medium text-[#2D2926]">{waliEmail}</span> a confirmation link. They'll be able to oversee your matches as soon as they accept it.</p>
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
