import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { HandshakeIcon } from '../../utils/icons';
import ProfileMiniGrid from './ProfileMiniGrid';
import { toRepEntries, repEntryName } from '../../utils/representation';

// Who represents this artist.
//
// An artist can have several — often regional — agents, so a single sentence
// listing names doesn't work: it can only ever link to one of them, and it
// gives no sense of who each agent is. Cards address every agent individually
// and match the network strips elsewhere on the profile.
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
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-tech mb-2.5 flex items-center gap-1.5">
          <span className="inline-flex [&>svg]:w-3.5 [&>svg]:h-3.5"><HandshakeIcon /></span>
          {t('profile.representedByTitle')}
        </p>
        <p className="text-sm text-white/70">{names.join(', ')}</p>
      </div>
    );
  }

  return (
    <div className="d3-rep mb-5 text-left">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-tech mb-2.5 flex items-center gap-1.5">
        <span className="inline-flex [&>svg]:w-3.5 [&>svg]:h-3.5"><HandshakeIcon /></span>
        {t('profile.representedByTitle')}
      </p>
      <ProfileMiniGrid profiles={cards} onOpenProfile={onOpenProfile} />
    </div>
  );
};

export default RepresentationSection;
