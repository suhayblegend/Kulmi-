import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Heart, ArrowLeft, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import {
  COMPATIBILITY_QUESTIONS,
  getSession,
  getSessionAnswers,
  submitSessionAnswer,
  submitSessionDecision,
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
  const [mine, setMine] = useState<Record<number, string>>({});
  const [theirs, setTheirs] = useState<Record<number, string>>({});
  const [drafts, setDrafts] = useState<string[]>(COMPATIBILITY_QUESTIONS.map(() => ''));
  const [saving, setSaving] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [analysis, setAnalysis] = useState<CompatibilityAnalysis | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [waitingPartner, setWaitingPartner] = useState(false);
  const [ended, setEnded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const refresh = async () => {
    const [s, a] = await Promise.all([getSession(sessionId), getSessionAnswers(sessionId)]);
    setSummary(s);
    setMine(a.mine);
    setTheirs(a.theirs);
    setDrafts(COMPATIBILITY_QUESTIONS.map((_, i) => a.mine[i] ?? ''));
    return s;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const s = await refresh();
      if (!active) return;
      if (s?.status === 'completed') {
        const chatId = await chatForSession(sessionId);
        if (chatId) return onMatched(chatId);
      }
      // Start on the first unanswered question.
      const a = await getSessionAnswers(sessionId);
      const firstUnanswered = COMPATIBILITY_QUESTIONS.findIndex((_, i) => !(a.mine[i] ?? '').trim());
      setQIndex(firstUnanswered === -1 ? COMPATIBILITY_QUESTIONS.length - 1 : firstUnanswered);
      // Re-entering after we already said yes → resume watching for the outcome.
      if (s?.myDecision === 'yes' && s.status === 'active') {
        startPollingForMatch();
      }
      setLoading(false);
    })();
    return () => {
      active = false;
      stopPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const iFinished = summary ? summary.myAnsweredCount >= COMPATIBILITY_QUESTIONS.length : false;
  const bothFinished = summary?.bothFinished ?? false;

  // Fetch the AI analysis once both have finished.
  useEffect(() => {
    if (bothFinished && !analysis) {
      analyzeCompatibility(sessionId).then(setAnalysis).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothFinished]);

  const total = COMPATIBILITY_QUESTIONS.length;
  const setDraft = (v: string) => setDrafts((d) => d.map((x, i) => (i === qIndex ? v : x)));

  const saveAndNext = async () => {
    const ans = drafts[qIndex]?.trim();
    if (!ans) return;
    setSaving(true);
    try {
      await submitSessionAnswer(sessionId, qIndex, ans);
      if (qIndex < total - 1) {
        setQIndex(qIndex + 1);
      } else {
        await refresh(); // finished → moves to waiting / reveal
      }
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
      // If the session has ended (partner declined), stop waiting and show it.
      const s = await getSession(sessionId);
      if (!s) { stopPoll(); setEnded(true); }
    }, 5000);
  };

  const handleDecision = async (decision: 'yes' | 'no') => {
    setDeciding(true);
    try {
      await submitSessionDecision(sessionId, decision);
      if (decision === 'no') {
        onExit();
        return;
      }
      const chatId = await chatForSession(sessionId);
      if (chatId) onMatched(chatId);
      else startPollingForMatch();
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return (
      <SessionCard onExit={onExit} summary={summary}>
        <div className="h-full flex items-center justify-center text-[#8B7355]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
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
          <button onClick={onExit} className="mt-4 bg-[#1B4332] text-white px-8 py-3 rounded-xl font-medium hover:bg-[#143326] transition-colors">
            Back to Discover
          </button>
        </div>
      </SessionCard>
    );
  }

  // ---- Answering stage (one question at a time) ----
  if (!iFinished) {
    const isLast = qIndex === total - 1;
    return (
      <SessionCard onExit={onExit} summary={summary}>
        <div className="max-w-xl mx-auto">
          {/* progress */}
          <div className="flex items-center gap-2 mb-8">
            {COMPATIBILITY_QUESTIONS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < qIndex ? 'bg-[#1B4332]' : i === qIndex ? 'bg-[#8B7355]' : 'bg-[#E5E0D8]'}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={qIndex} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
              <p className="text-[10px] font-bold text-[#8B7355] uppercase tracking-[0.2em] mb-3">
                Question {qIndex + 1} of {total} · {summary.partner.first_name} answers these too
              </p>
              <h2 className="text-2xl md:text-3xl font-serif text-[#1B4332] leading-snug mb-6">
                {COMPATIBILITY_QUESTIONS[qIndex]}
              </h2>
              <textarea
                autoFocus
                rows={5}
                value={drafts[qIndex]}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full p-5 rounded-2xl border border-[#E5E0D8] bg-[#FDFBF7] focus:border-[#1B4332] outline-none resize-none text-[#2D2926] font-serif text-lg leading-relaxed"
                placeholder="Take your time and be honest…"
              />
              <p className="text-xs text-[#8B7355] mt-2">Answers are private until you both finish all {total} questions.</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3 mt-8">
            {qIndex > 0 && (
              <button onClick={() => setQIndex(qIndex - 1)} className="px-5 py-4 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors">
                Back
              </button>
            )}
            <button
              onClick={saveAndNext}
              disabled={saving || !drafts[qIndex]?.trim()}
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
          <p className="text-[#5C574F] max-w-sm">
            You've completed your answers. We'll reveal both sets and your compatibility once {summary.partner.first_name} finishes.
          </p>
          <button onClick={refresh} className="text-sm font-medium text-[#1B4332] underline underline-offset-4">
            Check again
          </button>
        </div>
      </SessionCard>
    );
  }

  // ---- Both finished: reveal + analysis + decision ----
  return (
    <SessionCard onExit={onExit} summary={summary}>
      <div className="space-y-10">
        {/* AI analysis */}
        <div className="rounded-2xl border border-[#1B4332]/20 bg-[#FDFBF7] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#1B4332]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1B4332]">Compatibility Analysis</h3>
          </div>
          {!analysis ? (
            <div className="flex items-center gap-3 text-[#8B7355] py-4">
              <Loader2 className="w-5 h-5 animate-spin" /> Analyzing your answers…
            </div>
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
                      <li key={i} className="flex gap-2 text-sm text-[#5C574F]">
                        <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">To Discuss</p>
                  <ul className="space-y-1.5">
                    {analysis.considerations.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#5C574F]">
                        <Heart className="w-4 h-4 text-[#8B7355] shrink-0 mt-0.5" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Answers side by side */}
        <div className="space-y-6">
          {COMPATIBILITY_QUESTIONS.map((q, i) => (
            <div key={i} className="border-t border-[#F0EEE8] pt-4">
              <p className="text-sm font-medium text-[#1B4332] mb-3">{i + 1}. {q}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#F0EEE8]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1">You</p>
                  <p className="text-sm text-[#2D2926] font-serif italic">{mine[i] || '—'}</p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-[#1B4332]/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1B4332] mb-1">{summary.partner.first_name}</p>
                  <p className="text-sm text-[#1B4332] font-serif italic">{theirs[i] || '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Decision */}
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
                <button
                  onClick={() => handleDecision('no')}
                  disabled={deciding}
                  className="flex-1 h-14 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors disabled:opacity-50"
                >
                  Not this time
                </button>
                <button
                  onClick={() => handleDecision('yes')}
                  disabled={deciding}
                  className="flex-1 h-14 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
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
