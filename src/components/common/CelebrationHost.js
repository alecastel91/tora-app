import React, { useEffect, useState } from 'react';
import CelebrationOverlay from './CelebrationOverlay';
import { useLanguage } from '../../contexts/LanguageContext';
import { HandshakeIcon, ClipboardCheckIcon, StarIcon } from '../../utils/icons';

/**
 * The single listener for `tora:celebrate`. Mounted once, near AppDialogHost.
 *
 * Queued rather than replaced: signing a contract can earn a badge in the same
 * beat, and the second celebration cutting the first off would lose the one
 * that mattered. They play in order, one at a time.
 */
const MOMENT_ART = {
  offerAccepted: { icon: <StarIcon />, accent: '#43E97B' },
  contractSigned: { icon: <ClipboardCheckIcon />, accent: '#FF3366' },
  representationConfirmed: { icon: <HandshakeIcon />, accent: '#43E97B' },
};

const CelebrationHost = () => {
  const { t } = useLanguage();
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const onCelebrate = (e) => {
      if (!e.detail) return;
      setQueue((prev) => [...prev, { ...e.detail, id: `${Date.now()}-${prev.length}` }]);
    };
    window.addEventListener('tora:celebrate', onCelebrate);
    return () => window.removeEventListener('tora:celebrate', onCelebrate);
  }, []);

  const current = queue[0];
  if (!current) return null;

  const dismiss = () => setQueue((prev) => prev.slice(1));

  if (current.kind === 'badge') {
    return (
      <CelebrationOverlay
        key={current.id}
        badgeKey={current.badgeKey}
        eyebrow={t('celebration.badgeEyebrow')}
        title={t(`badges.${current.badgeKey}.name`)}
        subtitle={current.tier
          ? t('celebration.badgeTierSubtitle', { tier: current.tier })
          : t(`badges.${current.badgeKey}.description`)}
        onDismiss={dismiss}
      />
    );
  }

  const art = MOMENT_ART[current.moment] || {};
  return (
    <CelebrationOverlay
      key={current.id}
      icon={art.icon}
      accent={art.accent}
      eyebrow={t(`celebration.${current.moment}.eyebrow`)}
      title={t(`celebration.${current.moment}.title`)}
      subtitle={t(`celebration.${current.moment}.subtitle`, {
        name: t('celebration.thisBooking'),
        counterpart: t('celebration.theOtherParty'),
        ...Object.fromEntries(Object.entries(current.vars || {}).filter(([, v]) => v)),
      })}
      onDismiss={dismiss}
    />
  );
};

export default CelebrationHost;
