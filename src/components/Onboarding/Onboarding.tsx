import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Upload, Loader2, Check } from 'lucide-react';

const GENDERS = ['male', 'female'];
const MARITAL = ['Never married', 'Divorced', 'Widowed'];
const PRAYER = ['5 Daily Prayers', 'Usually prays', 'Sometimes prays', 'Working on it'];
const PRACTICE = ['Very practicing', 'Practicing', 'Moderately practicing', 'Still learning'];
const LOOKING = ['Marriage as soon as possible', 'Marriage within 1–2 years', 'Getting to know for marriage'];
const TIMELINE = ['As soon as possible', 'Within 1 year', '1–2 years', '2–3 years', 'Not sure yet'];
const RELOCATE = ['Willing to relocate', 'Not willing to relocate', 'Open to discussion'];
const WANT_KIDS = ['Want children', "Don't want children", 'Open / not sure'];
const HAS_KIDS = ['No', 'Yes — living with me', 'Yes — not living with me'];
const TRAITS = ['Calm', 'Funny', 'Patient', 'Ambitious', 'Introvert', 'Extrovert', 'Family-Oriented', 'Adventurous', 'Organized', 'Kind', 'Generous'];
const STYLES = ['Calm', 'Direct', 'Gentle', 'Honest', 'Listener', 'Problem Solver', 'Affectionate'];
const GOALS = ['Strong Islamic Home', 'Children', 'Career', 'Business', 'Education', 'Travel', 'Financial Stability', 'Memorise Quran'];

const INPUT_CLS = 'w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent';

