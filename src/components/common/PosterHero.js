import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { roleLabel } from '../../utils/roles';
import VerifiedBadge from './VerifiedBadge';

/* The top of a profile, as designed in the public-pages mock-ups (2026-11):
   one photo fading into the page, then a small role · place eyebrow with the
   role dot, the name in normal case with the seal, one quiet line (pronouns ·
   genres), and whatever the caller adds below (liked-by line, link icons,
   the buttons). No photo: the role colour and the initial. Phone only; the
   desktop pages use PosterBanner. */
const metaLine = (profile) => [
  profile?.pronouns,
  Array.isArray(profile?.genres) && profile.genres.length ? profile.genres.slice(0, 3).join(', ') : null,
].filter(Boolean).join(' · ');

const placeOf = (profile) => profile?.location || [profile?.city, profile?.country].filter(Boolean).join(', ');

const PosterHero = ({ profile, own = false, top = null, actions = null, children = null }) => {
  const { t } = useLanguage();
  const src = profile?.avatarLarge || profile?.avatar || null;
  const role = profile?.role || 'ARTIST';
  const place = placeOf(profile) || (own ? t('profile.addLocation') : '');
  const meta = metaLine(profile);

  const photo = src
    ? <img src={src} alt={profile?.name || ''} className="ph-photo" style={profile?.avatarFocus ? { objectPosition: profile.avatarFocus } : undefined} />
    : <span aria-hidden className="ph-initial">{(profile?.name || '?').charAt(0).toUpperCase()}</span>;

  const identity = (
    <>
      <p className="ph-eyebrow"><span className="ph-dot" />{[roleLabel(role, t), place].filter(Boolean).join(' · ')}</p>
      <h1 className="ph-name">
        <span>{profile?.name || t('profile.yourName')}</span>
        {profile?.verifyStatus === 'VERIFIED' && <VerifiedBadge size={22} className="ph-seal" channel={profile?.verifyChannel} />}
      </h1>
      {meta && <p className="ph-meta">{meta}</p>}
      {children}
    </>
  );

  return (
    <div className={`ph ph-role-${role.toLowerCase()}`}>
      <div className={`ph-cover ${src ? '' : 'ph-empty'}`}>
        {photo}
        <div aria-hidden className="ph-fade" />
        {top && <div className="ph-top">{top}</div>}
      </div>
      <div className="ph-body">
        {identity}
        {actions}
      </div>
    </div>
  );
};

export default PosterHero;
