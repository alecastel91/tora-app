import React, { useState, useEffect } from 'react';
import NotificationDropdown from './NotificationDropdown';
import { BellIcon, GearIcon } from '../../utils/icons';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';

const Header = ({ onOpenSettings, onSwitchTab, activeTab }) => {
  const { notifications } = useAppContext();
  const { t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNotificationDot, setHasNotificationDot] = useState(true);

  useEffect(() => {
    // Reset notification dot when there are new notifications
    if (notifications && notifications.length > 0) {
      setHasNotificationDot(true);
    }
  }, [notifications]);

  // Close the notification dropdown whenever the user switches tabs/screens —
  // an open dropdown must not linger over unrelated content.
  useEffect(() => {
    setShowNotifications(false);
  }, [activeTab]);

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    // Remove the dot when notifications are opened
    if (!showNotifications) setHasNotificationDot(false);
  };

  const handleSettingsClick = () => {
    if (onOpenSettings) {
      onOpenSettings();
    }
  };

  // Round glass icon button (Obsidian Neon). Base classes shared by all.
  const iconBtnClasses = `relative w-9 h-9 rounded-full border border-white/10 bg-[#111117]
                          flex items-center justify-center text-white cursor-pointer
                          transition-colors hover:border-infrared/40 hover:bg-white/[0.1]
                          [&>svg]:w-[18px] [&>svg]:h-[18px]`;

  return (
    <header className="app-header sticky top-0 z-[100] flex items-center justify-between
                       px-4 py-2.5 bg-black/95 border-b border-white/10">
      <div className="logo flex items-center">
        <img src="/tora_logo.png" alt="TORA" className="h-6 w-auto block" />
      </div>
      <div className="header-icons relative flex gap-3">
        <button
          className={iconBtnClasses}
          onClick={handleNotificationClick}
        >
          <BellIcon />
          {hasNotificationDot && notifications?.length > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-infrared
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
            onClearNotifications={() => setHasNotificationDot(false)}
            onSwitchTab={onSwitchTab}
          />
        )}
      </div>
    </header>
  );
};

export default Header;