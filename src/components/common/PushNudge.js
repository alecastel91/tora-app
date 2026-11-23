import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getPushState, enablePush } from '../../services/push';

const DISMISS_KEY = 'tora-push-nudge-dismissed';

/**
 * Soft-ask card for notifications: shown once, never fires the native
 * permission prompt without a tap. Only rendered where push can actually be
 * enabled ('ready') — while still uninstalled on iOS, Settings → TORA App owns the
 * Add-to-Home-Screen education instead.
 */
const PushNudge = () => {
  const { t } = useLanguage();
  const [state, setState] = useState(null); // null = checking / hidden

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return undefined;
    let alive = true;
    getPushState().then((s) => {
      if (alive && s === 'ready') setState(s);
    });
    // Enabling from Settings must also retire the card.
    const onPushState = (e) => {
      if (e.detail?.state === 'subscribed') {
        localStorage.setItem(DISMISS_KEY, '1');
        setState(null);
      }
    };
    window.addEventListener('tora:push-state', onPushState);
    return () => { alive = false; window.removeEventListener('tora:push-state', onPushState); };
  }, []);

  if (!state) return null;

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setState(null); };

  const enable = async () => {
    try {
      const next = await enablePush();
      if (next === 'subscribed') dismiss();
      else setState(null); // denied or dismissed at the native prompt — don't nag
    } catch { setState(null); }
  };

  return (
    <div className="mx-4 mt-4 mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="m-0 text-sm font-semibold text-white">{t('push.title')}</p>
      <p className="m-0 mt-1 text-xs leading-relaxed text-white/60">
        {t('push.body')}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={enable}>
          {t('push.enable')}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={dismiss}>
          {t('push.later')}
        </button>
      </div>
    </div>
  );
};

export default PushNudge;