// NOTE: these helpers are defined at MODULE scope (not inside the component) so
// they keep a stable identity across renders — otherwise inputs lose focus on
// every keystroke.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ChipsField({ value, options, max, onToggle }: { value: string[]; options: string[]; max?: number; onToggle: (item: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        const disabled = !on && max ? value.length >= max : false;
        return (
          <button key={o} type="button" disabled={disabled} onClick={() => onToggle(o)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-[#FDFBF7] text-[#2D2926] border-[#E5E0D8] hover:border-[#1B4332] disabled:opacity-40'}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

type Form = {
  first_name: string; age: string; gender: string; marital_status: string; country: string; city: string;
  bio: string; occupation: string; education: string; languages: string; height: string; heritage: string;
  prayer_level: string; islamic_practice: string; faith_statement: string;
  marriage_intent: string; timeline: string; relocate: string; children: string; has_children: string;
  personality_traits: string[]; communication_style: string[]; future_goals: string[]; deal_breakers: string;
};

const EMPTY: Form = {
  first_name: '', age: '', gender: '', marital_status: '', country: '', city: '',
  bio: '', occupation: '', education: '', languages: '', height: '', heritage: '',
  prayer_level: '', islamic_practice: '', faith_statement: '',
  marriage_intent: '', timeline: '', relocate: '', children: '', has_children: '',
  personality_traits: [], communication_style: [], future_goals: [], deal_breakers: '',
};

const TOTAL_STEPS = 6;
const TITLES = ['About you', 'Your photo', 'A bit more', 'Your faith', 'Marriage intentions', 'Your personality'];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form>(EMPTY);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof Form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: 'personality_traits' | 'communication_style' | 'future_goals', item: string) =>
    setForm((f) => {
      const cur = f[k];
      return { ...f, [k]: cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item] };
    });

  const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!(form.first_name && form.age && form.gender && form.marital_status && form.country && form.city);
      case 2: return !!photoFile;
      case 3: return !!(form.bio.trim().length >= 20 && form.occupation && form.languages);
      case 4: return !!(form.prayer_level && form.islamic_practice);
      case 5: return !!(form.marriage_intent && form.timeline && form.relocate && form.children && form.has_children);
      case 6: return form.personality_traits.length >= 1 && form.future_goals.length >= 1;
      default: return true;
    }
  };

  const next = async () => {
    setError('');
    if (step < TOTAL_STEPS) { setStep(step + 1); return; }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error: dbError } = await supabase.from('profiles').insert([{
        id: user.id, email: user.email,
        first_name: form.first_name, age: parseInt(form.age, 10), gender: form.gender,
        marital_status: form.marital_status, country: form.country, city: form.city,
        location: [form.city, form.country].filter(Boolean).join(', '),
        bio: form.bio, occupation: form.occupation, education: form.education,
        languages: form.languages, height: form.height, heritage: form.heritage,
        prayer_level: form.prayer_level, islamic_practice: form.islamic_practice, faith_statement: form.faith_statement,
        marriage_intent: form.marriage_intent, timeline: form.timeline, relocate: form.relocate,
        children: form.children, has_children: form.has_children,
        personality_traits: form.personality_traits, communication_style: form.communication_style,
        future_goals: form.future_goals, deal_breakers: form.deal_breakers,
      }]);
      if (dbError) throw dbError;

      if (photoFile) {
        try { await uploadAvatar(photoFile); } catch (e: any) { console.error('Photo upload failed:', e?.message); }
      }
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto py-6 relative">
      <button onClick={() => supabase.auth.signOut()} className="absolute -top-2 right-0 text-xs font-bold text-[#8B7355] hover:text-[#1B4332] uppercase tracking-widest">Sign Out</button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E0D8] shadow-sm">
        <p className="text-[10px] font-bold text-[#8B7355] uppercase tracking-[0.2em] text-center">Step {step} of {TOTAL_STEPS}</p>
        <h2 className="text-2xl font-serif text-[#1B4332] italic text-center mb-1">{TITLES[step - 1]}</h2>
        <p className="text-xs text-[#8B7355] text-center mb-6">Your profile helps us find you a suitable match.</p>

        <div className="flex gap-1.5 mb-8 justify-center">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${step >= i + 1 ? 'bg-[#1B4332]' : 'bg-[#E5E0D8]'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4 min-h-[240px]">
            {step === 1 && (
              <>
                <Field label="First Name"><input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className={INPUT_CLS} /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Age"><input type="number" min={18} value={form.age} onChange={(e) => set('age', e.target.value)} className={INPUT_CLS} /></Field>
                  <Field label="Gender"><SelectField value={form.gender} onChange={(v) => set('gender', v)} options={GENDERS} placeholder="Select" /></Field>
                </div>
                <Field label="Marital Status"><SelectField value={form.marital_status} onChange={(v) => set('marital_status', v)} options={MARITAL} placeholder="Select" /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Country"><input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="e.g. UK" className={INPUT_CLS} /></Field>
                  <Field label="City"><input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. London" className={INPUT_CLS} /></Field>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="text-center space-y-4 py-4">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickPhoto} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-36 h-36 bg-[#F0EEE8] rounded-full mx-auto flex items-center justify-center border-2 border-dashed border-[#8B7355] hover:bg-[#E5E0D8] transition-colors overflow-hidden">
                  {photoPreview ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" /> : (
                    <div className="text-center"><Upload className="w-6 h-6 mx-auto text-[#8B7355] mb-2" /><span className="text-xs font-medium text-[#8B7355]">Upload Photo</span></div>
                  )}
                </button>
                <p className="text-xs text-[#5C574F] max-w-xs mx-auto">Add a clear, recent photo of yourself. You can verify it later for a trusted badge.</p>
              </div>
            )}

            {step === 3 && (
              <>
                <Field label="About You"><textarea rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Tell us about yourself and what you're looking for… (min 20 characters)" className={`${INPUT_CLS} resize-none`} /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Occupation"><input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} className={INPUT_CLS} /></Field>
                  <Field label="Education"><input value={form.education} onChange={(e) => set('education', e.target.value)} className={INPUT_CLS} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Languages"><input value={form.languages} onChange={(e) => set('languages', e.target.value)} placeholder="Somali, English" className={INPUT_CLS} /></Field>
                  <Field label="Height"><input value={form.height} onChange={(e) => set('height', e.target.value)} placeholder={`5'7" / 170cm`} className={INPUT_CLS} /></Field>
                </div>
                <Field label="Heritage / Background (optional)"><input value={form.heritage} onChange={(e) => set('heritage', e.target.value)} placeholder="e.g. Somali — Mogadishu" className={INPUT_CLS} /></Field>
              </>
            )}

            {step === 4 && (
              <>
                <Field label="Prayer"><SelectField value={form.prayer_level} onChange={(v) => set('prayer_level', v)} options={PRAYER} placeholder="Select" /></Field>
                <Field label="Level of Practice"><SelectField value={form.islamic_practice} onChange={(v) => set('islamic_practice', v)} options={PRACTICE} placeholder="Select" /></Field>
                <Field label="A short statement about your faith (optional)"><textarea rows={3} value={form.faith_statement} onChange={(e) => set('faith_statement', e.target.value)} placeholder="What role does your deen play in your life?" className={`${INPUT_CLS} resize-none`} /></Field>
              </>
            )}

            {step === 5 && (
              <>
                <Field label="Looking For"><SelectField value={form.marriage_intent} onChange={(v) => set('marriage_intent', v)} options={LOOKING} placeholder="Select" /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Timeline"><SelectField value={form.timeline} onChange={(v) => set('timeline', v)} options={TIMELINE} placeholder="Select" /></Field>
                  <Field label="Relocation"><SelectField value={form.relocate} onChange={(v) => set('relocate', v)} options={RELOCATE} placeholder="Select" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Want Children?"><SelectField value={form.children} onChange={(v) => set('children', v)} options={WANT_KIDS} placeholder="Select" /></Field>
                  <Field label="Have Children?"><SelectField value={form.has_children} onChange={(v) => set('has_children', v)} options={HAS_KIDS} placeholder="Select" /></Field>
                </div>
              </>
            )}

            {step === 6 && (
              <>
                <Field label="Personality Traits (pick a few)"><ChipsField value={form.personality_traits} options={TRAITS} onToggle={(o) => toggle('personality_traits', o)} /></Field>
                <Field label="Communication Style"><ChipsField value={form.communication_style} options={STYLES} onToggle={(o) => toggle('communication_style', o)} /></Field>
                <Field label="Top Future Goals (up to 3)"><ChipsField value={form.future_goals} options={GOALS} max={3} onToggle={(o) => toggle('future_goals', o)} /></Field>
                <Field label="Private Deal Breakers (only used by matching, never shown)"><textarea rows={2} value={form.deal_breakers} onChange={(e) => set('deal_breakers', e.target.value)} placeholder="e.g. Smoking, not praying" className={`${INPUT_CLS} resize-none`} /></Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}

        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button type="button" onClick={() => { setError(''); setStep(step - 1); }} className="px-5 py-4 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button type="button" onClick={next} disabled={loading || !canProceed()}
            className="flex-1 bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : step === TOTAL_STEPS ? <>Complete Profile <Check className="w-4 h-4" /></> : <>Continue <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
        {!canProceed() && !loading && (
          <p className="text-[11px] text-[#8B7355] text-center mt-3">Please fill in the required fields to continue.</p>
        )}
      </motion.div>
    </div>
  );
}
