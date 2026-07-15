import React, { useState, useEffect } from 'react';
import NotificationDropdown from './NotificationDropdown';
import { BellIcon, GearIcon, StarIcon } from '../../utils/icons';
import { useAppContext } from '../../contexts/AppContext';

const Header = ({ onOpenSettings, onOpenPremium, accountUser, onSwitchTab }) => {
  const { notifications, clearNotificationDot, user } = useAppContext();
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNotificationDot, setHasNotificationDot] = useState(true);

  useEffect(() => {
    // Reset notification dot when there are new notifications
    if (notifications && notifications.length > 0) {
      setHasNotificationDot(true);
    }
  }, [notifications]);

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    // Remove the dot when notifications are opened
    if (!showNotifications) {
      setHasNotificationDot(false);
      if (clearNotificationDot) {
        clearNotificationDot();
      }
    }
  };

  const handleSettingsClick = () => {
    if (onOpenSettings) {
      onOpenSettings();
    }
  };

  const handlePremiumClick = () => {
    if (onOpenPremium) {
      onOpenPremium();
    }
  };

  // Round glass icon button (Obsidian Neon). Base classes shared by all three.
  const iconBtnClasses = `relative w-9 h-9 rounded-full border border-white/10 bg-[#1a1a20]
                          flex items-center justify-center text-white cursor-pointer
                          transition-colors hover:border-infrared/40 hover:bg-white/[0.1]
                          [&>svg]:w-[18px] [&>svg]:h-[18px]`;

  // Premium star keeps its tier tint (gold = YEARLY, crimson = MONTHLY).
  const premiumTint =
    user?.subscriptionTier === 'YEARLY' ? 'text-[#FFD700] [&>svg]:fill-[#FFD700]' :
    user?.subscriptionTier === 'MONTHLY' ? 'text-infrared [&>svg]:fill-infrared' :
    '';

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
          className={`${iconBtnClasses} ${premiumTint}`}
          onClick={handlePremiumClick}
        >
          <StarIcon />
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