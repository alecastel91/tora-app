import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';

/**
 * "Someone from your agency is already on TORA." Shown on the Profile tab
 * to an agent whose domain or agency name matches an existing agency. Names
 * nobody — agency name, how many agents, how many artists — and never
 * targets anyone from the client: the request is recomputed server-side.
 * The Join button only appears once both sides have verified the same work
 * domain (anti-spam); otherwise the prompt says what is missing.
 */
const AgencyJoinPrompt = ({ userId }) => {
  const { t } = useLanguage();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const key = `tora:org-suggest-dismissed:${userId || ''}`;

  useEffect(() => {
    let cancelled = false;
    try { if (localStorage.getItem(key)) return undefined; } catch { /* storage unavailable */ }
    apiService.suggestOrganisation().then((d) => { if (!cancelled) setS(d.suggestion || null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [key]);

  if (!s) return null;
  const dismiss = () => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } setS(null); };
  const join = async () => {
    if (busy) return;
    setBusy(true);
    try { await apiService.requestToJoinOrganisation(); showToast('agency.requestSent'); setS(null); } catch (e) { appAlert(e.message || t('common.error')); } finally { setBusy(false); }
  };

  return (
    <div className="agency-prompt">
      <p className="agency-prompt-title">{t('agency.promptTitle', { agency: s.name })}</p>
      <p className="agency-prompt-body">{t('agency.promptBody', { agency: s.name })}</p>
      <p className="agency-prompt-meta">{t('agency.promptMembers', { n: s.memberCount, total: s.artistTotal })}{s.matchedDomain ? ` · ${t('agency.promptDomain', { domain: s.matchedDomain })}` : ''}</p>
      {!s.canRequest && s.requestBlocker && (
        <p className="agency-prompt-meta">{t(`agency.blocker.${s.requestBlocker}`, { agency: s.name, domain: (s.agencyDomains || []).join(', ') })}</p>
      )}
      <div className="flex gap-2 mt-3">
        {s.canRequest && <button className="btn btn-primary btn-sm" disabled={busy} onClick={join}>{t('agency.join', { agency: s.name })}</button>}
        <button className="btn btn-outline btn-sm" onClick={dismiss}>{t('agency.notNow')}</button>
      </div>
    </div>
  );
};

export default AgencyJoinPrompt;
