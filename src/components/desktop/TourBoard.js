import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDesktopStrings } from './strings';
import { formatEventDate } from '../../utils/dates';
import { getAvatarClass } from '../../utils/roles';
import LoadingGlobe from '../common/LoadingGlobe';

/* Desktop v3 Tours: a pipeline table — one row per tour — with the selected
   tour open beside it. TourScreen owns the data, filters and every action;
   the detail pane is its own tour card (renderTourKickstart({ only })), so
   edit / close to offers / proposals / interest / make an offer are the
   shipped code. Owners (artists, agents) see their tours; bookers (venues,
   promoters) see the tours open to them. */

const STATUS = {
  ACTIVE: 'border-[#43E97B]/40 bg-[#43E97B]/10 text-[#43E97B]',
  COMPLETED: 'border-white/15 bg-white/5 text-white/55',
  CANCELLED: 'border-[#F5576C]/40 bg-[#F5576C]/10 text-[#F5576C]',
};

const TourBoard = ({ tours, loading, owner, selectedId, onSelect, statusLabel, toolbar, detail }) => {
  const { t } = useLanguage();
  const td = useDesktopStrings();
  const locale = t('dateFormat.locale');
  const range = (tour) => `${formatEventDate(tour.startDate, locale, { month: 'short', day: 'numeric', year: undefined })} — ${formatEventDate(tour.endDate, locale, { month: 'short', day: 'numeric' })}`;

  return (
    <div className="d3-board d3-fill d3-tours">
      <div className="d3-panel flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] px-3 py-2.5">{toolbar}</div>
        <div className="d3-tour-row px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
          <span className="truncate">{owner ? t('tour.tourKickstart') : t('tour.artist')}</span>
          <span className="truncate">{td('dates')}</span>
          <span className="truncate text-right">{t('tour.gigsConfirmed')}</span>
          <span className="truncate text-right">{t('tour.interestedCount')}</span>
          <span className="truncate">{owner ? t('tour.revenueTarget') : t('tour.feeRangeLabel')}</span>
          <span className="truncate">{td('colStatus')}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {loading ? <LoadingGlobe label={t('tour.loadingTours')} /> : tours.length === 0 ? (
            <p className="py-14 text-center text-[13px] text-white/35">{owner ? t('tour.noToursYet') : t('tour.noActiveTours')}</p>
          ) : tours.map((tour) => {
            const pct = Math.min(100, Math.round(((tour.totalRevenue || 0) / (tour.minRevenue || 1)) * 100));
            const selected = tour.id === selectedId;
            return (
              <button
                key={tour.id}
                onClick={() => onSelect(tour.id)}
                className={`d3-tour-row w-full cursor-pointer rounded-lg border px-1.5 py-2 text-left transition-colors
                            ${selected ? 'border-infrared/40 bg-infrared/[0.06]' : 'border-transparent hover:bg-white/[0.035]'}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {!owner && (
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[12px] font-semibold text-white ${getAvatarClass('ARTIST')}`}>
                      {tour.artist?.avatar ? <img src={tour.artist.avatar} alt="" className="h-full w-full object-cover" /> : (tour.artist?.name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-white">{owner ? t('tour.tourTitle', { location: tour.country || tour.zone }) : (tour.artist?.name || t('tour.unknownArtist'))}</span>
                    <span className="block truncate text-[11px] text-white/45">{owner ? (tour.artist?.name || tour.zone) : t('tour.tourTitle', { location: tour.country || tour.zone })}</span>
                  </span>
                </span>
                <span className="text-[12px] text-white/70">{range(tour)}</span>
                <span className="text-right font-futuristic text-[15px] font-semibold text-white">{tour.confirmedGigs || 0}</span>
                <span className="text-right font-futuristic text-[15px] font-semibold text-white/80">{tour.interestsCount || 0}</span>
                {owner ? (
                  <span className="min-w-0">
                    <span className="block text-[12px] tabular-nums text-white/75">{Math.round(tour.totalRevenue || 0).toLocaleString()} <span className="text-white/35">/ {Math.round(tour.minRevenue || 0).toLocaleString()} {tour.revenueCurrency || 'EUR'}</span></span>
                    <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-infrared" style={{ width: `${pct}%` }} /></span>
                  </span>
                ) : (
                  <span className="truncate text-[12px] text-white/70">{tour.priceOnRequest ? t('tour.priceOnRequest') : (tour.feeExpectation || '—')}</span>
                )}
                <span className="flex flex-wrap gap-1">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${STATUS[tour.status] || STATUS.COMPLETED}`}>{statusLabel(tour.status)}</span>
                  {tour.closedToOffers && tour.status === 'ACTIVE' && <span className="inline-flex items-center rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-white/50">{t('tour.fullyBooked')}</span>}
                  {!owner && tour.myProposal && <span className="inline-flex items-center rounded-full border border-infrared/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-infrared">{t('tour.viewSentProposal')}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="d3-panel relative overflow-y-auto p-3">
        {!selectedId && <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-8 text-center text-[13px] text-white/35">{td('selectTour')}</p>}
        {selectedId && detail}
      </div>
    </div>
  );
};

export default TourBoard;
