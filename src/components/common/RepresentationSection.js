import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { HandshakeIcon } from '../../utils/icons';
import { getAvatarClass } from '../../utils/roles';
import { toRepEntries, repEntryName } from '../../utils/representation';

// Who represents this artist.
//
// An artist can have several — often regional — agents, so a single sentence
// listing names doesn't work: it can only ever link to one of them, and it
// gives no sense of who each agent is. One slim row per agent (the mock-up):
// round avatar, name, agency and city.
//
// `profiles` is the hydrated `representedByProfiles` from GET /profiles/:id.
// `fallbackEntries` is the raw `representedBy` JSONB (name only), used when
// the hydrated list hasn't arrived yet so the section never flashes empty.
const RepresentationSection = ({ profiles, fallbackEntries, onOpenProfile }) => {
  const { t } = useLanguage();

  const cards = Array.isArray(profiles) ? profiles.filter((p) => p && p.id) : [];
  const entries = toRepEntries(fallbackEntries);

  if (cards.length === 0) {
    const names = entries.map(repEntryName).filter(Boolean);
    if (names.length === 0) return null;
    return (
      <div className="mb-5 text-left">
        <p className="poster-h2 flex items-center gap-1.5">
          <span className="inline-flex [&>svg]:w-3.5 [&>svg]:h-3.5"><HandshakeIcon /></span>
          {t('profile.representedByTitle')}
        </p>
        <p className="text-sm text-white/70">{names.join(', ')}</p>
      </div>
    );
  }

  return (
    <div className="d3-rep mb-5 text-left">
      <p className="poster-h2 flex items-center gap-1.5">
        <span className="inline-flex [&>svg]:w-3.5 [&>svg]:h-3.5"><HandshakeIcon /></span>
        {t('profile.representedByTitle')}
      </p>
      <div className="flex flex-col gap-2">
        {cards.map((p) => {
          const meta = [p.agencyName, p.city || p.location].filter(Boolean).join(' · ');
          return (
            <button key={p.id} type="button" className="rep-row" onClick={() => onOpenProfile && onOpenProfile(p)}>
              <span className={`rep-avatar ${getAvatarClass(p.role || 'AGENT')}`}>
                {p.avatar ? <img src={p.avatar} alt="" loading="lazy" /> : (p.name || '?').charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-white">{p.name}</span>
                {meta && <span className="block truncate text-[12px] text-white/50">{meta}</span>}
              </span>
              <span aria-hidden className="text-white/35">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RepresentationSection;
