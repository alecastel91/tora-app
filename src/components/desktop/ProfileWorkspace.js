import React from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDesktopStrings } from './strings';
import ProfileScreen from '../screens/ProfileScreen';
import { getAvatarClass, roleLabel } from '../../utils/roles';

/* Desktop v3 Profile: the phone profile in a reading column, with the
   network beside it — the people already in context (connections, who liked
   you, who you liked) as a rail instead of three counters to tap into. The
   rail disappears when ProfileScreen opens one of its own split panes. */

const People = ({ title, people, onOpen, t }) => (
  <section className="d3-panel px-2 pb-2 pt-3.5">
    <h2 className="mb-1 flex items-baseline justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
      {title}
      <span className="font-futuristic text-[13px] normal-case tracking-normal text-white/70">{people.length}</span>
    </h2>
    {people.length === 0 ? (
      <p className="px-2 py-3 text-[12px] text-white/30">—</p>
    ) : (
      <ul className="flex flex-col">
        {people.slice(0, 6).map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onOpen(p)}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold text-white ${getAvatarClass(p.role)}`}>
                {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : (p.name || '?').charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] text-white/90">{p.name}</span>
                <span className="block truncate text-[10.5px] text-white/40">{roleLabel(p.role, t)}{p.city ? ` · ${p.city}` : ''}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const ProfileWorkspace = ({ onOpenProfile, ...profileProps }) => {
  const { connectedUsersData, likerProfilesData, likedProfilesData } = useAppContext();
  const { t } = useLanguage();
  const td = useDesktopStrings();
  return (
    <div className="d3-profile">
      <div className="min-w-0"><ProfileScreen {...profileProps} /></div>
      <aside className="d3-rail-net flex flex-col gap-4">
        <p className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/35">{td('network')}</p>
        <People title={t('profile.connections')} people={connectedUsersData || []} onOpen={onOpenProfile} t={t} />
        <People title={t('viewProfile.likedBy')} people={likerProfilesData || []} onOpen={onOpenProfile} t={t} />
        <People title={t('profile.likes')} people={likedProfilesData || []} onOpen={onOpenProfile} t={t} />
      </aside>
    </div>
  );
};

export default ProfileWorkspace;
