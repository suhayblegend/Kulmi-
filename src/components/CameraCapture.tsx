import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';

/**
 * Live camera capture — no file uploads allowed. Requests the device camera
 * (front camera on phones, webcam on laptops), lets the user take a photo, and
 * returns it as a File. Calls onNoCamera if the camera can't be accessed so the
 * parent can guide the user (e.g. "open on your phone").
 *
 * Requires a secure context (HTTPS in production; localhost is fine).
 */
export function CameraCapture({
  onCapture,
  onNoCamera,
}: {
  onCapture: (file: File) => void;
  onNoCamera?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(true);
  const [failed, setFailed] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = async () => {
    setStarting(true);
    setFailed(false);
    stop(); // stop any previous stream (also guards StrictMode double-invoke)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; } // unmounted mid-request → don't leak the camera
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch {
      if (mountedRef.current) { setFailed(true); onNoCamera?.(); }
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    start();
    return () => { mountedRef.current = false; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          stop();
          onCapture(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
        }
      },
      'image/jpeg',
      0.9
    );
  };

  if (failed) {
    return (
      <div className="rounded-2xl border border-[#E5E0D8] bg-[#FDFBF7] p-6 text-center">
        <p className="text-sm text-[#5C574F] mb-4">
          We couldn't access a camera on this device. Please allow camera access, or open Kulmi on your phone to finish verifying.
        </p>
        <button onClick={start} className="inline-flex items-center gap-2 text-sm font-medium text-[#1B4332] border border-[#1B4332] px-4 py-2 rounded-xl hover:bg-[#F0EEE8] transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full aspect-[3/4] max-w-xs mx-auto rounded-2xl overflow-hidden bg-[#2D2926]">
        {/* mirror the preview so it feels like a mirror; saved image stays natural */}
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-40 h-52 border-2 border-dashed border-white/60 rounded-[40px]" />
        </div>
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}
      </div>
      <button
        onClick={capture}
        disabled={!ready}
        className="w-full bg-[#1B4332] hover:bg-[#143326] text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Camera className="w-5 h-5" /> Take Selfie
      </button>
    </div>
  );
}
