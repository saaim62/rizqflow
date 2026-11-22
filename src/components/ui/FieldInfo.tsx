'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

/**
 * FieldInfo — the small "i" beside a hard-to-understand field
 * (NOTES #32). Hover (desktop) or tap/click (touch) opens a small
 * popup explaining the field in plain language, with a worked
 * example where one helps. Fixed-position panel (same pattern as
 * AiButton) so it is never clipped by a card's overflow.
 *
 * Hover behaviour (fixed in NOTES #34): the first version closed the
 * moment the mouse crossed the gap between the icon and the panel,
 * so the popup flashed and vanished. Now leaving the icon starts a
 * short grace timer instead of closing instantly; entering the
 * panel cancels it, leaving the panel closes, and clicking anywhere
 * else (or scrolling) closes too.
 */

interface FieldInfoProps {
  title: string;
  text: string;
}

export function FieldInfo({ title, text }: FieldInfoProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 300);
  };

  const openPanel = () => {
    cancelClose();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - 256, window.innerWidth - 264)),
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open ]);

  useEffect(() => cancelClose, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`What is ${title}?`}
        title={`What is ${title}?`}
        onMouseEnter={openPanel}
        onMouseLeave={scheduleClose}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-zinc-500 hover:text-amber-400 transition-colors shrink-0"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[79]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[80] w-[256px] rounded-xl bg-[#17171A] border border-white/15 shadow-2xl shadow-black/60 p-3 space-y-1.5"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={cancelClose}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-300 leading-snug">{title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-white shrink-0"
                aria-label="Close explanation"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-line">{text}</p>
          </div>
        </>
      )}
    </>
  );
}
