import React, { useState } from 'react';
import OverlayPortal from './OverlayPortal';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';

/**
 * "Found in your calendar": the gigs and trips TORA recognised in the
 * member's imported calendar, each waiting for a decision. Confirm → the
 * day closes on the artist's calendar and a trip becomes a travel-schedule
 * entry; "Not a gig / trip" → the event stays on the grid as an ordinary
 * entry and nothing else happens. Agents pick which roster artist a row is
 * about. Nothing is applied until the member says so.
 */
const CalendarReviewSheet = ({ isOpen, profileId, review, onClose, onDecided }) => {
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState(null);
  const [edits, setEdits] = useState({}); // id → { kind, artistProfileId, city, country }

  if (!isOpen || !review) return null;
  const items = review.items || [];
  const roster = review.roster || [];
  const edit = (it) => ({ kind: it.kind, artistProfileId: it.artistProfileId || '', city: it.details?.city || '', country: it.details?.country || '', ...(edits[it.id] || {}) });
  const setEdit = (id, patch) => setEdits((m) => ({ ...m, [id]: { ...(m[id] || {}), ...patch } }));

  const decide = async (it, action) => {
    if (busyId) return;
    setBusyId(it.id);
    try {
      const e = edit(it);
      const body = { action, kind: e.kind, city: e.city, country: e.country, ...(roster.length ? { artistProfileId: e.artistProfileId || null } : {}) };
      const r = await apiService.decideCalendarEvent(profileId, it.id, body);
      showToast(action === 'confirm' ? (e.kind === 'TRAVEL' ? 'calendarSync.tripAdded' : 'calendarSync.gigAdded') : 'calendarSync.dismissed');
      onDecided(r);
    } catch (err) { appAlert(err.message || t('common.error')); } finally { setBusyId(null); }
  };

  const when = (it) => `${it.startDay}${it.endDay !== it.startDay ? ` → ${it.endDay}` : ''}${it.startTime ? ` · ${it.startTime}${it.endTime ? `–${it.endTime}` : ''}` : ''}`;

  return (
    <OverlayPortal>
      <div className="delete-modal-overlay" onClick={onClose}>
        <div className="delete-modal calendar-review-modal" onClick={(e) => e.stopPropagation()}>
          <div className="delete-modal-content">
            <h2 className="modal-title">{t('calendarSync.reviewTitle')}</h2>
            <p className="form-hint" style={{ marginTop: 0 }}>{t('calendarSync.reviewIntro')}</p>
            {items.length === 0 ? (
              <p className="form-hint">{t('calendarSync.reviewEmpty')}</p>
            ) : items.map((it) => {
              const e = edit(it);
              const busy = busyId === it.id;
              return (
                <div key={it.id} className="calendar-review-item">
                  <div className="calendar-review-head">
                    <div className="min-w-0">
                      <strong>{it.summary || t('calendarSync.unnamedEvent')}</strong>
                      <small>{when(it)}{it.location ? ` · ${it.location}` : ''}</small>
                    </div>
                    <div className="calendar-review-kind">
                      {['GIG', 'TRAVEL'].map((k) => (
                        <button key={k} type="button" className={`btn btn-sm ${e.kind === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setEdit(it.id, { kind: k })}>
                          {t(k === 'GIG' ? 'calendarSync.kindGig' : 'calendarSync.kindTrip')}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(it.details?.venue || it.details?.artist) && (
                    <small className="calendar-review-read">{[it.details.artist, it.details.venue].filter(Boolean).join(' · ')}</small>
                  )}
                  <div className="calendar-review-fields">
                    {roster.length > 0 && (
                      <select className="form-input" value={e.artistProfileId} onChange={(ev) => setEdit(it.id, { artistProfileId: ev.target.value })}>
                        <option value="">{t('calendarSync.whichArtist')}</option>
                        {roster.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                    <input type="text" className="form-input" placeholder={t('calendar.city')} value={e.city} onChange={(ev) => setEdit(it.id, { city: ev.target.value })} />
                    <input type="text" className="form-input" placeholder={t('calendar.country')} value={e.country} onChange={(ev) => setEdit(it.id, { country: ev.target.value })} />
                  </div>
                  <div className="calendar-review-actions">
                    <button type="button" className="btn btn-outline btn-sm" disabled={!!busyId} onClick={() => decide(it, 'dismiss')}>{t(e.kind === 'TRAVEL' ? 'calendarSync.notTrip' : 'calendarSync.notGig')}</button>
                    <button type="button" className="btn btn-primary btn-sm" disabled={!!busyId || (roster.length > 0 && !e.artistProfileId)} onClick={() => decide(it, 'confirm')}>{busy ? '…' : t('calendarSync.confirm')}</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="delete-modal-actions">
            <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default CalendarReviewSheet;
