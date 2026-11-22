import React, { useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/** How many genres lead a profile; the rest open from "+N". The order is the member's (Edit profile → Your genres). */
export const GENRE_SHOWN = 5;

/** A profile's genres as pills, the same on every profile view and the public page.
    `shown` sets how many lead before "+N". `fit` (the photo cards) keeps the
    closed row on one line: pills drop from the end until it fits. */
const GenrePills = ({ genres, shown = GENRE_SHOWN, fit = false, className = '' }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [fitted, setFitted] = useState(shown);
  const ref = useRef(null);
  const list = Array.isArray(genres) ? genres.filter(Boolean) : [];
  const key = list.join('|');
  const lead = fit ? Math.min(fitted, shown) : shown;

  // A new list or a resized card starts again from `shown`. The parent is
  // watched, not the row: the row's own width moves as pills drop.
  useLayoutEffect(() => {
    if (!fit) return undefined;
    setFitted(shown);
    const box = ref.current?.parentElement;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    let width = box.clientWidth;
    const ro = new ResizeObserver(() => {
      if (box.clientWidth !== width) { width = box.clientWidth; setFitted(shown); }
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit, shown, key]);

  // One pill fewer per pass while the closed row overflows; the last one stays.
  useLayoutEffect(() => {
    const el = ref.current;
    if (fit && !open && el && lead > 1 && el.scrollWidth > el.clientWidth + 1) setFitted(lead - 1);
  });

  if (!list.length) return null;
  const extra = list.length - lead;
  return (
    <ul ref={ref} className={`genre-pills${fit ? ' genre-pills--fit' : ''}${open ? ' is-open' : ''} ${className}`}>
      {(open ? list : list.slice(0, lead)).map((g) => <li key={g}>{g}</li>)}
      {(open || extra > 0) && (
        <li className="genre-pills-more">
          {/* Inside a photo card the click must not open the profile. */}
          <button type="button" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
            {open ? t('profile.seeLess') : `+${extra}`}
          </button>
        </li>
      )}
    </ul>
  );
};

export default GenrePills;
