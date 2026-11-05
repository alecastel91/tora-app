import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { roleLabel } from '../../utils/roles';
import VerifiedBadge from './VerifiedBadge';

/* A person as a photo: Search results, Matches and the roster all draw this.
   The whole card opens the profile; `actions` and `topRight` stay their own
   controls. `variant` sets the proportions: row (Search), match, tile (roster).
   No photo: the role colour and the initial, as on the profile page. */
const PhotoCard = ({ profile, variant = 'row', place, chip = null, note = null, topRight = null, actions = null, hideRole = false, dim = false, onOpen }) => {
  const { t } = useLanguage();
  const src = profile?.avatarLarge || profile?.avatar || null;
  const role = String(profile?.role || 'ARTIST').toUpperCase();
  const name = profile?.name || '';
  return (
    <article className={`photo-card photo-card--${variant} poster-role-${role.toLowerCase()}${src ? '' : ' poster-empty'}${dim ? ' is-dim' : ''}`}>
      {src
        ? <img src={src} alt="" loading="lazy" decoding="async" className="photo-card-img" />
        : <span aria-hidden className="photo-card-initial">{name.charAt(0).toUpperCase()}</span>}
      <div aria-hidden className="photo-card-fade" />
      <button type="button" className="photo-card-open" aria-label={name} onClick={onOpen} />
      {chip && <span className="photo-card-chip">{chip}</span>}
      {topRight && <div className="photo-card-top">{topRight}</div>}
      <div className="photo-card-foot">
        <div className="photo-card-id">
          <h3 className="photo-card-name">
            {name}
            {(profile?.verifyStatus === 'VERIFIED' || profile?.isVerified) && <VerifiedBadge size={18} className="photo-card-seal" channel={profile?.verifyChannel} />}
          </h3>
          <p className="photo-card-meta">
            {place}
            {!hideRole && <>{place ? ' · ' : ''}<span className="poster-role">{roleLabel(role, t)}</span></>}
          </p>
          {note && <p className="photo-card-note">{note}</p>}
        </div>
        {actions && <div className="photo-card-actions">{actions}</div>}
      </div>
    </article>
  );
};

export default PhotoCard;
