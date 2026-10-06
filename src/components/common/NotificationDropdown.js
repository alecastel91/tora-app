import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { renderNotificationText } from '../../utils/notificationText';
import { useAppContext } from '../../contexts/AppContext';

// Notification type → which tab to navigate to when the user clicks the row.
// Types whose target sits on a sub-tab, not the tab's default view. Without
// this a vouch request lands on the conversation list, where it does not
// appear at all — there is no chat thread for it.
const TYPE_TO_SUBTAB = {
  VERIFICATION_VOUCH_REQUEST: 'requests',
  CONNECTION_REQUEST: 'requests',
  REPRESENTATION_REQUEST: 'requests',
};

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
  DEAL_COMPLETED: 'bookings',
  DEAL_CANCELLED: 'bookings',
  // Event-venue consent (a promoter tagged your venue for their event)
  VENUE_EVENT_REQUEST: 'bookings',
  VENUE_EVENT_CONFIRMED: 'bookings',
  VENUE_EVENT_DECLINED: 'bookings',
  // Verification: an agency asking this artist to confirm they know them, and
  // the outcomes on the agency's own side. All answered from the Requests tab.
  VERIFICATION_VOUCH_REQUEST: 'messages',
  VERIFICATION_APPROVED: 'profile',
  VERIFICATION_REJECTED: 'profile',
  VERIFICATION_REVOKED: 'profile',
  // Connections / messaging
  CONNECTION_REQUEST: 'messages',
  CONNECTION_ACCEPTED: 'messages',
  REPRESENTATION_REQUEST: 'messages',
  REPRESENTATION_ACCEPTED: 'messages',
  NEW_MESSAGE: 'messages',
  // Yearly travel alerts: a liked artist scheduled travel to your city.
  TRAVEL_ALERT: 'search',
  // Tour interest: appetite signal on a tour (owner) / invite to offer (booker)
  TOUR_INTEREST: 'tour',
  TOUR_INTEREST_INVITE: 'tour',
  TOUR_PROPOSAL: 'tour',
  TOUR_PROPOSAL_ACCEPTED: 'tour',
  TOUR_PROPOSAL_DECLINED: 'tour',
  // News feed
  CONNECTION_POSTED: 'news',
  OFFICIAL_POST: 'news',
  POST_COMMENTED: 'news',
};

const NotificationDropdown = ({ onClose, onClearNotifications, onSwitchTab }) => {
  const { t, language } = useLanguage();
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
      // Booking notifications carry the deal: land on that card, expanded.
      const dealId = notif.relatedData?.dealId;
      if (tab === 'bookings' && dealId) {
        window.dispatchEvent(new CustomEvent('tora:open-deal', { detail: { dealId } }));
      }
      const subtab = TYPE_TO_SUBTAB[notif.type];
      if (subtab) {
        window.dispatchEvent(new CustomEvent('tora:messages-subtab', { detail: { subtab } }));
      }
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
                <p>{renderNotificationText(notif, t, t('dateFormat.locale') || language)}</p>
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
