import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Shield, BookOpen, Settings, Edit3, Save, X, Camera, CheckCircle2, Heart, Lock, Target, MessageSquare, Mic, Square, Trash2, Loader2 } from 'lucide-react';
import { getMyProfile, updateMyProfile, uploadAvatar, addGalleryPhoto, removeGalleryPhoto, uploadIntro, removeIntro, setIntroPublic as setIntroPublicApi, submitPhotoVerification, signOut, avatarFor, type Profile as DbProfile } from '../lib/db';
import { LogOut } from 'lucide-react';
import { CameraCapture } from './CameraCapture';

type ProfileForm = {
  firstName: string;
  age: string;
  country: string;
  city: string;
  occupation: string;
  education: string;
  languages: string;
  maritalStatus: string;
  height: string;
  heritage: string;
  hasChildren: string;
  marriageIntent: string;
  timeline: string;
  relocate: string;
  children: string;
  prayerLevel: string;
  islamicPractice: string;
  faithStatement: string;
  aboutMe: string;
  personalityTraits: string[];
  futureGoals: string[];
  communicationStyle: string[];
  dealBreakers: string;
};

const EMPTY_FORM: ProfileForm = {
  firstName: '', age: '', country: '', city: '', occupation: '', education: '', languages: '',
  maritalStatus: '', height: '', heritage: '', hasChildren: '',
  marriageIntent: 'Marriage Only', timeline: 'Within 1-2 years', relocate: 'Willing to relocate', children: 'Wants children',
  prayerLevel: '5 Daily Prayers', islamicPractice: 'Practicing', faithStatement: '',
  aboutMe: '', personalityTraits: [], futureGoals: [], communicationStyle: [], dealBreakers: '',
};

