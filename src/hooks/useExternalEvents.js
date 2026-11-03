import { useEffect, useState } from 'react';
import apiService from '../services/api';

/** Fired (window) after an import, a sync or a review decision changed the owner's events: every open calendar refetches. */
export const EVENTS_CHANGED = 'tora:calendar-events-changed';
export const announceEventsChanged = () => window.dispatchEvent(new CustomEvent(EVENTS_CHANGED));

/**
 * The owner's imported calendar events between `from` and `to` (YYYY-MM-DD,
 * inclusive), as a map 'YYYY-M-D' (the grids' key format) → [event…],
 * multi-day events on every day they cover. Refetches on EVENTS_CHANGED.
 */
export function useExternalEventsRange(profileId, from, to) {
  const [byDay, setByDay] = useState({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(EVENTS_CHANGED, bump);
    return () => window.removeEventListener(EVENTS_CHANGED, bump);
  }, []);
  useEffect(() => {
    if (!profileId) { setByDay({}); return; }
    let cancelled = false;
    apiService.getCalendarEvents(profileId, from, to).then((r) => {
      if (cancelled) return;
      const map = {};
      for (const e of r.events || []) {
        for (let d = new Date(`${e.startDay}T00:00:00Z`), n = 0; n < 366; d.setUTCDate(d.getUTCDate() + 1), n++) {
          const iso = d.toISOString().slice(0, 10);
          if (iso > e.endDay) break;
          if (iso < from || iso > to) continue;
          const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
          (map[key] ||= []).push(e);
        }
      }
      setByDay(map);
    }).catch(() => { if (!cancelled) setByDay({}); });
    return () => { cancelled = true; };
  }, [profileId, from, to, tick]);
  return byDay;
}

const pad = (n) => String(n).padStart(2, '0');
/** One month of it (the Tour calendar's grid). */
export default function useExternalEvents(profileId, year, month) {
  return useExternalEventsRange(profileId, `${year}-${pad(month + 1)}-01`, `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`);
}
