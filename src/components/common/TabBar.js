import React from 'react';
import { ProfileIcon, SearchIcon, BookingsIcon, MessageIcon, PlaneIcon, NewsIcon } from '../../utils/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import CountBadge from './CountBadge';
import { useDesktopStrings } from '../desktop/strings';
import { useAppContext } from '../../contexts/AppContext';
import { getAvatarClass, roleLabel } from '../../utils/roles';

// Desktop v3 dashboard glyph — lives here rather than in utils/icons because
// no other surface has a home tab.
const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="8" height="10" rx="1.5" />
    <rect x="13" y="3" width="8" height="6" rx="1.5" />
    <rect x="13" y="11" width="8" height="10" rx="1.5" />
    <rect x="3" y="15" width="8" height="6" rx="1.5" />
  </svg>
);

// homeTab — desktop v3 only (App.js passes useNativeDesktop()): a Dashboard
// entry leads the list. Never true on the phone.
const TabBar = ({ activeTab, onTabChange, unreadMessagesCount = 0, unreadProposalsCount = 0, bookingsHasDot = false, homeTab = false }) => {
  const { t } = useLanguage();
  const td = useDesktopStrings();
  const { user } = useAppContext();

  const tabs = [
    ...(homeTab ? [{ id: 'home', icon: DashboardIcon, label: td('home') }] : []),
    // Feed first, profile last — the order thumbs already know from
    // Instagram/LinkedIn/X; the two work tabs sit under the right thumb.
    { id: 'news', icon: NewsIcon, label: t('nav.news') },
    { id: 'search', icon: SearchIcon, label: t('nav.search') },
    { id: 'tour', icon: PlaneIcon, label: t('nav.tour') },
    { id: 'bookings', icon: BookingsIcon, label: t('nav.bookings') },
    { id: 'messages', icon: MessageIcon, label: t('nav.messages') },
    { id: 'profile', icon: ProfileIcon, label: t('nav.profile') }
  ];

  return (
    // .tab-bar / .tab-item / .active stay as hooks for responsive.css's desktop sidebar layout.
    // -translate-x-1/2 scoped to <lg: it compiles to the `translate` property, which the
    // desktop sidebar override in responsive.css (transform: none) cannot reset.
    <nav className="tab-bar fixed max-lg:bottom-0 max-lg:left-1/2 max-lg:-translate-x-1/2 max-lg:w-full max-lg:max-w-[428px] z-[100]
                    flex max-lg:justify-around pt-1.5 pb-[env(safe-area-inset-bottom,0.375rem)]
                    bg-black/95 max-lg:border-t border-white/10">
      {/* desktop sidebar brand — hidden on mobile via responsive.css */}
      <div className="sidebar-brand desktop-only">
        <img src="/tora_logo.png" alt="TORA" />
      </div>
      {tabs.map(tab => {
        const Icon = tab.icon;
        const showMessagesBadge = tab.id === 'messages' && unreadMessagesCount > 0;
        const showTourBadge = tab.id === 'tour' && unreadProposalsCount > 0;
        const showBookingsDot = tab.id === 'bookings' && bookingsHasDot;
        const badgeCount = tab.id === 'messages' ? unreadMessagesCount : unreadProposalsCount;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`tab-item ${isActive ? 'active' : ''} flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5
                        text-[8px] font-semibold uppercase tracking-[0.1em] font-tech cursor-pointer
                        transition-colors ${isActive
                          ? 'text-infrared [&_svg]:drop-shadow-[0_0_6px_rgba(255,51,102,0.6)]'
                          : 'text-white/40 hover:text-white/70'}`}
            onClick={() => onTabChange(tab.id)}
          >
            {/* Desktop v3: the Profile entry is a chip — who you are, at the
                foot of the sidebar. Everything else renders as before. */}
            {homeTab && tab.id === 'profile' && user ? (
              <span className="d3-chip flex w-full items-center gap-2.5 text-left">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[12px] font-semibold text-white ${getAvatarClass(user.role)}`}>
                  {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : (user.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{user.name}</span>
                  <span className="block truncate text-[11px] text-white/45">{roleLabel(user.role, t)}</span>
                </span>
              </span>
            ) : (
            <div className="relative flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5">
              <Icon />
              {(showMessagesBadge || showTourBadge) && (
                <CountBadge count={badgeCount} className="absolute -top-1 -right-2" />
              )}
              {showBookingsDot && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-infrared
                                 shadow-[0_0_6px_rgba(255,51,102,0.7)]" />
              )}
            </div>
            )}
            {!(homeTab && tab.id === 'profile' && user) && <span>{tab.label}</span>}
          </button>
        );
      })}
    </nav>
  );
};

export default TabBar;