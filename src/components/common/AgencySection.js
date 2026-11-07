import React, { useRef, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appConfirm } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';
import { Avatar } from '../desktop/primitives';
import { downscaleImageToDataUrl } from '../../utils/image';
import { agencyHeroPhoto, pendingOf } from '../../utils/agency';
import useBusyAction from '../../hooks/useBusyAction';

/**
 * Manage → Agency (agents only). Agents of one agency link up to appear as
 * one team on every member's profile. An agency never changes a price: every
 * agent pays the same flat Agent plan. Manage owns the fetch (`data`, see
 * hooks/useAgency) so its tab dot and Actions Required rows read the same
 * state; `reload` refetches after every action.
 */

/** One person row: avatar, name and meta, with the row's buttons on the right. */
const Row = ({ urgent, person, name, meta, children }) => (
  <li className={`agency-panel-row${urgent ? ' is-urgent' : ''}`}>
    {person && <Avatar profile={{ name: person.name || '?', avatar: person.avatar, role: 'AGENT' }} alt="" className="h-11 w-11 text-sm" />}
    <span className="agency-panel-who">
      <strong>{name}</strong>
      {meta && <small>{meta}</small>}
    </span>
    {children && <span className="agency-panel-row-actions">{children}</span>}
  </li>
);

const RowList = ({ title, children }) => (
  <section>
    <h3 className="agency-team-heading">{title}</h3>
    <ul className="agency-panel-list">{children}</ul>
  </section>
);

/** Rename field, keyed by the saved name so it resets when the name changes. */
const RenameForm = ({ current, busy, onSave }) => {
  const { t } = useLanguage();
  const [name, setName] = useState(current);
  return (
    <form className="agency-panel-field" onSubmit={(e) => { e.preventDefault(); onSave(name.trim()); }}>
      <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
      <button type="submit" className="btn btn-outline" disabled={busy || !name.trim() || name.trim() === current}>{t('agency.save')}</button>
    </form>
  );
};

const AgencySection = ({ data, reload, fallbackPhoto = null }) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [busy, run] = useBusyAction(reload);
  const fileRef = useRef(null);

  if (!data) return <p className="action-empty">...</p>;
  const { organisation: org, invite, request, suggestion, hasAgentProfile } = data;
  const isAdmin = org?.role === 'ADMIN';
  const requested = pendingOf(org, 'REQUESTED');
  const invited = pendingOf(org, 'INVITED');
  const heroPhoto = agencyHeroPhoto(org, fallbackPhoto);
  const me = org?.members?.find((m) => m.isMe);
  const confirmThen = async (message, label, fn) => {
    if (await appConfirm(message, { confirmLabel: label, danger: true })) run(fn);
  };
  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    // 1280 px is what the server keeps; anything larger is wasted upload.
    if (file) run(async () => apiService.setOrganisationImage(await downscaleImageToDataUrl(file, { maxDimension: 1280, quality: 0.85 })), { toast: 'agency.photoSaved' });
  };
  return (
    <div className="agency-panel">
      {org ? (
        <>
        <div className={`agency-team-hero agency-panel-hero poster-role-agent${heroPhoto ? '' : ' poster-empty'}`}>
          {heroPhoto && <img src={heroPhoto} alt="" aria-hidden />}
          <div className="agency-team-hero-text">
            <h2 className="agency-team-hero-name">{org.name}</h2>
            <p className="agency-team-summary">{t('agency.teamSummary', { n: org.members.length, total: org.artistTotal })}</p>
          </div>
          {isAdmin && (
            <div className="agency-panel-photo-actions">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickPhoto} />
              <button type="button" className="agency-panel-photo-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
                {org.imageUrl ? t('agency.changePhoto') : t('agency.addPhoto')}
              </button>
              {org.imageUrl && (
                <button type="button" className="agency-panel-photo-btn" disabled={busy} onClick={() => run(() => apiService.setOrganisationImage(null))}>{t('agency.removePhoto')}</button>
              )}
            </div>
          )}
        </div>
        {isAdmin && !org.imageUrl && <p className="agency-panel-photo-hint">{t('agency.photoHint')}</p>}
        </>
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
            <button className="btn btn-primary" disabled={busy || !hasAgentProfile} onClick={() => run(() => apiService.requestToJoinOrganisation(), { toast: 'agency.requestSent' })}>{t('agency.join', { agency: suggestion.name })}</button>
          </div>
        </section>
      )}

      {requested.length > 0 && (
        <RowList title={t('agency.pendingRequests')}>
          {requested.map((p) => (
            <Row key={p.memberId} urgent person={p} name={p.name || '—'} meta={t('agency.rosterCount', { n: p.rosterCount || 0 })}>
              <button className="btn btn-primary" disabled={busy} onClick={() => run(() => apiService.decideOrganisationMember(p.memberId, 'approve'))}>{t('agency.approve')}</button>
              <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiService.decideOrganisationMember(p.memberId, 'decline'))}>{t('agency.decline')}</button>
            </Row>
          ))}
        </RowList>
      )}

      {org && (
        <RowList title={t('agency.agentsHeading')}>
          {org.members.map((m) => (
            <Row
              key={m.memberId}
              person={m}
              name={<>{m.name}{m.isMe ? ` (${t('agency.you')})` : ''}{m.role === 'ADMIN' && <span className="agency-team-admin">{t('agency.admin')}</span>}</>}
              meta={t('agency.rosterCount', { n: m.rosterCount })}
            >
              {isAdmin && !m.isMe && (
                <>
                  {m.role !== 'ADMIN' && <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiService.decideOrganisationMember(m.memberId, 'promote'))}>{t('agency.promote')}</button>}
                  <button className="btn btn-outline" disabled={busy} onClick={() => confirmThen(t('agency.removeConfirm', { name: m.name, agency: org.name }), t('agency.remove'), () => apiService.removeOrganisationMember(m.memberId))}>{t('agency.remove')}</button>
                </>
              )}
            </Row>
          ))}
        </RowList>
      )}

      {invited.length > 0 && (
        <RowList title={t('agency.pendingInvites')}>
          {invited.map((p) => (
            <Row key={p.memberId} name={p.invitedEmail}>
              <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiService.revokeOrganisationInvite(p.memberId))}>{t('agency.revoke')}</button>
            </Row>
          ))}
        </RowList>
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
          <RenameForm key={org.name} current={org.name} busy={busy} onSave={(name) => run(() => apiService.renameOrganisation(name))} />
        </section>
      )}

      {org && (
        <div className="agency-panel-exit">
          {me && (
            <button type="button" className="agency-panel-quiet" disabled={busy} onClick={() => confirmThen(t('agency.leaveConfirm', { agency: org.name }), t('agency.leave'), () => apiService.removeOrganisationMember(me.memberId))}>{t('agency.leave')}</button>
          )}
          {isAdmin && (
            <button type="button" className="agency-panel-quiet" disabled={busy} onClick={() => confirmThen(t('agency.dissolveConfirm', { agency: org.name }), t('agency.dissolve'), () => apiService.dissolveOrganisation())}>{t('agency.dissolve')}</button>
          )}
        </div>
      )}
    </div>
  );
};

export default AgencySection;
