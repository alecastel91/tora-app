import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { HeartIcon } from '../../utils/icons';

/* The buttons on someone else's profile. The main one depends on who is looking:
   a venue or promoter can make an offer to an artist or agent; an artist or
   agent pitches a venue or promoter; everyone else connects, then messages.
   Connect and Message keep their rules: Message only once connected, Pending
   while a request is open. */
export function mainProfileAction(viewerRole, targetRole) {
  const books = viewerRole === 'VENUE' || viewerRole === 'PROMOTER';
  const booked = targetRole === 'ARTIST' || targetRole === 'AGENT';
  if (books && booked) return 'offer';
  if (!books && !booked && viewerRole) return 'pitch';
  return 'connect';
}

const ProfileActions = ({
  viewerRole, targetRole, isLiked, isConnected, hasPendingRequest, actionBusy,
  onLike, onMessage, onConnect, onOffer, className = '',
}) => {
  const { t } = useLanguage();
  const kind = mainProfileAction(viewerRole, targetRole);
  const connectLabel = hasPendingRequest ? t('search.pending') : (actionBusy ? '...' : t('search.connect'));
  const connectButton = (variant) => (
    <button
      type="button"
      className={`btn ${hasPendingRequest ? 'btn-disabled' : variant}`}
      onClick={onConnect}
      disabled={hasPendingRequest || actionBusy}
    >
      {connectLabel}
    </button>
  );

  let main;
  let side = null;
  if (kind === 'offer') {
    main = <button type="button" className="btn btn-primary" onClick={onOffer}>{t('tour.makeAnOffer')}</button>;
    side = isConnected
      ? <button type="button" className="btn btn-message" onClick={onMessage}>{t('search.message')}</button>
      : connectButton('btn-outline');
  } else if (isConnected) {
    main = <button type="button" className="btn btn-primary" onClick={onMessage}>{t(kind === 'pitch' ? 'pitch.send' : 'search.message')}</button>;
  } else if (kind === 'pitch') {
    main = hasPendingRequest
      ? connectButton('btn-primary')
      : <button type="button" className="btn btn-primary" onClick={onConnect} disabled={actionBusy}>{actionBusy ? '...' : t('pitch.send')}</button>;
  } else {
    main = connectButton('btn-primary');
  }

  return (
    <div className={`poster-actions ${className}`}>
      {main}
      {side}
      <button type="button" className={`btn poster-like ${isLiked ? 'btn-liked' : 'btn-outline'}`} onClick={onLike} aria-pressed={!!isLiked} aria-label={isLiked ? t('search.liked') : t('search.like')}>
        <HeartIcon filled={isLiked} />
      </button>
    </div>
  );
};

export default ProfileActions;
