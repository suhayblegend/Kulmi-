import React, { useState, useEffect, useRef } from 'react';
import { toast } from '../lib/toast';
import { motion, AnimatePresence } from 'motion/react';
import { User, Shield, BookOpen, Settings, Edit3, Save, X, Camera, CheckCircle2, Heart, Lock, Target, MessageSquare, Mic, Square, Trash2, Loader2 } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';
import { KulmiPlus } from './ui/KulmiPlus';
import { getMyProfile, updateMyProfile, uploadAvatar, addGalleryPhoto, removeGalleryPhoto, getMyGallery, uploadIntro, removeIntro, setIntroPublic as setIntroPublicApi, submitPhotoVerification, signOut, avatarFor, isPremium, resolveMediaUrl, getMyCompatQuestions, setMyCompatQuestions, COMPATIBILITY_QUESTIONS, type Profile as DbProfile, type GalleryPhoto } from '../lib/db';
import { LogOut } from 'lucide-react';
import { CameraCapture } from './CameraCapture';
import { MARITAL, HAS_KIDS, MARRIAGE_INTENT, TIMELINE, RELOCATE, WANT_KIDS, PRAYER, PRACTICE, TRAITS, GOALS, STYLES, SMOKING, KHAT, HIJAB, BEARD, POLYGYNY } from '../lib/options';

// Animated profile-strength ring shown on the hero banner.
function StrengthRing({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(value), 150); return () => clearTimeout(t); }, [value]);
  const r = 26, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, shown)) / 100);
  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-sm font-bold leading-none">{value}%</span>
      </div>
    </div>
  );
}

type ProfileForm = {
  firstName: string;
  gender: string;
  age: string;
  country: string;
  city: string;
  occupation: string;
  education: string;
  languages: string;
  maritalStatus: string;
  height: string;
  heritage: string;
  qabiil: string;
  hasChildren: string;
  marriageIntent: string;
  timeline: string;
  relocate: string;
  children: string;
  prayerLevel: string;
  islamicPractice: string;
  faithStatement: string;
  religiousDress: string;
  smoking: string;
  khat: string;
  openToPolygyny: string;
  aboutMe: string;
  personalityTraits: string[];
  futureGoals: string[];
  communicationStyle: string[];
  dealBreakers: string;
};

const EMPTY_FORM: ProfileForm = {
  firstName: '', gender: '', age: '', country: '', city: '', occupation: '', education: '', languages: '',
  maritalStatus: '', height: '', heritage: '', qabiil: '', hasChildren: '',
  marriageIntent: MARRIAGE_INTENT[0], timeline: TIMELINE[0], relocate: RELOCATE[0], children: WANT_KIDS[0],
  prayerLevel: PRAYER[0], islamicPractice: PRACTICE[0], faithStatement: '',
  religiousDress: '', smoking: '', khat: '', openToPolygyny: '',
  aboutMe: '', personalityTraits: [], futureGoals: [], communicationStyle: [], dealBreakers: '',
};

function fromDb(p: DbProfile): ProfileForm {
  return {
    firstName: p.first_name ?? '',
    gender: p.gender ?? '',
    age: p.age != null ? String(p.age) : '',
    country: p.country ?? '',
    city: p.city ?? '',
    occupation: p.occupation ?? '',
    education: p.education ?? '',
    languages: p.languages ?? '',
    maritalStatus: p.marital_status ?? '',
    height: p.height ?? '',
    heritage: p.heritage ?? '',
    qabiil: (p as any).qabiil ?? '',
    hasChildren: p.has_children ?? '',
    marriageIntent: p.marriage_intent ?? EMPTY_FORM.marriageIntent,
    timeline: p.timeline ?? EMPTY_FORM.timeline,
    relocate: p.relocate ?? EMPTY_FORM.relocate,
    children: p.children ?? EMPTY_FORM.children,
    prayerLevel: p.prayer_level ?? EMPTY_FORM.prayerLevel,
    islamicPractice: p.islamic_practice ?? EMPTY_FORM.islamicPractice,
    faithStatement: p.faith_statement ?? '',
    religiousDress: p.religious_dress ?? '',
    smoking: p.smoking ?? '',
    khat: p.khat ?? '',
    openToPolygyny: p.open_to_polygyny ?? '',
    aboutMe: p.bio ?? '',
    personalityTraits: p.personality_traits ?? [],
    futureGoals: p.future_goals ?? [],
    communicationStyle: p.communication_style ?? [],
    dealBreakers: p.deal_breakers ?? '',
  };
}

