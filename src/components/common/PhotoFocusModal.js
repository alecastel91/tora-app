import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';

/* Where the profile photo is anchored when a frame crops it (the phone
   header, the desktop banner, search cards). The member taps or drags on the
   whole photo; the two previews show the result live. Saves "x% y%", which
   the photo elements use as their object-position. */
export const DEFAULT_FOCUS = '50% 22%';

/** Crosshair glyph for the "Position photo" control. */
export const FocusIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </svg>
);

const parseFocus = (v) => {
  const m = /^(\d{1,3})% (\d{1,3})%$/.exec(v || '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 50, y: 22 };
};

const PhotoFocusModal = ({ open, src, focus, onCancel, onSave }) => {
  const { t } = useLanguage();
  const [point, setPoint] = useState(parseFocus(focus));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (open) { setPoint(parseFocus(focus)); setError(null); }
  }, [open, focus]);

  if (!open || !src) return null;

  const position = `${point.x}% ${point.y}%`;
  const moveTo = (e) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100)));
    setPoint({ x, y });
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(position);
    } catch (err) {
      setError(err?.message || t('profile.uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 p-5" onClick={onCancel}>
      <div className="photo-focus w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#131315] p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="m-0 text-center font-space-grotesk text-[13px] font-semibold uppercase tracking-[0.08em] text-white">{t('profile.positionPhoto')}</h3>
        <p className="m-0 mt-1.5 mb-4 text-center text-[12px] text-white/50">{t('profile.positionPhotoHint')}</p>

        <div className="flex flex-wrap items-start justify-center gap-4">
          {/* the whole photo: tap or drag to choose the point that stays in frame */}
          <div
            ref={boxRef}
            className="photo-focus-source"
            onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); moveTo(e); }}
            onPointerMove={(e) => { if (dragging.current) moveTo(e); }}
            onPointerUp={() => { dragging.current = false; }}
          >
            <img src={src} alt="" draggable={false} />
            <span className="photo-focus-dot" style={{ left: `${point.x}%`, top: `${point.y}%` }} />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p className="m-0 mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">{t('profile.previewPhone')}</p>
              <div className="photo-focus-preview photo-focus-phone"><img src={src} alt="" style={{ objectPosition: position }} /></div>
            </div>
            <div>
              <p className="m-0 mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">{t('profile.previewDesktop')}</p>
              <div className="photo-focus-preview photo-focus-desk"><img src={src} alt="" style={{ objectPosition: position }} /></div>
            </div>
          </div>
        </div>

        {error && <p className="m-0 mt-3 text-center text-[12px] text-infrared">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>{t('editProfile.cancel')}</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '...' : t('editProfile.save')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PhotoFocusModal;
