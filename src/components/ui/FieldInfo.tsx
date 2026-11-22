'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

/**
 * FieldInfo — the small "i" beside a hard-to-understand field
 * (NOTES #32). Hover (desktop) or tap/click (touch) opens a small
 * popup explaining the field in plain language, with a worked
 * example where one helps. Fixed-position panel so it is never
 * clipped by a card's overflow.
 *
 * Hover history (NOTES #34 -> #35): v1 closed instantly because the
 * click-catcher backdrop's mouse-enter fired as the cursor crossed
 * the gap to the panel. v2 removed that handler but the backdrop
 * still COVERED the icon, so the icon immediately "lost" hover and
 * the grace timer closed the popup after ~300ms. v3 removes the
 * backdrop entirely: click-away is a document mousedown listener
 * that ignores clicks inside the panel or on the icon, and hover
 * uses a grace timer between icon and panel. Nothing invisible sits
 * between the cursor and the icon anymore.
 */

interface FieldInfoProps {
  title: string;
  text: string;
}

export function FieldInfo({ title, text }: FieldInfoProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
      const isBottomThird = rect.top > (window.innerHeight * 2) / 3;
      const left = Math.max(8, Math.min(rect.right - 256, window.innerWidth - 264));
      if (isBottomThird) {
        setPos({
          bottom: Math.max(8, window.innerHeight - rect.top + 6),
          left,
        });
      } else {
        setPos({
          top: rect.bottom + 6,
          left,
        });
      }
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`What is ${title}?`}
        onMouseEnter={openPanel}
        onMouseLeave={scheduleClose}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="inline-flex items-center justify-center p-2 -m-2 rounded-full text-zinc-500 hover:text-amber-400 transition-colors shrink-0"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[80] w-[256px] rounded-xl bg-[#17171A] border border-white/15 shadow-2xl shadow-black/60 p-3 space-y-1.5"
          style={{
            top: pos.top !== undefined ? `${pos.top}px` : undefined,
            bottom: pos.bottom !== undefined ? `${pos.bottom}px` : undefined,
            left: `${pos.left}px`,
          }}
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
      )}
    </>
  );
}
