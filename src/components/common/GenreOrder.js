import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { GENRE_SHOWN } from './GenrePills';

/* "Your genres" in Edit profile: the picked genres in the order the profile
   shows them, dragged into place (the first GENRE_SHOWN lead the profile and
   the share image; a divider marks where the rest begin). Same drag rules as
   the photo grid: a mouse drags at once, a finger after a ~250ms long-press
   so a swipe still scrolls; release anywhere ends it. × removes a genre. */
const GenreOrder = ({ genres, onChange }) => {
  const { t } = useLanguage();
  const [dragging, setDragging] = useState(null);
  const from = useRef(null);
  const pending = useRef(null);
  const timer = useRef(null);
  const rowRef = useRef(null);
  const listRef = useRef(genres);
  listRef.current = genres;

  const begin = (index, target, pointerId) => {
    from.current = index;
    setDragging(index);
    try { target.setPointerCapture(pointerId); } catch { /* already released */ }
  };
  const end = () => {
    clearTimeout(timer.current);
    pending.current = null;
    from.current = null;
    setDragging(null);
  };

  const onPointerDown = (i) => (e) => {
    if (e.target.closest('button')) return; // the × button
    if (e.pointerType === 'touch') {
      pending.current = { index: i, x: e.clientX, y: e.clientY, target: e.currentTarget, pointerId: e.pointerId };
      timer.current = setTimeout(() => {
        const p = pending.current;
        pending.current = null;
        if (p) begin(p.index, p.target, p.pointerId);
      }, 250);
    } else {
      begin(i, e.currentTarget, e.pointerId);
    }
  };
  const onPointerMove = (e) => {
    if (pending.current) {
      if (Math.hypot(e.clientX - pending.current.x, e.clientY - pending.current.y) > 8) {
        clearTimeout(timer.current);
        pending.current = null;
      }
      return;
    }
    if (from.current === null) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { end(); return; }
    const chip = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-genre-idx]');
    const over = chip ? Number(chip.dataset.genreIdx) : NaN;
    if (Number.isNaN(over) || over === from.current) return;
    const next = [...listRef.current];
    const [moved] = next.splice(from.current, 1);
    next.splice(over, 0, moved);
    from.current = over;
    setDragging(over);
    onChange(next);
  };

  useEffect(() => {
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    const el = rowRef.current;
    const block = (e) => { if (from.current !== null) e.preventDefault(); };
    el?.addEventListener('touchmove', block, { passive: false });
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      el?.removeEventListener('touchmove', block);
    };
  }, []);

  if (!genres.length) return null;
  return (
    <div className="mb-3">
      <p className="m-0 mb-2 text-[10px] font-tech uppercase tracking-[0.15em] text-white/45">{t('editProfile.yourGenres')}</p>
      <div ref={rowRef} className="flex flex-wrap items-center gap-2" onPointerMove={onPointerMove}>
        {genres.map((g, i) => (
          <React.Fragment key={g}>
            {i === GENRE_SHOWN && <span aria-hidden className="h-6 w-px bg-white/25" />}
            <span
              data-genre-idx={i}
              onPointerDown={onPointerDown(i)}
              className={`flex select-none items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-[12px] touch-pan-y cursor-grab transition-colors ${
                dragging === i ? 'border-infrared bg-infrared/20 text-white' : i < GENRE_SHOWN ? 'border-infrared/50 bg-infrared/[0.08] text-white' : 'border-white/15 text-white/70'
              }`}
            >
              {g}
              <button type="button" aria-label={`${t('common.delete')} ${g}`} onClick={() => onChange(genres.filter((x) => x !== g))}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-[13px] leading-none text-white/50 hover:text-white">×</button>
            </span>
          </React.Fragment>
        ))}
      </div>
      {genres.length > 1 && (
        <p className="m-0 mt-2 text-[10px] text-white/35">{t('editProfile.genresOrderHint', { n: GENRE_SHOWN })}</p>
      )}
    </div>
  );
};

export default GenreOrder;
