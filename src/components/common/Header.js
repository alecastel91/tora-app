import React, { useState, useEffect, useRef } from 'react';
import NotificationDropdown from './NotificationDropdown';
import { BellIcon, GearIcon } from '../../utils/icons';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { isDesktopV2, useNativeDesktop } from '../../utils/desktopV2';

const Header = ({ onOpenSettings, onSwitchTab, activeTab }) => {
  const { notifications, markNotificationsRead } = useAppContext();
  const { t } = useLanguage();
  // v3 + desktop-sized: the only case the ⌘K pill exists at all (not hidden — absent)
  const nativeDesktop = useNativeDesktop();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadIds = (notifications || []).filter((n) => !n.isRead).map((n) => n.id);
  // What was unread when the bell opened: highlighted while it stays open,
  // marked read once it closes (however it closes), so a glance is enough
  // but nothing goes grey before it has been seen.
  const [freshIds, setFreshIds] = useState([]);
  const freshRef = useRef([]);

  useEffect(() => {
    if (showNotifications) return;
    if (freshRef.current.length) markNotificationsRead(freshRef.current);
    freshRef.current = [];
    setFreshIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifications]);

  // Close the notification dropdown whenever the user switches tabs/screens —
  // an open dropdown must not linger over unrelated content.
  useEffect(() => {
    setShowNotifications(false);
  }, [activeTab]);

  // Escape closes the dropdown, like any other transient surface.
  useEffect(() => {
    if (!showNotifications) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowNotifications(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showNotifications]);

  const handleNotificationClick = () => {
    if (!showNotifications) {
      freshRef.current = unreadIds;
      setFreshIds(unreadIds);
    }
    setShowNotifications(!showNotifications);
  };

  const markAllRead = () => {
    freshRef.current = [];
    setFreshIds([]);
    markNotificationsRead();
  };

  const handleSettingsClick = () => {
    if (onOpenSettings) {
      onOpenSettings();
    }
  };

  // Round glass icon button (Obsidian Neon). Base classes shared by all.
  const iconBtnClasses = `relative w-9 h-9 border-0 bg-transparent p-0
                          flex items-center justify-center text-white cursor-pointer
                          transition-colors hover:text-infrared
                          [&>svg]:w-[20px] [&>svg]:h-[20px]`;

  return (
    <header className="app-header sticky top-0 z-[100] flex items-center justify-between
                       px-4 py-2.5 bg-black/95 border-b border-white/10">
      <div className="logo flex items-center">
        <img src="/tora_logo_white.png" alt="TORA" className="h-6 w-auto block" />
      </div>
      {/* Desktop v2: the brand lives in the sidebar, so the bar carries the
          page instead of a hidden logo. Reuses the existing nav.* keys. */}
      {isDesktopV2() && (
        <div className="d2-page-title desktop-only">{activeTab === 'home' ? t('desktop.home') : t(`nav.${activeTab}`)}</div>
      )}
      <div className="header-icons relative flex gap-3">
        {/* Desktop v3: jump anywhere. The palette listens for this event. */}
        {nativeDesktop && (
          <button
            className="d3-k"
            onClick={() => window.dispatchEvent(new CustomEvent('tora:open-palette'))}
          >
            <span>{t('desktop.jumpTo')}</span>
            <kbd>⌘K</kbd>
          </button>
        )}
        <button
          className={iconBtnClasses}
          onClick={handleNotificationClick}
        >
          <BellIcon />
          {unreadIds.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-infrared
                             shadow-[0_0_6px_rgba(255,51,102,0.7)]" />
          )}
        </button>
        <button
          className={iconBtnClasses}
          aria-label={t('guide.title')}
          onClick={() => window.dispatchEvent(new CustomEvent('tora:open-guide'))}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            <path d="M9.5 9a2.5 2.5 0 0 1 4.86.82c0 1.67-2.5 2.5-2.5 2.5" />
            <circle cx="11.9" cy="15.5" r="0.4" fill="currentColor" />
          </svg>
        </button>
        <button
          className={iconBtnClasses}
          onClick={handleSettingsClick}
        >
          <GearIcon />
        </button>
        {showNotifications && (
          <NotificationDropdown
            onClose={() => setShowNotifications(false)}
            freshIds={freshIds}
            onMarkAllRead={markAllRead}
            onSwitchTab={onSwitchTab}
          />
        )}
      </div>
    </header>
  );
};

export default Header;