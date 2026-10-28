import React from 'react';
import OverlayPortal from './OverlayPortal';
import { useLanguage } from '../../contexts/LanguageContext';
import { CloseIcon } from '../../utils/icons';
import { openPremium } from '../../utils/subscription';
import CalendarLinkCard from './CalendarLinkCard';
import CalendarImportsCard from './CalendarImportsCard';

/**
 * "Calendar link & sync" — one page, opened from Tour → Calendar, with the
 * three things TORA can do between its calendar and the member's own, each
 * explained in plain words before its controls:
 *   1. TORA → their calendar app (the subscribe link)
 *   2. their calendar app → TORA (imported calendars)
 *   3. gigs and trips recognised in those imports (Yearly)
 * The how-to steps sit folded under a question line, so the page stays short.
 */
const CalendarSyncScreen = ({ isOpen, onClose, profileId, isAgent, settings, review, recognising, onRecognise, onOpenReview, onEventsChanged }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  const pending = review?.items?.length || 0;

  return (
    <OverlayPortal>
      <div className="calendar-sync-sheet">
        <div className="calendar-header">
          <button className="back-btn" onClick={onClose} aria-label={t('common.close')}><CloseIcon /></button>
          <h1>{t('calendarSync.pageTitle')}</h1>
          <div style={{ width: 36 }} />
        </div>
        <div className="calendar-sync-body">
          <p className="form-hint calendar-sync-lead">{t('calendarSync.pageIntro')}</p>

          <section className="dashboard-section">
            <h3>{t('calendarSync.section1Title')}</h3>
            <p className="form-hint">{t(isAgent ? 'calendarSync.section1TextAgent' : 'calendarSync.section1Text')}</p>
            <CalendarLinkCard profileId={profileId} settings={settings} />
            <details className="help-details">
              <summary>{t('calendarSync.howToTitle')}</summary>
              <ol>
                <li>{t('calendarSync.howToGoogle')}</li>
                <li>{t('calendarSync.howToIphone')}</li>
                <li>{t('calendarSync.howToOutlook')}</li>
              </ol>
              <p>{t('calendarSync.howToNote')}</p>
            </details>
          </section>

          <section className="dashboard-section">
            <h3>{t('calendarSync.section2Title')}</h3>
            <p className="form-hint">{t('calendarSync.section2Text')}</p>
            <CalendarImportsCard profileId={profileId} settings={settings} onChanged={onEventsChanged} />
            <details className="help-details">
              <summary>{t('calendarSync.whereTitle')}</summary>
              <ol>
                <li>{t('calendarSync.whereGoogle')}</li>
                <li>{t('calendarSync.whereApple')}</li>
                <li>{t('calendarSync.whereOutlook')}</li>
              </ol>
            </details>
          </section>

          <section className="dashboard-section">
            <h3>{t('calendarSync.section3Title')}</h3>
            <p className="form-hint">{t('calendarSync.section3Text')}</p>
            {review && (
              <div className="calendar-sync-summary">
                {!review.yearly ? (
                  <>
                    <p className="form-hint m-0">{t('calendarSync.recogniseTeaser')}</p>
                    <button type="button" className="btn btn-outline btn-sm" onClick={openPremium}>{t('aiFeatures.yearlyOnly')}</button>
                  </>
                ) : pending > 0 ? (
                  <>
                    <p className="m-0 text-sm text-white">{t('calendarSync.foundLine', { gigs: review.items.filter((i) => i.kind === 'GIG').length, trips: review.items.filter((i) => i.kind === 'TRAVEL').length })}</p>
                    <button type="button" className="btn btn-primary btn-sm" onClick={onOpenReview}>{t('calendarSync.reviewButton')}</button>
                  </>
                ) : review.unread > 0 ? (
                  <>
                    <p className="form-hint m-0">{t('calendarSync.unreadLine', { n: review.unread })}</p>
                    <button type="button" className="btn btn-outline btn-sm" disabled={recognising} onClick={onRecognise}>{recognising ? '…' : t('calendarSync.recogniseNow')}</button>
                  </>
                ) : (
                  <p className="form-hint m-0">{t('calendarSync.nothingToReview')}</p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default CalendarSyncScreen;
