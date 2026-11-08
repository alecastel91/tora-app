import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import BetaSheet from './BetaSheet';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const IS_BETA = import.meta.env.VITE_TORA_ENV === 'beta';

/**
 * Beta-only chrome: the round feedback button and the Tell Us form behind it —
 * the one thing beta shows that production does not. Renders nothing outside
 * beta (VITE_TORA_ENV !== 'beta'), so prod builds carry zero visual footprint.
 */
const BetaTools = () => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);

  // Commit SHA for silent feedback context — fetched once per session.
  useEffect(() => {
    if (!IS_BETA || window.__toraCommit) return;
    fetch(`${API_URL}/health`).then((r) => r.json())
      .then((h) => { window.__toraCommit = h.commit || null; })
      .catch(() => {});
  }, []);

  // Draggable FAB: hold and move to reposition (it was colliding with the
  // taller safe-area tab bar and the Search filters). Position persists.
  const fabRef = useRef(null);
  const dragMovedRef = useRef(false);
  const [fabPos, setFabPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tora-beta-fab-pos')) || null; }
    catch { return null; }
  });
  const lastPosRef = useRef(null);
  const onFabPointerDown = (e) => {
    const fab = fabRef.current;
    if (!fab) return;
    dragMovedRef.current = false;
    const rect = fab.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    const onMove = (ev) => {
      const x = Math.min(Math.max(4, ev.clientX - offX), window.innerWidth - rect.width - 4);
      const y = Math.min(Math.max(4, ev.clientY - offY), window.innerHeight - rect.height - 4);
      if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 6) {
        dragMovedRef.current = true;
        lastPosRef.current = { x, y };
        setFabPos(lastPosRef.current);
      }
    };
    // pointercancel matters on touch: an incoming call / gesture interrupt
    // would otherwise leave the move listener leaked and the FAB glued.
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      if (dragMovedRef.current && lastPosRef.current) {
        localStorage.setItem('tora-beta-fab-pos', JSON.stringify(lastPosRef.current));
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  if (!IS_BETA) return null;

  return (
    <>
      {!open && (
      <button
        type="button"
        className="beta-fab"
        ref={fabRef}
        style={fabPos ? {
          // Clamp to the CURRENT viewport — a position saved on desktop
          // could otherwise park the FAB off-screen on a phone, unrecoverable.
          left: Math.min(Math.max(4, fabPos.x), (typeof window !== 'undefined' ? window.innerWidth : 9999) - 52),
          top: Math.min(Math.max(4, fabPos.y), (typeof window !== 'undefined' ? window.innerHeight : 9999) - 52),
          right: 'auto', bottom: 'auto',
        } : undefined}
        onPointerDown={onFabPointerDown}
        onClick={() => { if (!dragMovedRef.current) setOpen(true); }}
        aria-label="Beta feedback"
      >
        {/* Same round icon button as the header's Questions entry: a speech
            cloud with three dots, the universal "tell us something". */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          <circle cx="8.2" cy="11.6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12.2" cy="11.6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="16.2" cy="11.6" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </button>
      )}

      <BetaSheet open={open} onClose={() => setOpen(false)} language={language} />
    </>
  );
};

export default BetaTools;
