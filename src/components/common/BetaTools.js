import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import BetaSheet from './BetaSheet';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const IS_BETA = import.meta.env.VITE_TORA_ENV === 'beta';

/**
 * Beta-only chrome: the BETA speech bubble and the Tell Us form behind it —
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
      <button
        type="button"
        className="beta-fab"
        ref={fabRef}
        style={fabPos ? {
          // Clamp to the CURRENT viewport — a position saved on desktop
          // could otherwise park the FAB off-screen on a phone, unrecoverable.
          left: Math.min(Math.max(4, fabPos.x), (typeof window !== 'undefined' ? window.innerWidth : 9999) - 72),
          top: Math.min(Math.max(4, fabPos.y), (typeof window !== 'undefined' ? window.innerHeight : 9999) - 48),
          right: 'auto', bottom: 'auto',
        } : undefined}
        onPointerDown={onFabPointerDown}
        onClick={() => { if (!dragMovedRef.current) setOpen(true); }}
        aria-label="Beta feedback"
      >
        {/* Comic-book speech bubble: tail bottom-left, the word inside. */}
        <svg className="beta-fab-bubble" viewBox="0 0 64 44" aria-hidden="true">
          <path d="M14 2h36a12 12 0 0 1 12 12v8a12 12 0 0 1-12 12H24l-12 8 2-8a12 12 0 0 1-12-12v-8A12 12 0 0 1 14 2z" />
        </svg>
        <span className="beta-fab-label">BETA</span>
      </button>

      <BetaSheet open={open} onClose={() => setOpen(false)} language={language} />
    </>
  );
};

export default BetaTools;
