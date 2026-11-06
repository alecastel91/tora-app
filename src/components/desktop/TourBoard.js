import React, { useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatEventDate } from '../../utils/dates';
import { Avatar } from './primitives';
import LoadingGlobe from '../common/LoadingGlobe';

/* Desktop v3 Tours: a list — one row per tour — with the selected tour open
   beside it, the first one until another is picked. TourScreen owns the data, filters and every action;
   the detail pane is its own tour card (renderTourKickstart({ only })), so
   edit / close to offers / proposals / interest / make an offer are the
   shipped code. Owners (artists, agents) see their tours; bookers (venues,
   promoters) see the tours open to them. */

const TourBoard = ({ tours, loading, owner, selectedId, onSelect, onPick, statusLabel, toolbar, detail }) => {
  const { t } = useLanguage();
  const locale = t('dateFormat.locale');
  const range = (tour) => `${formatEventDate(tour.startDate, locale, { month: 'short', day: 'numeric', year: undefined })} – ${formatEventDate(tour.endDate, locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  useEffect(() => {
    if (!loading && !tours.some((tour) => tour.id === selectedId)) onSelect(tours[0]?.id ?? null);
  }, [loading, tours, selectedId, onSelect]);

  return (
    <div className="d3-board d3-fill d3-tours">
      <div className="d3-panel flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] px-3 py-2.5">{toolbar}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {loading ? <LoadingGlobe label={t('tour.loadingTours')} /> : tours.length === 0 ? (
            <p className="py-14 text-center text-[13px] text-white/35">{owner ? t('tour.noToursYet') : t('tour.noActiveTours')}</p>
          ) : tours.map((tour) => {
            const title = t('tour.tourTitle', { location: tour.country || tour.zone });
            return (
              <button
                key={tour.id}
                onClick={() => onPick(tour.id)}
                className={`d3-tour-pick${tour.id === selectedId ? ' is-on' : ''}`}
              >
                {!owner && <Avatar profile={{ ...tour.artist, role: 'ARTIST' }} className="h-10 w-10 shrink-0 text-[13px]" />}
                <span className="min-w-0 flex-1">
                  <span className="d3-tour-pick-title">
                    <span className="truncate">{owner ? title : (tour.artist?.name || t('tour.unknownArtist'))}</span>
                    <span className={`tour-status tour-status--${String(tour.status).toLowerCase()}`}>{statusLabel(tour.status)}</span>
                  </span>
                  <span className="d3-tour-pick-sub">
                    {[!owner && title, range(tour), (tour.confirmedGigs === 1 ? t('tour.gigConfirmedCountOne') : t('tour.gigsConfirmedCount', { n: tour.confirmedGigs || 0 })), t('tour.interestedCountPublic', { n: tour.interestsCount || 0 }), tour.closedToOffers && tour.status === 'ACTIVE' && t('tour.fullyBooked'), !owner && tour.myProposal && t('tour.viewSentProposal')].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="d3-panel relative overflow-y-auto p-3">
        {selectedId && detail}
      </div>
    </div>
  );
};

export default TourBoard;
