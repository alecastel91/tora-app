import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';

// Notification type → which tab to navigate to when the user clicks the row.
const TYPE_TO_TAB = {
  // Booking workflow
  OFFER_RECEIVED: 'bookings',
  COUNTER_OFFER: 'bookings',
  BOOKING_ACCEPTED: 'bookings',
  BOOKING_DECLINED: 'bookings',
  CONTRACT_SENT: 'bookings',
  CONTRACT_SIGNED: 'bookings',
  CONTRACT_FULLY_SIGNED: 'bookings',
  CONTRACT_WITHDRAWN: 'bookings',
  DOCUMENT_SHARED: 'bookings',
  PAYMENT_RECEIVED: 'bookings',
  // Connections / messaging
  CONNECTION_REQUEST: 'messages',
  CONNECTION_ACCEPTED: 'messages',
  REPRESENTATION_REQUEST: 'messages',
  REPRESENTATION_ACCEPTED: 'messages',
  NEW_MESSAGE: 'messages',
};

const NotificationDropdown = ({ onClose, onClearNotifications, onSwitchTab }) => {
  const { t } = useLanguage();
  const { notifications } = useAppContext();

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('notifications.justNow') || 'Just now';
    if (diffMins < 60) return `${diffMins} ${t('notifications.minAgo')}`;
    if (diffHours < 24) return `${diffHours} ${t('notifications.hourAgo')}`;
    return t('notifications.daysAgo', { n: diffDays });
  };

  const handleNotificationClick = (notif) => {
    const tab = TYPE_TO_TAB[notif.type];
    if (tab && onSwitchTab) {
      onSwitchTab(tab);
    }
    if (onClose) onClose();
  };

  return (
    <div className="notifications-dropdown">
      <div className="notifications-header">
        <span>{t('notifications.title')}</span>
        <button onClick={onClearNotifications}>{t('notifications.clearAll')}</button>
      </div>
      <div className="notifications-list">
        {notifications && notifications.length > 0 ? (
          notifications.map((notif) => {
            const routable = !!TYPE_TO_TAB[notif.type];
            return (
              <div
                key={notif.id}
                className="notification-item"
                onClick={() => handleNotificationClick(notif)}
                style={{ cursor: routable ? 'pointer' : 'default' }}
                role={routable ? 'button' : undefined}
                tabIndex={routable ? 0 : undefined}
                onKeyDown={(e) => { if (routable && (e.key === 'Enter' || e.key === ' ')) handleNotificationClick(notif); }}
              >
                <p>{notif.message || notif.text}</p>
                <span className="notification-time">{getTimeAgo(notif.createdAt || notif.timestamp)}</span>
              </div>
            );
          })
        ) : (
          <div className="notification-item empty">
            <p>{t('notifications.noNotifications') || 'No notifications'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
