import React, { useEffect, useRef, useState } from 'react';
import OverlayPortal from './OverlayPortal';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * First-login "Getting started" carousel — six swipeable slides that explain
 * the app in the user's language. Reopenable from Settings; skippable always.
 */
const SLIDES = [
  { key: 'welcome' },
  { key: 'profile' },
  { key: 'discover' },
  { key: 'book' },
  { key: 'tourKickstart' },
  { key: 'ready' },
];

const GettingStartedSheet = ({ open, onClose }) => {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const trackRef = useRef(null);

  // Reopening recreates the track at scrollLeft 0 while `index` kept its old
  // value — the dots and CTA would desync from the visible slide (a stale
  // "Let's go" would close the sheet the user just opened). Reset on open.
  useEffect(() => {
    if (open) {
      setIndex(0);
      if (trackRef.current) trackRef.current.scrollTo({ left: 0 });
    }
  }, [open]);

  if (!open) return null;

  const goTo = (i) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIndex(clamped);
    const el = trackRef.current;
    if (el) el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };
  const onScroll = () => {
    const el = trackRef.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const last = index === SLIDES.length - 1;

  return (
    <OverlayPortal><div className="onboarding-overlay">
      <div className="onboarding-sheet">
        <div aria-hidden className="auth-cover onboarding-cover" />
        <div className="onboarding-top">
          <img src="/tora_logo_white.png" alt="TORA" className="onboarding-brand-logo" />
          <button type="button" className="onboarding-skip" onClick={onClose}>
            {t('onboarding.skip')}
          </button>
        </div>

        <div className="onboarding-track" ref={trackRef} onScroll={onScroll}>
          {SLIDES.map(({ key }) => (
            <div key={key} className="onboarding-slide">
              <h2 className="onboarding-title">{t(`onboarding.${key}Title`)}</h2>
              <p className="onboarding-body">{t(`onboarding.${key}Body`)}</p>
            </div>
          ))}
        </div>

        <div className="onboarding-dots">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`${i + 1}`}
              className={`onboarding-dot ${i === index ? 'active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-full-width onboarding-next"
          onClick={() => (last ? onClose() : goTo(index + 1))}
        >
          {last ? t('onboarding.done') : t('onboarding.next')}
        </button>
      </div>
    </div></OverlayPortal>
  );
};

export default GettingStartedSheet;
