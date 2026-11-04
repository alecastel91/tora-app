import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import AgencyTeamSheet from './AgencyTeamSheet';

/**
 * The agency an agent belongs to, on their profile: "{agency} · N agents".
 * Tapping opens the team. Solo agents keep `fallback` (their free-text agency
 * name).
 */
const AgencyBadge = ({ profileId, fallback = null, align = 'center', onOpenProfile }) => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    if (!profileId) return undefined;
    apiService.getAgencyOfProfile(profileId)
      .then((d) => { if (!cancelled) setData(d?.organisation ? d : null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profileId]);

  if (!data) return fallback;
  const { organisation: org } = data;

  return (
    <>
      <button
        type="button"
        className={`agency-badge ${align === 'left' ? 'agency-badge-left' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={t('agency.teamTitle', { agency: org.name })}
      >
        <span className="agency-badge-name">{org.name}</span>
        <span className="agency-badge-meta">{t('agency.badgeMeta', { n: org.memberCount })}</span>
        <span aria-hidden="true" className="agency-badge-chevron">›</span>
      </button>
      {open && <AgencyTeamSheet organisationId={org.id} onClose={() => setOpen(false)} onOpenProfile={onOpenProfile} />}
    </>
  );
};

export default AgencyBadge;