function fromDb(p: DbProfile): ProfileForm {
  return {
    firstName: p.first_name ?? '',
    age: p.age != null ? String(p.age) : '',
    country: p.country ?? '',
    city: p.city ?? '',
    occupation: p.occupation ?? '',
    education: p.education ?? '',
    languages: p.languages ?? '',
    maritalStatus: p.marital_status ?? '',
    height: p.height ?? '',
    heritage: p.heritage ?? '',
    hasChildren: p.has_children ?? '',
    marriageIntent: p.marriage_intent ?? EMPTY_FORM.marriageIntent,
    timeline: p.timeline ?? EMPTY_FORM.timeline,
    relocate: p.relocate ?? EMPTY_FORM.relocate,
    children: p.children ?? EMPTY_FORM.children,
    prayerLevel: p.prayer_level ?? EMPTY_FORM.prayerLevel,
    islamicPractice: p.islamic_practice ?? EMPTY_FORM.islamicPractice,
    faithStatement: p.faith_statement ?? '',
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

  const [profile, setProfile] = useState<ProfileForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<ProfileForm>(EMPTY_FORM);

  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleGalleryPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryBusy(true);
    try {
      setGallery(await addGalleryPhoto(file));
    } catch (err: any) {
      alert(err.message || 'Could not add photo.');
    } finally {
      setGalleryBusy(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleGalleryRemove = async (url: string) => {
    setGalleryBusy(true);
    try {
      setGallery(await removeGalleryPhoto(url));
    } finally {
      setGalleryBusy(false);
    }
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
      alert('Microphone access is needed to record your intro.');
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
        catch (e: any) { alert(e.message || 'Could not save your intro.'); }
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
      alert(err.message || 'Could not upload photo.');
    }
  };

  const handleSelfieCapture = async (file: File) => {
    setIsUploading(true);
    try {
      await submitPhotoVerification(file);
      setVerificationStatus('pending');
      setVerificationStep(2);
    } catch (err: any) {
      alert(err.message || 'Could not submit verification.');
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
        setGallery(p.gallery ?? []);
        setIntroUrl(p.intro_audio_url ?? null);
        setIntroPublicState(!!p.intro_public);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const AVAILABLE_TRAITS = ['Calm', 'Funny', 'Patient', 'Ambitious', 'Introvert', 'Extrovert', 'Family-Oriented', 'Adventurous', 'Organized'];
  const AVAILABLE_GOALS = ['Strong Islamic Home', 'Children', 'Career', 'Business', 'Education', 'Travel', 'Financial Stability'];
  const AVAILABLE_STYLES = ['Calm', 'Direct', 'Gentle', 'Honest', 'Listener', 'Problem Solver'];

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
        has_children: editForm.hasChildren,
        marriage_intent: editForm.marriageIntent,
        timeline: editForm.timeline,
        relocate: editForm.relocate,
        children: editForm.children,
        prayer_level: editForm.prayerLevel,
        islamic_practice: editForm.islamicPractice,
        faith_statement: editForm.faithStatement,
        bio: editForm.aboutMe,
        personality_traits: editForm.personalityTraits,
        future_goals: editForm.futureGoals,
        communication_style: editForm.communicationStyle,
        deal_breakers: editForm.dealBreakers,
      });
      setProfile(editForm);
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-24 flex justify-center text-[#8B7355]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        
        {/* Header section with photo and edit toggle */}
        <div className="bg-white rounded-3xl p-6 md:p-10 border border-[#E5E0D8] shadow-sm relative flex flex-col md:flex-row items-center md:items-start gap-8">
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className="absolute top-6 right-6 p-2 rounded-xl bg-[#F0EEE8] text-[#1B4332] hover:bg-[#E5E0D8] transition-colors flex items-center gap-2"
          >
            {isEditing ? (
              <>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="text-sm font-medium pr-1">{saving ? 'Saving…' : 'Save Profile'}</span>
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                <span className="text-sm font-medium pr-1">Edit Profile</span>
              </>
            )}
          </button>

          <div className="relative group shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-[#F0EEE8] bg-[#E5E0D8]">
              <img src={avatarFor({ profile_picture_url: pictureUrl })} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
            {isEditing && (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-2 right-2 p-3 bg-[#1B4332] text-white rounded-full shadow-lg hover:bg-[#143326] transition-colors"
              >
                <Camera className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 text-center md:text-left w-full mt-4 md:mt-0">
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
                <h1 className="text-3xl md:text-4xl font-serif text-[#1B4332] mb-2">{profile.firstName}, {profile.age}</h1>
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
            {gallery.map((url) => (
              <div key={url} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-[#E5E0D8] group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => handleGalleryRemove(url)}
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
                      <option>Never married</option>
                      <option>Divorced</option>
                      <option>Widowed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Have Children?</label>
                    <select value={editForm.hasChildren} onChange={e => setEditForm({...editForm, hasChildren: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option value="">Select</option>
                      <option>No</option>
                      <option>Yes — living with me</option>
                      <option>Yes — not living with me</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Looking For</label>
                    <select value={editForm.marriageIntent} onChange={e => setEditForm({...editForm, marriageIntent: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option>Marriage Only</option>
                      <option>Marriage in 1-2 years</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Timeline</label>
                    <select value={editForm.timeline} onChange={e => setEditForm({...editForm, timeline: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option>Within 1-2 years</option>
                      <option>ASAP</option>
                      <option>2-3 years</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Relocate</label>
                    <select value={editForm.relocate} onChange={e => setEditForm({...editForm, relocate: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option>Willing to relocate</option>
                      <option>Not willing</option>
                      <option>Open to discussion</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Children</label>
                    <select value={editForm.children} onChange={e => setEditForm({...editForm, children: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option>Wants children</option>
                      <option>Doesn't want children</option>
                      <option>Not sure</option>
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
                      <option>5 Daily Prayers</option>
                      <option>Usually prays</option>
                      <option>Working on it</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B7355] uppercase tracking-wider mb-1">Practice</label>
                    <select value={editForm.islamicPractice} onChange={e => setEditForm({...editForm, islamicPractice: e.target.value})} className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-2 text-[#2D2926] focus:outline-none focus:border-[#1B4332] appearance-none">
                      <option>Practicing</option>
                      <option>Moderately practicing</option>
                      <option>Liberal</option>
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
                  <div className="flex justify-between items-center text-sm pb-1">
                    <span className="text-[#5C574F]">Practice</span>
                    <span className="font-medium text-[#1B4332]">{profile.islamicPractice}</span>
                  </div>
                  <div className="bg-[#F0EEE8] p-4 rounded-xl mt-4">
                    <p className="text-sm text-[#2D2926] italic">"{profile.faithStatement}"</p>
                  </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
