import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Loader2, Camera, Clock, RefreshCw, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getMyProfile, submitPhotoVerification, signOut } from '../lib/db';
import { CameraCapture } from './CameraCapture';

type Status = 'loading' | 'unverified' | 'pending' | 'rejected';

/**
 * Mandatory identity check. New members must submit a selfie and be approved by
 * an admin before they can see any profiles. Shown instead of the app until
 * `verification_status === 'verified'`.
 */
export function VerificationGate({ onVerified }: { onVerified: () => void }) {
  const [status, setStatus] = useState<Status>('loading');
  const [note, setNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [noCamera, setNoCamera] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [copied, setCopied] = useState(false);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(siteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const load = async (fromButton = false) => {
    if (fromButton) setChecking(true);
    try {
      const p = await getMyProfile(true); // always fresh — verification status changes server-side
      if (p?.verification_status === 'verified' || p?.photo_verified) {
        onVerified();
        return;
      }
      setStatus((p?.verification_status as Status) ?? 'unverified');
      setNote(p?.verification_note ?? null);
    } catch {
      // don't get stuck on the loading spinner if the profile fetch fails
      setStatus('unverified');
    } finally {
      if (fromButton) setChecking(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = async (file: File) => {
    setCapturing(false);
    setSubmitting(true);
    setError('');
    try {
      await submitPhotoVerification(file);
      setStatus('pending');
    } catch (err: any) {
      setError(err.message || 'Could not submit your selfie. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-white rounded-3xl p-8 border border-[#E5E0D8] shadow-sm text-center">
        {children}
      </motion.div>
      <button onClick={() => signOut()} className="mt-6 text-xs font-bold text-[#8B7355] hover:text-[#1B4332] uppercase tracking-widest">
        Sign Out
      </button>
    </div>
  );

  if (status === 'loading') {
    return <Shell><div className="py-10 flex justify-center text-[#8B7355]"><Loader2 className="w-8 h-8 animate-spin" /></div></Shell>;
  }

  if (status === 'pending' && !capturing) {
    return (
      <Shell>
        <div className="w-16 h-16 rounded-2xl bg-[#F0EEE8] flex items-center justify-center text-[#1B4332] mx-auto mb-6 border border-[#E5E0D8]">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif text-[#1B4332] italic mb-3">Your profile is under review</h2>
        <p className="text-sm text-[#5C574F] leading-relaxed mb-8">
          Our team is checking your photo and selfie to keep Kulmi safe and genuine — real people, serious about marriage.
          You'll be able to see introductions as soon as you're approved, in shaa Allah.
        </p>
        <button
          onClick={() => load(true)}
          disabled={checking}
          className="w-full bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RefreshCw className="w-4 h-4" /> Check my status</>}
        </button>
        <button
          onClick={() => setCapturing(true)}
          className="w-full mt-3 text-sm font-medium text-[#8B7355] hover:text-[#1B4332] transition-colors"
        >
          Re-take my selfie
        </button>
      </Shell>
    );
  }

  // unverified or rejected
  return (
    <Shell>
      <div className="w-16 h-16 rounded-2xl bg-[#1B4332] flex items-center justify-center text-white mx-auto mb-6">
        <ShieldCheck className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-serif text-[#1B4332] italic mb-3">One last step — verify it's really you</h2>
      <p className="text-sm text-[#5C574F] leading-relaxed mb-4">
        To keep Kulmi a trusted, halal community, everyone takes a live selfie before seeing profiles — no uploads, so we
        know it's really you. Our team then confirms it matches your profile photo. Your selfie is only used for verification.
      </p>

      {status === 'rejected' && !capturing && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-left">
          <p className="font-medium">Your verification couldn't be approved.</p>
          {note ? (
            <p className="mt-1"><span className="font-medium">Reason:</span> {note}</p>
          ) : (
            <p className="mt-1">Please try again with a clear, well-lit photo of your face.</p>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {submitting ? (
        <div className="py-8 flex flex-col items-center gap-3 text-[#8B7355]">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Submitting…</span>
        </div>
      ) : capturing ? (
        <CameraCapture onCapture={handleCapture} onNoCamera={() => { setCapturing(false); setNoCamera(true); }} />
      ) : noCamera || showPhone ? (
        <div className="rounded-2xl border border-[#E5E0D8] bg-[#FDFBF7] p-6 text-left">
          <div className="flex items-center gap-2 mb-3 text-[#1B4332]">
            <Smartphone className="w-5 h-5" />
            <h3 className="font-bold text-sm">{noCamera ? 'No camera here — use your phone' : 'Verify on your phone'}</h3>
          </div>
          <ol className="text-sm text-[#5C574F] space-y-1.5 mb-4 list-decimal list-inside">
            <li>Scan this QR code with your phone's camera (or open the link below).</li>
            <li>Sign in with the same email &amp; password.</li>
            <li>Take your selfie — your account is then verified everywhere.</li>
          </ol>
          {siteUrl && (
            <div className="flex justify-center mb-4">
              <div className="bg-white p-3 rounded-2xl border border-[#E5E0D8]">
                <QRCodeSVG value={siteUrl} size={160} bgColor="#ffffff" fgColor="#1B4332" level="M" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm font-medium text-[#1B4332] break-all">{siteUrl}</div>
            <button onClick={copyUrl} className="px-3 py-3 rounded-xl border border-[#E5E0D8] text-[#1B4332] hover:bg-[#F0EEE8] transition-colors text-sm font-medium shrink-0">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={() => { setNoCamera(false); setShowPhone(false); setCapturing(true); }} className="mt-4 text-sm font-medium text-[#8B7355] hover:text-[#1B4332]">
            ← Use the camera on this device instead
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => setCapturing(true)}
            className="w-full bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" /> Open camera &amp; take selfie
          </button>
          <button onClick={() => setShowPhone(true)} className="w-full text-sm font-medium text-[#8B7355] hover:text-[#1B4332] flex items-center justify-center gap-1.5">
            <Smartphone className="w-4 h-4" /> Rather use your phone? Verify there instead
          </button>
        </div>
      )}
    </Shell>
  );
}
