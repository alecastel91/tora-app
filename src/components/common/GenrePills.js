import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/** How many genres lead a profile; the rest open from "+N". The order is the member's (Edit profile → Your genres). */
export const GENRE_SHOWN = 5;

/** A profile's genres as pills, the same on every profile view and the public page. */
const GenrePills = ({ genres, className = '' }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const list = Array.isArray(genres) ? genres.filter(Boolean) : [];
  if (!list.length) return null;
  const extra = list.length - GENRE_SHOWN;
  return (
    <ul className={`genre-pills ${className}`}>
      {(open ? list : list.slice(0, GENRE_SHOWN)).map((g) => <li key={g}>{g}</li>)}
      {extra > 0 && (
        <li className="genre-pills-more">
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? t('profile.seeLess') : `+${extra}`}
          </button>
        </li>
      )}
    </ul>
  );
};

export default GenrePills;