export function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationStep, setVerificationStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [photoVerified, setPhotoVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>('unverified');
  const [role, setRole] = useState<string>('user');
  const [plusMember, setPlusMember] = useState(false);

  const [profile, setProfile] = useState<ProfileForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<ProfileForm>(EMPTY_FORM);

  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleGalleryPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryBusy(true);
    try {
      await addGalleryPhoto(file);
      setGallery(await getMyGallery());
    } catch (err: any) {
      toast(err.message || 'Could not add photo.', 'error');
    } finally {
      setGalleryBusy(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleGalleryRemove = async (path: string) => {
    setGalleryBusy(true);
    try {
      await removeGalleryPhoto(path);
      setGallery(await getMyGallery());
    } finally {
      setGalleryBusy(false);
    }
  };

  // ---- Compatibility questions ----
  const [compatQs, setCompatQs] = useState<string[]>([]);
  const [newQ, setNewQ] = useState('');
  const [compatBusy, setCompatBusy] = useState(false);
  const [compatSaved, setCompatSaved] = useState(false);

  useEffect(() => { getMyCompatQuestions().then(setCompatQs).catch(() => {}); }, []);

  const moveQ = (i: number, dir: -1 | 1) => setCompatQs((qs) => {
    const j = i + dir; if (j < 0 || j >= qs.length) return qs;
    const n = [...qs]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const removeQ = (i: number) => setCompatQs((qs) => qs.filter((_, idx) => idx !== i));
  const addQ = () => { const q = newQ.trim(); if (q.length < 8) return; setCompatQs((qs) => [...qs, q].slice(0, 10)); setNewQ(''); };
  const resetQs = () => setCompatQs([...COMPATIBILITY_QUESTIONS]);
  const saveQs = async () => {
    setCompatBusy(true);
    try { await setMyCompatQuestions(compatQs); setCompatSaved(true); setTimeout(() => setCompatSaved(false), 2500); }
    catch (e: any) { toast(e.message || 'Could not save questions.', 'error'); }
    finally { setCompatBusy(false); }
  };

  // ---- Voice intro ----
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [introPublic, setIntroPublicState] = useState(false);
  const [introRecording, setIntroRecording] = useState(false);
  const [introBusy, setIntroBusy] = useState(false);
  const introRecRef = useRef<MediaRecorder | null>(null);
  const introChunksRef = useRef<Blob[]>([]);
  const introStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => { introStreamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const startIntro = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      introStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      introChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) introChunksRef.current.push(e.data); };
      mr.start();
      introRecRef.current = mr;
      setIntroRecording(true);
    } catch {
      toast('Microphone access is needed to record your intro.');
    }
  };

  const stopIntro = () => {
    const mr = introRecRef.current;
    if (!mr) { setIntroRecording(false); return; }
    mr.onstop = async () => {
      const blob = new Blob(introChunksRef.current, { type: 'audio/webm' });
      introStreamRef.current?.getTracks().forEach((t) => t.stop());
      setIntroRecording(false);
      if (blob.size > 0) {
        setIntroBusy(true);
        try { setIntroUrl(await uploadIntro(blob)); }
        catch (e: any) { toast(e.message || 'Could not save your intro.', 'error'); }
        finally { setIntroBusy(false); }
      }
    };
    mr.stop();
  };

  const deleteIntro = async () => {
    setIntroBusy(true);
    try { await removeIntro(); setIntroUrl(null); } finally { setIntroBusy(false); }
  };

  const changeIntroVisibility = async (v: boolean) => {
    setIntroPublicState(v);
    try { await setIntroPublicApi(v); } catch { setIntroPublicState(!v); }
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadAvatar(file);
      setPictureUrl(url);
    } catch (err: any) {
      toast(err.message || 'Could not upload photo.', 'error');
    }
  };

  const handleSelfieCapture = async (file: File) => {
    setIsUploading(true);
    try {
      await submitPhotoVerification(file);
      setVerificationStatus('pending');
      setVerificationStep(2);
    } catch (err: any) {
      toast(err.message || 'Could not submit verification.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    let active = true;
    getMyProfile()
      .then((p) => {
        if (!active || !p) return;
        const form = fromDb(p);
        setProfile(form);
        setEditForm(form);
        setPictureUrl(p.profile_picture_url);
        setPhotoVerified(!!p.photo_verified);
        setVerificationStatus((p.verification_status as any) ?? (p.photo_verified ? 'verified' : 'unverified'));
        setRole(p.role || 'user');
        setPlusMember(isPremium(p));
        getMyGallery().then((g) => { if (active) setGallery(g); }).catch(() => {});
        // Intros are stored as private paths — resolve to a playable URL.
        if (p.intro_audio_url) {
          resolveMediaUrl(p.intro_audio_url).then((u) => { if (active) setIntroUrl(u); }).catch(() => {});
        } else {
          setIntroUrl(null);
        }
        setIntroPublicState(!!p.intro_public);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const AVAILABLE_TRAITS = TRAITS;
  const AVAILABLE_GOALS = GOALS;
  const AVAILABLE_STYLES = STYLES;

  const toggleArrayItem = (key: 'personalityTraits' | 'futureGoals' | 'communicationStyle', item: string) => {
    setEditForm(prev => {
      const current = prev[key];
      if (current.includes(item)) {
        return { ...prev, [key]: current.filter(i => i !== item) };
      } else {
        return { ...prev, [key]: [...current, item] };
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        first_name: editForm.firstName,
        age: editForm.age ? parseInt(editForm.age, 10) : null,
        country: editForm.country,
        city: editForm.city,
        occupation: editForm.occupation,
        education: editForm.education,
        languages: editForm.languages,
        marital_status: editForm.maritalStatus,
        height: editForm.height,
        heritage: editForm.heritage,
        qabiil: editForm.qabiil || null,
        has_children: editForm.hasChildren,
        marriage_intent: editForm.marriageIntent,
        timeline: editForm.timeline,
        relocate: editForm.relocate,
        children: editForm.children,
        prayer_level: editForm.prayerLevel,
        islamic_practice: editForm.islamicPractice,
        faith_statement: editForm.faithStatement,
        religious_dress: editForm.religiousDress,
        smoking: editForm.smoking,
        khat: editForm.khat,
        open_to_polygyny: editForm.openToPolygyny,
        bio: editForm.aboutMe,
        personality_traits: editForm.personalityTraits,
        future_goals: editForm.futureGoals,
        communication_style: editForm.communicationStyle,
        deal_breakers: editForm.dealBreakers,
      });
      setProfile(editForm);
      setIsEditing(false);
    } catch (err: any) {
      toast(err.message || 'Could not save profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  // ---- Profile completeness (a strong profile earns better introductions) ----
  const completeness = (() => {
    const p = profile; // ProfileForm (camelCase fields)
    const has = (v: any) => (Array.isArray(v) ? v.length > 0 : !!(v ?? '').toString().trim());
    const checks: [boolean, string][] = [
      [has(pictureUrl), 'profile photo'],
      [(p.aboutMe ?? '').trim().length >= 20, 'a thoughtful bio'],
      [has(p.occupation), 'occupation'],
      [has(p.education), 'education'],
      [has(p.languages), 'languages'],
      [has(p.height), 'height'],
      [has(p.prayerLevel), 'prayer level'],
      [has(p.islamicPractice), 'islamic practice'],
      [has(p.faithStatement), 'faith statement'],
      [has(p.religiousDress), p.gender === 'male' ? 'beard answer' : 'hijab answer'],
      [has(p.smoking), 'smoking answer'],
      [has(p.marriageIntent), 'marriage intention'],
      [has(p.timeline), 'timeline'],
      [has(p.children), 'children plans'],
      [has(p.personalityTraits), 'personality traits'],
      [has(p.futureGoals), 'future goals'],
      [gallery.length >= 1, 'an extra photo'],
      [has(introUrl), 'a voice intro'],
    ];
    const done = checks.filter(([ok]) => ok).length;
    return {
      pct: Math.round((done / checks.length) * 100),
      missing: checks.filter(([ok]) => !ok).map(([, label]) => label).slice(0, 3),
    };
  })();

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

        {/* Hero — banner, overlapping avatar, identity & strength ring */}
        <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-sm overflow-hidden">
          {/* Banner */}
          <div className="relative h-28 md:h-32 bg-gradient-to-br from-[#1B4332] via-[#22523C] to-[#143326]">
            <p className="absolute top-4 left-5 font-serif italic text-sm text-white/40 select-none">Isla Kulma, Isla Noolada</p>
            {completeness.pct < 100 && (
              <div className="absolute top-3.5 right-4 flex items-center gap-2.5">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Profile strength</p>
                  <p className="text-[11px] text-white/50">Complete profiles get more interest</p>
                </div>
                <StrengthRing value={completeness.pct} />
              </div>
            )}
          </div>

          <div className="px-6 md:px-10 pb-6 md:pb-8">
            {/* Avatar overlapping the banner + edit toggle */}
            <div className="flex items-end justify-between -mt-14 md:-mt-16 mb-5">
              <div className="relative group shrink-0">
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-white bg-[#E5E0D8] shadow-lg">
                  <img src={avatarFor({ profile_picture_url: pictureUrl })} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-1 right-1 p-2.5 bg-[#1B4332] text-white rounded-full shadow-lg hover:bg-[#143326] transition-colors"
                  >
                    <Camera className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                className="mb-1 px-4 py-2.5 rounded-xl bg-[#1B4332] text-white hover:bg-[#143326] transition-colors flex items-center gap-2 shadow-sm"
              >
                {isEditing ? (
                  <>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="text-sm font-medium">{saving ? 'Saving…' : 'Save'}</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm font-medium">Edit</span>
                  </>
                )}
              </button>
            </div>

            {/* Next steps to 100% */}
            {completeness.pct < 100 && completeness.missing.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#8B7355] mr-1">Next:</span>
                {completeness.missing.map((m) => (
                  <span key={m} className="text-[11px] font-medium text-[#1B4332] bg-[#E8F3ED] border border-[#1B4332]/10 rounded-full px-2.5 py-1">+ {m}</span>
                ))}
              </div>
            )}

            <div className="w-full">
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">First Name</label>
                  <input type="text" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Age</label>
                  <input type="text" value={editForm.age} onChange={e => setEditForm({...editForm, age: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Country</label>
                  <input type="text" value={editForm.country} onChange={e => setEditForm({...editForm, country: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">City</label>
                  <input type="text" value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl md:text-4xl font-serif text-[#1B4332] mb-2 flex items-center gap-2.5 flex-wrap">{profile.firstName}, {profile.age}{plusMember && <KulmiPlus />}</h1>
                <p className="text-[#8B7355] text-lg">{profile.city}, {profile.country}</p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-6">
                  {verificationStatus === 'verified' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-[#E8F3ED] text-[#1B4332] rounded-full text-xs font-bold uppercase tracking-wider">
                      <Camera className="w-3.5 h-3.5" /> Photo Verified
                    </span>
                  ) : verificationStatus === 'pending' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold uppercase tracking-wider">
                      <Camera className="w-3.5 h-3.5" /> Verification Pending
                    </span>
                  ) : verificationStatus === 'rejected' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase tracking-wider">
                      <Camera className="w-3.5 h-3.5" /> Verification Rejected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-[#F0EEE8] text-[#8B7355] rounded-full text-xs font-bold uppercase tracking-wider">
                      <Camera className="w-3.5 h-3.5" /> Unverified
                    </span>
                  )}
                </div>
              </>
            )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex justify-end">
          <button onClick={() => signOut()} className="flex items-center gap-2 text-sm font-medium text-red-600 border border-red-200 bg-white px-4 py-2 rounded-xl hover:bg-red-50 transition-colors">
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>

        {/* More photos — revealed only to matches */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E5E0D8] shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-2 flex items-center gap-2">
            <Camera className="w-4 h-4" /> More Photos
          </h3>
          <p className="text-xs text-[#8B7355] mb-5">
            Your main photo is shown in Discover. These extra photos stay private and are revealed <span className="font-medium text-[#1B4332]">only to a match</span> — after you both pass the compatibility session.
          </p>
          <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleGalleryPick} />
          <div className="flex flex-wrap gap-3">
            {gallery.map((g) => (
              <div key={g.path} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-[#E5E0D8] group">
                <img src={g.url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => handleGalleryRemove(g.path)}
                  disabled={galleryBusy}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {gallery.length < 6 && (
              <button
                onClick={() => galleryInputRef.current?.click()}
                disabled={galleryBusy}
                className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#8B7355] text-[#8B7355] flex flex-col items-center justify-center hover:bg-[#FDFBF7] transition-colors disabled:opacity-50"
              >
                {galleryBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Camera className="w-5 h-5 mb-1" /><span className="text-[10px] font-medium">Add photo</span></>}
              </button>
            )}
          </div>
        </div>

        {/* Compatibility questions — the user's own set for sessions they start */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E5E0D8] shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Your Compatibility Questions
          </h3>
          <p className="text-xs text-[#8B7355] mb-5">
            These are the questions you and a match answer during a compatibility session. Reorder them by priority, remove any, or add your own.
            When <span className="font-medium text-[#1B4332]">you send</span> an introduction, your set is the one you'll both answer. Keep 3–10.
          </p>

          <div className="space-y-2">
            {compatQs.map((q, i) => (
              <div key={i} className="flex items-start gap-2 bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl p-3">
                <span className="text-xs font-bold text-[#8B7355] mt-1 w-5 shrink-0">{i + 1}.</span>
                <p className="flex-1 text-sm text-[#2D2926] leading-snug">{q}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => moveQ(i, -1)} disabled={i === 0} className="p-1 text-[#8B7355] hover:text-[#1B4332] disabled:opacity-30" title="Move up">▲</button>
                  <button onClick={() => moveQ(i, 1)} disabled={i === compatQs.length - 1} className="p-1 text-[#8B7355] hover:text-[#1B4332] disabled:opacity-30" title="Move down">▼</button>
                  <button onClick={() => removeQ(i)} disabled={compatQs.length <= 3} className="p-1 text-[#8B7355] hover:text-red-500 disabled:opacity-30" title="Remove"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>

          {compatQs.length < 10 && (
            <div className="flex gap-2 mt-4">
              <input
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQ(); } }}
                placeholder="Add your own question…"
                className="flex-1 bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2.5 text-sm text-[#2D2926] focus:outline-none focus:border-[#1B4332]"
              />
              <button onClick={addQ} disabled={newQ.trim().length < 8} className="px-4 py-2.5 rounded-xl bg-[#F0EEE8] text-[#1B4332] text-sm font-medium hover:bg-[#E5E0D8] transition-colors disabled:opacity-50">Add</button>
            </div>
          )}

          <div className="flex items-center gap-3 mt-5">
            <button onClick={saveQs} disabled={compatBusy || compatQs.length < 3} className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] transition-colors disabled:opacity-50 flex items-center gap-2">
              {compatBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : compatSaved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : 'Save questions'}
            </button>
            <button onClick={resetQs} disabled={compatBusy} className="text-sm font-medium text-[#8B7355] hover:text-[#1B4332] transition-colors">Reset to default</button>
          </div>
        </div>

        {/* Admin / Wali quick access */}
        {(role === 'admin' || role === 'wali') && (
          <div className="bg-white rounded-3xl p-6 border border-[#E5E0D8] shadow-sm flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Shield className="w-5 h-5 text-[#1B4332]" />
              <span className="text-sm font-medium text-[#2D2926]">Staff access</span>
            </div>
            {role === 'admin' && (
              <a href="/admin" className="w-full sm:w-auto text-center bg-[#1B4332] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#143326] transition-colors">
                Open Admin Dashboard
              </a>
            )}
            <a href="/wali" className="w-full sm:w-auto text-center border border-[#1B4332] text-[#1B4332] px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#F0EEE8] transition-colors">
              Open Wali Dashboard
            </a>
          </div>
        )}

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* About Me & Basic Info */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E5E0D8] shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-6 flex items-center gap-2">
                <User className="w-4 h-4" /> About Me
              </h3>
              
              {isEditing ? (
                <div className="space-y-4">
                  <textarea 
                    value={editForm.aboutMe} 
                    onChange={e => setEditForm({...editForm, aboutMe: e.target.value})} 
                    rows={4}
                    className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-3 text-[#2D2926] focus:outline-none focus:border-[#1B4332] resize-none" 
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#E5E0D8]">
                    <div>
                      <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Occupation</label>
                      <input type="text" value={editForm.occupation} onChange={e => setEditForm({...editForm, occupation: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Education</label>
                      <input type="text" value={editForm.education} onChange={e => setEditForm({...editForm, education: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Languages Spoken</label>
                      <input type="text" value={editForm.languages} onChange={e => setEditForm({...editForm, languages: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Height</label>
                      <input type="text" value={editForm.height} onChange={e => setEditForm({...editForm, height: e.target.value})} placeholder={`5'7" / 170cm`} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Heritage / Background</label>
                      <input type="text" value={editForm.heritage} onChange={e => setEditForm({...editForm, heritage: e.target.value})} placeholder="e.g. Somali — Mogadishu" className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Qabiil / Clan (optional)</label>
                      <input type="text" value={editForm.qabiil} onChange={e => setEditForm({...editForm, qabiil: e.target.value})} placeholder="Only if you wish to share" className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332]" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[#5C574F] leading-relaxed mb-8">{profile.aboutMe}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4">
                    <div>
                      <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mb-1">Occupation</p>
                      <p className="text-sm font-medium text-[#2D2926]">{profile.occupation}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mb-1">Education</p>
                      <p className="text-sm font-medium text-[#2D2926]">{profile.education}</p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mb-1">Languages</p>
                      <p className="text-sm font-medium text-[#2D2926]">{profile.languages}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Marriage Intent */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E5E0D8] shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-6 flex items-center gap-2">
                <Target className="w-4 h-4" /> Marriage Intent
              </h3>
              
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Marital Status</label>
                    <select value={editForm.maritalStatus} onChange={e => setEditForm({...editForm, maritalStatus: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option value="">Select</option>
                      {MARITAL.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Have Children?</label>
                    <select value={editForm.hasChildren} onChange={e => setEditForm({...editForm, hasChildren: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option value="">Select</option>
                      {HAS_KIDS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Looking For</label>
                    <select value={editForm.marriageIntent} onChange={e => setEditForm({...editForm, marriageIntent: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      {MARRIAGE_INTENT.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Timeline</label>
                    <select value={editForm.timeline} onChange={e => setEditForm({...editForm, timeline: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      {TIMELINE.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Relocate</label>
                    <select value={editForm.relocate} onChange={e => setEditForm({...editForm, relocate: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      {RELOCATE.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Children</label>
                    <select value={editForm.children} onChange={e => setEditForm({...editForm, children: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      {WANT_KIDS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <ul className="space-y-4">
                  <li className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                    <span className="text-[#5C574F]">Looking for</span>
                    <span className="font-medium text-[#1B4332]">{profile.marriageIntent}</span>
                  </li>
                  <li className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                    <span className="text-[#5C574F]">Timeline</span>
                    <span className="font-medium text-[#1B4332]">{profile.timeline}</span>
                  </li>
                  <li className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                    <span className="text-[#5C574F]">Relocation</span>
                    <span className="font-medium text-[#1B4332]">{profile.relocate}</span>
                  </li>
                  <li className="flex justify-between items-center text-sm pb-1">
                    <span className="text-[#5C574F]">Children</span>
                    <span className="font-medium text-[#1B4332]">{profile.children}</span>
                  </li>
                </ul>
              )}
            </div>

            {/* Personality & Goals */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E5E0D8] shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-6 flex items-center gap-2">
                <Heart className="w-4 h-4" /> Personality & Goals
              </h3>

              {isEditing ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-2">Personality Traits</label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_TRAITS.map(trait => (
                        <button
                          key={trait}
                          type="button"
                          onClick={() => toggleArrayItem('personalityTraits', trait)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            editForm.personalityTraits.includes(trait)
                              ? 'bg-[#1B4332] text-white border-[#1B4332]'
                              : 'bg-[#FDFBF7] text-[#2D2926] border-[#E5E0D8] hover:border-[#1B4332]'
                          }`}
                        >
                          {trait}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-2">Communication Style</label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_STYLES.map(style => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => toggleArrayItem('communicationStyle', style)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            editForm.communicationStyle.includes(style)
                              ? 'bg-[#1B4332] text-white border-[#1B4332]'
                              : 'bg-[#FDFBF7] text-[#2D2926] border-[#E5E0D8] hover:border-[#1B4332]'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-2">Top Future Goals (Select up to 3)</label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_GOALS.map(goal => (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => toggleArrayItem('futureGoals', goal)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            editForm.futureGoals.includes(goal)
                              ? 'bg-[#1B4332] text-white border-[#1B4332]'
                              : 'bg-[#FDFBF7] text-[#2D2926] border-[#E5E0D8] hover:border-[#1B4332]'
                          }`}
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mb-3">Traits & Communication</p>
                    <div className="flex flex-wrap gap-2">
                      {[...profile.personalityTraits, ...profile.communicationStyle].map(trait => trait && (
                        <span key={trait} className="px-3 py-1.5 bg-[#FDFBF7] border border-[#1B4332] text-[#1B4332] rounded-full text-xs font-medium">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mb-3">Top Goals</p>
                    <div className="space-y-2">
                      {profile.futureGoals.map((goal, idx) => goal && (
                        <div key={idx} className="flex items-center gap-3 bg-[#FDFBF7] border border-[#E5E0D8] p-3 rounded-xl">
                          <div className="w-6 h-6 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          <span className="text-sm font-medium text-[#2D2926]">{goal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right Column */}
          <div className="space-y-8">
            
            {/* Faith */}
            <div className="bg-white rounded-3xl p-6 border border-[#E5E0D8] shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-6 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Faith
              </h3>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Prayer Level</label>
                    <select value={editForm.prayerLevel} onChange={e => setEditForm({...editForm, prayerLevel: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      {PRAYER.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Practice</label>
                    <select value={editForm.islamicPractice} onChange={e => setEditForm({...editForm, islamicPractice: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      {PRACTICE.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">{editForm.gender === 'male' ? 'Beard' : 'Hijab'}</label>
                    <select value={editForm.religiousDress} onChange={e => setEditForm({...editForm, religiousDress: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option value="">Select</option>
                      {(editForm.gender === 'male' ? BEARD : HIJAB).map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Smoking</label>
                      <select value={editForm.smoking} onChange={e => setEditForm({...editForm, smoking: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                        <option value="">Select</option>
                        {SMOKING.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Khat / Qaad</label>
                      <select value={editForm.khat} onChange={e => setEditForm({...editForm, khat: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                        <option value="">Select</option>
                        {KHAT.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Open to polygyny?</label>
                    <select value={editForm.openToPolygyny} onChange={e => setEditForm({...editForm, openToPolygyny: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option value="">Prefer not to say</option>
                      {POLYGYNY.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Short Statement</label>
                    <textarea value={editForm.faithStatement} onChange={e => setEditForm({...editForm, faithStatement: e.target.value})} rows={3} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] resize-none" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                    <span className="text-[#5C574F]">Prayer</span>
                    <span className="font-medium text-[#1B4332]">{profile.prayerLevel}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                    <span className="text-[#5C574F]">Practice</span>
                    <span className="font-medium text-[#1B4332]">{profile.islamicPractice}</span>
                  </div>
                  {profile.religiousDress && (
                    <div className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                      <span className="text-[#5C574F]">{profile.gender === 'male' ? 'Beard' : 'Hijab'}</span>
                      <span className="font-medium text-[#1B4332]">{profile.religiousDress}</span>
                    </div>
                  )}
                  {profile.smoking && (
                    <div className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                      <span className="text-[#5C574F]">Smoking</span>
                      <span className="font-medium text-[#1B4332]">{profile.smoking}</span>
                    </div>
                  )}
                  {profile.khat && (
                    <div className="flex justify-between items-center text-sm border-b border-[#F0EEE8] pb-3">
                      <span className="text-[#5C574F]">Khat / Qaad</span>
                      <span className="font-medium text-[#1B4332]">{profile.khat}</span>
                    </div>
                  )}
                  {profile.openToPolygyny && (
                    <div className="flex justify-between items-center text-sm pb-1">
                      <span className="text-[#5C574F]">Polygyny</span>
                      <span className="font-medium text-[#1B4332]">{profile.openToPolygyny}</span>
                    </div>
                  )}
                  {profile.faithStatement && (
                    <div className="bg-[#F0EEE8] p-4 rounded-xl mt-4">
                      <p className="text-sm text-[#2D2926] italic">"{profile.faithStatement}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Private Deal Breakers */}
            {isEditing && (
              <div className="bg-[#FDFBF7] rounded-3xl p-6 border border-[#E5E0D8] shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#1B4332] mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Private Deal Breakers
                </h3>
                <p className="text-[10px] text-[#8B7355] mb-4">This information is hidden from others and used strictly by our matching algorithm.</p>
                <textarea 
                  value={editForm.dealBreakers} 
                  onChange={e => setEditForm({...editForm, dealBreakers: e.target.value})} 
                  placeholder="What are absolute deal breakers for you?"
                  rows={3} 
                  className="w-full bg-white border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] resize-none text-sm" 
                />
              </div>
            )}

            {/* Voice intro */}
            {!isEditing && (
              <div className="bg-white rounded-3xl p-6 border border-[#E5E0D8] shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-2 flex items-center gap-2">
                  <Mic className="w-4 h-4" /> Voice Intro
                </h3>
                <p className="text-xs text-[#8B7355] mb-4">A short voice note lets people hear your manner and sincerity.</p>

                {introUrl ? (
                  <>
                    <audio controls src={introUrl} className="w-full mb-4" />
                    <div className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">Who can hear it?</p>
                      <div className="flex gap-2">
                        <button onClick={() => changeIntroVisibility(true)} className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${introPublic ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white border-[#E5E0D8] text-[#2D2926] hover:bg-[#FDFBF7]'}`}>Everyone</button>
                        <button onClick={() => changeIntroVisibility(false)} className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${!introPublic ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white border-[#E5E0D8] text-[#2D2926] hover:bg-[#FDFBF7]'}`}>Only matches</button>
                      </div>
                      <p className="text-[10px] text-[#8B7355] mt-2">{introPublic ? 'Played to everyone who sees you in Discover.' : 'Played only after you both match.'}</p>
                    </div>
                    <button onClick={deleteIntro} disabled={introBusy} className="w-full flex items-center justify-center gap-2 text-xs font-medium text-red-600 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" /> Delete intro
                    </button>
                  </>
                ) : introRecording ? (
                  <button onClick={stopIntro} className="w-full flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-red-600 transition-colors">
                    <Square className="w-4 h-4 fill-current" /> Stop &amp; save
                  </button>
                ) : (
                  <button onClick={startIntro} disabled={introBusy} className="w-full flex items-center justify-center gap-2 text-sm font-medium text-[#1B4332] border border-[#1B4332] px-4 py-3 rounded-xl hover:bg-[#F0EEE8] transition-colors disabled:opacity-50">
                    {introBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mic className="w-4 h-4" /> Record voice intro</>}
                  </button>
                )}
              </div>
            )}
            
            {/* Verification */}
            {!isEditing && (
              <div className="bg-white rounded-3xl p-6 border border-[#E5E0D8] shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B7355] mb-6 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Verification
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3">
                    {verificationStatus === 'verified' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <div className={`w-5 h-5 rounded-full border-2 ${verificationStatus === 'pending' ? 'border-orange-400' : 'border-[#E5E0D8]'}`} />
                    )}
                    <span className="text-sm font-medium text-[#2D2926]">
                      {verificationStatus === 'verified' ? 'Photo Verified'
                        : verificationStatus === 'pending' ? 'Photo — under review'
                        : verificationStatus === 'rejected' ? 'Photo — rejected, try again'
                        : 'Photo not verified'}
                    </span>
                  </li>
                </ul>
                {verificationStatus !== 'verified' && (
                  <div className="mt-6 pt-6 border-t border-[#E5E0D8]">
                    <button
                      onClick={() => setShowVerificationModal(true)}
                      disabled={verificationStatus === 'pending'}
                      className="w-full py-2 rounded-xl border border-[#1B4332] text-[#1B4332] font-medium text-xs hover:bg-[#F0EEE8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verificationStatus === 'pending' ? 'Awaiting review…' : 'Verify my photo'}
                    </button>
                  </div>
                )}
              </div>
            )}
            
          </div>
        </div>
      </motion.div>

      {/* Verification Modal */}
      <AnimatePresence>
        {showVerificationModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-[#2D2926]/40 backdrop-blur-sm"
              onClick={() => !isUploading && setShowVerificationModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden relative z-10 shadow-2xl border border-[#E5E0D8]"
            >
              <div className="p-6 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FDFBF7]">
                <h3 className="font-serif text-xl text-[#1B4332]">Photo Verification</h3>
                <button 
                  onClick={() => !isUploading && setShowVerificationModal(false)}
                  className="p-2 text-[#8B7355] hover:text-[#2D2926] transition-colors rounded-full hover:bg-white"
                  disabled={isUploading}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8">
                {verificationStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#F0EEE8] flex items-center justify-center text-[#1B4332] mx-auto border border-[#E5E0D8]">
                      <Camera className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <h4 className="text-xl font-bold text-[#2D2926] mb-2">Take a Selfie</h4>
                      <p className="text-sm text-[#5C574F] leading-relaxed">
                        We need to verify that you are a real person and your profile pictures match you. Position your face in the oval.
                      </p>
                    </div>
                    
                    {isUploading ? (
                      <div className="py-8 flex justify-center text-[#8B7355]"><div className="w-8 h-8 border-3 border-[#E5E0D8] border-t-[#1B4332] rounded-full animate-spin" /></div>
                    ) : (
                      <CameraCapture onCapture={handleSelfieCapture} />
                    )}
                  </motion.div>
                )}

                {verificationStep === 2 && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center py-4">
                    <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center text-green-600 mx-auto">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-serif text-[#1B4332] mb-2 italic">Submitted for Review</h4>
                      <p className="text-sm text-[#5C574F] leading-relaxed">
                        Thanks! Your selfie has been sent to our team for review. Once approved, a verified badge will appear on your profile.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setShowVerificationModal(false);
                        setVerificationStep(1);
                      }}
                      className="w-full py-4 rounded-xl bg-[#1B4332] text-white font-medium shadow-sm hover:bg-[#143326] transition-colors"
                    >
                      Done
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
