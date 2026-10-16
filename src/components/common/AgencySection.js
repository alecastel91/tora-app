import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';
import { AGENT_BANDS, AGENCY_DISCOUNTS, agencySeatPrice, formatMoney, normalizeCurrency } from '../../utils/money';

/**
 * Settings → Agency. Agents of one agency link up so each pays their OWN
 * seats at the band of the agency's TOTAL artist count. One explanation,
 * one ladder, one timing rule — shown here in full, repeated in short on
 * the checkout and the Premium screen.
 */
export const AgencyLadder = ({ currency }) => {
  const { t } = useLanguage();
  const cur = normalizeCurrency(currency);
  let prev = 0;
  return (
    <table className="agency-ladder">
      <caption>{t('agency.ladderTitle')}</caption>
      <tbody>
        {AGENT_BANDS.map((b, i) => {
          const label = b.upTo === Infinity ? t('agency.ladderRowLast', { n: prev + 1 }) : t('agency.ladderRow', { range: `${prev + 1}–${b.upTo}` });
          prev = b.upTo;
          return (
            <tr key={i}>
              <td>{label}</td>
              <td className="agency-ladder-price">{formatMoney(agencySeatPrice(cur, i), cur)}{AGENCY_DISCOUNTS[i] ? <small> −{AGENCY_DISCOUNTS[i]}%</small> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export const AgencyFacts = () => {
  const { t } = useLanguage();
  return (
    <ul className="agency-facts">
      <li>{t('agency.fact1')}</li>
      <li>{t('agency.fact2')}</li>
      <li>{t('agency.fact3')}</li>
    </ul>
  );
};

const AgencySection = ({ currency, onChange }) => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const d = await apiService.getOrganisation(); setData(d); setName(d.organisation?.name || ''); if (onChange) onChange(d.organisation); } catch { setData({ organisation: null }); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, toastKey, vars) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (toastKey) showToast(toastKey, vars); await load(); } catch (e) { appAlert(e.message || t('common.error')); } finally { setBusy(false); }
  };

  if (!data) return null;
  const { organisation: org, invite, request, suggestion, hasAgentProfile } = data;
  const cur = normalizeCurrency(currency || org?.ratePerSeat?.currency);
  const rate = org ? formatMoney(org.ratePerSeat.monthly, org.ratePerSeat.currency) : null;

  return (
    <div className="settings-section agency-section">
      <h3>{t('agency.title')}</h3>
      <p className="form-hint" style={{ marginTop: 0 }}>{t('agency.howItWorks')}</p>

      {!hasAgentProfile && <p className="form-hint">{t('agency.agentProfileRequired')}</p>}

      {invite && (
        <div className="agency-card">
          <p className="m-0 text-sm text-white">{t('agency.invitedYou', { agency: invite.name })}</p>
          <p className="form-hint">{t('agency.promptMembers', { n: invite.memberCount, total: invite.artistTotal })}</p>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => apiService.respondOrganisationInvite(invite.memberId, true))}>{t('agency.accept')}</button>
            <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiService.respondOrganisationInvite(invite.memberId, false))}>{t('agency.decline')}</button>
          </div>
        </div>
      )}

      {request && (
        <div className="agency-card">
          <p className="m-0 text-sm text-white">{t('agency.requestPending', { agency: request.name })}</p>
          <button className="btn btn-outline mt-3" disabled={busy} onClick={() => run(() => apiService.withdrawOrganisationRequest())}>{t('agency.withdraw')}</button>
        </div>
      )}

      {!org && !invite && !request && suggestion && (
        <div className="agency-card">
          <p className="m-0 text-sm font-semibold text-white">{t('agency.promptTitle', { agency: suggestion.name })}</p>
          <p className="form-hint">{t('agency.promptBody', { agency: suggestion.name })}</p>
          <p className="form-hint">{t('agency.promptMembers', { n: suggestion.memberCount, total: suggestion.artistTotal })}{suggestion.matchedDomain ? ` · ${t('agency.promptDomain', { domain: suggestion.matchedDomain })}` : ''}</p>
          <button className="btn btn-primary mt-3" disabled={busy || !hasAgentProfile} onClick={() => run(() => apiService.requestToJoinOrganisation(), 'agency.requestSent')}>{t('agency.join', { agency: suggestion.name })}</button>
        </div>
      )}

      {org && (
        <>
          <p className="m-0 text-sm text-white">{t('agency.summary', { agency: org.name, total: org.artistTotal, rate })}</p>
          <p className="form-hint">{t('agency.timing')}</p>
          <ul className="agency-members">
            {org.members.map((m) => (
              <li key={m.memberId} className="agency-member">
                <span className="agency-member-avatar">{m.avatar ? <img src={m.avatar} alt="" /> : (m.name || '?').charAt(0)}</span>
                <span className="agency-member-who">
                  <strong>{m.name}{m.isMe ? ` (${t('agency.you')})` : ''}</strong>
                  <small>{t('agency.rosterCount', { n: m.rosterCount })}{m.role === 'ADMIN' ? ` · ${t('agency.admin')}` : ''}</small>
                </span>
                {org.role === 'ADMIN' && !m.isMe && (
                  <span className="flex gap-1">
                    {m.role !== 'ADMIN' && <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => run(() => apiService.decideOrganisationMember(m.memberId, 'promote'))}>{t('agency.promote')}</button>}
                    <button className="btn btn-sm btn-outline" disabled={busy} onClick={async () => { if (await appConfirm(t('agency.removeConfirm', { name: m.name, agency: org.name }), { confirmLabel: t('agency.remove'), danger: true })) run(() => apiService.removeOrganisationMember(m.memberId)); }}>{t('agency.remove')}</button>
                  </span>
                )}
              </li>
            ))}
          </ul>

          {org.role === 'ADMIN' && org.pending.length > 0 && (
            <div className="mt-3">
              {org.pending.some((p) => p.status === 'REQUESTED') && <h4 className="agency-sub">{t('agency.pendingRequests')}</h4>}
              {org.pending.filter((p) => p.status === 'REQUESTED').map((p) => (
                <div key={p.memberId} className="agency-member">
                  <span className="agency-member-who"><strong>{p.name || '—'}</strong><small>{t('agency.rosterCount', { n: p.rosterCount || 0 })}</small></span>
                  <span className="flex gap-1">
                    <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(() => apiService.decideOrganisationMember(p.memberId, 'approve'))}>{t('agency.approve')}</button>
                    <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => run(() => apiService.decideOrganisationMember(p.memberId, 'decline'))}>{t('agency.decline')}</button>
                  </span>
                </div>
              ))}
              {org.pending.some((p) => p.status === 'INVITED') && <h4 className="agency-sub">{t('agency.pendingInvites')}</h4>}
              {org.pending.filter((p) => p.status === 'INVITED').map((p) => (
                <div key={p.memberId} className="agency-member">
                  <span className="agency-member-who"><strong>{p.invitedEmail}</strong></span>
                  <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => run(() => apiService.revokeOrganisationInvite(p.memberId))}>{t('agency.revoke')}</button>
                </div>
              ))}
            </div>
          )}

          {org.role === 'ADMIN' && (
            <div className="mt-4">
              <label className="form-label">{t('agency.rename')}</label>
              <div className="flex gap-2">
                <input className="form-input flex-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
                <button className="btn btn-outline" disabled={busy || !name.trim() || name.trim() === org.name} onClick={() => run(() => apiService.renameOrganisation(name.trim()))}>{t('agency.save')}</button>
              </div>
            </div>
          )}
        </>
      )}

      {hasAgentProfile && (!org || org.role === 'ADMIN') && !invite && !request && (
        <div className="mt-4">
          <label className="form-label">{t('agency.inviteTitle')}</label>
          <div className="flex gap-2">
            <input type="email" className="form-input flex-1" placeholder={t('agency.invitePlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary" disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)} onClick={() => run(async () => { await apiService.inviteToOrganisation(email.trim()); const sent = email.trim(); setEmail(''); showToast('agency.inviteTiming', { email: sent }); })}>{t('agency.inviteSend')}</button>
          </div>
        </div>
      )}

      <AgencyLadder currency={cur} />
      <AgencyFacts />

      {org && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-outline btn-sm" disabled={busy} onClick={async () => {
            const me = org.members.find((m) => m.isMe);
            if (!me) return;
            if (await appConfirm(t('agency.leaveConfirm', { agency: org.name }), { confirmLabel: t('agency.leave'), danger: true })) run(() => apiService.removeOrganisationMember(me.memberId));
          }}>{t('agency.leave')}</button>
          {org.role === 'ADMIN' && (
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={async () => {
              if (await appConfirm(t('agency.dissolveConfirm', { agency: org.name }), { confirmLabel: t('agency.dissolve'), danger: true })) run(() => apiService.dissolveOrganisation());
            }}>{t('agency.dissolve')}</button>
          )}
        </div>
      )}
    </div>
  );
};

export default AgencySection;
