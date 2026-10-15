import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAvatarClass, roleLabel } from '../../utils/roles';
import { LocationIcon } from '../../utils/icons';
import SettingsNav from './SettingsNav';
import { useDesktopStrings } from './strings';

/* Desktop v3 editor chrome around the existing Edit Profile form: a sticky
   header with the title and the Cancel / Save actions, a section index on
   the left, and a live preview on the right of how the card will read. The
   form fields in between are EditProfileScreen's own — not re-implemented. */

export const EditHeader = ({ title, onCancel, onSave, saving, blocked }) => {
  const { t } = useLanguage();
  return (
    <header className="d3-edit-head d3-subhead">
      <button type="button" className="back-btn" onClick={onCancel} aria-label={t('common.close')} disabled={saving}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
      <h1 className="m-0 flex-1 font-futuristic text-[22px] font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-2">
        <button className="btn btn-outline" onClick={onCancel} disabled={saving}>{t('editProfile.cancel')}</button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving || blocked}>
          {saving ? t('editProfile.saving') : t('editProfile.saveChanges')}
        </button>
      </div>
    </header>
  );
};

export const EditIndex = () => (
  <SettingsNav root=".d3-edit" sections=".edit-profile-content > .edit-section" observeIn={null} className="d3-edit-nav" />
);

export const EditPreview = ({ draft, genres, photos }) => {
  const { t } = useLanguage();
  const td = useDesktopStrings();
  const role = draft?.role;
  const location = [draft?.city, draft?.country].filter(Boolean).join(', ') || draft?.location;
  const tone = { ARTIST: 'border-[#667EEA]/50 text-[#667EEA]', VENUE: 'border-[#F5576C]/50 text-[#F5576C]', PROMOTER: 'border-[#FFC107]/50 text-[#FFC107]', AGENT: 'border-[#43E97B]/50 text-[#43E97B]' }[role] || 'border-white/30 text-white/70';
  const links = ['website', 'instagram', 'residentAdvisor', 'linkedin', 'mixtape', 'spotify'].filter((k) => draft?.[k]).length;
  return (
    <aside className="d3-edit-preview">
      <p className="m-0 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/35">{td('preview')}</p>
      <div className="d3-panel overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-semibold text-white ${getAvatarClass(role)}`}>
            {draft?.avatar ? <img src={draft.avatar} alt="" className="h-full w-full object-cover" /> : (draft?.name || '?').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-futuristic text-[16px] font-semibold text-white">{draft?.name || t('profile.yourName')}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-white/55">
              <span className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] ${tone}`}>{roleLabel(role, t)}</span>
              {location && <span className="inline-flex items-center gap-1 [&>svg]:h-3 [&>svg]:w-3"><LocationIcon />{location}</span>}
            </span>
          </span>
        </div>
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1 px-4 pt-3">
            {genres.slice(0, 8).map((g) => <span key={g} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9.5px] uppercase tracking-[0.1em] text-white/60">{g}</span>)}
            {genres.length > 8 && <span className="px-1 text-[10px] text-white/35">+{genres.length - 8}</span>}
          </div>
        )}
        {draft?.bio && <p className="m-0 line-clamp-4 px-4 pt-3 text-[12.5px] leading-relaxed text-white/60">{draft.bio}</p>}
        {Array.isArray(photos) && photos.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-px bg-white/[0.06]">
            {photos.slice(0, 4).map((p) => <img key={p} src={p} alt="" className="aspect-square w-full object-cover" />)}
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 text-[10.5px] uppercase tracking-[0.12em] text-white/35">
          <span>{t('profile.links')} · {links}</span>
          {draft?.venueCapacity && <span>{t('profile.capacity')} {Number(draft.venueCapacity).toLocaleString()}</span>}
        </div>
      </div>
    </aside>
  );
};
