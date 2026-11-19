import { useEffect, useReducer } from 'react';
import ENTRY from '../data/visitorEntry.json';
import PERMITS from '../data/performerPermits.json';
import apiService from '../services/api';

/**
 * The Travel panel's rules. The server keeps the live copy, updated by the
 * weekly check of the official sources; the bundled files are the fallback
 * until it answers (or when it can't).
 */

const day = (d) => (d ? `${d}T00:00:00Z` : null);
let state = {
  entry: ENTRY,
  permits: PERMITS,
  dates: {
    entry: { checkedAt: day(ENTRY._checkedAt), reviewedAt: day(ENTRY._checkedAt) },
    permits: { checkedAt: day(PERMITS._verifiedAt), reviewedAt: day(PERMITS._verifiedAt) },
  },
  changes: [],
};
const listeners = new Set();
let loading = null;

export const travelData = () => state;

export function loadTravelData() {
  if (!loading) {
    loading = apiService.getTravelRules()
      .then((r) => {
        if (!r?.entry || !r?.permits) return;
        state = { entry: r.entry, permits: r.permits, dates: r.dates, changes: r.changes || [] };
        listeners.forEach((fn) => fn());
      })
      // Unreachable: keep the bundled rules for this session, no retry on every mount.
      .catch(() => {});
  }
  return loading;
}

/** The rules, re-rendering once the server copy arrives. */
export function useTravelData() {
  const [, rerender] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    listeners.add(rerender);
    loadTravelData();
    return () => { listeners.delete(rerender); };
  }, []);
  return state;
}
