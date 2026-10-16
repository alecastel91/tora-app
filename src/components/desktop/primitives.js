import React from 'react';
import { getAvatarClass } from '../../utils/roles';
import { raProfileUrl } from '../../utils/urls';
import { RA_LOGO_WHITE } from '../../utils/brandAssets';
import { GlobeIcon, LinkIcon } from '../../utils/icons';

/* Small pieces shared by the desktop-v3 pages so a label, a panel or a stat
   looks the same on the profile, the own profile, the editor and the boards. */

export const fmtStat = (n) => {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(v);
};

export const Label = ({ children, className = '' }) => (
  <p className={`m-0 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 ${className}`}>{children}</p>
);

export const Section = ({ title, children, className = '' }) => (
  <section className={`min-w-0 ${className}`}>
    {title && <Label>{title}</Label>}
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

/** The profile's outbound links as {key, href, icon, label}, only the ones set. */
export const profileLinks = (p, t) => [
  p?.website && { key: 'web', href: p.website, icon: <GlobeIcon />, label: t('profile.officialWebsite') },
  p?.instagram && { key: 'ig', href: `https://instagram.com/${p.instagram.replace('@', '')}`, icon: <InstagramGlyph />, label: 'Instagram' },
  p?.residentAdvisor && { key: 'ra', href: raProfileUrl(p.residentAdvisor), icon: <img src={RA_LOGO_WHITE} alt="RA" className="h-auto w-[16px]" />, label: t('editProfile.residentAdvisorLabel') },
  p?.linkedin && { key: 'li', href: p.linkedin, icon: <LinkIcon />, label: 'LinkedIn' },
].filter(Boolean);
