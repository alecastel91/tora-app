import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';

/**
 * The subscribe link for this profile's TORA calendar (Google / Apple /
 * Outlook): create, copy private or public, reset, turn off. One component,
 * shown in Settings → Calendar sync and on the Tour → Calendar page, so the
 * two never drift. For an agent the link covers every active roster artist,
 * so it always belongs to the viewer's own profile, never to a roster artist.
 *
 * `onData(data)` reports the loaded settings (imports etc.) to a parent that
 * renders more than the link; `compact` drops the how-to paragraph.
 */
const CalendarLinkCard = ({ profileId, isAgent = false, compact = false, onData = null }) => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const d = await apiService.getCalendarSettings(profileId); setData(d); if (onData) onData(d); } catch { setData({ enabled: false, imports: [] }); }
  };
  useEffect(() => { if (profileId) load(); }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, toastKey) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (toastKey) showToast(toastKey); await load(); } catch (e) { appAlert(e.message || t('common.error')); } finally { setBusy(false); }
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); showToast('calendarSync.copied'); } catch { appAlert(text); }
  };

  if (!profileId || !data) return null;

  return (
    <div className="calendar-link-card">
      {!compact && <p className="form-hint" style={{ marginTop: 0 }}>{isAgent ? t('calendarSync.introAgent') : t('calendarSync.intro')}</p>}
      {!data.enabled ? (
        <>
          {compact && <p className="form-hint" style={{ marginTop: 0 }}>{isAgent ? t('calendarSync.introAgent') : t('calendarSync.intro')}</p>}
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => apiService.enableCalendarFeed(profileId), 'calendarSync.linkCreated')}>
            {t('calendarSync.enable')}
          </button>
        </>
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
          {!compact && <p className="form-hint">{t('calendarSync.howToAdd')}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={async () => {
              if (await appConfirm(t('calendarSync.resetConfirm'), { confirmLabel: t('calendarSync.reset'), danger: true })) run(() => apiService.enableCalendarFeed(profileId), 'calendarSync.linkCreated');
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
