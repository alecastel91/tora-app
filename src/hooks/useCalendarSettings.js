import { useCallback, useEffect, useState } from 'react';
import apiService from '../services/api';

/**
 * GET /calendar/:profileId — the subscribe link + imports — owned once per
 * screen and handed to the renderers (CalendarLinkCard, the imports list),
 * so a change made in one of them is seen by the others after `reload()`.
 * `data` is null until the first load; a failed load reads as "not enabled".
 */
export default function useCalendarSettings(profileId) {
  const [data, setData] = useState(null);
  const reload = useCallback(async () => {
    if (!profileId) return;
    try { setData(await apiService.getCalendarSettings(profileId)); } catch { setData({ enabled: false, imports: [] }); }
  }, [profileId]);
  useEffect(() => { setData(null); reload(); }, [reload]);
  return { data, reload };
}
