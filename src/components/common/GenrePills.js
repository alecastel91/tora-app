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
  const [width, setWidth] = useState(0);
  const ref = useRef(null);
  const list = Array.isArray(genres) ? genres.filter(Boolean) : [];
  const key = list.join('|');
  // Pills kept on the closed row, counted down while it overflows; 0 = one pill
  // that may shrink (ellipsis) so "+N" stays visible. A new list, `shown` or
  // card width starts again from `shown` (derived, no reset effect).
  const sig = `${shown}|${key}|${width}`;
  const [fitState, setFitState] = useState({ sig, n: shown });
  const fitted = fitState.sig === sig ? fitState.n : shown;
  const lead = fit ? Math.max(fitted, 1) : shown;

  // The parent is watched, not the row: the row's own width moves as pills drop.
  useLayoutEffect(() => {
    const box = ref.current?.parentElement;
    if (!fit || !box || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit, key]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (fit && !open && el && fitted > 0 && el.scrollWidth > el.clientWidth + 1) setFitState({ sig, n: fitted - 1 });
  }, [fit, open, sig, fitted]);

  if (!list.length) return null;
  const extra = list.length - lead;
  return (
    <ul ref={ref} className={`genre-pills${fit && fitted === 0 && !open ? ' is-tight' : ''}${open ? ' is-open' : ''} ${className}`}>
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
