import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';

/**
 * Settings → Calendar sync.
 *  - A private subscribe link (Google / Apple / Outlook) with everything,
 *    and a public one that shows only Booked / Available — the owner copies
 *    whichever they want to hand out. Reset kills the old links.
 *  - "Your calendars": paste the private .ics address of a personal calendar;
 *    TORA reads only the busy days (never titles) and closes those open dates.
 */
const CalendarSyncSection = ({ profile }) => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const profileId = profile?.id;

  const load = async () => {
    try { setData(await apiService.getCalendarSettings(profileId)); } catch { setData({ enabled: false, imports: [] }); }
  };
  useEffect(() => { if (profileId) load(); }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, toastKey) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (toastKey) showToast(toastKey); await load(); } catch (e) { appAlert(e.message || t('common.error')); } finally { setBusy(false); }
  };
  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(text); showToast(key); } catch { appAlert(text); }
  };

  if (!profileId || !data) return null;
  const isAgent = profile.role === 'AGENT';

  return (
    <div className="settings-section calendar-sync-section">
      <h3>{t('calendarSync.title')}</h3>
      <p className="form-hint" style={{ marginTop: 0 }}>{isAgent ? t('calendarSync.introAgent') : t('calendarSync.intro')}</p>

      {!data.enabled ? (
        <button className="btn btn-primary" disabled={busy} onClick={() => run(() => apiService.enableCalendarFeed(profileId), 'calendarSync.linkCreated')}>
          {t('calendarSync.enable')}
        </button>
      ) : (
        <>
          <div className="calendar-link-row">
            <div className="calendar-link-who">
              <strong>{t('calendarSync.privateLink')}</strong>
              <small>{t('calendarSync.privateHint')}</small>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => copy(data.privateUrl, 'calendarSync.copied')}>{t('calendarSync.copy')}</button>
          </div>
          <div className="calendar-link-row">
            <div className="calendar-link-who">
              <strong>{t('calendarSync.publicLink')}</strong>
              <small>{t('calendarSync.publicHint')}</small>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => copy(data.publicUrl, 'calendarSync.copied')}>{t('calendarSync.copy')}</button>
          </div>
          <p className="form-hint">{t('calendarSync.howToAdd')}</p>
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

      <h4 className="calendar-sync-sub">{t('calendarSync.importsTitle')}</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>{t('calendarSync.importsIntro')}</p>
      {data.imports.length > 0 && (
        <ul className="calendar-imports">
          {data.imports.map((i) => (
            <li key={i.id} className="calendar-import">
              <div className="min-w-0 flex-1">
                <strong>{i.label || t('calendarSync.unnamed')}</strong>
                <small>
                  {i.lastError
                    ? <span className="text-infrared">{t('calendarSync.lastError', { error: i.lastError })}</span>
                    : t('calendarSync.lastSync', { n: i.busyCount, when: i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString() : '—' })}
                </small>
              </div>
              <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(() => apiService.removeCalendarImport(profileId, i.id))}>{t('calendarSync.remove')}</button>
            </li>
          ))}
        </ul>
      )}
      {data.imports.length < (data.maxImports || 3) && (
        <div className="calendar-import-form">
          <input type="url" className="form-input" placeholder={t('calendarSync.urlPlaceholder')} value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="flex gap-2">
            <input type="text" className="form-input flex-1" placeholder={t('calendarSync.labelPlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
            <button className="btn btn-primary" disabled={busy || !/^(https?|webcal):\/\/\S+/i.test(url.trim())} onClick={() => run(async () => { await apiService.addCalendarImport(profileId, url.trim(), label.trim()); setUrl(''); setLabel(''); }, 'calendarSync.connected')}>
              {t('calendarSync.connect')}
            </button>
          </div>
          <p className="form-hint">{t('calendarSync.whereToFind')}</p>
        </div>
      )}
      {data.imports.length > 0 && (
        <button className="btn btn-outline btn-sm mt-2" disabled={busy} onClick={() => run(() => apiService.syncCalendarImports(profileId), 'calendarSync.refreshed')}>{t('calendarSync.refresh')}</button>
      )}
    </div>
  );
};

export default CalendarSyncSection;
