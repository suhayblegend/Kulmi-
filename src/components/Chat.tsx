import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ShieldAlert, Mic, Trash2, Users, AlertTriangle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import {
  getChatPartner,
  getMatchGallery,
  getMatchIntro,
  setChatStatus,
  getChatMeta,
  listMessages,
  sendMessage,
  sendVoiceMessage,
  reportUser,
  getCurrentUserId,
  avatarFor,
  type Message,
  type Profile,
} from '../lib/db';
import { ChatHeader } from './Chat/ChatHeader';

interface ChatProps {
  chatId: string;
  onExit: () => void;
  onEndIntroduction: () => void;
}

export function Chat({ chatId, onExit, onEndIntroduction }: ChatProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endReason, setEndReason] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSuccessForm, setShowSuccessForm] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState('still_getting_to_know');
  const [testimonial, setTestimonial] = useState('');
  const [consentPublic, setConsentPublic] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [partnerIntro, setPartnerIntro] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const partnerName = partner?.first_name || 'your match';

  const upsert = (list: Message[], msg: Message) =>
    list.some((m) => m.id === msg.id) ? list : [...list, msg];

  useEffect(() => {
    let active = true;
    (async () => {
      const [uid, p, msgs] = await Promise.all([
        getCurrentUserId(),
        getChatPartner(chatId),
        listMessages(chatId),
      ]);
      if (!active) return;
      setMyId(uid);
      setPartner(p);
      setMessages(msgs);
      if (p) {
        // Matched → their extra photos + voice intro unlock.
        const [extra, intro] = await Promise.all([getMatchGallery(p.id), getMatchIntro(p.id)]);
        if (!active) return;
        setGallery([avatarFor(p), ...extra]);
        setPartnerIntro(intro);
      }
    })();

    const subscription = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages((prev) => upsert(prev, payload.new as Message));
        }
      )
      .subscribe();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [chatId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    const text = message.trim();
    if (!text) return;
    setMessage('');
    try {
      const saved = await sendMessage(chatId, text);
      if (saved) setMessages((prev) => upsert(prev, saved));
    } catch {
      setMessage(text); // restore on failure
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [endingChat, setEndingChat] = useState(false);
  const handleConfirmEnd = async () => {
    if (endingChat) return;
    setEndingChat(true);
    try {
      await setChatStatus(chatId, 'ended');
    } catch {
      /* still leave the chat even if the status write fails */
    } finally {
      setEndingChat(false);
      setShowEndConfirm(false);
      onEndIntroduction();
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Make sure the mic is released if the chat is left mid-recording.
  useEffect(() => () => {
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    stopStream();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      alert('Microphone access is needed to record a voice note.');
    }
  };

  const stopAndSend = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) { setIsRecording(false); return; }
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      stopStream();
      setIsRecording(false);
      if (blob.size > 0) {
        try {
          const saved = await sendVoiceMessage(chatId, blob);
          if (saved) setMessages((prev) => upsert(prev, saved));
        } catch {
          alert('Could not send the voice note.');
        }
      }
    };
    mr.stop();
  };

  const cancelRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr) { mr.onstop = () => stopStream(); mr.stop(); }
    else stopStream();
    setIsRecording(false);
  };

  const handleReport = async () => {
    if (!partner) return;
    const reason = window.prompt(`Report ${partnerName}? Briefly, what's the issue?`);
    if (!reason || !reason.trim()) return;
    try {
      await reportUser(partner.id, reason.trim());
      alert('Thank you. Our team will review this report.');
    } catch {
      alert('Could not submit the report.');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-[80vh] flex gap-6 mt-4 relative">
      <AnimatePresence>
        {showEndConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E5E0D8] p-8 rounded-2xl shadow-lg max-w-md w-full text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-serif text-[#1B4332] font-medium mb-3">End Introduction?</h3>
              <p className="text-sm text-[#5C574F] mb-6">
                This will permanently end the conversation and archive the chat. You will not be matched again.
                This action cannot be undone.
              </p>

              <div className="mb-8 text-left">
                <label className="block text-xs font-bold text-[#8B7355] uppercase tracking-wider mb-2">Private Reason (Optional)</label>
                <select
                  className="w-full bg-[#FDFBF7] border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332]"
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                >
                  <option value="">Select a reason...</option>
                  <option value="goals">Incompatible goals/values</option>
                  <option value="communication">Communication style mismatch</option>
                  <option value="ready">Not ready to proceed</option>
                  <option value="other">Other</option>
                </select>
                <p className="text-[10px] text-[#8B7355] mt-2">This is kept private and helps us improve future matches.</p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmEnd}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  Confirm End
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {showStatusModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E5E0D8] p-8 rounded-2xl shadow-lg max-w-md w-full"
            >
              <h3 className="text-xl font-serif text-[#1B4332] font-medium mb-2 text-center">Update Relationship Status</h3>
              <p className="text-sm text-[#8B7355] mb-6 text-center">
                Keep your status updated. If both of you select the same status, it will be confirmed on your profiles.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  { id: 'still_getting_to_know', label: 'Still Getting to Know Each Other' },
                  { id: 'exclusive', label: 'Exclusive (Not talking to others)' },
                  { id: 'engaged', label: 'Engaged' },
                  { id: 'married', label: 'Married' },
                  { id: 'ended', label: 'Ended the Introduction' },
                ].map((status) => (
                  <button
                    key={status.id}
                    onClick={() => setRelationshipStatus(status.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      relationshipStatus === status.id
                        ? 'bg-[#1B4332] text-white border-[#1B4332]'
                        : 'bg-white border-[#E5E0D8] text-[#2D2926] hover:bg-[#FDFBF7]'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowStatusModal(false);
                    if (relationshipStatus === 'ended') { setShowEndConfirm(true); return; }
                    try {
                      await setChatStatus(chatId, relationshipStatus);
                      const meta = await getChatMeta(chatId);
                      if (meta.confirmedStatus === 'married' || meta.confirmedStatus === 'engaged') {
                        setShowSuccessForm(true); // both agreed → confirmed success
                      } else if (relationshipStatus === 'married' || relationshipStatus === 'engaged') {
                        alert(`Saved. Once ${partnerName} also marks "${relationshipStatus}", it's confirmed.`);
                      }
                    } catch {
                      alert('Could not update status.');
                    }
                  }}
                  className="flex-1 px-6 py-3 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors"
                >
                  Update
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSuccessForm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/95 backdrop-blur-md rounded-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-[#E5E0D8] p-8 rounded-2xl shadow-xl max-w-lg w-full text-center max-h-[90vh] overflow-y-auto"
            >
              <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🎉</span>
              </div>
              <h3 className="text-2xl font-serif text-[#1B4332] font-medium mb-3">Masha'Allah! Congratulations!</h3>
              <p className="text-[#8B7355] mb-6 leading-relaxed">
                Both you and {partnerName} have updated your status to{' '}
                <strong className="text-[#1B4332] font-medium">{relationshipStatus === 'married' ? 'Married' : 'Engaged'}</strong>.
                We are so happy for you! You've both earned the "Success Story" badge.
              </p>

              <div className="bg-[#FDFBF7] border border-[#E5E0D8] rounded-2xl p-6 text-left mb-8">
                <h4 className="font-medium text-[#1B4332] mb-2">Share Your Story (Optional)</h4>
                <p className="text-xs text-[#8B7355] mb-4">
                  Inspire others who are looking for their righteous spouse. You can write a short testimonial. We will only publish it if both of you consent.
                </p>

                <textarea
                  className="w-full bg-white border border-[#E5E0D8] rounded-xl p-4 text-sm focus:outline-none focus:border-[#1B4332] min-h-[120px] mb-4 resize-none"
                  placeholder="How did you meet? What made you realize they were the one?..."
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                />

                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-[#1B4332] rounded border-[#E5E0D8]"
                      checked={consentPublic}
                      onChange={(e) => setConsentPublic(e.target.checked)}
                    />
                  </div>
                  <span className="text-sm text-[#5C574F]">
                    I consent to sharing this story publicly on the platform to inspire others. (It will only be shared if {partnerName} also consents).
                  </span>
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowSuccessForm(false);
                    onEndIntroduction();
                  }}
                  className="flex-1 px-6 py-4 rounded-xl border border-[#E5E0D8] text-[#5C574F] font-medium hover:bg-[#FDFBF7] transition-colors"
                >
                  Skip for Now
                </button>
                <button
                  onClick={() => {
                    setShowSuccessForm(false);
                    onEndIntroduction();
                  }}
                  className="flex-1 px-6 py-4 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors"
                >
                  Submit & Archive
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Sidebar */}
      <div className="w-80 hidden md:flex flex-col border border-[#E5E0D8] bg-white rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FDFBF7]">
          <button onClick={onExit} className="-ml-2 text-[#8B7355] hover:text-[#1B4332] p-2 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-serif font-medium text-[#1B4332] text-lg italic">Profile</span>
          <div className="w-9"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="w-32 h-32 rounded-full overflow-hidden mx-auto mb-4 border border-[#E5E0D8] shadow-sm">
            {partner && <img src={avatarFor(partner)} alt={partnerName} className="w-full h-full object-cover" />}
          </div>
          {gallery.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {gallery.slice(1).map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="w-14 h-14 rounded-xl overflow-hidden border border-[#E5E0D8] hover:opacity-90">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
          <h2 className="text-2xl font-serif font-medium text-center text-[#1B4332] mb-1">
            {partnerName}{partner?.age ? `, ${partner.age}` : ''}
          </h2>
          <p className="text-center text-[10px] uppercase tracking-[0.2em] font-bold text-[#8B7355] mb-8">
            {[partner?.occupation, partner?.location || partner?.city].filter(Boolean).join(' • ') || 'Kulmi member'}
          </p>

          <div className="space-y-8">
            {partnerIntro && (
              <div>
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#8B7355] mb-2">🎤 Voice intro</h3>
                <audio controls src={partnerIntro} className="w-full" />
              </div>
            )}
            {partner?.bio && (
              <div>
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#8B7355] mb-3">About</h3>
                <p className="text-sm text-[#5C574F] leading-relaxed italic font-serif">"{partner.bio}"</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              {partner?.languages && (
                <div>
                  <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mb-1">Languages</p>
                  <p className="text-sm font-medium text-[#1B4332]">{partner.languages}</p>
                </div>
              )}
              {partner?.prayer_level && (
                <div>
                  <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mb-1">Prayer</p>
                  <p className="text-sm font-medium text-[#1B4332]">{partner.prayer_level}</p>
                </div>
              )}
              {partner?.relocate && (
                <div>
                  <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mb-1">Relocate</p>
                  <p className="text-sm font-medium text-[#1B4332]">{partner.relocate}</p>
                </div>
              )}
              {partner?.country && (
                <div>
                  <p className="text-[10px] text-[#8B7355] uppercase tracking-widest font-bold mb-1">Origin</p>
                  <p className="text-sm font-medium text-[#1B4332]">{partner.country}</p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-[#E5E0D8]">
              <button onClick={handleReport} className="w-full flex items-center justify-center gap-2 text-sm text-[#8B7355] hover:text-[#1B4332] transition-colors py-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col border border-[#E5E0D8] bg-white rounded-2xl overflow-hidden shadow-sm">
        <ChatHeader
          partnerName={partnerName}
          partnerAvatar={partner ? avatarFor(partner) : undefined}
          onExit={onExit}
          setShowStatusModal={setShowStatusModal}
          setShowEndConfirm={setShowEndConfirm}
        />

        <div className="bg-[#F0EEE8] px-6 py-2.5 flex items-start sm:items-center gap-3 border-b border-[#E5E0D8]">
          <Users className="w-4 h-4 text-[#8B7355] shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-xs text-[#5C574F]">
            <span className="font-bold text-[#2D2926]">Marriage-focused space:</span> please keep this conversation respectful. Chats may be reviewed by a guardian (Wali) or our team.
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 p-6 sm:p-8 overflow-y-auto space-y-6 bg-[#FDFBF7]">
          <div className="flex justify-center mb-8">
            <div className="bg-[#E5E0D8] text-[#5C574F] text-[10px] uppercase tracking-widest px-4 py-2 rounded-full font-bold">
              You both agreed to continue! Say salaam.
            </div>
          </div>

          {messages.length === 0 && (
            <div className="flex flex-col gap-2 mb-8 items-center">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#8B7355] mb-2">Conversation Starters</p>
              <button
                onClick={() => setMessage('Asalamu alaikum! It was nice to be introduced to you.')}
                className="bg-white border border-[#1B4332]/20 hover:border-[#1B4332] text-sm text-[#1B4332] px-4 py-2 rounded-xl transition-colors shadow-sm max-w-sm text-center"
              >
                "Asalamu alaikum! It was nice to be introduced to you."
              </button>
              <button
                onClick={() => setMessage('What are you hoping to build in a marriage, insha’Allah?')}
                className="bg-white border border-[#1B4332]/20 hover:border-[#1B4332] text-sm text-[#1B4332] px-4 py-2 rounded-xl transition-colors shadow-sm max-w-sm text-center"
              >
                "What are you hoping to build in a marriage, insha'Allah?"
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {messages.map((msg) => {
              const mine = msg.sender_id === myId;
              return (
                <div key={msg.id} className={`flex gap-4 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && partner && (
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-auto border border-[#E5E0D8]">
                      <img src={avatarFor(partner)} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div
                    className={`p-4 text-sm shadow-sm max-w-[80%] leading-relaxed rounded-2xl ${
                      mine
                        ? 'bg-[#1B4332] text-white rounded-br-sm'
                        : 'bg-white border border-[#E5E0D8] text-[#2D2926] rounded-bl-sm'
                    }`}
                  >
                    {msg.type === 'audio' ? (
                      <audio controls src={msg.content} className="max-w-[240px]" />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-white border-t border-[#E5E0D8] shrink-0">
          {isRecording ? (
            <div className="flex items-center gap-3 bg-[#FDFBF7] rounded-xl px-5 py-3 border border-[#E5E0D8]">
              <div className="flex-1 flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-[#2D2926]">{formatTime(recordingTime)}</span>
              </div>
              <button onClick={cancelRecording} className="p-2 text-[#8B7355] hover:text-red-500 transition-colors" title="Cancel">
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                className="rounded-xl w-10 h-10 bg-[#1B4332] hover:bg-[#143326] text-white shrink-0 flex items-center justify-center transition-colors ml-2"
                onClick={stopAndSend}
                title="Stop & send"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="w-full bg-[#FDFBF7] rounded-xl pl-5 pr-5 py-4 text-sm focus:outline-none border border-[#E5E0D8] focus:border-[#1B4332] transition-all text-[#2D2926] placeholder-[#8B7355]/50"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && message.trim()) handleSendMessage();
                  }}
                />
              </div>
              {message.trim() ? (
                <button
                  className="rounded-xl w-14 h-14 bg-[#1B4332] hover:bg-[#143326] text-white shrink-0 flex items-center justify-center transition-colors"
                  onClick={handleSendMessage}
                >
                  <Send className="w-5 h-5 ml-1" />
                </button>
              ) : (
                <button
                  className="rounded-xl w-14 h-14 bg-[#F0EEE8] hover:bg-[#E5E0D8] text-[#1B4332] shrink-0 flex items-center justify-center transition-colors border border-[#E5E0D8]"
                  onClick={startRecording}
                  title="Record voice note"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
