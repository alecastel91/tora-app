import React from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appConfirm, copyText } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';
import useBusyAction from '../../hooks/useBusyAction';

/**
 * The subscribe link for this profile's TORA calendar (Google / Apple /
 * Outlook): create, copy private or public, reset, turn off. Shown on the
 * Tour → Calendar page (phone and desktop rail). For an agent the link
 * covers every active roster artist,
 * so it always belongs to the viewer's own profile, never to a roster artist.
 *
 * `settings` is the `{ data, reload }` from useCalendarSettings, owned by the
 * screen; `compact` drops the how-to paragraph.
 */
const CalendarLinkCard = ({ profileId, settings, isAgent = false, compact = false }) => {
  const { t } = useLanguage();
  const { data, reload } = settings;
  const [busy, run] = useBusyAction(reload);
  const copy = async (text) => { if (await copyText(text)) showToast('calendarSync.copied'); };

  if (!profileId || !data) return null;
  const intro = <p className="form-hint calendar-link-intro">{isAgent ? t('calendarSync.introAgent') : t('calendarSync.intro')}</p>;

  return (
    <div className="calendar-link-card">
      {(!compact || !data.enabled) && intro}
      {!data.enabled ? (
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => apiService.enableCalendarFeed(profileId), { toast: 'calendarSync.linkCreated' })}>
          {t('calendarSync.enable')}
        </button>
      ) : (
        <>
          <div className="calendar-link-row">
            <div className="calendar-link-who">
              <strong>{t('calendarSync.privateLink')}</strong>
              <small>{t('calendarSync.privateHint')}</small>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => copy(data.privateUrl)}>{t('calendarSync.copy')}</button>
          </div>
          <div className="calendar-link-row">
            <div className="calendar-link-who">
              <strong>{t('calendarSync.publicLink')}</strong>
              <small>{t('calendarSync.publicHint')}</small>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => copy(data.publicUrl)}>{t('calendarSync.copy')}</button>
          </div>
          <label className="settings-toggle mt-2">
            <input type="checkbox" checked={!!data.showAvailable} disabled={busy} onChange={(e) => run(() => apiService.setCalendarFeedOptions(profileId, { showAvailable: e.target.checked }))} />
            <span>{t('calendarSync.includeAvailable')}</span>
          </label>
          <p className="form-hint" style={{ marginTop: 2 }}>{t('calendarSync.includeAvailableHint')}</p>
          {!compact && <p className="form-hint">{t('calendarSync.howToAdd')}</p>}
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
