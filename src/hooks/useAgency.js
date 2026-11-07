import { useCallback, useEffect, useState } from 'react';
import apiService from '../services/api';
import { pendingOf } from '../utils/agency';

/** Agency state for Manage: null while loading, then the /organisations/me payload. */
export default function useAgency(enabled) {
  const [data, setData] = useState(null);
  const reload = useCallback(async () => {
    try { setData(await apiService.getOrganisation()); } catch { setData({ organisation: null }); }
  }, []);
  useEffect(() => { if (enabled) reload(); }, [enabled, reload]);
  return [data, reload];
}

/** Agency items that need this agent, as Actions Required rows: an invite to answer, requests to approve. */
export const agencyActionRows = (data, t) => {
  const org = data?.organisation;
  const requests = pendingOf(org, 'REQUESTED').length;
  return [
    data?.invite && { id: 'agency-invite', title: t('agency.invitedYou', { agency: data.invite.name }) },
    requests > 0 && { id: 'agency-requests', title: t('agency.actionRequests', { n: requests, agency: org.name }) },
  ].filter(Boolean);
};
