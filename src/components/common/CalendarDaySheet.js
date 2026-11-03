import React from 'react';
import OverlayPortal from './OverlayPortal';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Phone calendar: everything on one day, as a bottom sheet — opened by a tap
 * on an event chip or on "+N" in the month grid (a tap on the day itself
 * keeps toggling availability, as always). Bookings open their card; events
 * from the member's own calendar show their time, place and what TORA made
 * of them; the day can be marked free or busy from here.
 *
 * info: { label, isFree, schedule, deals: [{ deal, label }], external: [event…] }
 */
const CalendarDaySheet = ({ info, locationText, onClose, onToggleFree, onOpenDeal }) => {
  const { t } = useLanguage();
  if (!info) return null;
  const nothing = !info.isFree && !info.schedule && !info.deals.length && !info.external.length;
  const kindTag = (e) => (e.kind === 'GIG' && e.status === 'CONFIRMED' ? t('calendarSync.kindGig') : e.kind === 'TRAVEL' && e.status === 'CONFIRMED' ? t('calendarSync.kindTrip') : t('calendarSync.external'));
  return (
    <OverlayPortal>
      <div className="message-modal-overlay" onClick={onClose}>
        <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
          <p className="day-sheet-date">{info.label}</p>
          <div className="day-sheet-list">
            {info.isFree && (
              <div className="day-sheet-row is-free">
                <span className="day-sheet-bar" />
                <span className="day-sheet-main"><span className="day-sheet-title">{t('calendar.available')}</span></span>
              </div>
            )}
            {info.schedule && (
              <div className="day-sheet-row is-travel">
                <span className="day-sheet-bar" />
                <span className="day-sheet-main">
                  <span className="day-sheet-title">✈ {locationText(info.schedule)}</span>
                  <span className="day-sheet-sub">{t('calendar.scheduled')}</span>
                </span>
              </div>
            )}
            {info.deals.map(({ deal, label }) => (
              <button key={deal.id} type="button" className={`day-sheet-row ${['PENDING', 'NEGOTIATING'].includes(deal.status) ? 'is-pending' : 'is-gig'}`} onClick={() => onOpenDeal(deal.id)}>
                <span className="day-sheet-bar" />
                <span className="day-sheet-main">
                  <span className="day-sheet-title">{label}</span>
                  <span className="day-sheet-sub">{t('calendarSync.openBooking')}</span>
                </span>
                <span className="day-sheet-tag">{['PENDING', 'NEGOTIATING'].includes(deal.status) ? t('calendarSync.offerTag') : t('calendarSync.kindGig')}</span>
              </button>
            ))}
            {info.external.map((e) => (
              <div key={e.id} className="day-sheet-row">
                <span className="day-sheet-bar" />
                {e.startTime && <span className="day-sheet-time">{e.startTime}{e.endTime ? `–${e.endTime}` : ''}</span>}
                <span className="day-sheet-main">
                  <span className="day-sheet-title">{e.summary || t('calendarSync.unnamedEvent')}</span>
                  {e.location && <span className="day-sheet-sub">{e.location}</span>}
                </span>
                <span className="day-sheet-tag">{kindTag(e)}</span>
              </div>
            ))}
            {nothing && <p className="day-sheet-empty">{t('calendarSync.dayNothing')}</p>}
          </div>
          <div className="day-sheet-actions">
            <button type="button" className="btn btn-outline" onClick={onToggleFree}>{info.isFree ? t('calendarSync.markBusy') : t('calendarSync.markFree')}</button>
            <button type="button" className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default CalendarDaySheet;
