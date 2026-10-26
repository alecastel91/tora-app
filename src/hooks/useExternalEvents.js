import { useEffect, useState } from 'react';
import apiService from '../services/api';

/**
 * The owner's imported calendar events for one month, as a map
 * 'YYYY-M-D' (the grid's key format) → [event…], multi-day events on every
 * day they cover. `version` bumps re-fetch after an import changed.
 */
export default function useExternalEvents(profileId, year, month, version = 0) {
  const [byDay, setByDay] = useState({});
  useEffect(() => {
    if (!profileId) { setByDay({}); return; }
    let cancelled = false;
    const pad = (n) => String(n).padStart(2, '0');
    const from = `${year}-${pad(month + 1)}-01`;
    const to = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
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
  }, [profileId, year, month, version]);
  return byDay;
}
