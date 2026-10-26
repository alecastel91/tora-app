import React, { useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import useBusyAction from '../../hooks/useBusyAction';

/**
 * "Your calendars" on the Calendar page: paste the private .ics address of a
 * personal calendar (Google / Apple / Outlook) and its events appear on the
 * TORA calendar as they are — owner-only. All-day events close the open dates
 * they cover; a timed event does not. Up to three calendars.
 *
 * `settings` is the `{ data, reload }` from useCalendarSettings, owned by the
 * screen; `onChanged` fires after any change so the grid re-reads its events.
 */
const CalendarImportsCard = ({ profileId, settings, onChanged }) => {
  const { t } = useLanguage();
  const [busy, run] = useBusyAction(async () => { await settings.reload(); if (onChanged) onChanged(); });
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  const data = settings.data;
  if (!profileId || !data) return null;

  return (
    <div className="calendar-imports-card">
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
                    : t('calendarSync.lastSync', { n: i.eventCount, when: i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString() : '—' })}
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
            <button className="btn btn-primary" disabled={busy || !/^(https?|webcal):\/\/\S+/i.test(url.trim())} onClick={() => run(async () => { await apiService.addCalendarImport(profileId, url.trim(), label.trim()); setUrl(''); setLabel(''); }, { toast: 'calendarSync.connected' })}>
              {busy ? '…' : t('calendarSync.connect')}
            </button>
          </div>
          <p className="form-hint">{t('calendarSync.whereToFind')}</p>
        </div>
      )}
      {data.imports.length > 0 && (
        <button className="btn btn-outline btn-sm mt-2" disabled={busy} onClick={() => run(() => apiService.syncCalendarImports(profileId), { toast: 'calendarSync.refreshed' })}>{t('calendarSync.refresh')}</button>
      )}
    </div>
  );
};

export default CalendarImportsCard;
