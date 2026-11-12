import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { profileLinks } from '../desktop/primitives';

/* The profile's links as a row of small square icons under the name (the
   mock-up layout). On your own profile a dashed "+" opens Edit profile. */
const LinkIcons = ({ profile, onAdd }) => {
  const { t } = useLanguage();
  const links = profileLinks(profile, t);
  if (!links.length && !onAdd) return null;
  return (
    <div className="ph-links">
      {links.map((l) => (
        <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label} className="ph-link">
          {l.icon}
        </a>
      ))}
      {onAdd && (
        <button type="button" onClick={onAdd} aria-label={t('artistPage.addLink')} title={t('artistPage.addLink')} className="ph-link ph-link-add">+</button>
      )}
    </div>
  );
};

export default LinkIcons;
