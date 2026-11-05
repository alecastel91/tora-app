import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { drawBadgeGlyph, BADGE_ACCENTS } from '../../utils/badgeArt';

/**
 * One celebration, used by everything that celebrates.
 *
 * The rule the whole system follows: celebrate completions the member CAUSED,
 * never arrivals. An offer landing in your inbox is not an achievement — and
 * if the screen erupts weekly, the moments that should feel rare stop feeling
 * like anything. So this is deliberately short, quiet, and rare.
 *
 * Two callers:
 *   - a newly earned badge (glyph from badgeArt, so it matches the flip cards
 *     the member already knows from Achievements)
 *   - the three action moments (accepted offer, signed contract, confirmed
 *     representation), which pass an icon instead
 *
 * Dismisses on tap, on Escape, or by itself. `prefers-reduced-motion` drops
 * the scale/glow animation and just shows the card.
 */
const AUTO_DISMISS_MS = 3200;

const CelebrationOverlay = ({
  photo,
  badgeKey,          // when celebrating a badge
  icon,              // when celebrating an action moment
  eyebrow,           // small label above the title
  title,
  subtitle,
  accent = '#FF3366',
  onDismiss,
}) => {
  const { t } = useLanguage();
  const dismissed = useRef(false);

  // One dismissal, whichever path fires first — the timer and a tap racing
  // each other must not call back twice.
  const finish = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    onDismiss && onDismiss();
  };

  useEffect(() => {
    const timer = setTimeout(finish, AUTO_DISMISS_MS);
    const onKey = (e) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glyphAccent = badgeKey ? (BADGE_ACCENTS[badgeKey] || accent) : accent;

  return createPortal(
    <div
      className="celebration-overlay fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6"
      onClick={finish}
      // status, not dialog: this announces itself and leaves on its own, so it
      // must not claim a modal's focus contract — a screen reader user should
      // hear it without being trapped in it.
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      {photo && (
        <>
          <img src={photo} alt="" aria-hidden className="celebration-photo" />
          <div aria-hidden className="celebration-photo-fade" />
        </>
      )}
      <div className={`celebration-card relative flex flex-col ${photo ? 'celebration-card-poster' : 'items-center text-center'}`}>
        {!photo && (
        <span
          className="celebration-glow block"
          style={{ '--celebration-accent': glyphAccent }}
        >
          {badgeKey ? (
            <span
              className="block h-[112px] w-[112px]"
              dangerouslySetInnerHTML={{ __html: drawBadgeGlyph(badgeKey, { level: 0, max: 0, locked: false }) }}
            />
          ) : (
            <span
              className="flex h-[112px] w-[112px] items-center justify-center rounded-full border-2 [&>svg]:h-12 [&>svg]:w-12"
              style={{ borderColor: glyphAccent, color: glyphAccent }}
            >
              {icon}
            </span>
          )}
        </span>
        )}

        {eyebrow && (
          <p className="mt-6 mb-0 text-[10px] uppercase tracking-[0.28em] font-tech"
             style={{ color: glyphAccent }}>
            {eyebrow}
          </p>
        )}
        <h2 className="celebration-title mt-2 mb-0 font-bold text-white font-space-grotesk">{title}</h2>
        {subtitle && (
          <p className="mt-3 mb-0 max-w-xs text-sm leading-relaxed text-white/80">{subtitle}</p>
        )}

        <p className="mt-8 mb-0 text-[10px] uppercase tracking-[0.2em] text-white/60 font-tech">
          {t('celebration.tapToContinue')}
        </p>
      </div>
    </div>,
    document.body
  );
};

export default CelebrationOverlay;
