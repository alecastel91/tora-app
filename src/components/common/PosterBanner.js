import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { roleLabel } from '../../utils/roles';
import VerifiedBadge from './VerifiedBadge';

/* The top of a profile: one photo, big uppercase name, fading into the page.
   Uses the large upload when there is one, else the small avatar. A tall photo
   covers the whole hero; a square one or a logo fills the width and fades, so
   nothing important is cropped. No photo: the role colour and the initial.
   `wide` is the desktop banner, where tall photos sit on the right over a
   blurred copy of themselves because stretching one would cut the face. */
const PosterBanner = ({ profile, own = false, wide = false, top = null, actions = null, children = null }) => {
  const { t } = useLanguage();
  const [shape, setShape] = useState(null); // tall | square | landscape
  const src = profile?.avatarLarge || profile?.avatar || null;
  const role = profile?.role || 'ARTIST';

  const onLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (!w || !h) return;
    const ratio = w / h;
    setShape(ratio > 1.15 ? 'landscape' : ratio >= 0.9 ? 'square' : 'tall');
  };

  return (
    <div className={`poster-hero poster-role-${role.toLowerCase()} ${wide ? 'poster-wide' : ''} ${src ? `poster-${shape || 'tall'}` : 'poster-empty'}`}>
      {src ? (
        <>
          {wide && shape !== 'landscape' && <img src={src} alt="" aria-hidden className="poster-backdrop" />}
          <img src={src} alt={profile?.name || ''} className="poster-photo" onLoad={onLoad} style={profile?.avatarFocus ? { objectPosition: profile.avatarFocus } : undefined} />
        </>
      ) : (
        <span aria-hidden className="poster-initial">{(profile?.name || '?').charAt(0).toUpperCase()}</span>
      )}
      <div aria-hidden className="poster-fade" />
      {top && <div className="poster-top">{top}</div>}
      <div className="poster-body">
        <div className="poster-identity">
          <h1 className="poster-name">
            {profile?.name || t('profile.yourName')}
            {profile?.verifyStatus === 'VERIFIED' && <VerifiedBadge size={wide ? 26 : 20} className="poster-seal" channel={profile?.verifyChannel} />}
          </h1>
          <div className="poster-meta">
            <span>{profile?.location || (own ? t('profile.addLocation') : '')}</span>
            <span className="poster-role">{roleLabel(role, t)}</span>
          </div>
          {children}
        </div>
        {actions}
      </div>
    </div>
  );
};

export default PosterBanner;
