import React, { useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import CalendarLinkCard from './CalendarLinkCard';
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

  // The link card loads /calendar/:id on mount and reports it via onData;
  // this section only re-reads after one of ITS own actions (imports).
  const load = async () => {
    try { setData(await apiService.getCalendarSettings(profileId)); } catch { setData({ enabled: false, imports: [] }); }
  };

  const run = async (fn, toastKey) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (toastKey) showToast(toastKey); await load(); } catch (e) { appAlert(e.message || t('common.error')); } finally { setBusy(false); }
  };

  if (!profileId || !data) return null;
  const isAgent = profile.role === 'AGENT';

  return (
    <div className="settings-section calendar-sync-section">
      <h3>{t('calendarSync.title')}</h3>
      {/* The link itself is the shared card (also on Tour → Calendar). */}
      <CalendarLinkCard profileId={profileId} isAgent={isAgent} onData={setData} />

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
