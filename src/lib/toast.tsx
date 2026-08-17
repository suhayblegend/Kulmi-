import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

// Tiny global toast system — replaces ugly browser alert() popups with calm,
// branded in-app notices. Usage: toast('Saved!', 'success').
type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; kind: Kind }

let nextId = 1;
let push: ((t: Toast) => void) | null = null;

export function toast(message: string, kind: Kind = 'info'): void {
  const msg = (message ?? '').toString().trim();
  if (!msg) return;
  if (push) push({ id: nextId++, message: msg, kind });
  else console.warn('[toast]', msg); // Toaster not mounted yet
}

const STYLES: Record<Kind, { bg: string; border: string; text: string; Icon: typeof Info }> = {
  success: { bg: 'bg-[#E8F3ED]', border: 'border-[#1B4332]/20', text: 'text-[#1B4332]', Icon: CheckCircle2 },
  error:   { bg: 'bg-red-50',    border: 'border-red-200',      text: 'text-red-700',   Icon: AlertTriangle },
  info:    { bg: 'bg-white',     border: 'border-[#E5E0D8]',    text: 'text-[#2D2926]', Icon: Info },
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    push = (t) => {
      setItems((prev) => [...prev.slice(-2), t]); // max 3 visible
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3800);
    };
    return () => { push = null; };
  }, []);

  return (
    <div
      className="fixed left-0 right-0 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
    >
      <AnimatePresence>
        {items.map((t) => {
          const s = STYLES[t.kind];
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className={`pointer-events-auto w-full max-w-sm flex items-start gap-2.5 text-left ${s.bg} ${s.border} ${s.text} border rounded-2xl px-4 py-3 shadow-lg`}
            >
              <s.Icon className="w-4.5 h-4.5 shrink-0 mt-0.5" />
              <span className="text-sm leading-snug">{t.message}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
