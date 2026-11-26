import { useEffect, useRef } from 'react';
import { subscribeToDeals } from '../services/realtime';

const POLL_MS = 45000;

/**
 * Keeps a deals view fresh without a reload: refetches on every realtime
 * deal_update for this profile, when the app comes back to the foreground,
 * and on a slow poll while visible — the safety net for a dropped realtime
 * socket (phones suspend it in the background). `active` false pauses it
 * (a hidden tab refetches when it is shown again instead).
 */
export default function useLiveDeals(profileId, refetch, { active = true } = {}) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!profileId) return undefined;
    const run = () => { if (activeRef.current && document.visibilityState === 'visible') refetchRef.current(); };
    const unsubscribe = subscribeToDeals(profileId, run);
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', run);
    const timer = setInterval(run, POLL_MS);
    return () => {
      unsubscribe?.();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', run);
      clearInterval(timer);
    };
  }, [profileId]);
}
