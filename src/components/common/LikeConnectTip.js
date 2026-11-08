import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { HeartIcon } from '../../utils/icons';

const DISMISS_KEY = 'tora:tip-like-connect';
const readDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } };

/**
 * One-time explainer next to the Like / Connect buttons, worded for who is
 * looking: an artist's like says "I rate you and I'm open to playing there", a booker's like
 * keeps the artist on their radar (travel alerts on Yearly). Closing it on
 * any screen closes it everywhere; the full answer lives in Questions.
 */
const LikeConnectTip = ({ viewerRole, className = '' }) => {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(readDismissed);
  // Search list and the profile pane can both show it on desktop: close both.
  useEffect(() => {
    const hide = () => setDismissed(true);
    window.addEventListener(DISMISS_KEY, hide);
    return () => window.removeEventListener(DISMISS_KEY, hide);
  }, []);
  if (dismissed || !viewerRole) return null;
  const books = viewerRole === 'VENUE' || viewerRole === 'PROMOTER';
  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode: closes for this visit */ }
    window.dispatchEvent(new Event(DISMISS_KEY));
  };
  return (
    <div className={`like-tip ${className}`} role="note">
      <div className="like-tip-row">
        <span className="like-tip-icon"><HeartIcon /></span>
        <p>{t(books ? 'likeTip.likeBooker' : 'likeTip.likeArtist')}</p>
      </div>
      <div className="like-tip-row">
        <span className="like-tip-icon like-tip-plus" aria-hidden="true">+</span>
        <p>{t(books ? 'likeTip.connectBooker' : 'likeTip.connectArtist')}</p>
      </div>
      <button type="button" className="like-tip-close" onClick={close}>{t('likeTip.gotIt')}</button>
    </div>
  );
};

export default LikeConnectTip;
