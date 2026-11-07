import React, { useCallback, useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';
import { Avatar } from '../desktop/primitives';

/**
 * Manage → Agency (agents only). Agents of one agency link up to appear as
 * one team on every member's profile. An agency never changes a price: every
 * agent pays the same flat Agent plan. Manage owns the fetch (`data`) so its
 * tab dot and Actions Required rows read the same state; `reload` refetches.
 */
const AgencySection = ({ data, reload, fallbackPhoto = null }) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [name, setName] = useState(data?.organisation?.name || '');
  const [busy, setBusy] = useState(false);
  const orgName = data?.organisation?.name || '';
  useEffect(() => { setName(orgName); }, [orgName]);

  const run = async (fn, toastKey, vars) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (toastKey) showToast(toastKey, vars); await reload(); } catch (e) { appAlert(e.message || t('common.error')); } finally { setBusy(false); }
  };

  if (!data) return <p className="action-empty">...</p>;
  const { organisation: org, invite, request, suggestion, hasAgentProfile } = data;
  const isAdmin = org?.role === 'ADMIN';
  const requested = isAdmin ? org.pending.filter((p) => p.status === 'REQUESTED') : [];
  const invited = isAdmin ? org.pending.filter((p) => p.status === 'INVITED') : [];
  const heroPhoto = org?.members?.find((m) => m.role === 'ADMIN' && m.avatar)?.avatar || org?.members?.find((m) => m.avatar)?.avatar || fallbackPhoto;
  const me = org?.members?.find((m) => m.isMe);

  return (
    <div className="agency-section agency-panel">
      {org ? (
        <div className={`agency-team-hero agency-panel-hero poster-role-agent${heroPhoto ? '' : ' poster-empty'}`}>
          {heroPhoto && <img src={heroPhoto} alt="" aria-hidden />}
          <div className="agency-team-hero-text">
            <h2 className="agency-team-hero-name">{org.name}</h2>
            <p className="agency-team-summary">{t('agency.teamSummary', { n: org.members.length, total: org.artistTotal })}</p>
          </div>
        </div>
      ) : (
        <header className="agency-panel-intro">
          <h2 className="agency-panel-title">{t('agency.title')}</h2>
          <p className="agency-panel-lede">{t('agency.howItWorks')}</p>
          {!hasAgentProfile && <p className="agency-panel-lede">{t('agency.agentProfileRequired')}</p>}
        </header>
      )}

      {invite && (
        <section className="agency-panel-card">
          <p className="agency-panel-card-title">{t('agency.invitedYou', { agency: invite.name })}</p>
          <p className="agency-panel-card-meta">{t('agency.promptMembers', { n: invite.memberCount, total: invite.artistTotal })}</p>
          <div className="agency-panel-buttons">
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => apiService.respondOrganisationInvite(invite.memberId, true))}>{t('agency.accept')}</button>
            <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiService.respondOrganisationInvite(invite.memberId, false))}>{t('agency.decline')}</button>
          </div>
        </section>
      )}

      {request && (
        <section className="agency-panel-card">
          <p className="agency-panel-card-title">{t('agency.requestPending', { agency: request.name })}</p>
          <div className="agency-panel-buttons">
            <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiService.withdrawOrganisationRequest())}>{t('agency.withdraw')}</button>
          </div>
        </section>
      )}

      {!org && !invite && !request && suggestion && (
        <section className="agency-panel-card">
          <p className="agency-panel-card-title">{t('agency.promptTitle', { agency: suggestion.name })}</p>
          <p className="agency-panel-card-meta">{t('agency.promptBody', { agency: suggestion.name })}</p>
          <p className="agency-panel-card-meta">{t('agency.promptMembers', { n: suggestion.memberCount, total: suggestion.artistTotal })}{suggestion.matchedDomain ? ` · ${t('agency.promptDomain', { domain: suggestion.matchedDomain })}` : ''}</p>
          <div className="agency-panel-buttons">
            <button className="btn btn-primary" disabled={busy || !hasAgentProfile} onClick={() => run(() => apiService.requestToJoinOrganisation(), 'agency.requestSent')}>{t('agency.join', { agency: suggestion.name })}</button>
          </div>
        </section>
      )}

      {requested.length > 0 && (
        <section>
          <h3 className="agency-team-heading">{t('agency.pendingRequests')}</h3>
          <ul className="agency-panel-list">
            {requested.map((p) => (
              <li key={p.memberId} className="agency-panel-row is-urgent">
                <Avatar profile={{ name: p.name || '?', avatar: p.avatar, role: 'AGENT' }} alt="" className="h-11 w-11 text-sm" />
                <span className="agency-panel-who">
                  <strong>{p.name || '—'}</strong>
                  <small>{t('agency.rosterCount', { n: p.rosterCount || 0 })}</small>
                </span>
                <span className="agency-panel-row-actions">
                  <button className="btn btn-primary" disabled={busy} onClick={() => run(() => apiService.decideOrganisationMember(p.memberId, 'approve'))}>{t('agency.approve')}</button>
                  <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiService.decideOrganisationMember(p.memberId, 'decline'))}>{t('agency.decline')}</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {org && (
        <section>
          <h3 className="agency-team-heading">{t('agency.agentsHeading')}</h3>
          <ul className="agency-panel-list">
            {org.members.map((m) => (
              <li key={m.memberId} className="agency-panel-row">
                <Avatar profile={{ name: m.name || '?', avatar: m.avatar, role: 'AGENT' }} alt="" className="h-11 w-11 text-sm" />
                <span className="agency-panel-who">
                  <strong>
                    {m.name}{m.isMe ? ` (${t('agency.you')})` : ''}
                    {m.role === 'ADMIN' && <span className="agency-team-admin">{t('agency.admin')}</span>}
                  </strong>
                  <small>{t('agency.rosterCount', { n: m.rosterCount })}</small>
                </span>
                {isAdmin && !m.isMe && (
                  <span className="agency-panel-row-actions">
                    {m.role !== 'ADMIN' && <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiService.decideOrganisationMember(m.memberId, 'promote'))}>{t('agency.promote')}</button>}
                    <button className="btn btn-outline" disabled={busy} onClick={async () => { if (await appConfirm(t('agency.removeConfirm', { name: m.name, agency: org.name }), { confirmLabel: t('agency.remove'), danger: true })) run(() => apiService.removeOrganisationMember(m.memberId)); }}>{t('agency.remove')}</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {invited.length > 0 && (
        <section>
          <h3 className="agency-team-heading">{t('agency.pendingInvites')}</h3>
          <ul className="agency-panel-list">
            {invited.map((p) => (
              <li key={p.memberId} className="agency-panel-row">
                <span className="agency-panel-who"><strong>{p.invitedEmail}</strong></span>
                <span className="agency-panel-row-actions">
                  <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiService.revokeOrganisationInvite(p.memberId))}>{t('agency.revoke')}</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasAgentProfile && (!org || isAdmin) && !invite && !request && (
        <section>
          <h3 className="agency-team-heading">{t('agency.inviteTitle')}</h3>
          <form
            className="agency-panel-field"
            onSubmit={(e) => {
              e.preventDefault();
              const sent = email.trim();
              run(async () => { await apiService.inviteToOrganisation(sent); setEmail(''); showToast('agency.inviteTiming', { email: sent }); });
            }}
          >
            <input type="email" className="form-input" placeholder={t('agency.invitePlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="btn btn-primary" disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)}>{t('agency.inviteSend')}</button>
          </form>
        </section>
      )}

      {isAdmin && (
        <section>
          <h3 className="agency-team-heading">{t('agency.rename')}</h3>
          <form
            className="agency-panel-field"
            onSubmit={(e) => { e.preventDefault(); run(() => apiService.renameOrganisation(name.trim())); }}
          >
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
            <button type="submit" className="btn btn-outline" disabled={busy || !name.trim() || name.trim() === org.name}>{t('agency.save')}</button>
          </form>
        </section>
      )}

      {org && (
        <div className="agency-panel-exit">
          {me && (
            <button type="button" className="agency-panel-quiet" disabled={busy} onClick={async () => {
              if (await appConfirm(t('agency.leaveConfirm', { agency: org.name }), { confirmLabel: t('agency.leave'), danger: true })) run(() => apiService.removeOrganisationMember(me.memberId));
            }}>{t('agency.leave')}</button>
          )}
          {isAdmin && (
            <button type="button" className="agency-panel-quiet" disabled={busy} onClick={async () => {
              if (await appConfirm(t('agency.dissolveConfirm', { agency: org.name }), { confirmLabel: t('agency.dissolve'), danger: true })) run(() => apiService.dissolveOrganisation());
            }}>{t('agency.dissolve')}</button>
          )}
        </div>
      )}
    </div>
  );
};

/** Agency state for Manage: null while loading, then the /organisations/me payload. */
export const useAgency = (enabled) => {
  const [data, setData] = useState(null);
  const reload = useCallback(async () => {
    try { setData(await apiService.getOrganisation()); } catch { setData({ organisation: null }); }
  }, []);
  useEffect(() => { if (enabled) reload(); }, [enabled, reload]);
  return [data, reload];
};

/** What in the agency needs this agent: requests to approve (admins) and an invite to answer. */
export const agencyAttention = (data) => {
  const org = data?.organisation;
  const requests = org?.role === 'ADMIN' ? org.pending.filter((p) => p.status === 'REQUESTED').length : 0;
  return { requests, agency: org?.name, invite: data?.invite || null };
};

export default AgencySection;
