import React from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appConfirm, copyText } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';
import useBusyAction from '../../hooks/useBusyAction';

/**
 * The subscribe link for this profile's TORA calendar (Google / Apple /
 * Outlook): create, copy, reset, turn off. Lives on the
 * "Calendar link & sync" page. For an agent the link covers every active
 * roster artist, so it always belongs to the viewer's own profile.
 *
 * `settings` is the `{ data, reload }` from useCalendarSettings, owned by the
 * screen. The page around it explains what the link is and how to add it.
 */
const CalendarLinkCard = ({ profileId, settings }) => {
  const { t } = useLanguage();
  const { data, reload } = settings;
  const [busy, run] = useBusyAction(reload);
  const copy = async (text) => { if (await copyText(text)) showToast('calendarSync.copied'); };

  if (!profileId || !data) return null;

  return (
    <div className="calendar-link-card">
      {!data.enabled ? (
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => apiService.enableCalendarFeed(profileId), { toast: 'calendarSync.linkCreated' })}>
          {t('calendarSync.enable')}
        </button>
      ) : (
        <>
          <div className="calendar-link-row">
            <div className="calendar-link-who">
              <strong>{t('calendarSync.linkLabel')}</strong>
              <small>{t('calendarSync.linkHint')}</small>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => copy(data.privateUrl)}>{t('calendarSync.copy')}</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={async () => {
              if (await appConfirm(t('calendarSync.resetConfirm'), { confirmLabel: t('calendarSync.reset'), danger: true })) run(() => apiService.enableCalendarFeed(profileId), { toast: 'calendarSync.linkCreated' });
            }}>{t('calendarSync.reset')}</button>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={async () => {
              if (await appConfirm(t('calendarSync.disableConfirm'), { confirmLabel: t('calendarSync.disable'), danger: true })) run(() => apiService.disableCalendarFeed(profileId));
            }}>{t('calendarSync.disable')}</button>
          </div>
        </>
      )}
    </div>
  );
};

export default CalendarLinkCard;
