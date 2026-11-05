import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import InlineDrawer from './InlineDrawer';

export const RA_URL_RE = /^https:\/\/(www\.)?(ra\.co|residentadvisor\.net)\//i;

// Official Resident Advisor monogram as an inline vector path (traced from
// the brand asset), filled via currentColor on a fully transparent
// background — the letter notches are real path topology, so whatever sits
// behind shows through instead of reading as a dark box.
const RAMark = () => (
  <svg width="19" height="9" viewBox="0 0 120 57" aria-hidden="true" className="block">
    <path
      d="M0 0L0 35L34 36L52 55L56 57L109 56L120 45L120 41L89 11L86 6L75 17L100 41L100 43L62 43L58 41L39 22L14 21L14 14L39 14L47 18L51 24L58 31L60 31L69 22L69 20L52 4L42 0Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

// Past-highlights dot-rows shared by ProfileScreen/ViewProfileScreen: shows
// three rows, the rest expand inline (same drawer pattern as the galleries
// and network strips) with a "See more"/"See less" toggle. Entries with a
// Resident Advisor link get the RA mark, opening the event page.
const HighlightsList = ({ highlights }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const list = Array.isArray(highlights) ? highlights : [];
  if (list.length === 0) return null;

  const extras = list.slice(3);

  const row = (h, i) => (
    <div key={i} className="poster-row">
      <span className="flex-1 text-sm text-white min-w-0">
        {h.venue}
        {(h.artist || h.city) && (
          <span className="text-white/40"> · {[h.artist, h.city].filter(Boolean).join(' · ')}</span>
        )}
      </span>
      {h.raUrl && RA_URL_RE.test(h.raUrl) && (
        <a
          href={h.raUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Resident Advisor"
          className="shrink-0 flex items-center text-white/60 hover:text-white transition-colors"
        >
          <RAMark />
        </a>
      )}
      {h.year && <span className="text-[11px] text-white/40 font-tech shrink-0">{h.year}</span>}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col">
        {list.slice(0, 3).map(row)}
      </div>
      {extras.length > 0 && (
        <InlineDrawer expanded={expanded} className="flex flex-col gap-2 pt-2">
          {extras.map((h, j) => row(h, j + 3))}
        </InlineDrawer>
      )}
      {extras.length > 0 && (
        <button
          type="button"
          className="mt-2 bg-transparent border-none p-0 text-infrared text-xs cursor-pointer hover:underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t('profile.seeLess') : t('profile.seeMore')}
        </button>
      )}
    </div>
  );
};

export default HighlightsList;
