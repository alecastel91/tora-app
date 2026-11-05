import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import useBusyAction from '../../hooks/useBusyAction';
import OverlayPortal from './OverlayPortal';
import { Avatar } from '../desktop/primitives';

// Blockers that mean "this viewer could never ask to join" — say nothing
// rather than tell a venue to add an agent profile.
const SILENT_BLOCKERS = new Set(['ORG_AGENT_PROFILE_REQUIRED']);

const place = (p) => [p.city, p.country].filter(Boolean).join(', ');

const Person = ({ person, role, onOpen }) => {
  const { t } = useLanguage();
  const where = place(person);
  return (
    <button type="button" className={`${role === 'AGENT' ? 'agency-team-row' : 'agency-team-artist'} agency-team-tap`} onClick={() => onOpen(person, role)}>
      <Avatar profile={{ name: person.name, avatar: person.avatar, role }} alt={person.name} className={role === 'AGENT' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-[11px]'} />
      <div className="min-w-0 flex-1">
        <p className="agency-team-name">
          {person.name}
          {person.role === 'ADMIN' && <span className="agency-team-admin">{t('agency.admin')}</span>}
        </p>
        {where && <p className="agency-team-place">{where}</p>}
      </div>
    </button>
  );
};

const TeamFooter = ({ org, viewer, busy, onRequest }) => {
  const { t } = useLanguage();
  const domains = (org.domains || []).join(', ');
  const blocker = viewer?.requestBlocker;
  let body = null;
  if (viewer?.isMember) {
    body = <p className="agency-team-note">{t('agency.teamMember', { agency: org.name })}</p>;
  } else if (viewer?.canRequest) {
    body = (
      <>
        <p className="agency-team-note">{t('agency.teamRequestHint', { domain: domains })}</p>
        <button type="button" className="btn btn-primary btn-sm w-full" disabled={busy} onClick={onRequest}>
          {t('agency.join', { agency: org.name })}
        </button>
      </>
    );
  } else if (blocker && !SILENT_BLOCKERS.has(blocker)) {
    body = <p className="agency-team-note">{t(`agency.blocker.${blocker}`, { agency: org.name, domain: domains })}</p>;
  }
  return body && <div className="agency-team-footer">{body}</div>;
};

/**
 * The whole agency: its agents, and under each one the artists they publicly
 * represent. Opened from a profile's agency badge or a search card. Never
 * prices. Tapping a name opens that profile. A colleague at the agency's
 * verified email domain can ask to join from here; anyone else is told why not.
 */
const AgencyTeamSheet = ({ organisationId, onClose, onOpenProfile }) => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, run] = useBusyAction();

  useEffect(() => {
    let cancelled = false;
    apiService.getAgencyTeam(organisationId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [organisationId]);

  const org = data?.organisation;
  const viewer = data?.viewer;
  const heroPhoto = org?.members?.find((m) => m.avatar)?.avatar || null;
  const artists = org ? [...new Map(org.members.flatMap((m) => m.artists).map((a) => [a.profileId, a])).values()] : [];

  const request = () => run(async () => {
    await apiService.requestToJoinOrganisation(org.id);
    setData({ ...data, viewer: { ...viewer, canRequest: false, requestBlocker: 'ORG_REQUESTED' } });
  });

  const open = (person, role) => {
    onClose();
    onOpenProfile({ id: person.profileId, name: person.name, avatar: person.avatar, role, city: person.city, country: person.country });
  };

  return (
    <OverlayPortal>
      <div className="message-modal-overlay" onClick={onClose}>
        <div className="message-modal-bottom agency-team" onClick={(e) => e.stopPropagation()}>
          {!org ? (
            <p className="agency-team-note">{failed ? t('common.error') : t('common.loading')}</p>
          ) : (
            <>
              <div className={`agency-team-hero poster-role-agent${heroPhoto ? '' : ' poster-empty'}`}>
                {heroPhoto && <img src={heroPhoto} alt="" aria-hidden />}
                <div className="agency-team-hero-text">
                  <h2 className="agency-team-hero-name">{org.name}</h2>
                  <p className="agency-team-summary">{t('agency.teamSummary', { n: org.memberCount, total: org.artistTotal })}</p>
                </div>
              </div>
              <h3 className="agency-team-heading">{t('agency.agentsHeading')}</h3>
              <ul className="agency-team-list">
                {org.members.map((m) => (
                  <li key={m.profileId}><Person person={m} role="AGENT" onOpen={open} /></li>
                ))}
              </ul>
              {artists.length > 0 && (
                <>
                  <h3 className="agency-team-heading">{t('agency.artistsHeading')}</h3>
                  <div className="agency-team-artist-grid">
                    {artists.map((a) => (
                      <button type="button" key={a.profileId} className="agency-team-artist-tile" onClick={() => open(a, 'ARTIST')}>
                        <span className="agency-team-artist-photo">
                          {a.avatar ? <img src={a.avatar} alt="" loading="lazy" /> : <span aria-hidden>{(a.name || '?').charAt(0).toUpperCase()}</span>}
                        </span>
                        <span className="agency-team-artist-name">{a.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <TeamFooter org={org} viewer={viewer} busy={busy} onRequest={request} />
            </>
          )}
          <div className="message-modal-actions">
            <button type="button" className="btn btn-outline btn-modal-cancel" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

/** A matching agency above the search results. */
export const AgencySearchCard = ({ agency, onOpen }) => {
  const { t } = useLanguage();
  return (
    <button type="button" className="agency-search-card" onClick={() => onOpen(agency.id)}>
      <span className="agency-search-label">{t('agency.searchCardLabel')}</span>
      <span className="agency-search-name">{agency.name}</span>
      <span className="agency-search-meta">{t('agency.teamSummary', { n: agency.memberCount, total: agency.artistTotal })}</span>
      <span aria-hidden="true" className="agency-badge-chevron">›</span>
    </button>
  );
};

export default AgencyTeamSheet;
