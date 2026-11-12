import React from 'react';
import { getAvatarClass } from '../../utils/roles';
import { raProfileUrl, safeHttpUrl } from '../../utils/urls';
import { RA_LOGO_WHITE } from '../../utils/brandAssets';
import { GlobeIcon, LinkIcon } from '../../utils/icons';
import { SectionTitle } from '../common/ArtistMedia';

/* Small pieces shared by the desktop-v3 pages so a label, a panel or a stat
   looks the same on the profile, the own profile, the editor and the boards. */

export const fmtStat = (n) => {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(v);
};

export const Label = ({ children, className = '' }) => (
  <p className={`m-0 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 ${className}`}>{children}</p>
);

export const Section = ({ title, onAdd, children, className = '' }) => (
  <section className={`min-w-0 ${className}`}>
    {title && (onAdd ? <SectionTitle title={title} onAdd={onAdd} /> : <h2 className="poster-h2">{title}</h2>)}
    {children}
  </section>
);

export const Panel = ({ title, action, children, className = '' }) => (
  <section className={`d3-panel px-4 pb-4 pt-3.5 ${className}`}>
    {(title || action) && (
      <div className="mb-2 flex items-baseline justify-between gap-3">
        {title && <Label className="mb-0">{title}</Label>}
        {action}
      </div>
    )}
    {children}
  </section>
);

export const Stat = ({ value, label, onClick }) => {
  const inner = (
    <>
      <span className="block font-futuristic text-[20px] font-semibold leading-none tracking-tight text-white">{value}</span>
      <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</span>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="cursor-pointer rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.04]">{inner}</button>
  ) : (
    <div className="px-3 py-2">{inner}</div>
  );
};

/** Round avatar with the role gradient behind the initial. Size and text size come from className. */
export const Avatar = ({ profile, className = 'h-9 w-9 text-[13px]', alt = '' }) => (
  <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${getAvatarClass(profile?.role)} ${className}`}>
    {profile?.avatar
      ? <img src={profile.avatar} alt={alt} className="h-full w-full object-cover" />
      : (profile?.name || '?').charAt(0).toUpperCase()}
  </span>
);

export const InstagramGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

// Brand marks from Simple Icons (CC0).
const SoundCloudGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z" /></svg>
);

const BandcampGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z" /></svg>
);

const SpotifyGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg>
);

/** The profile's outbound links as {key, href, icon, label}, only the ones set. */
export const profileLinks = (p, t) => [
  p?.website && { key: 'web', href: p.website, icon: <GlobeIcon />, label: t('profile.officialWebsite') },
  p?.instagram && { key: 'ig', href: `https://instagram.com/${p.instagram.replace('@', '')}`, icon: <InstagramGlyph />, label: 'Instagram' },
  p?.residentAdvisor && { key: 'ra', href: raProfileUrl(p.residentAdvisor), icon: <img src={RA_LOGO_WHITE} alt="RA" className="h-auto w-[16px]" />, label: t('editProfile.residentAdvisorLabel') },
  p?.linkedin && { key: 'li', href: p.linkedin, icon: <LinkIcon />, label: 'LinkedIn' },
  safeHttpUrl(p?.soundcloud) && { key: 'sc', href: safeHttpUrl(p.soundcloud), icon: <SoundCloudGlyph />, label: 'SoundCloud' },
  safeHttpUrl(p?.bandcamp) && { key: 'bc', href: safeHttpUrl(p.bandcamp), icon: <BandcampGlyph />, label: 'Bandcamp' },
  safeHttpUrl(p?.spotify) && { key: 'sp', href: safeHttpUrl(p.spotify), icon: <SpotifyGlyph />, label: 'Spotify' },
].filter(Boolean);
