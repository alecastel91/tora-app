import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import { Avatar } from '../desktop/primitives';

// Blockers that mean "this viewer could never ask to join" — say nothing
// rather than tell a venue to add an agent profile.
const SILENT_BLOCKERS = new Set(['ORG_AGENT_PROFILE_REQUIRED']);

/**
 * The agency an agent belongs to, on their profile: "{agency} · N agents".
 * Tapping opens the team (name, city, roster size, admin), never prices.
 * A colleague at the agency's verified email domain can ask to join from
 * here; anyone else is told why they can't. Solo agents keep `fallback`
 * (their free-text agency name).
 */
const AgencyBadge = ({ profileId, fallback = null, align = 'center' }) => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
  const { organisation: org, viewer } = data;

  const request = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiService.requestToJoinOrganisation(org.id);
      setData({ ...data, viewer: { ...viewer, canRequest: false, requestBlocker: 'ORG_REQUESTED' } });
    } catch (e) {
      appAlert(e.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const blocker = viewer?.requestBlocker;
  const domains = (org.domains || []).join(', ');
  const footer = viewer?.isMember
    ? <p className="agency-team-note">{t('agency.teamMember', { agency: org.name })}</p>
    : viewer?.canRequest
      ? (
        <>
          <p className="agency-team-note">{t('agency.teamRequestHint', { domain: domains })}</p>
          <button type="button" className="btn btn-primary btn-sm w-full" disabled={busy} onClick={request}>
            {t('agency.join', { agency: org.name })}
          </button>
        </>
      )
      : blocker && !SILENT_BLOCKERS.has(blocker)
        ? <p className="agency-team-note">{t(`agency.blocker.${blocker}`, { agency: org.name, domain: domains })}</p>
        : null;

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
      {open && createPortal(
        <div className="message-modal-overlay" onClick={() => setOpen(false)}>
          <div className="message-modal-bottom agency-team" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">{t('agency.teamTitle', { agency: org.name })}</h2>
            <p className="agency-team-summary">{t('agency.teamSummary', { n: org.memberCount, total: org.artistTotal })}</p>
            <ul className="agency-team-list">
              {org.members.map((m) => (
                <li key={m.profileId} className="agency-team-row">
                  <Avatar profile={{ name: m.name, avatar: m.avatar, role: 'AGENT' }} alt={m.name} className="h-9 w-9 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="agency-team-name">
                      {m.name}
                      {m.role === 'ADMIN' && <span className="agency-team-admin">{t('agency.admin')}</span>}
                    </p>
                    {(m.city || m.country) && <p className="agency-team-place">{[m.city, m.country].filter(Boolean).join(', ')}</p>}
                  </div>
                  <span className="agency-team-count">{t('agency.rosterCount', { n: m.rosterCount })}</span>
                </li>
              ))}
            </ul>
            {footer && <div className="agency-team-footer">{footer}</div>}
            <div className="message-modal-actions">
              <button type="button" className="btn btn-outline btn-modal-cancel" onClick={() => setOpen(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default AgencyBadge;
