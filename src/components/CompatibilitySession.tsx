import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Heart, ArrowLeft, Sparkles, CheckCircle2, XCircle, Mic, Trash2, Square } from 'lucide-react';
import {
  COMPATIBILITY_QUESTIONS,
  getSession,
  getSessionAnswers,
  submitSessionAnswer,
  submitSessionDecision,
  uploadSessionAnswerAudio,
  analyzeCompatibility,
  chatForSession,
  avatarFor,
  type SessionSummary,
  type CompatibilityAnalysis,
} from '../lib/db';

interface Props {
  sessionId: string;
  onExit: () => void;
  onMatched: (chatId: string) => void;
}

// A thoughtful answer, not a one-liner — the seriousness filter.
const MIN_WORDS = 15;
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// Module scope so it keeps a stable identity across renders — otherwise the
// answer textareas remount on every keystroke and lose focus.
function SessionCard({ onExit, summary, children }: { onExit: () => void; summary: SessionSummary | null; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-3xl mx-auto shadow-sm border border-[#E5E0D8] bg-white rounded-2xl overflow-hidden min-h-[480px] flex flex-col">
      <div className="h-16 border-b border-[#E5E0D8] bg-[#FDFBF7] flex items-center px-6 shrink-0">
        <button onClick={onExit} className="text-[#8B7355] hover:text-[#1B4332] p-2 -ml-2 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-serif text-lg text-[#1B4332] italic ml-2">Compatibility Session</span>
        {summary && (
          <div className="ml-auto flex items-center gap-2">
            <img src={avatarFor(summary.partner)} alt="" className="w-8 h-8 rounded-full object-cover border border-[#E5E0D8]" />
            <span className="text-sm font-medium text-[#1B4332] hidden sm:block">{summary.partner.first_name}</span>
          </div>
        )}
      </div>
      <div className="flex-1 p-6 sm:p-10">{children}</div>
    </div>
  );
}

export function CompatibilitySession({ sessionId, onExit, onMatched }: Props) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [questions, setQuestions] = useState<string[]>(COMPATIBILITY_QUESTIONS);
  const [mine, setMine] = useState<Record<number, string>>({});
  const [theirs, setTheirs] = useState<Record<number, string>>({});
  const [mineAudio, setMineAudio] = useState<Record<number, string>>({});
  const [theirsAudio, setTheirsAudio] = useState<Record<number, string>>({});
  const [drafts, setDrafts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [analysis, setAnalysis] = useState<CompatibilityAnalysis | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [waitingPartner, setWaitingPartner] = useState(false);
  const [ended, setEnded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice-answer recording (per current question).
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [audioPreview, setAudioPreview] = useState<Record<number, string>>({}); // local blob URL just recorded
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingBlobRef = useRef<{ q: number; blob: Blob } | null>(null);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const refresh = async () => {
    const [s, a] = await Promise.all([getSession(sessionId), getSessionAnswers(sessionId)]);
    const qs = s?.questions?.length ? s.questions : COMPATIBILITY_QUESTIONS;
    setSummary(s);
    setQuestions(qs);
    setMine(a.mine);
    setTheirs(a.theirs);
    setMineAudio(a.mineAudio);
    setTheirsAudio(a.theirsAudio);
    setDrafts(qs.map((_, i) => a.mine[i] ?? ''));
    return { s, a, qs };
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { s, a, qs } = await refresh();
        if (!active) return;
        if (s?.status === 'completed') {
          const chatId = await chatForSession(sessionId);
          if (chatId) return onMatched(chatId);
        }
        // Start on the first question not yet answered (typed or recorded).
        const firstUnanswered = qs.findIndex((_, i) => !(a.mine[i] ?? '').trim() && !a.mineAudio[i]);
        setQIndex(firstUnanswered === -1 ? qs.length - 1 : firstUnanswered);
        if (s?.myDecision === 'yes' && s.status === 'active') startPollingForMatch();
      } catch {
        if (active) setEnded(false); // fall through to the normal screen; a retry happens via polling
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      stopPoll();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const total = questions.length;
  const iFinished = summary ? summary.myAnsweredCount >= total : false;
  const bothFinished = summary?.bothFinished ?? false;

  useEffect(() => {
    if (bothFinished && !analysis) {
      analyzeCompatibility(sessionId).then(setAnalysis).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothFinished]);

  useEffect(() => {
    if (!iFinished || bothFinished) return;
    const t = setInterval(() => { refresh().catch(() => {}); }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iFinished, bothFinished]);

  // Recording timer.
  useEffect(() => {
    if (!recording) { setRecSec(0); return; }
    const t = setInterval(() => setRecSec((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const setDraft = (v: string) => setDrafts((d) => d.map((x, i) => (i === qIndex ? v : x)));

  const hasVoiceAnswer = !!(audioPreview[qIndex] || mineAudio[qIndex]);
  const draft = drafts[qIndex] ?? '';
  const words = wordCount(draft);
  const canProceed = hasVoiceAnswer || words >= MIN_WORDS;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      alert('Microphone access is needed to record a voice answer.');
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) { setRecording(false); return; }
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecording(false);
      if (blob.size > 0) {
        const url = URL.createObjectURL(blob);
        setAudioPreview((p) => ({ ...p, [qIndex]: url }));
        pendingBlobRef.current = { q: qIndex, blob };
      }
    };
    mr.stop();
  };

  const clearRecording = () => {
    setAudioPreview((p) => { const n = { ...p }; delete n[qIndex]; return n; });
    setMineAudio((p) => { const n = { ...p }; delete n[qIndex]; return n; });
    pendingBlobRef.current = null;
  };

  const saveAndNext = async () => {
    if (!canProceed) return;
    setSaving(true);
    try {
      let audioPath: string | null = null;
      if (pendingBlobRef.current && pendingBlobRef.current.q === qIndex) {
        audioPath = await uploadSessionAnswerAudio(pendingBlobRef.current.blob);
        pendingBlobRef.current = null;
      }
      // If they typed a full answer, save it; a voice answer may have no text.
      await submitSessionAnswer(sessionId, qIndex, draft.trim(), audioPath);
      if (qIndex < total - 1) {
        setQIndex(qIndex + 1);
      } else {
        await refresh();
      }
    } catch (e: any) {
      alert(e?.message || 'Could not save your answer.');
    } finally {
      setSaving(false);
    }
  };

  const startPollingForMatch = () => {
    setWaitingPartner(true);
    stopPoll();
    pollRef.current = setInterval(async () => {
      const chatId = await chatForSession(sessionId);
      if (chatId) { stopPoll(); onMatched(chatId); return; }
      const s = await getSession(sessionId);
      // Partner said no (status becomes 'ended') or session vanished — stop
      // the spinner and show the gentle "not the right fit" screen.
      if (!s || s.status === 'ended') { stopPoll(); setEnded(true); }
    }, 5000);
  };

  const handleDecision = async (decision: 'yes' | 'no') => {
    setDeciding(true);
    try {
      await submitSessionDecision(sessionId, decision);
      if (decision === 'no') { onExit(); return; }
      const chatId = await chatForSession(sessionId);
      if (chatId) onMatched(chatId);
      else startPollingForMatch();
    } catch (e: any) {
      alert(e?.message || 'Could not save your decision. Please check your connection and try again.');
    } finally {
      setDeciding(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (loading) {
    return (
      <SessionCard onExit={onExit} summary={summary}>
        <div className="h-full flex items-center justify-center text-[#8B7355]"><Loader2 className="w-8 h-8 animate-spin" /></div>
      </SessionCard>
    );
  }

  if (ended || !summary || summary.status === 'ended') {
    return (
      <SessionCard onExit={onExit} summary={summary}>
        <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-16">
          <XCircle className="w-12 h-12 text-[#8B7355]" />
          <h2 className="text-2xl font-serif text-[#1B4332] italic">This session has ended</h2>
          <p className="text-[#5C574F] max-w-sm">Not every introduction is the right fit — and that's okay. New introductions await.</p>
          <button onClick={onExit} className="mt-4 bg-[#1B4332] text-white px-8 py-3 rounded-xl font-medium hover:bg-[#143326] transition-colors">Back to Discover</button>
        </div>
      </SessionCard>
    );
  }

  // ---- Answering stage (one question at a time) ----
  if (!iFinished) {
    const isLast = qIndex === total - 1;
    const recordedUrl = audioPreview[qIndex] || mineAudio[qIndex];
    return (
      <SessionCard onExit={onExit} summary={summary}>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            {questions.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < qIndex ? 'bg-[#1B4332]' : i === qIndex ? 'bg-[#8B7355]' : 'bg-[#E5E0D8]'}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={qIndex} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
              <p className="text-[10px] font-bold text-[#8B7355] uppercase tracking-[0.2em] mb-3">
                Question {qIndex + 1} of {total} · {summary.partner.first_name} answers these too
              </p>
              <h2 className="text-2xl md:text-3xl font-serif text-[#1B4332] leading-snug mb-6">{questions[qIndex]}</h2>

              <textarea
                autoFocus
                rows={5}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full p-5 rounded-2xl border border-[#E5E0D8] bg-[#FDFBF7] focus:border-[#1B4332] outline-none resize-none text-[#2D2926] font-serif text-lg leading-relaxed"
                placeholder="Take your time and be honest — a few thoughtful sentences…"
              />

              {/* length hint */}
              {!hasVoiceAnswer && (
                <div className="flex items-center justify-between mt-2">
                  <p className={`text-xs ${words >= MIN_WORDS ? 'text-green-700' : 'text-[#8B7355]'}`}>
                    {words >= MIN_WORDS ? '✓ Looks thoughtful' : `Write at least ${MIN_WORDS} words (${words}/${MIN_WORDS})`}
                  </p>
                  <span className="text-[11px] text-[#8B7355]">{words} words</span>
                </div>
              )}

              {/* voice answer */}
              <div className="mt-4 border-t border-[#F0EEE8] pt-4">
                {recordedUrl ? (
                  <div className="flex items-center gap-3">
                    <audio controls src={recordedUrl} className="flex-1 max-w-full" />
                    <button onClick={clearRecording} className="p-2 text-[#8B7355] hover:text-red-500 transition-colors" title="Remove voice answer">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ) : recording ? (
                  <div className="flex items-center gap-3 bg-[#FDFBF7] rounded-xl px-4 py-3 border border-[#E5E0D8]">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-medium text-[#2D2926] flex-1">Recording… {fmt(recSec)}</span>
                    <button onClick={stopRecording} className="flex items-center gap-2 bg-[#1B4332] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#143326]">
                      <Square className="w-4 h-4" /> Stop
                    </button>
                  </div>
                ) : (
                  <button onClick={startRecording} className="flex items-center gap-2 text-sm font-medium text-[#1B4332] hover:text-[#143326] transition-colors">
                    <Mic className="w-4 h-4" /> Prefer to speak? Record a voice answer instead
                  </button>
                )}
              </div>

              <p className="text-xs text-[#8B7355] mt-4">You'll each see the other's answers once you've both finished all {total} questions.</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3 mt-8">
            {qIndex > 0 && (
              <button onClick={() => setQIndex(qIndex - 1)} className="px-5 py-4 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors">Back</button>
            )}
            <button
              onClick={saveAndNext}
              disabled={saving || recording || !canProceed}
              className="flex-1 h-14 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : isLast ? 'Finish' : 'Next question'}
            </button>
          </div>
        </div>
      </SessionCard>
    );
  }

  // ---- I finished, partner hasn't ----
  if (!bothFinished) {
    return (
      <SessionCard onExit={onExit} summary={summary}>
        <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-16">
          <div className="w-10 h-10 rounded-full border-2 border-[#E5E0D8] border-t-[#1B4332] animate-spin" />
          <h2 className="text-2xl font-serif text-[#1B4332] italic">Waiting for {summary.partner.first_name}</h2>
          <p className="text-[#5C574F] max-w-sm">You've completed your answers. We'll reveal both sets and your compatibility once {summary.partner.first_name} finishes.</p>
          <button onClick={() => refresh()} className="text-sm font-medium text-[#1B4332] underline underline-offset-4">Check again</button>
        </div>
      </SessionCard>
    );
  }

  // ---- Both finished: reveal + analysis + decision ----
  return (
    <SessionCard onExit={onExit} summary={summary}>
      <div className="space-y-10">
        <div className="rounded-2xl border border-[#1B4332]/20 bg-[#FDFBF7] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#1B4332]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1B4332]">Compatibility Analysis</h3>
          </div>
          {!analysis ? (
            <div className="flex items-center gap-3 text-[#8B7355] py-4"><Loader2 className="w-5 h-5 animate-spin" /> Preparing your compatibility summary…</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-serif text-[#1B4332]">{analysis.score}%</div>
                <p className="text-sm text-[#5C574F] flex-1">{analysis.summary}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1B4332] mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#5C574F]"><CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" /> {s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">To Discuss</p>
                  <ul className="space-y-1.5">
                    {analysis.considerations.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#5C574F]"><Heart className="w-4 h-4 text-[#8B7355] shrink-0 mt-0.5" /> {s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Answers side by side (text and/or voice) */}
        <div className="space-y-6">
          {questions.map((q, i) => (
            <div key={i} className="border-t border-[#F0EEE8] pt-4">
              <p className="text-sm font-medium text-[#1B4332] mb-3">{i + 1}. {q}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#F0EEE8]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">You</p>
                  {mine[i] && <p className="text-sm text-[#2D2926] font-serif italic">{mine[i]}</p>}
                  {mineAudio[i] && <audio controls src={mineAudio[i]} className="w-full mt-2" />}
                  {!mine[i] && !mineAudio[i] && <p className="text-sm text-[#2D2926] font-serif italic">—</p>}
                </div>
                <div className="p-4 rounded-xl bg-white border border-[#1B4332]/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1B4332] mb-1">{summary.partner.first_name}</p>
                  {theirs[i] && <p className="text-sm text-[#1B4332] font-serif italic">{theirs[i]}</p>}
                  {theirsAudio[i] && <audio controls src={theirsAudio[i]} className="w-full mt-2" />}
                  {!theirs[i] && !theirsAudio[i] && <p className="text-sm text-[#1B4332] font-serif italic">—</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {waitingPartner || summary.myDecision === 'yes' ? (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 border-t border-[#E5E0D8]">
              <div className="w-8 h-8 rounded-full border-2 border-[#E5E0D8] border-t-[#1B4332] animate-spin mx-auto mb-4" />
              <p className="text-[#5C574F]">You said yes. Waiting for {summary.partner.first_name}'s private decision…</p>
              <p className="text-xs text-[#8B7355] mt-1">If you both say yes, your chat unlocks automatically.</p>
            </motion.div>
          ) : (
            <motion.div key="decide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 border-t border-[#E5E0D8]">
              <h3 className="text-xl font-serif text-[#1B4332] italic mb-2">Your private decision</h3>
              <p className="text-sm text-[#8B7355] mb-6">Would you like to continue getting to know {summary.partner.first_name}? This is never shared.</p>
              <div className="flex gap-4 max-w-md mx-auto">
                <button onClick={() => handleDecision('no')} disabled={deciding} className="flex-1 h-14 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors disabled:opacity-50">Not this time</button>
                <button onClick={() => handleDecision('yes')} disabled={deciding} className="flex-1 h-14 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {deciding ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Yes, continue <Heart className="w-4 h-4" /></>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SessionCard>
  );
}
