import React, { useState, useEffect } from 'react';
import NotificationDropdown from './NotificationDropdown';
import { BellIcon, GearIcon, StarIcon } from '../../utils/icons';
import { useAppContext } from '../../contexts/AppContext';

const Header = ({ onOpenSettings, onOpenPremium, accountUser }) => {
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

  return (
    <header className="app-header">
      <div className="logo">
        <img src="/tora_logo.png" alt="TORA" className="logo-image" />
      </div>
      <div className="header-icons">
        <button 
          className="icon-btn notification-btn"
          onClick={handleNotificationClick}
        >
          <BellIcon />
          {hasNotificationDot && notifications?.length > 0 && (
            <span className="notification-dot" />
          )}
        </button>
        <button
          className={`icon-btn premium-btn ${
            user?.subscriptionTier === 'YEARLY' ? 'is-yearly' :
            user?.subscriptionTier === 'MONTHLY' ? 'is-monthly' :
            ''
          }`}
          onClick={handlePremiumClick}
        >
          <StarIcon />
        </button>
        <button 
          className="icon-btn settings-btn"
          onClick={handleSettingsClick}
        >
          <GearIcon />
        </button>
        {showNotifications && (
          <NotificationDropdown 
            onClose={() => setShowNotifications(false)}
            onClearNotifications={() => setHasNotificationDot(false)}
          />
        )}
      </div>
    </header>
  );
};

export default Header;