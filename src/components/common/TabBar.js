import React from 'react';
import { ProfileIcon, SearchIcon, BookingsIcon, MessageIcon, PlaneIcon, NewsIcon } from '../../utils/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import CountBadge from './CountBadge';

const TabBar = ({ activeTab, onTabChange, unreadMessagesCount = 0, unreadProposalsCount = 0 }) => {
  const { t } = useLanguage();

  const tabs = [
    { id: 'profile', icon: ProfileIcon, label: t('nav.profile') },
    { id: 'search', icon: SearchIcon, label: t('nav.search') },
    { id: 'news', icon: NewsIcon, label: t('nav.news') },
    { id: 'tour', icon: PlaneIcon, label: t('nav.tour') },
    { id: 'bookings', icon: BookingsIcon, label: t('nav.bookings') },
    { id: 'messages', icon: MessageIcon, label: t('nav.messages') }
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
            <div className="relative flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5">
              <Icon />
              {(showMessagesBadge || showTourBadge) && (
                <CountBadge count={badgeCount} className="absolute -top-1 -right-2" />
              )}
            </div>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default TabBar;